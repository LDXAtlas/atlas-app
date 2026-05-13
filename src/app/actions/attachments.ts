"use server";

import sharp from "sharp";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getRoleFromProfile } from "@/lib/permissions";
import type { Role } from "@/lib/permissions";
import {
  ALLOWED_MIME_TYPES,
  MAX_FILE_BYTES,
  categorizeFile,
  formatBytes,
  getFileExtension,
  sanitizeFilename,
  shouldGenerateThumbnail,
  type FileCategory,
} from "@/lib/file-utils";

// ─── Types ─────────────────────────────────────────────────
export type AttachmentEntityType =
  | "task"
  | "announcement"
  | "board_card"
  | "event"
  | "library";

export type Attachment = {
  id: string;
  organization_id: string;
  entity_type: AttachmentEntityType;
  entity_id: string;
  name: string;
  description: string | null;
  file_type: FileCategory;
  file_extension: string | null;
  size_bytes: number;
  storage_path: string;
  thumbnail_path: string | null;
  mime_type: string | null;
  uploaded_by: string;
  uploaded_at: string;
  // Joined for UI rendering.
  uploader: {
    id: string;
    full_name: string;
    avatar_color: string;
  } | null;
};

export type StorageUsage = {
  used_bytes: number;
  limit_bytes: number;
  percentage_used: number;
  formatted: { used: string; limit: string };
};

export type StorageBreakdownItem = {
  entity_type: AttachmentEntityType;
  label: string;
  count: number;
  bytes: number;
  formatted: string;
};

export type ActionResult<T = unknown> =
  | { success: true; data?: T }
  | { success: false; error: string; code?: string };

const BUCKET = "attachments";
const SIGNED_URL_TTL_SECONDS = 60 * 60; // 60 minutes — matches spec.

// ─── Auth helper ────────────────────────────────────────────
async function getAuthContext(): Promise<{
  userId: string;
  organizationId: string;
  role: Role;
} | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const slug = user.user_metadata?.organization_slug;
  if (!slug) return null;
  const { data: org } = await supabaseAdmin
    .from("organizations")
    .select("id")
    .eq("slug", slug)
    .single();
  if (!org?.id) return null;
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  return {
    userId: user.id,
    organizationId: org.id,
    role: getRoleFromProfile(profile),
  };
}

// ─── Parent-entity access checks ────────────────────────────
//
// Attachments are polymorphic, so we re-verify access against the parent
// before exposing or mutating any file. Each branch follows the same
// "is this in your org / are you allowed to touch it" pattern used by the
// underlying feature.
async function userHasParentAccess(
  ctx: { userId: string; organizationId: string; role: Role },
  entityType: AttachmentEntityType,
  entityId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  switch (entityType) {
    case "task": {
      const { data } = await supabaseAdmin
        .from("tasks")
        .select("id, organization_id")
        .eq("id", entityId)
        .maybeSingle();
      if (!data || data.organization_id !== ctx.organizationId)
        return { ok: false, error: "Task not found." };
      return { ok: true };
    }
    case "announcement": {
      const { data } = await supabaseAdmin
        .from("announcements")
        .select("id, organization_id")
        .eq("id", entityId)
        .maybeSingle();
      if (!data || data.organization_id !== ctx.organizationId)
        return { ok: false, error: "Announcement not found." };
      return { ok: true };
    }
    case "event": {
      const { data } = await supabaseAdmin
        .from("events")
        .select("id, organization_id")
        .eq("id", entityId)
        .maybeSingle();
      if (!data || data.organization_id !== ctx.organizationId)
        return { ok: false, error: "Event not found." };
      return { ok: true };
    }
    case "board_card": {
      // Card is one level removed from the org through its board.
      const { data: card } = await supabaseAdmin
        .from("board_cards")
        .select("id, board_id")
        .eq("id", entityId)
        .maybeSingle();
      if (!card) return { ok: false, error: "Card not found." };
      const { data: board } = await supabaseAdmin
        .from("boards")
        .select("id, organization_id")
        .eq("id", card.board_id)
        .maybeSingle();
      if (!board || board.organization_id !== ctx.organizationId)
        return { ok: false, error: "Card not found." };
      return { ok: true };
    }
    case "library":
      // Library is org-scoped only; no other parent. Phase 3 may add
      // folders / collections — for now any org member can attach.
      return { ok: true };
  }
}

