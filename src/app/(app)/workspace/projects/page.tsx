import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getRoleFromProfile } from "@/lib/permissions";
import type { Role } from "@/lib/permissions";
import { getBoards } from "@/app/actions/boards";
import type { BoardSummary } from "@/app/actions/boards";
import { BoardsListView } from "./_components/boards-list";

export default async function ProjectsPage() {
  await connection();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let boards: BoardSummary[] = [];
  let viewerRole: Role = "member";
  let viewerId: string | null = null;
  let departments: { id: string; name: string; color: string }[] = [];

  if (user) {
    viewerId = user.id;
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    viewerRole = getRoleFromProfile(profile);

    const slug = user.user_metadata?.organization_slug;
    if (slug) {
      const { data: org } = await supabaseAdmin
        .from("organizations")
        .select("id")
        .eq("slug", slug)
        .single();
      if (org?.id) {
        const { data: deptRows } = await supabaseAdmin
          .from("departments")
          .select("id, name, color")
          .eq("organization_id", org.id)
          .order("name", { ascending: true });
        departments = (deptRows ?? []).map(
          (d: { id: string; name: string; color: string | null }) => ({
            id: d.id,
            name: d.name,
            color: d.color || "#5CE1A5",
          }),
        );
      }
    }

    const result = await getBoards();
    boards = result.data;
  }

  return (
    <BoardsListView
      boards={boards}
      departments={departments}
      viewerRole={viewerRole}
      viewerId={viewerId}
    />
  );
}
