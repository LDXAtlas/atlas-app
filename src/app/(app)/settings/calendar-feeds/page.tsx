import { getFeedTokens } from "@/app/actions/calendar-feeds";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { CalendarFeedsClient } from "./calendar-feeds-client";

export default async function CalendarFeedsPage() {
  const tokens = await getFeedTokens();

  // Fetch departments for the create modal
  let departments: { id: string; name: string }[] = [];
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const slug = user.user_metadata?.organization_slug;
    if (slug) {
      const { data: org } = await supabaseAdmin
        .from("organizations")
        .select("id")
        .eq("slug", slug)
        .single();

      if (org) {
        const { data: depts } = await supabaseAdmin
          .from("departments")
          .select("id, name")
          .eq("organization_id", org.id)
          .order("name", { ascending: true });

        departments = depts || [];
      }
    }
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "";

  return (
    <CalendarFeedsClient
      initialTokens={tokens}
      departments={departments}
      baseUrl={baseUrl}
    />
  );
}