// ─── getOrganizationStorageUsage ───────────────────────────
export async function getOrganizationStorageUsage(): Promise<
  ActionResult<StorageUsage>
> {
  const ctx = await getAuthContext();
  if (!ctx) return { success: false, error: "Not authenticated." };

  const { data, error } = await supabaseAdmin
    .from("organizations")
    .select("storage_used_bytes, storage_limit_bytes")
    .eq("id", ctx.organizationId)
    .single();
  if (error || !data) {
    console.error("[getOrganizationStorageUsage] Select error:", error?.message);
    return { success: false, error: error?.message || "Storage info unavailable." };
  }

  const used = Number(data.storage_used_bytes ?? 0);
  const limit = Number(data.storage_limit_bytes ?? 0);
  const pct = limit > 0 ? Math.min(100, (used / limit) * 100) : 0;
  return {
    success: true,
    data: {
      used_bytes: used,
      limit_bytes: limit,
      percentage_used: pct,
      formatted: { used: formatBytes(used), limit: formatBytes(limit) },
    },
  };
}

// ─── getStorageBreakdown ───────────────────────────────────
//
// Returns counts + total bytes by entity_type for the settings page.
// Single round-trip; we aggregate in JS rather than relying on a
// custom RPC, since the row count per org will stay modest.
const ENTITY_LABELS: Record<AttachmentEntityType, string> = {
  task: "Tasks",
  announcement: "Announcements",
  board_card: "Project Boards",
  event: "Events",
  library: "Library",
};

export async function getStorageBreakdown(): Promise<
  ActionResult<StorageBreakdownItem[]>
> {
  const ctx = await getAuthContext();
  if (!ctx) return { success: false, error: "Not authenticated." };

  const { data, error } = await supabaseAdmin
    .from("attachments")
    .select("entity_type, size_bytes")
    .eq("organization_id", ctx.organizationId)
    .is("deleted_at", null);
  if (error) {
    console.error("[getStorageBreakdown] Select error:", error.message);
    return { success: false, error: error.message };
  }

  const buckets: Record<
    AttachmentEntityType,
    { count: number; bytes: number }
  > = {
    task: { count: 0, bytes: 0 },
    announcement: { count: 0, bytes: 0 },
    board_card: { count: 0, bytes: 0 },
    event: { count: 0, bytes: 0 },
    library: { count: 0, bytes: 0 },
  };

  (data ?? []).forEach(
    (row: { entity_type: AttachmentEntityType; size_bytes: number }) => {
      const b = buckets[row.entity_type];
      if (!b) return;
      b.count += 1;
      b.bytes += Number(row.size_bytes ?? 0);
    },
  );

  const items: StorageBreakdownItem[] = (
    Object.keys(buckets) as AttachmentEntityType[]
  ).map((t) => ({
    entity_type: t,
    label: ENTITY_LABELS[t],
    count: buckets[t].count,
    bytes: buckets[t].bytes,
    formatted: formatBytes(buckets[t].bytes),
  }));

  return { success: true, data: items };
}

