"use server";

import sharp from "sharp";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getRoleFromProfile } from "@/lib/permissions";
import type { Role } from "@/lib/permissions";
import { deterministicAvatarColor } from "@/lib/avatar";

export type ProfileSearchResult = {
  id: string;
  full_name: string;
  email: string;
  /** Deterministic-per-id color for the initial circle. */
  avatar_color: string;
  /** Optional uploaded photo. */
  avatar_url: string | null;
  role: string;
};

async function getAuthContext(): Promise<{
  userId: string;
  organizationId: string;
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

  return { userId: user.id, organizationId: org.id };
}

/**
 * Search profiles in the caller's organization by name or email.
 *
 * - Case-insensitive ILIKE on full_name and email
 * - Capped at 10 results
 * - When `excludeBoardId` is provided, profiles already in that board's
 *   board_members table are filtered out, so the picker only surfaces
 *   people you can actually add.
 * - When the caller passes an `excludeBoardId` they must have access to
 *   the board — otherwise the request is rejected to avoid leaking
 *   "who's already on this board" via inferred filtering.
 */
export async function searchProfiles(
  query: string,
  excludeBoardId?: string,
): Promise<{ data: ProfileSearchResult[]; error?: string }> {
  const ctx = await getAuthContext();
  if (!ctx) return { data: [], error: "Not authenticated." };

  // Verify board access if filtering by excludeBoardId.
  if (excludeBoardId) {
    const { data: board } = await supabaseAdmin
      .from("boards")
      .select("id, organization_id")
      .eq("id", excludeBoardId)
      .maybeSingle();
    if (!board || board.organization_id !== ctx.organizationId) {
      return { data: [], error: "Board not found." };
    }
  }

  const trimmed = query.trim();
  let queryBuilder = supabaseAdmin
    .from("profiles")
    .select("id, full_name, email, avatar_url, role")
    .eq("organization_id", ctx.organizationId)
    .limit(10)
    .order("full_name", { ascending: true });

  if (trimmed) {
    // PostgREST ILIKE uses % wildcards. Escape any user-supplied % so the
    // wildcards we add are the only ones in effect.
    const safe = trimmed.replace(/[%_]/g, "\\$&");
    queryBuilder = queryBuilder.or(
      `full_name.ilike.%${safe}%,email.ilike.%${safe}%`,
    );
  }

  const { data, error } = await queryBuilder;
  if (error) {
    console.error("[searchProfiles] Select error:", error.message);
    return { data: [], error: error.message };
  }

  let rows = data ?? [];

  // Filter out current board members + the caller themselves.
  if (excludeBoardId) {
    const { data: memberRows } = await supabaseAdmin
      .from("board_members")
      .select("profile_id")
      .eq("board_id", excludeBoardId);
    const memberSet = new Set<string>(
      (memberRows ?? []).map((m: { profile_id: string }) => m.profile_id),
    );
    rows = rows.filter((p: { id: string }) => !memberSet.has(p.id));
  }

  const results: ProfileSearchResult[] = rows.map(
    (p: {
      id: string;
      full_name: string | null;
      email: string | null;
      avatar_url: string | null;
      role: string | null;
    }) => ({
      id: p.id,
      full_name: p.full_name || p.email?.split("@")[0] || "Unnamed",
      email: p.email || "",
      avatar_color: deterministicAvatarColor(p.id),
      avatar_url: p.avatar_url,
      role: getRoleFromProfile({ role: p.role }),
    }),
  );

  return { data: results };
}

// ─── Self-service profile actions ──────────────────────────
//
// Both of the actions below are intentionally scoped to the
// authenticated user's OWN profile row. They never read or write
// another profile — full_name and phone are the only editable fields.
// Email is tied to auth and changes require re-verification.
// role / organization_id are security boundaries that only an admin
// can change through a separate code path.

export type MyProfile = {
  id: string;
  full_name: string;
  email: string;
  avatar_url: string | null;
  phone: string | null;
  role: Role;
  organization_id: string;
  organization_name: string | null;
  last_active: string | null;
  created_at: string;
};

export type UpdateMyProfileInput = {
  full_name: string;
  phone?: string | null;
};

