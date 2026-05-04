import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getDirectoryPeople } from "@/app/actions/members";
import { getRoleFromProfile } from "@/lib/permissions";
import type { Role } from "@/lib/permissions";
import type { DirectoryPerson } from "@/app/actions/members";
import { PeopleList } from "./_components/people-list";

export default async function DirectoryPage() {
  await connection();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let people: DirectoryPerson[] = [];
  let currentUserRole: Role = "member";
  const currentUserEmail = user?.email ?? "";

  if (user) {
    const { data: currentProfile } = await supabaseAdmin
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    currentUserRole = getRoleFromProfile(currentProfile);

    const { data } = await getDirectoryPeople();
    people = data;
  }

  return (
    <PeopleList
      people={people}
      currentUserRole={currentUserRole}
      currentUserEmail={currentUserEmail}
    />
  );
}