// ─── uploadAttachment ──────────────────────────────────────
export async function uploadAttachment(
  formData: FormData,
): Promise<ActionResult<Attachment>> {
  const ctx = await getAuthContext();
  if (!ctx) return { success: false, error: "Not authenticated." };

  // RLS on attachments.INSERT requires admin/staff/leader. Re-enforce here
  // since the action client uses the service-role key and would otherwise
  // bypass that policy.
  if (!["admin", "staff", "leader"].includes(ctx.role)) {
    return {
      success: false,
      error: "You don't have permission to upload files.",
      code: "FORBIDDEN",
    };
  }

  // Parse FormData.
  const file = formData.get("file");
  const entityType = formData.get("entity_type") as
    | AttachmentEntityType
    | null;
  const entityId = formData.get("entity_id") as string | null;
  const description = (formData.get("description") as string | null) || null;

  if (!(file instanceof File)) {
    return { success: false, error: "No file provided.", code: "BAD_INPUT" };
  }
  if (
    !entityType ||
    !["task", "announcement", "board_card", "event", "library"].includes(
      entityType,
    )
  ) {
    return { success: false, error: "Unknown entity_type.", code: "BAD_INPUT" };
  }
  if (!entityId) {
    return { success: false, error: "Missing entity_id.", code: "BAD_INPUT" };
  }
  if (file.size <= 0) {
    return { success: false, error: "File is empty.", code: "BAD_INPUT" };
  }
  if (file.size > MAX_FILE_BYTES) {
    return {
      success: false,
      error: `File is too large (${formatBytes(file.size)}). Max is 25 MB.`,
      code: "FILE_TOO_LARGE",
    };
  }
  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    return {
      success: false,
      error: `File type "${file.type || "unknown"}" isn't supported.`,
      code: "UNSUPPORTED_TYPE",
    };
  }

  // Parent access check.
  const access = await userHasParentAccess(ctx, entityType, entityId);
  if (!access.ok) {
    return { success: false, error: access.error, code: "NOT_FOUND" };
  }

  // Storage limit pre-check. Small race window between this check and the
  // trigger increment is acceptable for Phase 1; future versions can wrap
  // both in an advisory lock.
  const usage = await getOrganizationStorageUsage();
  if (usage.success && usage.data) {
    if (usage.data.used_bytes + file.size > usage.data.limit_bytes) {
      return {
        success: false,
        code: "STORAGE_LIMIT_EXCEEDED",
        error: `Your church has used ${usage.data.formatted.used} of ${usage.data.formatted.limit}. Uploading "${file.name}" (${formatBytes(file.size)}) would exceed your plan.`,
      };
    }
  }

  // Prepare storage paths.
  const fileId = crypto.randomUUID();
  const sanitized = sanitizeFilename(file.name);
  const extension = getFileExtension(sanitized);
  const storagePath = `${ctx.organizationId}/${entityType}/${entityId}/${fileId}_${sanitized}`;
  const category = categorizeFile(file.type, extension);

  // Load bytes once (we may need them for thumbnail generation too).
  const arrayBuffer = await file.arrayBuffer();
  const fileBuffer = Buffer.from(arrayBuffer);

  // Optional thumbnail (images only).
  let thumbnailPath: string | null = null;
  let thumbnailBuffer: Buffer | null = null;
  if (shouldGenerateThumbnail(file.type)) {
    try {
      thumbnailBuffer = await sharp(fileBuffer)
        .resize(200, 200, { fit: "inside", withoutEnlargement: true })
        .webp({ quality: 80 })
        .toBuffer();
      thumbnailPath = `${ctx.organizationId}/${entityType}/${entityId}/${fileId}_thumb.webp`;
    } catch (err) {
      // Non-fatal — store the original anyway.
      console.error("[uploadAttachment] Thumbnail generation failed:", err);
    }
  }

  // Upload the original.
  const { error: uploadError } = await supabaseAdmin.storage
    .from(BUCKET)
    .upload(storagePath, fileBuffer, {
      contentType: file.type,
      cacheControl: "3600",
      upsert: false,
    });
  if (uploadError) {
    console.error("[uploadAttachment] Storage upload error:", uploadError.message);
    return {
      success: false,
      error: "Couldn't upload the file. Try again.",
    };
  }

  // Upload the thumbnail (best effort — failure logs but doesn't roll back).
  if (thumbnailBuffer && thumbnailPath) {
    const { error: thumbError } = await supabaseAdmin.storage
      .from(BUCKET)
      .upload(thumbnailPath, thumbnailBuffer, {
        contentType: "image/webp",
        cacheControl: "3600",
        upsert: false,
      });
    if (thumbError) {
      console.error(
        "[uploadAttachment] Thumbnail upload error:",
        thumbError.message,
      );
      thumbnailPath = null; // Don't record a path that doesn't exist.
    }
  }

  // Insert row — trigger increments storage_used_bytes.
  const { data: inserted, error: insertError } = await supabaseAdmin
    .from("attachments")
    .insert({
      organization_id: ctx.organizationId,
      entity_type: entityType,
      entity_id: entityId,
      name: file.name.slice(0, 255), // preserve display name
      description,
      file_type: category,
      file_extension: extension,
      size_bytes: file.size,
      storage_path: storagePath,
      thumbnail_path: thumbnailPath,
      mime_type: file.type,
      uploaded_by: ctx.userId,
    })
    .select(
      "id, organization_id, entity_type, entity_id, name, description, file_type, file_extension, size_bytes, storage_path, thumbnail_path, mime_type, uploaded_by, uploaded_at",
    )
    .single();

  if (insertError || !inserted) {
    // Roll back the storage upload to avoid orphaned files.
    await supabaseAdmin.storage.from(BUCKET).remove([storagePath]);
    if (thumbnailPath)
      await supabaseAdmin.storage.from(BUCKET).remove([thumbnailPath]);
    console.error("[uploadAttachment] Insert error:", insertError?.message);
    return {
      success: false,
      error: insertError?.message || "Couldn't record the upload.",
    };
  }

  // Resolve uploader for the immediate UI return.
  const uploader = await resolveUploader(inserted.uploaded_by);

  // TODO (Phase 2): emit a notification when the upload targets a task /
  // board_card and the user isn't the assignee. Types 'task_attachment_added'
  // and 'board_card_attachment_added' aren't in the notifications.type
  // CHECK constraint yet — add them in a future migration before wiring.

  return {
    success: true,
    data: {
      id: inserted.id,
      organization_id: inserted.organization_id,
      entity_type: inserted.entity_type as AttachmentEntityType,
      entity_id: inserted.entity_id,
      name: inserted.name,
      description: inserted.description,
      file_type: inserted.file_type as FileCategory,
      file_extension: inserted.file_extension,
      size_bytes: Number(inserted.size_bytes),
      storage_path: inserted.storage_path,
      thumbnail_path: inserted.thumbnail_path,
      mime_type: inserted.mime_type,
      uploaded_by: inserted.uploaded_by,
      uploaded_at: inserted.uploaded_at,
      uploader,
    },
  };
}