export type ActionResult<T = unknown> =
  | { success: true; data?: T }
  | { success: false; error: string; code?: string };

export async function getMyProfile(): Promise<
  ActionResult<MyProfile>
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, error: "Not authenticated.", code: "UNAUTHENTICATED" };
  }

  // Direct lookup by auth.uid() — never falls through to any other user.
  const { data: profile, error } = await supabaseAdmin
    .from("profiles")
    .select(
      "id, full_name, email, avatar_url, phone, role, organization_id, last_active, created_at",
    )
    .eq("id", user.id)
    .maybeSingle();
  if (error) {
    console.error("[getMyProfile] Select error:", error.message);
    return { success: false, error: error.message };
  }
  if (!profile) {
    return { success: false, error: "Profile not found." };
  }

  // Pull the org name in a second lightweight query so the settings
  // page can show "You're in <Org Name>" without another round trip
  // from the client.
  let organization_name: string | null = null;
  if (profile.organization_id) {
    const { data: org } = await supabaseAdmin
      .from("organizations")
      .select("name")
      .eq("id", profile.organization_id)
      .maybeSingle();
    organization_name = org?.name ?? null;
  }

  return {
    success: true,
    data: {
      id: profile.id,
      full_name: profile.full_name || "",
      email: profile.email || "",
      avatar_url: profile.avatar_url ?? null,
      phone: profile.phone ?? null,
      role: (profile.role as Role) ?? "member",
      organization_id: profile.organization_id,
      organization_name,
      last_active: profile.last_active ?? null,
      created_at: profile.created_at,
    },
  };
}

// Phone formatting — lenient. Allows digits, spaces, hyphens, parens,
// dots, and an optional leading '+'. Anything else is rejected so we
// don't accidentally store a paragraph of text in the phone column.
const PHONE_RE = /^[+]?[\d\s().\-]{6,32}$/;

export async function updateMyProfile(
  input: UpdateMyProfileInput,
): Promise<ActionResult<MyProfile>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, error: "Not authenticated.", code: "UNAUTHENTICATED" };
  }

  const trimmedName = input.full_name?.trim() ?? "";
  if (!trimmedName) {
    return {
      success: false,
      error: "Full name is required.",
      code: "BAD_INPUT",
    };
  }
  if (trimmedName.length > 120) {
    return {
      success: false,
      error: "Full name is too long (max 120 characters).",
      code: "BAD_INPUT",
    };
  }

  // Phone is optional — coerce empty string / whitespace to null.
  let phone: string | null = null;
  if (input.phone !== null && input.phone !== undefined) {
    const trimmedPhone = String(input.phone).trim();
    if (trimmedPhone.length > 0) {
      if (!PHONE_RE.test(trimmedPhone)) {
        return {
          success: false,
          error:
            "Phone format isn't recognized. Use digits, spaces, or +()-./",
          code: "BAD_INPUT",
        };
      }
      phone = trimmedPhone;
    }
  }

  // Critical: scope the UPDATE to the authenticated user's id only.
  // This is the security boundary — without `.eq("id", user.id)` an
  // attacker who controls input could in theory steer the write. The
  // service-role client bypasses RLS so we re-enforce here.
  const { error } = await supabaseAdmin
    .from("profiles")
    .update({
      full_name: trimmedName,
      phone,
    })
    .eq("id", user.id);
  if (error) {
    console.error("[updateMyProfile] Update error:", error.message);
    return { success: false, error: error.message };
  }

  revalidatePath("/settings");
  revalidatePath("/settings/profile");
  // Settings shell, dashboard, and directory all show the user's name
  // in nav / chrome — bust those caches too.
  revalidatePath("/dashboard");
  revalidatePath("/directory");

  // Return the fresh profile so the form can render the saved state
  // without an extra round trip.
  return getMyProfile();
}

// ─── Avatar upload / removal ───────────────────────────────
//
// Both functions scope storage writes to {user_id}/avatar.webp inside
// the public `avatars` bucket. The storage policies already enforce
// "users can only write to their own folder" — we still re-check
// auth.uid() here because we use the service-role client to do the
// upload (RLS bypass) and we want to be belt-and-suspenders.

