import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { StaffManagementView } from "./staff-view";

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

export default async function StaffManagementPage() {
  await connection();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let departments: Department[] = [];

  if (user) {
    const slug = user.user_metadata?.organization_slug;
    if (slug) {
      const { data: org } = await supabaseAdmin
        .from("organizations")
        .select("id")
        .eq("slug", slug)
        .single();

      if (org?.id) {
        const { data, error } = await supabaseAdmin
          .from("departments")
          .select("*")
          .eq("organization_id", org.id)
          .order("name", { ascending: true });

        if (!error && data) {
          departments = data as Department[];
        }
      }
    }
  }

  return <StaffManagementView departments={departments} />;
}
