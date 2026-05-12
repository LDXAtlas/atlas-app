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

  // Snapshot the existing assignments so we can detect which rows are
  // genuinely new and only notify on those (this action does a wholesale
  // delete + insert, so a no-op save would otherwise re-notify on every
  // edit).
  const { data: previousRows } = await supabaseAdmin
    .from("profile_departments")
    .select("department_id, is_primary")
    .eq("profile_id", profileId);
  const previousIds = new Set<string>(
    (previousRows ?? []).map(
      (r: { department_id: string }) => r.department_id,
    ),
  );

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

  // Notify the user about any department they're newly assigned to —
  // unless they're assigning themselves. Best-effort.
  if (profileId !== ctx.userId) {
    const newlyAdded = assignments.filter(
      (a) => !previousIds.has(a.department_id),
    );
    if (newlyAdded.length > 0) {
      try {
        const deptIds = newlyAdded.map((a) => a.department_id);
        const [{ data: deptRows }, { data: actor }] = await Promise.all([
          supabaseAdmin
            .from("departments")
            .select("id, name")
            .in("id", deptIds),
          supabaseAdmin
            .from("profiles")
            .select("full_name, email")
            .eq("id", ctx.userId)
            .maybeSingle(),
        ]);
        const deptNameById = new Map(
          (deptRows ?? []).map(
            (d: { id: string; name: string }) => [d.id, d.name] as const,
          ),
        );
        const actorName =
          actor?.full_name || actor?.email?.split("@")[0] || "A teammate";
        const { createNotification } = await import(
          "@/app/actions/notifications"
        );
        // Send one notification per department added — keeps the deep link
        // accurate and lets the user click straight into the right hub.
        await Promise.all(
          newlyAdded.map((a) =>
            createNotification({
              recipientId: profileId,
              organizationId: ctx.orgId,
              actorId: ctx.userId,
              type: "department_assigned",
              title: `${actorName} added you to ${
                deptNameById.get(a.department_id) || "a department"
              }`,
              body: a.is_primary ? "Primary department" : "Secondary department",
              entityType: "department",
              entityId: a.department_id,
              actionUrl: `/ministry-hub/${a.department_id}`,
            }),
          ),
        );
      } catch (err) {
        console.error("[bulkUpdateAssignments] Notification send failed:", err);
      }
    }
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
