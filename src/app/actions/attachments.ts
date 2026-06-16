"use server";

import sharp from "sharp";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getRoleFromProfile } from "@/lib/permissions";
import type { Role } from "@/lib/permissions";
import { deterministicAvatarColor } from "@/lib/avatar";
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
  // Nullable for direct-library uploads (entity_type='library' + entity_id=null).
  entity_id: string | null;
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
    avatar_url: string | null;
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
    { id: string; full_name: string; avatar_color: string; avatar_url: string | null }
  >();
  if (uploaderIds.length > 0) {
    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, email, avatar_url")
      .in("id", uploaderIds);
    (profiles ?? []).forEach(
      (p: {
        id: string;
        full_name: string | null;
        email: string | null;
        avatar_url: string | null;
      }) => {
        uploaderMap.set(p.id, {
          id: p.id,
          full_name: p.full_name || p.email?.split("@")[0] || "Unnamed",
          avatar_color: deterministicAvatarColor(p.id),
          avatar_url: p.avatar_url,
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
    .select("id, full_name, email, avatar_url")
    .eq("id", userId)
    .maybeSingle();
  if (!data) return null;
  return {
    id: data.id,
    full_name: data.full_name || data.email?.split("@")[0] || "Unnamed",
    avatar_color: deterministicAvatarColor(data.id),
    avatar_url: data.avatar_url ?? null,
  };
}

// ============================================================
//  Phase 3 — Library page (folders, tags, browse, detail)
// ============================================================

// ─── Phase 3 types ─────────────────────────────────────────

export type LibraryFolderVisibility = "organization" | "department" | "private";

export type LibraryFolder = {
  id: string;
  organization_id: string;
  name: string;
  parent_folder_id: string | null;
  description: string | null;
  color: string;
  icon: string;
  visibility: LibraryFolderVisibility;
  department_id: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
};

export type LibraryFolderWithCount = LibraryFolder & { file_count: number };

export type LibraryTag = {
  id: string;
  organization_id: string;
  name: string;
  color: string;
  created_by: string;
  created_at: string;
};

export type LibraryTagWithUsage = LibraryTag & { usage_count: number };

// Extended attachment row exposed to the library page. Carries the Phase 3
// columns plus joined tags and uploader, ready for the file card / row UI.
export type LibraryFile = {
  id: string;
  organization_id: string;
  entity_type: AttachmentEntityType;
  entity_id: string | null;
  folder_id: string | null;
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
  is_pinned: boolean;
  view_count: number;
  download_count: number;
  last_accessed_at: string | null;
  uploader: { id: string; full_name: string; avatar_color: string; avatar_url: string | null } | null;
  tags: LibraryTag[];
};

export type LibraryParent =
  | { kind: "task"; id: string; title: string; href: string }
  | { kind: "announcement"; id: string; title: string; href: string }
  | { kind: "event"; id: string; title: string; href: string }
  | { kind: "board_card"; id: string; title: string; board_id: string; board_name: string; href: string }
  | { kind: "library"; folder: LibraryFolder | null };

export type LibraryFileDetail = LibraryFile & {
  folder: LibraryFolder | null;
  parent: LibraryParent;
};

export type LibraryVirtualFolder =
  | "all"
  | "recent"
  | "pinned"
  | "from_tasks"
  | "from_announcements"
  | "from_events"
  | "from_boards";

export type LibraryFilter = LibraryVirtualFolder;

// ─── Internal helpers ──────────────────────────────────────

// Visibility gate applied client-side to folder rows. We mirror the RLS
// SELECT policy in JS because we read with the service-role key.
async function loadVisibleFolders(ctx: {
  userId: string;
  organizationId: string;
  role: Role;
}): Promise<LibraryFolder[]> {
  const { data, error } = await supabaseAdmin
    .from("library_folders")
    .select(
      "id, organization_id, name, parent_folder_id, description, color, icon, visibility, department_id, created_by, created_at, updated_at",
    )
    .eq("organization_id", ctx.organizationId);
  if (error || !data) {
    if (error) console.error("[loadVisibleFolders] Select error:", error.message);
    return [];
  }
  // Resolve department memberships once for the department filter.
  const { data: deptRows } = await supabaseAdmin
    .from("profile_departments")
    .select("department_id")
    .eq("profile_id", ctx.userId);
  const myDepartments = new Set(
    (deptRows ?? []).map((r: { department_id: string }) => r.department_id),
  );
  return (data as LibraryFolder[]).filter((f) => {
    if (f.visibility === "organization") return true;
    if (f.visibility === "private") return f.created_by === ctx.userId;
    if (f.visibility === "department")
      return f.department_id ? myDepartments.has(f.department_id) : false;
    return false;
  });
}

async function loadFolderForViewer(
  ctx: { userId: string; organizationId: string; role: Role },
  folderId: string,
): Promise<{ ok: true; folder: LibraryFolder } | { ok: false; error: string }> {
  const { data } = await supabaseAdmin
    .from("library_folders")
    .select(
      "id, organization_id, name, parent_folder_id, description, color, icon, visibility, department_id, created_by, created_at, updated_at",
    )
    .eq("id", folderId)
    .maybeSingle();
  if (!data || data.organization_id !== ctx.organizationId)
    return { ok: false, error: "Folder not found." };
  const folder = data as LibraryFolder;
  // Mirror the SELECT visibility rule.
  if (folder.visibility === "organization") return { ok: true, folder };
  if (folder.visibility === "private")
    return folder.created_by === ctx.userId
      ? { ok: true, folder }
      : { ok: false, error: "Folder not found." };
  if (folder.visibility === "department" && folder.department_id) {
    const { data: dept } = await supabaseAdmin
      .from("profile_departments")
      .select("profile_id")
      .eq("profile_id", ctx.userId)
      .eq("department_id", folder.department_id)
      .maybeSingle();
    return dept
      ? { ok: true, folder }
      : { ok: false, error: "Folder not found." };
  }
  return { ok: false, error: "Folder not found." };
}

// Tile of access semantics: only the creator or an admin can mutate a folder.
function canMutateFolder(
  folder: LibraryFolder,
  ctx: { userId: string; role: Role },
): boolean {
  return folder.created_by === ctx.userId || ctx.role === "admin";
}

// Joined uploader + tags hydrator for a batch of attachment rows.
async function hydrateLibraryFiles(
  rows: {
    id: string;
    organization_id: string;
    entity_type: AttachmentEntityType;
    entity_id: string | null;
    folder_id: string | null;
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
    is_pinned: boolean | null;
    view_count: number | null;
    download_count: number | null;
    last_accessed_at: string | null;
  }[],
): Promise<LibraryFile[]> {
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);
  const uploaderIds = Array.from(new Set(rows.map((r) => r.uploaded_by)));

  const [{ data: profiles }, { data: tagJoins }] = await Promise.all([
    supabaseAdmin
      .from("profiles")
      .select("id, full_name, email, avatar_url")
      .in("id", uploaderIds),
    supabaseAdmin
      .from("attachment_tags")
      .select(
        "attachment_id, library_tags(id, organization_id, name, color, created_by, created_at)",
      )
      .in("attachment_id", ids),
  ]);

  const uploaderById = new Map<
    string,
    { id: string; full_name: string; avatar_color: string; avatar_url: string | null }
  >();
  (profiles ?? []).forEach(
    (p: {
      id: string;
      full_name: string | null;
      email: string | null;
      avatar_url: string | null;
    }) => {
      uploaderById.set(p.id, {
        id: p.id,
        full_name:
          p.full_name || p.email?.split("@")[0] || "Unnamed",
        avatar_color: deterministicAvatarColor(p.id),
        avatar_url: p.avatar_url,
      });
    },
  );

  const tagsByAttachment = new Map<string, LibraryTag[]>();
  (tagJoins ?? []).forEach(
    (j: {
      attachment_id: string;
      library_tags: LibraryTag | LibraryTag[] | null;
    }) => {
      const t = Array.isArray(j.library_tags)
        ? j.library_tags[0]
        : j.library_tags;
      if (!t) return;
      const arr = tagsByAttachment.get(j.attachment_id) ?? [];
      arr.push(t);
      tagsByAttachment.set(j.attachment_id, arr);
    },
  );

  return rows.map((r) => ({
    id: r.id,
    organization_id: r.organization_id,
    entity_type: r.entity_type,
    entity_id: r.entity_id,
    folder_id: r.folder_id,
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
    is_pinned: !!r.is_pinned,
    view_count: r.view_count ?? 0,
    download_count: r.download_count ?? 0,
    last_accessed_at: r.last_accessed_at,
    uploader: uploaderById.get(r.uploaded_by) ?? null,
    tags: tagsByAttachment.get(r.id) ?? [],
  }));
}

// ─── Folder management ─────────────────────────────────────

export async function getLibraryFolders(): Promise<
  ActionResult<LibraryFolder[]>
> {
  const ctx = await getAuthContext();
  if (!ctx) return { success: false, error: "Not authenticated." };
  const folders = await loadVisibleFolders(ctx);
  return { success: true, data: folders };
}

// Returns folders plus a count of (non-deleted) attachments per folder.
// Used by the sidebar tree to render badges.
export async function getFolderTree(): Promise<
  ActionResult<LibraryFolderWithCount[]>
> {
  const ctx = await getAuthContext();
  if (!ctx) return { success: false, error: "Not authenticated." };
  const folders = await loadVisibleFolders(ctx);
  if (folders.length === 0) return { success: true, data: [] };

  const { data: rows } = await supabaseAdmin
    .from("attachments")
    .select("folder_id")
    .in("folder_id", folders.map((f) => f.id))
    .is("deleted_at", null);
  const counts = new Map<string, number>();
  (rows ?? []).forEach((r: { folder_id: string | null }) => {
    if (!r.folder_id) return;
    counts.set(r.folder_id, (counts.get(r.folder_id) ?? 0) + 1);
  });

  return {
    success: true,
    data: folders.map((f) => ({ ...f, file_count: counts.get(f.id) ?? 0 })),
  };
}

export async function createLibraryFolder(input: {
  name: string;
  parentFolderId?: string | null;
  color?: string | null;
  icon?: string | null;
  description?: string | null;
  visibility?: LibraryFolderVisibility;
  departmentId?: string | null;
}): Promise<ActionResult<LibraryFolder>> {
  const ctx = await getAuthContext();
  if (!ctx) return { success: false, error: "Not authenticated." };
  if (!["admin", "staff", "leader"].includes(ctx.role))
    return {
      success: false,
      error: "Only admins, staff, and leaders can create library folders.",
      code: "FORBIDDEN",
    };

  const name = input.name.trim();
  if (!name)
    return { success: false, error: "Folder name is required.", code: "BAD_INPUT" };

  // Validate parent (if any) is visible to the user.
  if (input.parentFolderId) {
    const parent = await loadFolderForViewer(ctx, input.parentFolderId);
    if (!parent.ok)
      return { success: false, error: "Parent folder not found.", code: "NOT_FOUND" };
  }

  const visibility: LibraryFolderVisibility = input.visibility ?? "organization";
  const departmentId =
    visibility === "department" ? input.departmentId ?? null : null;
  if (visibility === "department" && !departmentId)
    return {
      success: false,
      error: "Pick a department for a department-scoped folder.",
      code: "BAD_INPUT",
    };

  const { data, error } = await supabaseAdmin
    .from("library_folders")
    .insert({
      organization_id: ctx.organizationId,
      name,
      parent_folder_id: input.parentFolderId ?? null,
      description: input.description?.trim() || null,
      color: input.color || "#6B7280",
      icon: input.icon || "Folder",
      visibility,
      department_id: departmentId,
      created_by: ctx.userId,
    })
    .select(
      "id, organization_id, name, parent_folder_id, description, color, icon, visibility, department_id, created_by, created_at, updated_at",
    )
    .single();
  if (error || !data) {
    console.error("[createLibraryFolder] Insert error:", error?.message);
    return { success: false, error: error?.message || "Couldn't create folder." };
  }
  revalidatePath("/workspace/library");
  return { success: true, data: data as LibraryFolder };
}

export async function updateLibraryFolder(
  folderId: string,
  data: {
    name?: string;
    description?: string | null;
    color?: string;
    icon?: string;
    visibility?: LibraryFolderVisibility;
    departmentId?: string | null;
  },
): Promise<ActionResult<LibraryFolder>> {
  const ctx = await getAuthContext();
  if (!ctx) return { success: false, error: "Not authenticated." };
  const access = await loadFolderForViewer(ctx, folderId);
  if (!access.ok) return { success: false, error: access.error };
  if (!canMutateFolder(access.folder, ctx))
    return { success: false, error: "You can't edit this folder.", code: "FORBIDDEN" };

  const update: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (typeof data.name === "string" && data.name.trim())
    update.name = data.name.trim();
  if ("description" in data)
    update.description = data.description?.trim() || null;
  if (typeof data.color === "string") update.color = data.color;
  if (typeof data.icon === "string") update.icon = data.icon;
  if (data.visibility) {
    update.visibility = data.visibility;
    update.department_id =
      data.visibility === "department"
        ? data.departmentId ?? access.folder.department_id
        : null;
    if (data.visibility === "department" && !update.department_id)
      return {
        success: false,
        error: "Pick a department for a department-scoped folder.",
        code: "BAD_INPUT",
      };
  } else if ("departmentId" in data) {
    update.department_id = data.departmentId ?? null;
  }

  const { data: row, error } = await supabaseAdmin
    .from("library_folders")
    .update(update)
    .eq("id", folderId)
    .select(
      "id, organization_id, name, parent_folder_id, description, color, icon, visibility, department_id, created_by, created_at, updated_at",
    )
    .single();
  if (error || !row) {
    console.error("[updateLibraryFolder] Update error:", error?.message);
    return { success: false, error: error?.message || "Couldn't save." };
  }
  revalidatePath("/workspace/library");
  return { success: true, data: row as LibraryFolder };
}

// Folder delete with two cascade options:
//  - 'move_to_root': files inside the folder lose their folder_id (set to
//    null) but are otherwise untouched.
//  - 'delete_files': soft-delete every attachment that lives in this folder.
//    Storage usage is decremented manually because the trigger only fires
//    on hard DELETE.
export async function deleteLibraryFolder(
  folderId: string,
  options: { cascade: "move_to_root" | "delete_files" },
): Promise<ActionResult> {
  const ctx = await getAuthContext();
  if (!ctx) return { success: false, error: "Not authenticated." };
  const access = await loadFolderForViewer(ctx, folderId);
  if (!access.ok) return { success: false, error: access.error };
  if (!canMutateFolder(access.folder, ctx))
    return {
      success: false,
      error: "You can't delete this folder.",
      code: "FORBIDDEN",
    };

  if (options.cascade === "move_to_root") {
    // Children of this folder also lose their parent_folder_id via the
    // ON DELETE CASCADE pattern would nuke them — set parent to null first.
    await supabaseAdmin
      .from("library_folders")
      .update({ parent_folder_id: null })
      .eq("parent_folder_id", folderId);
    // Files lose folder_id automatically thanks to ON DELETE SET NULL.
  } else {
    // Soft-delete every non-deleted file in this folder + recurse children.
    // We only handle one level here; UI prevents deleting non-empty trees
    // without confirmation. A deeper recursion is doable but out of scope.
    const { data: files } = await supabaseAdmin
      .from("attachments")
      .select("id, size_bytes")
      .eq("folder_id", folderId)
      .is("deleted_at", null);
    if (files && files.length > 0) {
      const ids = (files as { id: string }[]).map((f) => f.id);
      await supabaseAdmin
        .from("attachments")
        .update({ deleted_at: new Date().toISOString() })
        .in("id", ids);
      const totalBytes = (
        files as { size_bytes: number }[]
      ).reduce((s, f) => s + Number(f.size_bytes ?? 0), 0);
      if (totalBytes > 0) {
        // Recompute used_bytes safely via two-step read + update.
        const { data: org } = await supabaseAdmin
          .from("organizations")
          .select("storage_used_bytes")
          .eq("id", ctx.organizationId)
          .single();
        const next = Math.max(0, (org?.storage_used_bytes ?? 0) - totalBytes);
        await supabaseAdmin
          .from("organizations")
          .update({ storage_used_bytes: next })
          .eq("id", ctx.organizationId);
      }
    }
  }

  const { error } = await supabaseAdmin
    .from("library_folders")
    .delete()
    .eq("id", folderId);
  if (error) {
    console.error("[deleteLibraryFolder] Delete error:", error.message);
    return { success: false, error: error.message };
  }
  revalidatePath("/workspace/library");
  return { success: true };
}

export async function moveLibraryFolder(
  folderId: string,
  newParentFolderId: string | null,
): Promise<ActionResult<LibraryFolder>> {
  const ctx = await getAuthContext();
  if (!ctx) return { success: false, error: "Not authenticated." };
  const access = await loadFolderForViewer(ctx, folderId);
  if (!access.ok) return { success: false, error: access.error };
  if (!canMutateFolder(access.folder, ctx))
    return { success: false, error: "You can't move this folder.", code: "FORBIDDEN" };

  if (newParentFolderId) {
    if (newParentFolderId === folderId)
      return { success: false, error: "A folder can't be its own parent." };
    const parent = await loadFolderForViewer(ctx, newParentFolderId);
    if (!parent.ok)
      return { success: false, error: "Parent folder not found.", code: "NOT_FOUND" };
    // Cycle detection: walk up the parent chain.
    let cursor: string | null = parent.folder.parent_folder_id;
    const seen = new Set<string>([newParentFolderId]);
    while (cursor) {
      if (cursor === folderId)
        return {
          success: false,
          error: "Can't move a folder into one of its own descendants.",
        };
      if (seen.has(cursor)) break;
      seen.add(cursor);
      const { data: row } = await supabaseAdmin
        .from("library_folders")
        .select("parent_folder_id")
        .eq("id", cursor)
        .maybeSingle();
      cursor = (row?.parent_folder_id as string | null) ?? null;
    }
  }

  const { data: row, error } = await supabaseAdmin
    .from("library_folders")
    .update({
      parent_folder_id: newParentFolderId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", folderId)
    .select(
      "id, organization_id, name, parent_folder_id, description, color, icon, visibility, department_id, created_by, created_at, updated_at",
    )
    .single();
  if (error || !row) {
    console.error("[moveLibraryFolder] Update error:", error?.message);
    return { success: false, error: error?.message || "Couldn't move." };
  }
  revalidatePath("/workspace/library");
  return { success: true, data: row as LibraryFolder };
}

// ─── Library tags ──────────────────────────────────────────

export async function getLibraryTags(): Promise<
  ActionResult<LibraryTagWithUsage[]>
> {
  const ctx = await getAuthContext();
  if (!ctx) return { success: false, error: "Not authenticated." };

  const [{ data: tags, error }, { data: junctions }] = await Promise.all([
    supabaseAdmin
      .from("library_tags")
      .select(
        "id, organization_id, name, color, created_by, created_at",
      )
      .eq("organization_id", ctx.organizationId)
      .order("name", { ascending: true }),
    // Restrict the count to attachments inside the same org so the
    // service-role read doesn't leak any cross-org noise.
    supabaseAdmin
      .from("attachment_tags")
      .select("tag_id, attachments!inner(organization_id)")
      .eq("attachments.organization_id", ctx.organizationId),
  ]);
  if (error) {
    console.error("[getLibraryTags] Select error:", error.message);
    return { success: false, error: error.message };
  }
  const counts = new Map<string, number>();
  (junctions ?? []).forEach((r: { tag_id: string }) => {
    counts.set(r.tag_id, (counts.get(r.tag_id) ?? 0) + 1);
  });
  return {
    success: true,
    data: (tags ?? []).map((t) => ({
      ...(t as LibraryTag),
      usage_count: counts.get(t.id) ?? 0,
    })),
  };
}

export async function createLibraryTag(
  name: string,
  color: string,
): Promise<ActionResult<LibraryTag>> {
  const ctx = await getAuthContext();
  if (!ctx) return { success: false, error: "Not authenticated." };
  if (!["admin", "staff", "leader"].includes(ctx.role))
    return {
      success: false,
      error: "Only admins, staff, and leaders can manage tags.",
      code: "FORBIDDEN",
    };

  const trimmed = name.trim();
  if (!trimmed)
    return { success: false, error: "Tag name is required.", code: "BAD_INPUT" };

  const { data, error } = await supabaseAdmin
    .from("library_tags")
    .insert({
      organization_id: ctx.organizationId,
      name: trimmed,
      color: color || "#6B7280",
      created_by: ctx.userId,
    })
    .select("id, organization_id, name, color, created_by, created_at")
    .single();
  if (error || !data) {
    // 23505 = unique violation on (organization_id, name).
    if (error?.code === "23505")
      return {
        success: false,
        error: "A tag with that name already exists.",
        code: "DUPLICATE",
      };
    console.error("[createLibraryTag] Insert error:", error?.message);
    return { success: false, error: error?.message || "Couldn't create tag." };
  }
  revalidatePath("/workspace/library");
  return { success: true, data: data as LibraryTag };
}

export async function updateLibraryTag(
  tagId: string,
  data: { name?: string; color?: string },
): Promise<ActionResult<LibraryTag>> {
  const ctx = await getAuthContext();
  if (!ctx) return { success: false, error: "Not authenticated." };
  if (!["admin", "staff", "leader"].includes(ctx.role))
    return {
      success: false,
      error: "Only admins, staff, and leaders can manage tags.",
      code: "FORBIDDEN",
    };

  const update: Record<string, unknown> = {};
  if (typeof data.name === "string" && data.name.trim())
    update.name = data.name.trim();
  if (typeof data.color === "string") update.color = data.color;
  if (Object.keys(update).length === 0)
    return { success: false, error: "Nothing to update.", code: "BAD_INPUT" };

  const { data: row, error } = await supabaseAdmin
    .from("library_tags")
    .update(update)
    .eq("id", tagId)
    .eq("organization_id", ctx.organizationId)
    .select("id, organization_id, name, color, created_by, created_at")
    .single();
  if (error || !row) {
    if (error?.code === "23505")
      return {
        success: false,
        error: "A tag with that name already exists.",
        code: "DUPLICATE",
      };
    console.error("[updateLibraryTag] Update error:", error?.message);
    return { success: false, error: error?.message || "Couldn't save." };
  }
  revalidatePath("/workspace/library");
  return { success: true, data: row as LibraryTag };
}

export async function deleteLibraryTag(
  tagId: string,
): Promise<ActionResult> {
  const ctx = await getAuthContext();
  if (!ctx) return { success: false, error: "Not authenticated." };
  if (!["admin", "staff", "leader"].includes(ctx.role))
    return {
      success: false,
      error: "Only admins, staff, and leaders can manage tags.",
      code: "FORBIDDEN",
    };

  // FK ON DELETE CASCADE on attachment_tags.tag_id handles the junctions.
  const { error } = await supabaseAdmin
    .from("library_tags")
    .delete()
    .eq("id", tagId)
    .eq("organization_id", ctx.organizationId);
  if (error) {
    console.error("[deleteLibraryTag] Delete error:", error.message);
    return { success: false, error: error.message };
  }
  revalidatePath("/workspace/library");
  return { success: true };
}

export async function addTagToAttachment(
  attachmentId: string,
  tagId: string,
): Promise<ActionResult> {
  const ctx = await getAuthContext();
  if (!ctx) return { success: false, error: "Not authenticated." };

  // Confirm both attachment + tag live in the caller's org.
  const [{ data: att }, { data: tag }] = await Promise.all([
    supabaseAdmin
      .from("attachments")
      .select("id, organization_id, uploaded_by, deleted_at")
      .eq("id", attachmentId)
      .maybeSingle(),
    supabaseAdmin
      .from("library_tags")
      .select("id, organization_id")
      .eq("id", tagId)
      .maybeSingle(),
  ]);
  if (!att || att.organization_id !== ctx.organizationId || att.deleted_at)
    return { success: false, error: "Attachment not found." };
  if (!tag || tag.organization_id !== ctx.organizationId)
    return { success: false, error: "Tag not found." };
  // Mirror the RLS rule on attachment_tags.INSERT — uploader, admin, or
  // staff can tag.
  if (
    att.uploaded_by !== ctx.userId &&
    !["admin", "staff"].includes(ctx.role)
  )
    return {
      success: false,
      error: "You can't tag this file.",
      code: "FORBIDDEN",
    };

  const { error } = await supabaseAdmin
    .from("attachment_tags")
    .insert({ attachment_id: attachmentId, tag_id: tagId });
  if (error) {
    if (error.code === "23505") return { success: true }; // already tagged
    console.error("[addTagToAttachment] Insert error:", error.message);
    return { success: false, error: error.message };
  }
  revalidatePath("/workspace/library");
  return { success: true };
}

export async function removeTagFromAttachment(
  attachmentId: string,
  tagId: string,
): Promise<ActionResult> {
  const ctx = await getAuthContext();
  if (!ctx) return { success: false, error: "Not authenticated." };

  const { data: att } = await supabaseAdmin
    .from("attachments")
    .select("id, organization_id, uploaded_by")
    .eq("id", attachmentId)
    .maybeSingle();
  if (!att || att.organization_id !== ctx.organizationId)
    return { success: false, error: "Attachment not found." };
  if (
    att.uploaded_by !== ctx.userId &&
    !["admin", "staff"].includes(ctx.role)
  )
    return {
      success: false,
      error: "You can't untag this file.",
      code: "FORBIDDEN",
    };

  const { error } = await supabaseAdmin
    .from("attachment_tags")
    .delete()
    .eq("attachment_id", attachmentId)
    .eq("tag_id", tagId);
  if (error) {
    console.error("[removeTagFromAttachment] Delete error:", error.message);
    return { success: false, error: error.message };
  }
  revalidatePath("/workspace/library");
  return { success: true };
}

// ─── File browsing ─────────────────────────────────────────

export type LibraryFileOptions = {
  /** null = root (folder_id IS NULL + entity_type='library'). undefined = no folder filter. */
  folderId?: string | null;
  filter?: LibraryFilter;
  tagIds?: string[];
  fileTypes?: FileCategory[];
  search?: string;
  uploadedBy?: string;
  sortBy?:
    | "name_asc"
    | "name_desc"
    | "date_newest"
    | "date_oldest"
    | "size_largest"
    | "size_smallest";
  limit?: number;
  cursor?: string;
};

export type LibraryFilesPage = {
  files: LibraryFile[];
  nextCursor: string | null;
};

export async function getLibraryFiles(
  options: LibraryFileOptions = {},
): Promise<ActionResult<LibraryFilesPage>> {
  const ctx = await getAuthContext();
  if (!ctx) return { success: false, error: "Not authenticated." };

  const limit = Math.min(Math.max(1, options.limit ?? 60), 200);

  let query = supabaseAdmin
    .from("attachments")
    .select(
      "id, organization_id, entity_type, entity_id, folder_id, name, description, file_type, file_extension, size_bytes, storage_path, thumbnail_path, mime_type, uploaded_by, uploaded_at, is_pinned, view_count, download_count, last_accessed_at",
    )
    .eq("organization_id", ctx.organizationId)
    .is("deleted_at", null);

  // Folder filter takes priority over `filter`. folderId === null means
  // "library root" (direct uploads with no folder). undefined means no
  // folder constraint at all.
  if (options.folderId === null) {
    query = query.is("folder_id", null).eq("entity_type", "library");
  } else if (typeof options.folderId === "string") {
    // Verify the viewer can see this folder before exposing its contents.
    const access = await loadFolderForViewer(ctx, options.folderId);
    if (!access.ok) return { success: false, error: access.error };
    query = query.eq("folder_id", options.folderId);
  } else {
    switch (options.filter ?? "all") {
      case "all":
        break;
      case "recent": {
        const threshold = new Date(
          Date.now() - 30 * 24 * 60 * 60 * 1000,
        ).toISOString();
        query = query.gte("uploaded_at", threshold);
        break;
      }
      case "pinned":
        query = query.eq("is_pinned", true);
        break;
      case "from_tasks":
        query = query.eq("entity_type", "task");
        break;
      case "from_announcements":
        query = query.eq("entity_type", "announcement");
        break;
      case "from_events":
        query = query.eq("entity_type", "event");
        break;
      case "from_boards":
        query = query.eq("entity_type", "board_card");
        break;
    }
  }

  if (options.fileTypes && options.fileTypes.length > 0)
    query = query.in("file_type", options.fileTypes);
  if (options.uploadedBy)
    query = query.eq("uploaded_by", options.uploadedBy);
  if (options.search && options.search.trim()) {
    const safe = options.search.trim().replace(/[%_]/g, "\\$&");
    query = query.ilike("name", `%${safe}%`);
  }

  // Tag filter: fetch attachment ids that have ALL the requested tags.
  if (options.tagIds && options.tagIds.length > 0) {
    const { data: tagRows } = await supabaseAdmin
      .from("attachment_tags")
      .select("attachment_id, tag_id")
      .in("tag_id", options.tagIds);
    const byAttachment = new Map<string, Set<string>>();
    (tagRows ?? []).forEach(
      (r: { attachment_id: string; tag_id: string }) => {
        const s = byAttachment.get(r.attachment_id) ?? new Set<string>();
        s.add(r.tag_id);
        byAttachment.set(r.attachment_id, s);
      },
    );
    const matchIds = Array.from(byAttachment.entries())
      .filter(([, set]) =>
        options.tagIds!.every((t) => set.has(t)),
      )
      .map(([id]) => id);
    if (matchIds.length === 0)
      return { success: true, data: { files: [], nextCursor: null } };
    query = query.in("id", matchIds);
  }

  // Sort.
  switch (options.sortBy ?? "date_newest") {
    case "name_asc":
      query = query.order("name", { ascending: true });
      break;
    case "name_desc":
      query = query.order("name", { ascending: false });
      break;
    case "date_newest":
      query = query.order("uploaded_at", { ascending: false });
      break;
    case "date_oldest":
      query = query.order("uploaded_at", { ascending: true });
      break;
    case "size_largest":
      query = query.order("size_bytes", { ascending: false });
      break;
    case "size_smallest":
      query = query.order("size_bytes", { ascending: true });
      break;
  }
  // Stable tiebreaker so cursors stay deterministic.
  query = query.order("id", { ascending: true }).limit(limit + 1);

  const { data, error } = await query;
  if (error) {
    console.error("[getLibraryFiles] Select error:", error.message);
    return { success: false, error: error.message };
  }

  const rows = (data ?? []) as Parameters<typeof hydrateLibraryFiles>[0];
  const hasMore = rows.length > limit;
  const visible = hasMore ? rows.slice(0, limit) : rows;
  const files = await hydrateLibraryFiles(visible);
  return {
    success: true,
    data: {
      files,
      nextCursor: hasMore ? visible[visible.length - 1]?.id ?? null : null,
    },
  };
}

// ─── File mutations ───────────────────────────────────────

export async function moveAttachmentToFolder(
  attachmentId: string,
  folderId: string | null,
): Promise<ActionResult> {
  const ctx = await getAuthContext();
  if (!ctx) return { success: false, error: "Not authenticated." };

  const { data: att } = await supabaseAdmin
    .from("attachments")
    .select("id, organization_id, uploaded_by, deleted_at")
    .eq("id", attachmentId)
    .maybeSingle();
  if (!att || att.organization_id !== ctx.organizationId || att.deleted_at)
    return { success: false, error: "Attachment not found." };
  if (
    att.uploaded_by !== ctx.userId &&
    !["admin", "staff"].includes(ctx.role)
  )
    return {
      success: false,
      error: "You can't move this file.",
      code: "FORBIDDEN",
    };

  if (folderId) {
    const access = await loadFolderForViewer(ctx, folderId);
    if (!access.ok) return { success: false, error: access.error };
  }

  const { error } = await supabaseAdmin
    .from("attachments")
    .update({ folder_id: folderId })
    .eq("id", attachmentId);
  if (error) {
    console.error("[moveAttachmentToFolder] Update error:", error.message);
    return { success: false, error: error.message };
  }
  revalidatePath("/workspace/library");
  return { success: true };
}

// Copies an attachment as a new standalone Library file. Storage bytes
// are duplicated on disk and accounted for by the INSERT trigger.
export async function copyAttachment(
  attachmentId: string,
  targetFolderId: string | null,
): Promise<ActionResult<LibraryFile>> {
  const ctx = await getAuthContext();
  if (!ctx) return { success: false, error: "Not authenticated." };

  const { data: source } = await supabaseAdmin
    .from("attachments")
    .select(
      "id, organization_id, name, description, file_type, file_extension, size_bytes, storage_path, thumbnail_path, mime_type, deleted_at",
    )
    .eq("id", attachmentId)
    .maybeSingle();
  if (!source || source.organization_id !== ctx.organizationId || source.deleted_at)
    return { success: false, error: "Source file not found." };

  if (targetFolderId) {
    const access = await loadFolderForViewer(ctx, targetFolderId);
    if (!access.ok) return { success: false, error: access.error };
  }

  // Storage limit precheck.
  const usage = await getOrganizationStorageUsage();
  if (
    usage.success &&
    usage.data &&
    usage.data.used_bytes + Number(source.size_bytes) > usage.data.limit_bytes
  ) {
    return {
      success: false,
      code: "STORAGE_LIMIT_EXCEEDED",
      error:
        "Copying this file would exceed your storage limit. Free up space or upgrade.",
    };
  }

  const fileId = crypto.randomUUID();
  const sanitized = sanitizeFilename(source.name);
  const newPath = `${ctx.organizationId}/library/${targetFolderId ?? "root"}/${fileId}_${sanitized}`;

  // Copy the bytes in storage.
  const { data: download, error: dlErr } = await supabaseAdmin.storage
    .from(BUCKET)
    .download(source.storage_path);
  if (dlErr || !download) {
    console.error("[copyAttachment] Download error:", dlErr?.message);
    return { success: false, error: "Couldn't read the source file." };
  }
  const buffer = Buffer.from(await download.arrayBuffer());
  const { error: upErr } = await supabaseAdmin.storage
    .from(BUCKET)
    .upload(newPath, buffer, {
      contentType: source.mime_type || "application/octet-stream",
      upsert: false,
    });
  if (upErr) {
    console.error("[copyAttachment] Upload error:", upErr.message);
    return { success: false, error: "Couldn't write the copy." };
  }

  // Thumbnail: clone the path if one exists. We re-upload from the
  // original bytes so the copy works even if the source thumbnail is
  // missing (Phase 1 best-effort flow).
  let newThumbPath: string | null = null;
  if (source.thumbnail_path) {
    const { data: thumbDl } = await supabaseAdmin.storage
      .from(BUCKET)
      .download(source.thumbnail_path);
    if (thumbDl) {
      newThumbPath = `${ctx.organizationId}/library/${targetFolderId ?? "root"}/${fileId}_thumb.webp`;
      const thumbBuf = Buffer.from(await thumbDl.arrayBuffer());
      const { error: thumbErr } = await supabaseAdmin.storage
        .from(BUCKET)
        .upload(newThumbPath, thumbBuf, {
          contentType: "image/webp",
          upsert: false,
        });
      if (thumbErr) newThumbPath = null;
    }
  }

  const { data: inserted, error: insertErr } = await supabaseAdmin
    .from("attachments")
    .insert({
      organization_id: ctx.organizationId,
      entity_type: "library",
      entity_id: null,
      folder_id: targetFolderId,
      name: source.name,
      description: source.description,
      file_type: source.file_type,
      file_extension: source.file_extension,
      size_bytes: source.size_bytes,
      storage_path: newPath,
      thumbnail_path: newThumbPath,
      mime_type: source.mime_type,
      uploaded_by: ctx.userId,
    })
    .select(
      "id, organization_id, entity_type, entity_id, folder_id, name, description, file_type, file_extension, size_bytes, storage_path, thumbnail_path, mime_type, uploaded_by, uploaded_at, is_pinned, view_count, download_count, last_accessed_at",
    )
    .single();
  if (insertErr || !inserted) {
    // Roll back storage uploads.
    await supabaseAdmin.storage.from(BUCKET).remove([newPath]);
    if (newThumbPath)
      await supabaseAdmin.storage.from(BUCKET).remove([newThumbPath]);
    console.error("[copyAttachment] Insert error:", insertErr?.message);
    return {
      success: false,
      error: insertErr?.message || "Couldn't record the copy.",
    };
  }

  const [hydrated] = await hydrateLibraryFiles([
    inserted as Parameters<typeof hydrateLibraryFiles>[0][number],
  ]);
  revalidatePath("/workspace/library");
  return { success: true, data: hydrated };
}

export async function pinAttachment(
  attachmentId: string,
): Promise<ActionResult> {
  return setAttachmentPinned(attachmentId, true);
}

export async function unpinAttachment(
  attachmentId: string,
): Promise<ActionResult> {
  return setAttachmentPinned(attachmentId, false);
}

async function setAttachmentPinned(
  attachmentId: string,
  pinned: boolean,
): Promise<ActionResult> {
  const ctx = await getAuthContext();
  if (!ctx) return { success: false, error: "Not authenticated." };
  const { data: att } = await supabaseAdmin
    .from("attachments")
    .select("id, organization_id, uploaded_by")
    .eq("id", attachmentId)
    .maybeSingle();
  if (!att || att.organization_id !== ctx.organizationId)
    return { success: false, error: "Attachment not found." };
  if (
    att.uploaded_by !== ctx.userId &&
    !["admin", "staff"].includes(ctx.role)
  )
    return { success: false, error: "You can't pin this file.", code: "FORBIDDEN" };
  const { error } = await supabaseAdmin
    .from("attachments")
    .update({ is_pinned: pinned })
    .eq("id", attachmentId);
  if (error) {
    console.error("[setAttachmentPinned] Update error:", error.message);
    return { success: false, error: error.message };
  }
  revalidatePath("/workspace/library");
  return { success: true };
}

export async function renameAttachment(
  attachmentId: string,
  newName: string,
): Promise<ActionResult> {
  const ctx = await getAuthContext();
  if (!ctx) return { success: false, error: "Not authenticated." };
  const trimmed = newName.trim();
  if (!trimmed)
    return { success: false, error: "Name is required.", code: "BAD_INPUT" };

  const { data: att } = await supabaseAdmin
    .from("attachments")
    .select("id, organization_id, uploaded_by")
    .eq("id", attachmentId)
    .maybeSingle();
  if (!att || att.organization_id !== ctx.organizationId)
    return { success: false, error: "Attachment not found." };
  if (
    att.uploaded_by !== ctx.userId &&
    !["admin", "staff"].includes(ctx.role)
  )
    return {
      success: false,
      error: "You can't rename this file.",
      code: "FORBIDDEN",
    };

  const { error } = await supabaseAdmin
    .from("attachments")
    .update({ name: trimmed.slice(0, 255) })
    .eq("id", attachmentId);
  if (error) {
    console.error("[renameAttachment] Update error:", error.message);
    return { success: false, error: error.message };
  }
  revalidatePath("/workspace/library");
  return { success: true };
}

export async function updateAttachmentDescription(
  attachmentId: string,
  description: string,
): Promise<ActionResult> {
  const ctx = await getAuthContext();
  if (!ctx) return { success: false, error: "Not authenticated." };
  const { data: att } = await supabaseAdmin
    .from("attachments")
    .select("id, organization_id, uploaded_by")
    .eq("id", attachmentId)
    .maybeSingle();
  if (!att || att.organization_id !== ctx.organizationId)
    return { success: false, error: "Attachment not found." };
  if (
    att.uploaded_by !== ctx.userId &&
    !["admin", "staff"].includes(ctx.role)
  )
    return {
      success: false,
      error: "You can't edit this file's description.",
      code: "FORBIDDEN",
    };
  const { error } = await supabaseAdmin
    .from("attachments")
    .update({ description: description.trim() || null })
    .eq("id", attachmentId);
  if (error) {
    console.error("[updateAttachmentDescription] Update error:", error.message);
    return { success: false, error: error.message };
  }
  revalidatePath("/workspace/library");
  return { success: true };
}

export async function getAttachmentDetail(
  attachmentId: string,
): Promise<ActionResult<LibraryFileDetail>> {
  const ctx = await getAuthContext();
  if (!ctx) return { success: false, error: "Not authenticated." };

  const { data, error } = await supabaseAdmin
    .from("attachments")
    .select(
      "id, organization_id, entity_type, entity_id, folder_id, name, description, file_type, file_extension, size_bytes, storage_path, thumbnail_path, mime_type, uploaded_by, uploaded_at, is_pinned, view_count, download_count, last_accessed_at, deleted_at",
    )
    .eq("id", attachmentId)
    .maybeSingle();
  if (error) {
    console.error("[getAttachmentDetail] Select error:", error.message);
    return { success: false, error: error.message };
  }
  if (
    !data ||
    data.organization_id !== ctx.organizationId ||
    data.deleted_at
  )
    return { success: false, error: "Attachment not found." };

  const [hydrated] = await hydrateLibraryFiles([
    data as Parameters<typeof hydrateLibraryFiles>[0][number],
  ]);

  // Resolve folder + parent entity for the "Where this file is used" block.
  let folder: LibraryFolder | null = null;
  if (hydrated.folder_id) {
    const { data: f } = await supabaseAdmin
      .from("library_folders")
      .select(
        "id, organization_id, name, parent_folder_id, description, color, icon, visibility, department_id, created_by, created_at, updated_at",
      )
      .eq("id", hydrated.folder_id)
      .maybeSingle();
    folder = (f as LibraryFolder | null) ?? null;
  }

  let parent: LibraryParent;
  switch (hydrated.entity_type) {
    case "task": {
      const { data: t } = await supabaseAdmin
        .from("tasks")
        .select("id, title")
        .eq("id", hydrated.entity_id ?? "")
        .maybeSingle();
      parent = {
        kind: "task",
        id: t?.id ?? hydrated.entity_id ?? "",
        title: t?.title ?? "Task",
        href: `/workspace/tasks?task=${hydrated.entity_id}`,
      };
      break;
    }
    case "announcement": {
      const { data: a } = await supabaseAdmin
        .from("announcements")
        .select("id, title")
        .eq("id", hydrated.entity_id ?? "")
        .maybeSingle();
      parent = {
        kind: "announcement",
        id: a?.id ?? hydrated.entity_id ?? "",
        title: a?.title ?? "Announcement",
        href: `/workspace/announcements`,
      };
      break;
    }
    case "event": {
      const { data: e } = await supabaseAdmin
        .from("events")
        .select("id, title")
        .eq("id", hydrated.entity_id ?? "")
        .maybeSingle();
      parent = {
        kind: "event",
        id: e?.id ?? hydrated.entity_id ?? "",
        title: e?.title ?? "Event",
        href: `/workspace/calendar`,
      };
      break;
    }
    case "board_card": {
      const { data: c } = await supabaseAdmin
        .from("board_cards")
        .select("id, title, board_id")
        .eq("id", hydrated.entity_id ?? "")
        .maybeSingle();
      const { data: b } = c?.board_id
        ? await supabaseAdmin
            .from("boards")
            .select("name")
            .eq("id", c.board_id)
            .maybeSingle()
        : { data: null };
      parent = {
        kind: "board_card",
        id: c?.id ?? hydrated.entity_id ?? "",
        title: c?.title ?? "Card",
        board_id: (c?.board_id as string) ?? "",
        board_name: b?.name ?? "Board",
        href: c?.board_id
          ? `/workspace/projects/${c.board_id}`
          : `/workspace/projects`,
      };
      break;
    }
    case "library":
      parent = { kind: "library", folder };
      break;
  }

  return {
    success: true,
    data: { ...hydrated, folder, parent } as LibraryFileDetail,
  };
}

// Direct-library upload. Sets entity_type='library' + entity_id=null.
export async function uploadToLibrary(
  formData: FormData,
): Promise<ActionResult<LibraryFile>> {
  const ctx = await getAuthContext();
  if (!ctx) return { success: false, error: "Not authenticated." };

  if (!["admin", "staff", "leader"].includes(ctx.role))
    return {
      success: false,
      error: "You don't have permission to upload files.",
      code: "FORBIDDEN",
    };

  const file = formData.get("file");
  const folderIdRaw = formData.get("folder_id");
  const folderId =
    typeof folderIdRaw === "string" && folderIdRaw.length > 0
      ? folderIdRaw
      : null;
  const description =
    (formData.get("description") as string | null) || null;

  if (!(file instanceof File))
    return { success: false, error: "No file provided.", code: "BAD_INPUT" };
  if (file.size <= 0)
    return { success: false, error: "File is empty.", code: "BAD_INPUT" };
  if (file.size > MAX_FILE_BYTES)
    return {
      success: false,
      error: `File is too large (${formatBytes(file.size)}). Max is 25 MB.`,
      code: "FILE_TOO_LARGE",
    };
  if (!ALLOWED_MIME_TYPES.has(file.type))
    return {
      success: false,
      error: `File type "${file.type || "unknown"}" isn't supported.`,
      code: "UNSUPPORTED_TYPE",
    };

  if (folderId) {
    const access = await loadFolderForViewer(ctx, folderId);
    if (!access.ok) return { success: false, error: access.error };
  }

  const usage = await getOrganizationStorageUsage();
  if (
    usage.success &&
    usage.data &&
    usage.data.used_bytes + file.size > usage.data.limit_bytes
  )
    return {
      success: false,
      code: "STORAGE_LIMIT_EXCEEDED",
      error: `Your church has used ${usage.data.formatted.used} of ${usage.data.formatted.limit}. Uploading "${file.name}" would exceed your plan.`,
    };

  const fileId = crypto.randomUUID();
  const sanitized = sanitizeFilename(file.name);
  const extension = getFileExtension(sanitized);
  const storagePath = `${ctx.organizationId}/library/${folderId ?? "root"}/${fileId}_${sanitized}`;
  const category = categorizeFile(file.type, extension);

  const arrayBuffer = await file.arrayBuffer();
  const fileBuffer = Buffer.from(arrayBuffer);

  let thumbnailPath: string | null = null;
  let thumbnailBuffer: Buffer | null = null;
  if (shouldGenerateThumbnail(file.type)) {
    try {
      thumbnailBuffer = await sharp(fileBuffer)
        .resize(200, 200, { fit: "inside", withoutEnlargement: true })
        .webp({ quality: 80 })
        .toBuffer();
      thumbnailPath = `${ctx.organizationId}/library/${folderId ?? "root"}/${fileId}_thumb.webp`;
    } catch (err) {
      console.error("[uploadToLibrary] Thumbnail generation failed:", err);
    }
  }

  const { error: uploadError } = await supabaseAdmin.storage
    .from(BUCKET)
    .upload(storagePath, fileBuffer, {
      contentType: file.type,
      cacheControl: "3600",
      upsert: false,
    });
  if (uploadError) {
    console.error("[uploadToLibrary] Storage upload error:", uploadError.message);
    return { success: false, error: "Couldn't upload the file." };
  }
  if (thumbnailBuffer && thumbnailPath) {
    const { error: thumbError } = await supabaseAdmin.storage
      .from(BUCKET)
      .upload(thumbnailPath, thumbnailBuffer, {
        contentType: "image/webp",
        cacheControl: "3600",
        upsert: false,
      });
    if (thumbError) thumbnailPath = null;
  }

  const { data: inserted, error: insertError } = await supabaseAdmin
    .from("attachments")
    .insert({
      organization_id: ctx.organizationId,
      entity_type: "library",
      entity_id: null,
      folder_id: folderId,
      name: file.name.slice(0, 255),
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
      "id, organization_id, entity_type, entity_id, folder_id, name, description, file_type, file_extension, size_bytes, storage_path, thumbnail_path, mime_type, uploaded_by, uploaded_at, is_pinned, view_count, download_count, last_accessed_at",
    )
    .single();

  if (insertError || !inserted) {
    await supabaseAdmin.storage.from(BUCKET).remove([storagePath]);
    if (thumbnailPath)
      await supabaseAdmin.storage.from(BUCKET).remove([thumbnailPath]);
    console.error("[uploadToLibrary] Insert error:", insertError?.message);
    return {
      success: false,
      error: insertError?.message || "Couldn't record the upload.",
    };
  }

  const [hydrated] = await hydrateLibraryFiles([
    inserted as Parameters<typeof hydrateLibraryFiles>[0][number],
  ]);
  revalidatePath("/workspace/library");
  return { success: true, data: hydrated };
}

// ─── View / download tracking ──────────────────────────────
//
// Best-effort counters. Failures log and continue — we never want a
// preview or download blocked by a failed UPDATE.

export async function trackAttachmentView(
  attachmentId: string,
): Promise<void> {
  try {
    const ctx = await getAuthContext();
    if (!ctx) return;
    const { data: row } = await supabaseAdmin
      .from("attachments")
      .select("view_count, organization_id")
      .eq("id", attachmentId)
      .maybeSingle();
    if (!row || row.organization_id !== ctx.organizationId) return;
    await supabaseAdmin
      .from("attachments")
      .update({
        view_count: (row.view_count ?? 0) + 1,
        last_accessed_at: new Date().toISOString(),
      })
      .eq("id", attachmentId);
  } catch (err) {
    console.error("[trackAttachmentView] Threw:", err);
  }
}

export async function trackAttachmentDownload(
  attachmentId: string,
): Promise<void> {
  try {
    const ctx = await getAuthContext();
    if (!ctx) return;
    const { data: row } = await supabaseAdmin
      .from("attachments")
      .select("download_count, organization_id")
      .eq("id", attachmentId)
      .maybeSingle();
    if (!row || row.organization_id !== ctx.organizationId) return;
    await supabaseAdmin
      .from("attachments")
      .update({
        download_count: (row.download_count ?? 0) + 1,
        last_accessed_at: new Date().toISOString(),
      })
      .eq("id", attachmentId);
  } catch (err) {
    console.error("[trackAttachmentDownload] Threw:", err);
  }
}
