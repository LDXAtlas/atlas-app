"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

// ─── Types ──────────────────────────────────────────────
export type MemberInput = {
  first_name: string;
  last_name: string;
  email?: string | null;
  phone?: string | null;
  address_line_1?: string | null;
  address_line_2?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  gender?: string | null;
  birthdate?: string | null;
  membership_status?: string;
  member_type?: string;
  notes?: string | null;
  tags?: string[] | null;
};

export type ActionResult = {
  success: boolean;
  error?: string;
  id?: string;
  imported?: number;
  skipped?: number;
};

// ─── Helpers ────────────────────────────────────────────
async function getOrganizationId(): Promise<string | null> {
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

  return org?.id ?? null;
}

// ─── Add Member ─────────────────────────────────────────
export async function addMember(data: MemberInput): Promise<ActionResult> {
  console.log("[addMember] Starting with:", data.first_name, data.last_name);

  const orgId = await getOrganizationId();
  console.log("[addMember] Org ID:", orgId);
  if (!orgId) return { success: false, error: "Not authenticated or no organization found." };

  if (!data.first_name?.trim() || !data.last_name?.trim()) {
    return { success: false, error: "First name and last name are required." };
  }

  const insertData = {
    organization_id: orgId,
    first_name: data.first_name.trim(),
    last_name: data.last_name.trim(),
    email: data.email?.trim() || null,
    phone: data.phone?.trim() || null,
    address_line_1: data.address_line_1?.trim() || null,
    address_line_2: data.address_line_2?.trim() || null,
    city: data.city?.trim() || null,
    state: data.state?.trim() || null,
    zip: data.zip?.trim() || null,
    gender: data.gender || null,
    birthdate: data.birthdate || null,
    membership_status: data.membership_status || "active",
    member_type: data.member_type || "member",
    notes: data.notes?.trim() || null,
  };
  console.log("[addMember] Inserting into members table");

  const { data: member, error } = await supabaseAdmin
    .from("members")
    .insert(insertData)
    .select("id")
    .single();

  console.log("[addMember] Result:", error ? `ERROR: ${error.message} (code: ${error.code}, details: ${error.details})` : `SUCCESS: id=${member?.id}`);

  if (error) {
    return { success: false, error: error.message };
  }

  // Insert tags into member_tags junction table if provided
  if (member?.id && data.tags && data.tags.length > 0) {
    const tagRows = data.tags.map((tag) => ({
      member_id: member.id,
      tag,
    }));
    const { error: tagError } = await supabaseAdmin
      .from("member_tags")
      .insert(tagRows);

    if (tagError) {
      console.log("[addMember] Tags insert error (non-fatal):", tagError.message);
    }
  }

  revalidatePath("/directory");
  return { success: true, id: member?.id };
}

// ─── Update Member ──────────────────────────────────────
export async function updateMember(
  id: string,
  data: MemberInput,
): Promise<ActionResult> {
  const orgId = await getOrganizationId();
  if (!orgId) return { success: false, error: "Not authenticated or no organization found." };

  if (!data.first_name?.trim() || !data.last_name?.trim()) {
    return { success: false, error: "First name and last name are required." };
  }

  const { error } = await supabaseAdmin
    .from("members")
    .update({
      first_name: data.first_name.trim(),
      last_name: data.last_name.trim(),
      email: data.email?.trim() || null,
      phone: data.phone?.trim() || null,
      address_line_1: data.address_line_1?.trim() || null,
      address_line_2: data.address_line_2?.trim() || null,
      city: data.city?.trim() || null,
      state: data.state?.trim() || null,
      zip: data.zip?.trim() || null,
      gender: data.gender || null,
      birthdate: data.birthdate || null,
      membership_status: data.membership_status || "active",
      member_type: data.member_type || "member",
      notes: data.notes?.trim() || null,
    })
    .eq("id", id)
    .eq("organization_id", orgId);

  if (error) {
    console.error("[updateMember] Error:", error.message);
    return { success: false, error: error.message };
  }

  // Update tags in member_tags junction table
  if (data.tags !== undefined) {
    // Remove existing tags
    await supabaseAdmin
      .from("member_tags")
      .delete()
      .eq("member_id", id);

    // Insert new tags
    if (data.tags && data.tags.length > 0) {
      const tagRows = data.tags.map((tag) => ({
        member_id: id,
        tag,
      }));
      await supabaseAdmin.from("member_tags").insert(tagRows);
    }
  }

  revalidatePath("/directory");
  revalidatePath(`/directory/${id}`);
  return { success: true };
}

// ─── Delete Member ──────────────────────────────────────
export async function deleteMember(id: string): Promise<ActionResult> {
  const orgId = await getOrganizationId();
  if (!orgId) return { success: false, error: "Not authenticated or no organization found." };

  const { error } = await supabaseAdmin
    .from("members")
    .delete()
    .eq("id", id)
    .eq("organization_id", orgId);

  if (error) {
    console.error("[deleteMember] Error:", error.message);
    return { success: false, error: error.message };
  }

  revalidatePath("/directory");
  return { success: true };
}

// ─── Import Members (batch) ─────────────────────────────
export async function importMembers(
  members: MemberInput[],
): Promise<ActionResult> {
  const orgId = await getOrganizationId();
  if (!orgId) return { success: false, error: "Not authenticated or no organization found." };

  if (!members.length) {
    return { success: false, error: "No members to import." };
  }

  // Get existing emails for deduplication
  const { data: existing } = await supabaseAdmin
    .from("members")
    .select("email")
    .eq("organization_id", orgId)
    .not("email", "is", null);

  const existingEmails = new Set(
    (existing ?? []).map((m: { email: string | null }) => m.email?.toLowerCase()),
  );

  const toInsert: Array<MemberInput & { organization_id: string }> = [];
  let skipped = 0;

  for (const m of members) {
    if (!m.first_name?.trim() || !m.last_name?.trim()) {
      skipped++;
      continue;
    }
    if (m.email && existingEmails.has(m.email.trim().toLowerCase())) {
      skipped++;
      continue;
    }
    toInsert.push({
      organization_id: orgId,
      first_name: m.first_name.trim(),
      last_name: m.last_name.trim(),
      email: m.email?.trim() || null,
      phone: m.phone?.trim() || null,
      address_line_1: m.address_line_1?.trim() || null,
      address_line_2: m.address_line_2?.trim() || null,
      city: m.city?.trim() || null,
      state: m.state?.trim() || null,
      zip: m.zip?.trim() || null,
      gender: m.gender || null,
      birthdate: m.birthdate || null,
      membership_status: m.membership_status || "active",
      member_type: m.member_type || "member",
      notes: m.notes?.trim() || null,
    });
  }

  if (!toInsert.length) {
    return { success: true, imported: 0, skipped };
  }

  const { error } = await supabaseAdmin.from("members").insert(toInsert);

  if (error) {
    console.error("[importMembers] Error:", error.message);
    return { success: false, error: error.message };
  }

  revalidatePath("/directory");
  return { success: true, imported: toInsert.length, skipped };
}