// ─── getAttachments ────────────────────────────────────────
export async function getAttachments(
  entityType: AttachmentEntityType,
  entityId: string,
): Promise<{ data: Attachment[]; error?: string }> {
  const ctx = await getAuthContext();
  if (!ctx) return { data: [], error: "Not authenticated." };

  const access = await userHasParentAccess(ctx, entityType, entityId);
  if (!access.ok) return { data: [], error: access.error };

  const { data, error } = await supabaseAdmin
    .from("attachments")
    .select(
      "id, organization_id, entity_type, entity_id, name, description, file_type, file_extension, size_bytes, storage_path, thumbnail_path, mime_type, uploaded_by, uploaded_at",
    )
    .eq("organization_id", ctx.organizationId)
    .eq("entity_type", entityType)
    .eq("entity_id", entityId)
    .is("deleted_at", null)
    .order("uploaded_at", { ascending: false });

  if (error) {
    console.error("[getAttachments] Select error:", error.message);
    return { data: [], error: error.message };
  }

  const rows = data ?? [];
  if (rows.length === 0) return { data: [] };

  // Batched uploader join.
  const uploaderIds = Array.from(
    new Set(rows.map((r: { uploaded_by: string }) => r.uploaded_by)),
  );
  const uploaderMap = new Map<
    string,
    { id: string; full_name: string; avatar_color: string }
  >();
  if (uploaderIds.length > 0) {
    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, email")
      .in("id", uploaderIds);
    (profiles ?? []).forEach(
      (p: { id: string; full_name: string | null; email: string | null }) => {
        uploaderMap.set(p.id, {
          id: p.id,
          full_name: p.full_name || p.email?.split("@")[0] || "Unnamed",
          avatar_color: "#5CE1A5",
        });
      },
    );
  }

  const attachments: Attachment[] = rows.map(
    (
      r: {
        id: string;
        organization_id: string;
        entity_type: AttachmentEntityType;
        entity_id: string;
        name: string;
        description: string | null;
        file_type: FileCategory;
        file_extension: string | null;
        size_bytes: number;
        storage_path: string;
        thumbnail_path: string | null;
        mime_type: string | null;
        uploaded_by: string;
        uploaded_at: string;
      },
    ) => ({
      id: r.id,
      organization_id: r.organization_id,
      entity_type: r.entity_type,
      entity_id: r.entity_id,
      name: r.name,
      description: r.description,
      file_type: r.file_type,
      file_extension: r.file_extension,
      size_bytes: Number(r.size_bytes),
      storage_path: r.storage_path,
      thumbnail_path: r.thumbnail_path,
      mime_type: r.mime_type,
      uploaded_by: r.uploaded_by,
      uploaded_at: r.uploaded_at,
      uploader: uploaderMap.get(r.uploaded_by) ?? null,
    }),
  );

  return { data: attachments };
}

