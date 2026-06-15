import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getRoleFromProfile } from "@/lib/permissions";
import { getHuddles } from "@/app/actions/huddles";
import { HuddleList } from "./_components/huddle-list";

export default async function HuddlesPage() {
  await connection();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="p-8 text-center text-[#6B7280]">
        Sign in to use Huddles.
      </div>
    );
  }

  const slug = user.user_metadata?.organization_slug;
  if (!slug) {
    return (
      <div className="p-8 text-center text-[#6B7280]">
        No organization context found.
      </div>
    );
  }

  const { data: org } = await supabaseAdmin
    .from("organizations")
    .select("id")
    .eq("slug", slug)
    .single();
  if (!org) {
    return (
      <div className="p-8 text-center text-[#6B7280]">
        Organization not found.
      </div>
    );
  }

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  const role = getRoleFromProfile(profile);
  const canCreate = ["admin", "staff", "leader"].includes(role);

  const [initialRes, deptsRes, profilesRes] = await Promise.all([
    getHuddles({ filter: "upcoming" }),
    supabaseAdmin
      .from("departments")
      .select("id, name, color")
      .eq("organization_id", org.id)
      .order("name", { ascending: true }),
    supabaseAdmin
      .from("profiles")
      .select("id, full_name, email")
      .eq("organization_id", org.id)
      .order("full_name", { ascending: true }),
  ]);

  const orgProfiles = (profilesRes.data ?? []).map(
    (p: { id: string; full_name: string | null; email: string | null }) => ({
      id: p.id,
      full_name: p.full_name || p.email?.split("@")[0] || "Teammate",
    }),
  );

  return (
    <HuddleList
      initial={initialRes.success && initialRes.data ? initialRes.data : []}
      initialFilter="upcoming"
      canCreate={canCreate}
      departments={
        (deptsRes.data ?? []) as { id: string; name: string; color: string }[]
      }
      orgProfiles={orgProfiles}
    />
  );
}
