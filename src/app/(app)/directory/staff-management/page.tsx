import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getRoleFromProfile } from "@/lib/permissions";
import { StaffManagementView } from "./staff-view";
import type { Role } from "@/lib/permissions";

export interface Department {
  id: string;
  name: string;
  color: string;
  description: string | null;
  icon: string;
  leader_id: string | null;
  member_count: number;
  hub_enabled: boolean;
  created_at: string;
}

export interface StaffProfile {
  id: string;
  email: string;
  full_name: string;
  role: string;
  avatar_url: string | null;
}

export interface ProfileDepartmentAssignment {
  profile_id: string;
  department_id: string;
  is_primary: boolean;
}

export default async function StaffManagementPage() {
  await connection();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let departments: Department[] = [];
  let profiles: StaffProfile[] = [];
  let assignments: ProfileDepartmentAssignment[] = [];
  let currentUserRole: Role = "member";

  if (user) {
    const slug = user.user_metadata?.organization_slug;
    if (slug) {
      const { data: org } = await supabaseAdmin
        .from("organizations")
        .select("id")
        .eq("slug", slug)
        .single();

      if (org?.id) {
        // Fetch departments
        const { data: deptData } = await supabaseAdmin
          .from("departments")
          .select("*")
          .eq("organization_id", org.id)
          .order("name", { ascending: true });

        if (deptData) {
          departments = deptData as Department[];
        }

        // Fetch all profiles in the org
        const { data: profileData } = await supabaseAdmin
          .from("profiles")
          .select("id, email, full_name, role, avatar_url")
          .eq("organization_id", org.id)
          .order("full_name", { ascending: true });

        if (profileData) {
          profiles = profileData as StaffProfile[];
        }

        // Fetch all profile_departments assignments for these profiles
        const profileIds = profiles.map((p) => p.id);
        if (profileIds.length > 0) {
          const { data: assignData } = await supabaseAdmin
            .from("profile_departments")
            .select("profile_id, department_id, is_primary")
            .in("profile_id", profileIds);

          if (assignData) {
            assignments = assignData as ProfileDepartmentAssignment[];
          }
        }

        // Get current user's role
        const { data: currentProfile } = await supabaseAdmin
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .single();

        currentUserRole = getRoleFromProfile(currentProfile);
      }
    }
  }

  return (
    <StaffManagementView
      departments={departments}
      profiles={profiles}
      assignments={assignments}
      currentUserRole={currentUserRole}
    />
  );
}
