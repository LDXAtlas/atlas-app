import { notFound } from "next/navigation";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getRoleFromProfile } from "@/lib/permissions";
import type { Role } from "@/lib/permissions";
import { ProfileDetail, type ProfileDetailDepartment } from "./profile-detail";

export default async function ProfileDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await connection();
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) notFound();

  const slug = user.user_metadata?.organization_slug;
  if (!slug) notFound();

  const { data: org } = await supabaseAdmin
    .from("organizations")
    .select("id")
    .eq("slug", slug)
    .single();
  if (!org?.id) notFound();

  // Fetch the target profile
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("id, email, full_name, role, avatar_url, organization_id, created_at")
    .eq("id", id)
    .single();

  if (!profile || profile.organization_id !== org.id) notFound();

  // Current viewer's role
  const { data: viewerProfile } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  const viewerRole: Role = getRoleFromProfile(viewerProfile);

  // Department assignments
  const { data: assignments } = await supabaseAdmin
    .from("profile_departments")
    .select("department_id, is_primary")
    .eq("profile_id", id);

  const { data: departments } = await supabaseAdmin
    .from("departments")
    .select("id, name, color, icon")
    .eq("organization_id", org.id);

  const deptMap = new Map<string, ProfileDetailDepartment>();
  (departments ?? []).forEach((d: { id: string; name: string; color: string; icon: string | null }) => {
    deptMap.set(d.id, {
      id: d.id,
      name: d.name,
      color: d.color || "#6B7280",
      icon: d.icon || "Building",
    });
  });

  let primary: ProfileDetailDepartment | null = null;
  const secondaries: ProfileDetailDepartment[] = [];
  (assignments ?? []).forEach((a: { department_id: string; is_primary: boolean }) => {
    const d = deptMap.get(a.department_id);
    if (!d) return;
    if (a.is_primary) primary = d;
    else secondaries.push(d);
  });
  secondaries.sort((a, b) => a.name.localeCompare(b.name));

  const allowedRoles: Role[] = ["admin", "staff", "leader", "volunteer", "member"];
  const role: Role = allowedRoles.includes((profile.role || "") as Role)
    ? (profile.role as Role)
    : "member";

  return (
    <ProfileDetail
      profile={{
        id: profile.id,
        full_name: profile.full_name || profile.email?.split("@")[0] || "Unnamed",
        email: profile.email,
        avatar_url: profile.avatar_url,
        role,
        created_at: profile.created_at,
      }}
      primaryDepartment={primary}
      secondaryDepartments={secondaries}
      viewerRole={viewerRole}
    />
  );
}