// ─── deleteAttachment ──────────────────────────────────────
//
// Soft-deletes the row (sets deleted_at), removes the underlying file from
// Storage, and manually decrements storage_used_bytes since the trigger
// only fires on hard DELETE.
export async function deleteAttachment(
  attachmentId: string,
): Promise<ActionResult> {
  const ctx = await getAuthContext();
  if (!ctx) return { success: false, error: "Not authenticated." };

  const { data: row } = await supabaseAdmin
    .from("attachments")
    .select(
      "id, organization_id, uploaded_by, storage_path, thumbnail_path, size_bytes, deleted_at",
    )
    .eq("id", attachmentId)
    .maybeSingle();
  if (!row || row.organization_id !== ctx.organizationId) {
    return { success: false, error: "Attachment not found." };
  }
  if (row.deleted_at) {
    // Idempotent: already soft-deleted.
    return { success: true };
  }
  if (row.uploaded_by !== ctx.userId && ctx.role !== "admin") {
    return {
      success: false,
      error: "Only the uploader or an admin can remove this file.",
    };
  }

  const nowIso = new Date().toISOString();
  const { error: updateError } = await supabaseAdmin
    .from("attachments")
    .update({ deleted_at: nowIso })
    .eq("id", attachmentId);
  if (updateError) {
    console.error("[deleteAttachment] Soft delete error:", updateError.message);
    return { success: false, error: updateError.message };
  }

  // Remove the underlying files from Storage. Errors here log but don't
  // surface — the row is already soft-deleted and a follow-up cron can
  // sweep orphans.
  const pathsToRemove: string[] = [row.storage_path];
  if (row.thumbnail_path) pathsToRemove.push(row.thumbnail_path);
  const { error: storageError } = await supabaseAdmin.storage
    .from(BUCKET)
    .remove(pathsToRemove);
  if (storageError) {
    console.error(
      "[deleteAttachment] Storage cleanup error:",
      storageError.message,
    );
  }

  // Trigger doesn't fire on soft delete — manually decrement.
  // GREATEST(0, ...) mirrors the trigger's underflow guard.
  const sizeBytes = Number(row.size_bytes || 0);
  const { data: org } = await supabaseAdmin
    .from("organizations")
    .select("storage_used_bytes")
    .eq("id", ctx.organizationId)
    .single();
  const currentUsed = Number(org?.storage_used_bytes ?? 0);
  const nextUsed = Math.max(0, currentUsed - sizeBytes);
  await supabaseAdmin
    .from("organizations")
    .update({ storage_used_bytes: nextUsed })
    .eq("id", ctx.organizationId);

  return { success: true };
}

