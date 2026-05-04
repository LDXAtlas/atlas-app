import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getDirectoryPeople } from "@/app/actions/members";
import { getRoleFromProfile } from "@/lib/permissions";
import type { Role } from "@/lib/permissions";
import type { DirectoryPerson } from "@/app/actions/members";
import { PeopleList } from "./_components/people-list";
import { MinistryFilterBanner } from "../_components/ministry-filter-banner";

export default async function DirectoryPage({
  searchParams,
}: {
  searchParams: Promise<{ ministry?: string }>;
}) {
  await connection();
  const { ministry: ministryId } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let people: DirectoryPerson[] = [];
  let currentUserRole: Role = "member";
  const currentUserEmail = user?.email ?? "";
  let filterMinistry: { id: string; name: string; color: string; icon: string } | null = null;

  if (user) {
    const { data: currentProfile } = await supabaseAdmin
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    currentUserRole = getRoleFromProfile(currentProfile);

    const { data } = await getDirectoryPeople();
    people = data;

    if (ministryId) {
      // Filter to people whose primary or secondary department matches.
      // Members (no app account) don't have ministry assignments — so they
      // drop out of the filtered view, which matches the spec's intent.
      people = people.filter((p) => {
        if (p.primary_department?.id === ministryId) return true;
        return p.secondary_departments.some((d) => d.id === ministryId);
      });

      const slug = user.user_metadata?.organization_slug;
      if (slug) {
        const { data: org } = await supabaseAdmin
          .from("organizations")
          .select("id")
          .eq("slug", slug)
          .single();
        if (org?.id) {
          const { data: dept } = await supabaseAdmin
            .from("departments")
            .select("id, name, color, icon")
            .eq("id", ministryId)
            .eq("organization_id", org.id)
            .single();
          if (dept) {
            filterMinistry = {
              id: dept.id,
              name: dept.name,
              color: dept.color || "#5CE1A5",
              icon: dept.icon || "Building",
            };
          }
        }
      }
    }
  }

  return (
    <>
      {filterMinistry && (
        <MinistryFilterBanner ministry={filterMinistry} basePath="/directory" />
      )}
      <PeopleList
        people={people}
        currentUserRole={currentUserRole}
        currentUserEmail={currentUserEmail}
      />
    </>
  );
}
