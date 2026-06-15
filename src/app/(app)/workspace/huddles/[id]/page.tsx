import { connection } from "next/server";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getHuddle } from "@/app/actions/huddles";
import { HuddleDetailView } from "../_components/huddle-detail";

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

  return <HuddleDetailView initial={res.data} departments={departments} />;
}