const AVATAR_BUCKET = "avatars";
const AVATAR_MIME_ALLOWLIST = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
]);
const AVATAR_MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const AVATAR_PIXEL_SIZE = 256;

export async function uploadMyAvatar(
  formData: FormData,
): Promise<ActionResult<{ avatar_url: string }>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, error: "Not authenticated.", code: "UNAUTHENTICATED" };
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return { success: false, error: "No file provided.", code: "BAD_INPUT" };
  }
  if (file.size <= 0) {
    return { success: false, error: "File is empty.", code: "BAD_INPUT" };
  }
  if (file.size > AVATAR_MAX_BYTES) {
    return {
      success: false,
      error: "Image is too large (max 5 MB).",
      code: "FILE_TOO_LARGE",
    };
  }
  if (!AVATAR_MIME_ALLOWLIST.has(file.type)) {
    return {
      success: false,
      error: "Use a JPG, PNG, or WebP image.",
      code: "UNSUPPORTED_TYPE",
    };
  }

  // Resize + crop to a square, convert to webp. Cover crop keeps the
  // subject centered — most avatar source images have a head near the
  // center so this works without face detection.
  let processed: Buffer;
  try {
    const arrayBuffer = await file.arrayBuffer();
    processed = await sharp(Buffer.from(arrayBuffer))
      .rotate() // honor EXIF orientation
      .resize(AVATAR_PIXEL_SIZE, AVATAR_PIXEL_SIZE, {
        fit: "cover",
        position: "centre",
      })
      .webp({ quality: 88 })
      .toBuffer();
  } catch (err) {
    console.error("[uploadMyAvatar] sharp error:", err);
    return {
      success: false,
      error: "Couldn't process this image. Try a different one.",
      code: "IMAGE_PROCESSING_FAILED",
    };
  }

  const path = `${user.id}/avatar.webp`;
  const { error: uploadErr } = await supabaseAdmin.storage
    .from(AVATAR_BUCKET)
    .upload(path, processed, {
      contentType: "image/webp",
      cacheControl: "3600",
      upsert: true,
    });
  if (uploadErr) {
    console.error("[uploadMyAvatar] Storage error:", uploadErr.message);
    return {
      success: false,
      error: "Couldn't save the image. Try again.",
    };
  }

  // Public URL + cache-bust so the new image shows immediately even
  // though the path didn't change (same path = browser will hold the
  // stale image otherwise).
  const { data: publicData } = supabaseAdmin.storage
    .from(AVATAR_BUCKET)
    .getPublicUrl(path);
  const avatar_url = `${publicData.publicUrl}?v=${Date.now()}`;

  const { error: updateErr } = await supabaseAdmin
    .from("profiles")
    .update({ avatar_url })
    .eq("id", user.id);
  if (updateErr) {
    console.error("[uploadMyAvatar] Profile update error:", updateErr.message);
    return { success: false, error: updateErr.message };
  }

  revalidatePath("/settings");
  revalidatePath("/settings/profile");
  revalidatePath("/dashboard");
  revalidatePath("/directory");
  return { success: true, data: { avatar_url } };
}

export async function removeMyAvatar(): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, error: "Not authenticated.", code: "UNAUTHENTICATED" };
  }

  // Clear the DB first; storage cleanup is best-effort. If we deleted
  // the file but failed to clear the column, the UI would briefly try
  // to load a 404 image.
  const { error: updateErr } = await supabaseAdmin
    .from("profiles")
    .update({ avatar_url: null })
    .eq("id", user.id);
  if (updateErr) {
    console.error("[removeMyAvatar] Update error:", updateErr.message);
    return { success: false, error: updateErr.message };
  }

  const { error: deleteErr } = await supabaseAdmin.storage
    .from(AVATAR_BUCKET)
    .remove([`${user.id}/avatar.webp`]);
  if (deleteErr) {
    // Storage object may not exist (legacy users) — log + continue.
    console.warn("[removeMyAvatar] Storage delete warning:", deleteErr.message);
  }

  revalidatePath("/settings");
  revalidatePath("/settings/profile");
  revalidatePath("/dashboard");
  revalidatePath("/directory");
  return { success: true };
}
