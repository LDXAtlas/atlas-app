"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { can, getRoleFromProfile } from "@/lib/permissions";

export interface ProfileWithAssignments {
  id: string;
  email: string;
  full_name: string;
  role: string;
  avatar_url: string | null;
  assignments: {
    department_id: string;
    department_name: string;
    department_color: string;
    department_icon: string | null;
    is_primary: boolean;
  }[];
}

async function getAuthContext() {
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
  if (!org) return null;

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  const role = getRoleFromProfile(profile);

  return { userId: user.id, orgId: org.id, role };
}

export async function getStaffWithAssignments(): Promise<{
  data: ProfileWithAssignments[];
  error?: string;
}> {
  const ctx = await getAuthContext();
  if (!ctx) return { data: [], error: "Not authenticated" };

  // Fetch all profiles in the org
  const { data: profiles, error: profilesError } = await supabaseAdmin
    .from("profiles")
    .select("id, email, full_name, role, avatar_url")
    .eq("organization_id", ctx.orgId)
    .order("full_name", { ascending: true });

  if (profilesError) return { data: [], error: profilesError.message };

  // Fetch all profile_departments for the org's profiles
  const profileIds = (profiles || []).map((p: { id: string }) => p.id);
  if (profileIds.length === 0) return { data: [] };

  const { data: assignments, error: assignError } = await supabaseAdmin
    .from("profile_departments")
    .select("profile_id, department_id, is_primary")
    .in("profile_id", profileIds);

  if (assignError) return { data: [], error: assignError.message };

  // Fetch departments for enrichment
  const { data: departments } = await supabaseAdmin
    .from("departments")
    .select("id, name, color, icon")
    .eq("organization_id", ctx.orgId);

  const deptMap = new Map(
    (departments || []).map((d: { id: string; name: string; color: string; icon: string | null }) => [d.id, d])
  );

  // Enrich profiles with their assignments
  const result: ProfileWithAssignments[] = (profiles || []).map(
    (p: { id: string; email: string; full_name: string; role: string; avatar_url: string | null }) => {
      const profileAssignments = (assignments || [])
        .filter((a: { profile_id: string }) => a.profile_id === p.id)
        .map((a: { department_id: string; is_primary: boolean }) => {
          const dept = deptMap.get(a.department_id) as
            | { id: string; name: string; color: string; icon: string | null }
            | undefined;
          return {
            department_id: a.department_id,
            department_name: dept?.name || "Unknown",
            department_color: dept?.color || "#6B7280",
            department_icon: dept?.icon || null,
            is_primary: a.is_primary,
          };
        });

      return {
        id: p.id,
        email: p.email,
        full_name: p.full_name,
        role: p.role,
        avatar_url: p.avatar_url,
        assignments: profileAssignments,
      };
    }
  );

  return { data: result };
}

export async function bulkUpdateAssignments(
  profileId: string,
  assignments: { department_id: string; is_primary: boolean }[]
): Promise<{ error?: string }> {
  const ctx = await getAuthContext();
  if (!ctx) return { error: "Not authenticated" };

  if (!can.manageDepartmentAssignments(ctx.role)) {
    return { error: "You don't have permission to manage assignments." };
  }

  // Ensure only one primary
  const primaryCount = assignments.filter((a) => a.is_primary).length;
  if (primaryCount > 1) {
    return { error: "Only one department can be primary." };
  }

  // Delete existing assignments
  const { error: deleteError } = await supabaseAdmin
    .from("profile_departments")
    .delete()
    .eq("profile_id", profileId);

  if (deleteError) return { error: deleteError.message };

  // Insert new assignments
  if (assignments.length > 0) {
    const rows = assignments.map((a) => ({
      profile_id: profileId,
      department_id: a.department_id,
      is_primary: a.is_primary,
      assigned_by: ctx.userId,
    }));

    const { error: insertError } = await supabaseAdmin
      .from("profile_departments")
      .insert(rows);

    if (insertError) return { error: insertError.message };
  }

  revalidatePath("/directory/staff-management");
  return {};
}

export async function removeProfileFromDepartment(
  profileId: string,
  departmentId: string
): Promise<{ error?: string }> {
  const ctx = await getAuthContext();
  if (!ctx) return { error: "Not authenticated" };

  if (!can.manageDepartmentAssignments(ctx.role)) {
    return { error: "You don't have permission to manage assignments." };
  }

  const { error } = await supabaseAdmin
    .from("profile_departments")
    .delete()
    .eq("profile_id", profileId)
    .eq("department_id", departmentId);

  if (error) return { error: error.message };

  revalidatePath("/directory/staff-management");
  return {};
}

export async function setPrimaryDepartment(
  profileId: string,
  departmentId: string
): Promise<{ error?: string }> {
  const ctx = await getAuthContext();
  if (!ctx) return { error: "Not authenticated" };

  if (!can.manageDepartmentAssignments(ctx.role)) {
    return { error: "You don't have permission to manage assignments." };
  }

  // Set all to false
  const { error: clearError } = await supabaseAdmin
    .from("profile_departments")
    .update({ is_primary: false })
    .eq("profile_id", profileId);

  if (clearError) return { error: clearError.message };

  // Set the target to true
  const { error: setError } = await supabaseAdmin
    .from("profile_departments")
    .update({ is_primary: true })
    .eq("profile_id", profileId)
    .eq("department_id", departmentId);

  if (setError) return { error: setError.message };

  revalidatePath("/directory/staff-management");
  return {};
}
