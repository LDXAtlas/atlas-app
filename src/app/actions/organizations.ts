"use server";

import sharp from "sharp";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { can, getRoleFromProfile } from "@/lib/permissions";

// ─── Types ────────────────────────────────────────────────

export type ActionResult<T = unknown> =
  | { success: true; data?: T }
  | { success: false; error: string; code?: string };

// ─── Auth + admin gate ────────────────────────────────────

async function getAdminContext(): Promise<
  { userId: string; organizationId: string } | { error: string; code: string }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Not authenticated.", code: "UNAUTHENTICATED" };
  }

  // Look up the caller's role + org from profiles. The slug-based path
  // used elsewhere works too, but reading role + organization_id from
  // profiles directly is one query and keeps the admin check tight.
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("role, organization_id")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile?.organization_id) {
    return { error: "No organization found.", code: "BAD_INPUT" };
  }
  const role = getRoleFromProfile(profile);
  if (!can.editOrganization(role)) {
    return {
      error: "Only admins can change the organization logo.",
      code: "FORBIDDEN",
    };
  }
  return { userId: user.id, organizationId: profile.organization_id };
}

// ─── Logo upload / removal ────────────────────────────────
//
// Both functions are admin-only and write to the `org-logos` bucket at
// {organization_id}/logo.webp. The storage policy already enforces
// admin-only writes; we re-check here because we use the service-role
// client (which bypasses RLS).

const LOGO_BUCKET = "org-logos";
const LOGO_MIME_ALLOWLIST = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/svg+xml",
]);
const LOGO_MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const LOGO_PIXEL_SIZE = 256;

export async function uploadOrgLogo(
  formData: FormData,
): Promise<ActionResult<{ logo_url: string }>> {
  const ctx = await getAdminContext();
  if ("error" in ctx) {
    return { success: false, error: ctx.error, code: ctx.code };
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return { success: false, error: "No file provided.", code: "BAD_INPUT" };
  }
  if (file.size <= 0) {
    return { success: false, error: "File is empty.", code: "BAD_INPUT" };
  }
  if (file.size > LOGO_MAX_BYTES) {
    return {
      success: false,
      error: "Image is too large (max 5 MB).",
      code: "FILE_TOO_LARGE",
    };
  }
  if (!LOGO_MIME_ALLOWLIST.has(file.type)) {
    return {
      success: false,
      error: "Use a JPG, PNG, WebP, or SVG image.",
      code: "UNSUPPORTED_TYPE",
    };
  }

  // Logo uses `contain` instead of `cover` so we don't crop a wide
  // wordmark or a tall stacked lockup. Transparent padding around the
  // shorter axis is preserved.
  let processed: Buffer;
  try {
    const arrayBuffer = await file.arrayBuffer();
    processed = await sharp(Buffer.from(arrayBuffer))
      .rotate()
      .resize(LOGO_PIXEL_SIZE, LOGO_PIXEL_SIZE, {
        fit: "contain",
        background: { r: 255, g: 255, b: 255, alpha: 0 },
      })
      .webp({ quality: 88 })
      .toBuffer();
  } catch (err) {
    console.error("[uploadOrgLogo] sharp error:", err);
    return {
      success: false,
      error: "Couldn't process this image. Try a different one.",
      code: "IMAGE_PROCESSING_FAILED",
    };
  }

  const path = `${ctx.organizationId}/logo.webp`;
  const { error: uploadErr } = await supabaseAdmin.storage
    .from(LOGO_BUCKET)
    .upload(path, processed, {
      contentType: "image/webp",
      cacheControl: "3600",
      upsert: true,
    });
  if (uploadErr) {
    console.error("[uploadOrgLogo] Storage error:", uploadErr.message);
    return { success: false, error: "Couldn't save the image. Try again." };
  }

  const { data: publicData } = supabaseAdmin.storage
    .from(LOGO_BUCKET)
    .getPublicUrl(path);
  const logo_url = `${publicData.publicUrl}?v=${Date.now()}`;

  const { error: updateErr } = await supabaseAdmin
    .from("organizations")
    .update({ logo_url })
    .eq("id", ctx.organizationId);
  if (updateErr) {
    console.error("[uploadOrgLogo] Org update error:", updateErr.message);
    return { success: false, error: updateErr.message };
  }

  revalidatePath("/settings/organization");
  revalidatePath("/dashboard");
  return { success: true, data: { logo_url } };
}

export async function removeOrgLogo(): Promise<ActionResult> {
  const ctx = await getAdminContext();
  if ("error" in ctx) {
    return { success: false, error: ctx.error, code: ctx.code };
  }

  const { error: updateErr } = await supabaseAdmin
    .from("organizations")
    .update({ logo_url: null })
    .eq("id", ctx.organizationId);
  if (updateErr) {
    console.error("[removeOrgLogo] Org update error:", updateErr.message);
    return { success: false, error: updateErr.message };
  }

  const { error: deleteErr } = await supabaseAdmin.storage
    .from(LOGO_BUCKET)
    .remove([`${ctx.organizationId}/logo.webp`]);
  if (deleteErr) {
    console.warn("[removeOrgLogo] Storage delete warning:", deleteErr.message);
  }

  revalidatePath("/settings/organization");
  revalidatePath("/dashboard");
  return { success: true };
}

// ─── Read helper (used by the org settings header card) ───

export type OrgSummary = {
  id: string;
  name: string;
  logo_url: string | null;
};

export async function getMyOrgSummary(): Promise<ActionResult<OrgSummary>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, error: "Not authenticated.", code: "UNAUTHENTICATED" };
  }
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("organization_id")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile?.organization_id) {
    return { success: false, error: "No organization found." };
  }
  const { data: org } = await supabaseAdmin
    .from("organizations")
    .select("id, name, logo_url")
    .eq("id", profile.organization_id)
    .maybeSingle();
  if (!org) return { success: false, error: "Organization not found." };
  return {
    success: true,
    data: {
      id: org.id,
      name: org.name,
      logo_url: org.logo_url ?? null,
    },
  };
}
