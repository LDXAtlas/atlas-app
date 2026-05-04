import { redirect } from "next/navigation";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getBoard } from "@/app/actions/boards";
import { getRoleFromProfile } from "@/lib/permissions";
import type { Role } from "@/lib/permissions";
import { BoardView } from "./_components/board-view";

export default async function BoardDetailPage({
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
  if (!user) redirect("/login");

  // Resolve viewer role + load org members for the assignee dropdown.
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("role, organization_id")
    .eq("id", user.id)
    .single();
  const viewerRole: Role = getRoleFromProfile(profile);

  const { data: detail, error } = await getBoard(id);
  if (!detail) {
    // Bounce back to the list on missing or no-access. Phase 1's list page
    // is the canonical fallback; we can layer a toast in Phase 3.
    redirect("/workspace/projects");
  }

  // Fetch org-wide profiles for the assignee dropdown in quick-add card.
  let orgProfiles: { id: string; full_name: string }[] = [];
  if (profile?.organization_id) {
    const { data: profs } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, email")
      .eq("organization_id", profile.organization_id)
      .order("full_name", { ascending: true });
    orgProfiles = (profs ?? []).map(
      (p: { id: string; full_name: string | null; email: string | null }) => ({
        id: p.id,
        full_name: p.full_name || p.email?.split("@")[0] || "Unnamed",
      }),
    );
  }

  // Suppress the lint warning about `error` being unused — we read it for
  // future telemetry but currently rely on the `!detail` redirect above.
  void error;

  return (
    <BoardView
      board={detail}
      viewerRole={viewerRole}
      viewerId={user.id}
      orgProfiles={orgProfiles}
    />
  );
}
