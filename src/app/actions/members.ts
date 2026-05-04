"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { can, getRoleFromProfile } from "@/lib/permissions";

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

// ─── Unified directory ──────────────────────────────────
export type DirectoryDepartment = {
  id: string;
  name: string;
  color: string;
  icon: string;
};

export type DirectoryPerson = {
  id: string;
  type: "profile" | "member";
  first_name: string;
  last_name: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  avatar_url: string | null;
  role: "admin" | "staff" | "leader" | "volunteer" | "member";
  membership_status: string | null;
  member_type: string | null;
  primary_department: DirectoryDepartment | null;
  secondary_departments: DirectoryDepartment[];
  ministry_count: number;
  created_at: string;
};

function splitName(fullName: string | null | undefined, fallbackEmail: string | null = null): { first: string; last: string } {
  const trimmed = (fullName || "").trim();
  if (!trimmed) {
    const localPart = fallbackEmail?.split("@")[0] || "Unknown";
    return { first: localPart, last: "" };
  }
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) return { first: parts[0], last: "" };
  return { first: parts[0], last: parts.slice(1).join(" ") };
}

function asRole(role: string | null | undefined): DirectoryPerson["role"] {
  const allowed = ["admin", "staff", "leader", "volunteer", "member"] as const;
  return (allowed as readonly string[]).includes(role || "")
    ? (role as DirectoryPerson["role"])
    : "member";
}

export async function getDirectoryPeople(): Promise<{
  data: DirectoryPerson[];
  error?: string;
}> {
  const ctx = await getAuthContext();
  if (!ctx) return { data: [], error: "Not authenticated" };

  // Profiles (team members with app accounts)
  const { data: profiles, error: profilesError } = await supabaseAdmin
    .from("profiles")
    .select("id, email, full_name, role, avatar_url, created_at")
    .eq("organization_id", ctx.organizationId);

  if (profilesError) return { data: [], error: profilesError.message };

  // Department assignments + departments for those profiles
  const profileIds = (profiles ?? []).map((p: { id: string }) => p.id);

  let assignments: { profile_id: string; department_id: string; is_primary: boolean }[] = [];
  if (profileIds.length > 0) {
    const { data: a } = await supabaseAdmin
      .from("profile_departments")
      .select("profile_id, department_id, is_primary")
      .in("profile_id", profileIds);
    assignments = (a ?? []) as typeof assignments;
  }

  const { data: departments } = await supabaseAdmin
    .from("departments")
    .select("id, name, color, icon")
    .eq("organization_id", ctx.organizationId);

  const deptMap = new Map<string, DirectoryDepartment>();
  (departments ?? []).forEach((d: { id: string; name: string; color: string; icon: string | null }) => {
    deptMap.set(d.id, {
      id: d.id,
      name: d.name,
      color: d.color || "#6B7280",
      icon: d.icon || "Building",
    });
  });

  const profilePeople: DirectoryPerson[] = (profiles ?? []).map(
    (p: {
      id: string;
      email: string | null;
      full_name: string | null;
      role: string | null;
      avatar_url: string | null;
      created_at: string;
    }) => {
      const { first, last } = splitName(p.full_name, p.email);
      const own = assignments.filter((a) => a.profile_id === p.id);
      const primaryAssignment = own.find((a) => a.is_primary);
      const primary = primaryAssignment ? (deptMap.get(primaryAssignment.department_id) ?? null) : null;
      const secondaries = own
        .filter((a) => !a.is_primary)
        .map((a) => deptMap.get(a.department_id))
        .filter((d): d is DirectoryDepartment => !!d)
        .sort((a, b) => a.name.localeCompare(b.name));

      return {
        id: p.id,
        type: "profile",
        first_name: first,
        last_name: last,
        full_name: p.full_name?.trim() || `${first} ${last}`.trim(),
        email: p.email,
        phone: null,
        avatar_url: p.avatar_url,
        role: asRole(p.role),
        membership_status: null,
        member_type: null,
        primary_department: primary,
        secondary_departments: secondaries,
        ministry_count: own.length,
        created_at: p.created_at,
      };
    },
  );

  // Members (congregation, no app account)
  const { data: members, error: membersError } = await supabaseAdmin
    .from("members")
    .select(
      "id, first_name, last_name, email, phone, membership_status, member_type, created_at",
    )
    .eq("organization_id", ctx.organizationId);

  if (membersError) return { data: profilePeople, error: membersError.message };

  const memberPeople: DirectoryPerson[] = (members ?? []).map(
    (m: {
      id: string;
      first_name: string;
      last_name: string;
      email: string | null;
      phone: string | null;
      membership_status: string | null;
      member_type: string | null;
      created_at: string;
    }) => ({
      id: m.id,
      type: "member",
      first_name: m.first_name,
      last_name: m.last_name,
      full_name: `${m.first_name} ${m.last_name}`.trim(),
      email: m.email,
      phone: m.phone,
      avatar_url: null,
      role: "member",
      membership_status: m.membership_status,
      member_type: m.member_type,
      primary_department: null,
      secondary_departments: [],
      ministry_count: 0,
      created_at: m.created_at,
    }),
  );

  return { data: [...profilePeople, ...memberPeople] };
}

// ─── Add Member ─────────────────────────────────────────
export async function addMember(data: MemberInput): Promise<ActionResult> {
  console.log("[addMember] Starting with:", data.first_name, data.last_name);

  const ctx = await getAuthContext();
  if (!ctx) return { success: false, error: "Not authenticated or no organization found." };
  const orgId = ctx.organizationId;
  console.log("[addMember] Org ID:", orgId);

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", ctx.userId)
    .single();
  const role = getRoleFromProfile(profile);

  if (!can.createMember(role)) {
    return { success: false, error: "You don't have permission to do this." };
  }

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
  const ctx = await getAuthContext();
  if (!ctx) return { success: false, error: "Not authenticated or no organization found." };
  const orgId = ctx.organizationId;

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", ctx.userId)
    .single();
  const role = getRoleFromProfile(profile);

  if (!can.editMember(role)) {
    return { success: false, error: "You don't have permission to do this." };
  }

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
  const ctx = await getAuthContext();
  if (!ctx) return { success: false, error: "Not authenticated or no organization found." };
  const orgId = ctx.organizationId;

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", ctx.userId)
    .single();
  const role = getRoleFromProfile(profile);

  if (!can.deleteMember(role)) {
    return { success: false, error: "You don't have permission to do this." };
  }

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
  const ctx = await getAuthContext();
  if (!ctx) return { success: false, error: "Not authenticated or no organization found." };
  const orgId = ctx.organizationId;

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", ctx.userId)
    .single();
  const role = getRoleFromProfile(profile);

  if (!can.importMembers(role)) {
    return { success: false, error: "You don't have permission to do this." };
  }

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