// ─── getDownloadUrl ────────────────────────────────────────
export async function getDownloadUrl(
  attachmentId: string,
): Promise<ActionResult<{ url: string; name: string }>> {
  const ctx = await getAuthContext();
  if (!ctx) return { success: false, error: "Not authenticated." };

  const { data: row } = await supabaseAdmin
    .from("attachments")
    .select("id, organization_id, storage_path, name, deleted_at")
    .eq("id", attachmentId)
    .maybeSingle();
  if (!row || row.organization_id !== ctx.organizationId || row.deleted_at) {
    return { success: false, error: "Attachment not found." };
  }

  const { data, error } = await supabaseAdmin.storage
    .from(BUCKET)
    .createSignedUrl(row.storage_path, SIGNED_URL_TTL_SECONDS, {
      download: row.name,
    });
  if (error || !data?.signedUrl) {
    console.error("[getDownloadUrl] Sign error:", error?.message);
    return { success: false, error: error?.message || "Couldn't create download link." };
  }
  return { success: true, data: { url: data.signedUrl, name: row.name } };
}

// ─── getInlineUrl ──────────────────────────────────────────
//
// Like getDownloadUrl but without the `download` content-disposition, so
// the URL can be embedded in <img>, <iframe>, <audio>, etc.
export async function getInlineUrl(
  attachmentId: string,
): Promise<ActionResult<{ url: string }>> {
  const ctx = await getAuthContext();
  if (!ctx) return { success: false, error: "Not authenticated." };

  const { data: row } = await supabaseAdmin
    .from("attachments")
    .select("id, organization_id, storage_path, deleted_at")
    .eq("id", attachmentId)
    .maybeSingle();
  if (!row || row.organization_id !== ctx.organizationId || row.deleted_at) {
    return { success: false, error: "Attachment not found." };
  }

  const { data, error } = await supabaseAdmin.storage
    .from(BUCKET)
    .createSignedUrl(row.storage_path, SIGNED_URL_TTL_SECONDS);
  if (error || !data?.signedUrl) {
    console.error("[getInlineUrl] Sign error:", error?.message);
    return { success: false, error: error?.message || "Couldn't create link." };
  }
  return { success: true, data: { url: data.signedUrl } };
}

// ─── getThumbnailUrl ───────────────────────────────────────
export async function getThumbnailUrl(
  attachmentId: string,
): Promise<ActionResult<{ url: string } | null>> {
  const ctx = await getAuthContext();
  if (!ctx) return { success: false, error: "Not authenticated." };

  const { data: row } = await supabaseAdmin
    .from("attachments")
    .select("id, organization_id, thumbnail_path, deleted_at")
    .eq("id", attachmentId)
    .maybeSingle();
  if (!row || row.organization_id !== ctx.organizationId || row.deleted_at) {
    return { success: false, error: "Attachment not found." };
  }
  if (!row.thumbnail_path) return { success: true, data: null };

  const { data, error } = await supabaseAdmin.storage
    .from(BUCKET)
    .createSignedUrl(row.thumbnail_path, SIGNED_URL_TTL_SECONDS);
  if (error || !data?.signedUrl) {
    console.error("[getThumbnailUrl] Sign error:", error?.message);
    return { success: false, error: error?.message || "Couldn't create thumbnail link." };
  }
  return { success: true, data: { url: data.signedUrl } };
}

// ─── Helpers ───────────────────────────────────────────────
async function resolveUploader(
  userId: string,
): Promise<Attachment["uploader"]> {
  const { data } = await supabaseAdmin
    .from("profiles")
    .select("id, full_name, email")
    .eq("id", userId)
    .maybeSingle();
  if (!data) return null;
  return {
    id: data.id,
    full_name: data.full_name || data.email?.split("@")[0] || "Unnamed",
    avatar_color: "#5CE1A5",
  };
}
