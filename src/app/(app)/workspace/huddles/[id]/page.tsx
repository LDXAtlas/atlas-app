import { connection } from "next/server";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getHuddle } from "@/app/actions/huddles";
import { HuddleDetailView } from "../_components/huddle-detail";
import { HuddleRecordingProvider } from "@/components/huddle-recorder";

export default async function HuddleDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await connection();
  const { id } = await params;

  const res = await getHuddle(id);
  if (!res.success || !res.data) {
    notFound();
  }

  // Departments are fetched server-side for the settings panel so the
  // department dropdown is populated the first time the gear opens.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  let departments: { id: string; name: string }[] = [];
  if (user) {
    const slug = user.user_metadata?.organization_slug;
    if (slug) {
      const { data: org } = await supabaseAdmin
        .from("organizations")
        .select("id")
        .eq("slug", slug)
        .single();
      if (org?.id) {
        const { data } = await supabaseAdmin
          .from("departments")
          .select("id, name")
          .eq("organization_id", org.id)
          .order("name", { ascending: true });
        departments = (data ?? []) as { id: string; name: string }[];
      }
    }
  }

  // The provider owns the recording session (stream, MediaRecorder,
  // upload queue, heartbeat). It sits above the tabs so switching tabs —
  // which unmounts the Overview subtree, and with it the recorder card —
  // no longer kills a recording in progress.
  return (
    <HuddleRecordingProvider huddleId={id}>
      <HuddleDetailView initial={res.data} departments={departments} />
    </HuddleRecordingProvider>
  );
}
