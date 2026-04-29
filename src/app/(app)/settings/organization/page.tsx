import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { OrganizationPageClient } from "./_components/organization-page-client";

export default async function OrganizationPage() {
  await connection();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  // Fetch current user's profile
  const { data: currentProfile } = await supabaseAdmin
    .from("profiles")
    .select("organization_id, role")
    .eq("id", user.id)
    .single();

  if (!currentProfile?.organization_id) {
    return (
      <div className="flex items-center justify-center py-20">
        <p
          className="text-[15px] text-[#6B7280]"
          style={{ fontFamily: "var(--font-source-sans)" }}
        >
          No organization found. Please contact support.
        </p>
      </div>
    );
  }

  const organizationId = currentProfile.organization_id;

  // Fetch team members (profiles in the org)
  const { data: profiles } = await supabaseAdmin
    .from("profiles")
    .select("id, full_name, role, created_at")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: true });

  // Fetch emails for team members from auth
  const { data: authData } = await supabaseAdmin.auth.admin.listUsers();
  const authUsersMap = new Map(
    authData?.users?.map((u) => [u.id, u.email]) || [],
  );

  const teamMembers = (profiles || []).map((p) => ({
    id: p.id,
    full_name: p.full_name || "Unknown",
    email: authUsersMap.get(p.id) || "unknown@email.com",
    role: p.role || "staff",
  }));

  // Fetch pending invitations
  const { data: invitations } = await supabaseAdmin
    .from("invitations")
    .select("id, email, role, invited_by, created_at")
    .eq("organization_id", organizationId)
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  // Get inviter names
  const inviterIds = [
    ...new Set((invitations || []).map((i) => i.invited_by).filter(Boolean)),
  ];
  const inviterProfiles =
    inviterIds.length > 0
      ? (
          await supabaseAdmin
            .from("profiles")
            .select("id, full_name")
            .in("id", inviterIds)
        ).data || []
      : [];
  const inviterMap = new Map(inviterProfiles.map((p) => [p.id, p.full_name]));

  const pendingInvitations = (invitations || []).map((i) => ({
    id: i.id,
    email: i.email,
    role: i.role,
    inviter_name: inviterMap.get(i.invited_by) || "Unknown",
    created_at: i.created_at,
  }));

  // Fetch seat limit from organizations table
  const { data: org } = await supabaseAdmin
    .from("organizations")
    .select("seat_limit")
    .eq("id", organizationId)
    .single();

  const seatLimit = org?.seat_limit ?? 5;

  return (
    <OrganizationPageClient
      teamMembers={teamMembers}
      pendingInvitations={pendingInvitations}
      seatLimit={seatLimit}
      currentUserRole={currentProfile.role || "staff"}
      currentUserEmail={user.email || ""}
    />
  );
}
