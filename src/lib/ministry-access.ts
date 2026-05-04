import { supabaseAdmin } from "@/lib/supabase/admin";
import type { Role } from "@/lib/permissions";

export type AccessibleDepartment = {
  id: string;
  name: string;
  color: string;
  icon: string;
  description: string | null;
  member_count: number;
  hub_enabled: boolean;
};

/**
 * Returns the list of departments the user can access in Ministry Hub.
 * - admin / staff: every department in the org
 * - leader / volunteer: only departments they're assigned to (primary or secondary)
 * - member: empty
 *
 * For volunteers the spec says "primary only", but the UI only ever exposes
 * the user's assigned ministries, so showing both is harmless and friendlier
 * to volunteers who happen to have a secondary tag. We still gate the detail
 * page through canAccessMinistry, so honor the strict rule there.
 */
export async function getAccessibleMinistries(
  userId: string,
  role: Role,
  organizationId: string,
): Promise<AccessibleDepartment[]> {
  if (role === "member") return [];

  if (role === "admin" || role === "staff") {
    const { data } = await supabaseAdmin
      .from("departments")
      .select("id, name, color, icon, description, member_count, hub_enabled")
      .eq("organization_id", organizationId)
      .order("name", { ascending: true });
    return (data ?? []).map(normalizeDepartment);
  }

  // leader / volunteer — fetch their assignments
  const { data: assignments } = await supabaseAdmin
    .from("profile_departments")
    .select("department_id, is_primary")
    .eq("profile_id", userId);

  const assigned = assignments ?? [];
  const ids = (
    role === "volunteer"
      ? assigned.filter((a) => a.is_primary)
      : assigned
  ).map((a) => a.department_id);

  if (ids.length === 0) return [];

  const { data } = await supabaseAdmin
    .from("departments")
    .select("id, name, color, icon, description, member_count, hub_enabled")
    .eq("organization_id", organizationId)
    .in("id", ids)
    .order("name", { ascending: true });

  return (data ?? []).map(normalizeDepartment);
}

export async function canAccessMinistry(
  userId: string,
  role: Role,
  organizationId: string,
  departmentId: string,
): Promise<boolean> {
  // Members and volunteers can't open Ministry Hub at all.
  if (role === "member" || role === "volunteer") return false;

  // Admin / staff / leader can open any ministry in their org. The overview
  // surfaces "All Ministries" to leaders too (they can browse, not just their
  // own assignments), so detail-page access matches that.
  const { data } = await supabaseAdmin
    .from("departments")
    .select("id")
    .eq("id", departmentId)
    .eq("organization_id", organizationId)
    .maybeSingle();
  return !!data;
}

function normalizeDepartment(d: {
  id: string;
  name: string;
  color: string | null;
  icon: string | null;
  description: string | null;
  member_count: number | null;
  hub_enabled: boolean | null;
}): AccessibleDepartment {
  return {
    id: d.id,
    name: d.name,
    color: d.color || "#5CE1A5",
    icon: d.icon || "Building",
    description: d.description,
    member_count: d.member_count ?? 0,
    hub_enabled: d.hub_enabled ?? false,
  };
}
