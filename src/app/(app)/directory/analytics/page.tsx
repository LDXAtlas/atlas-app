import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { AnalyticsView } from "./analytics-view";

export default async function AnalyticsPage() {
  await connection();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let stats = { total: 0, active: 0, inactive: 0, visitors: 0, newThisMonth: 0 };

  if (user) {
    const slug = user.user_metadata?.organization_slug;
    if (slug) {
      const { data: org } = await supabaseAdmin
        .from("organizations")
        .select("id")
        .eq("slug", slug)
        .single();

      if (org?.id) {
        const { count: total } = await supabaseAdmin
          .from("members")
          .select("*", { count: "exact", head: true })
          .eq("organization_id", org.id);

        const { count: active } = await supabaseAdmin
          .from("members")
          .select("*", { count: "exact", head: true })
          .eq("organization_id", org.id)
          .eq("membership_status", "active");

        const { count: inactive } = await supabaseAdmin
          .from("members")
          .select("*", { count: "exact", head: true })
          .eq("organization_id", org.id)
          .eq("membership_status", "inactive");

        const { count: visitors } = await supabaseAdmin
          .from("members")
          .select("*", { count: "exact", head: true })
          .eq("organization_id", org.id)
          .eq("membership_status", "visitor");

        // New this month
        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);

        const { count: newThisMonth } = await supabaseAdmin
          .from("members")
          .select("*", { count: "exact", head: true })
          .eq("organization_id", org.id)
          .gte("created_at", startOfMonth.toISOString());

        stats = {
          total: total || 0,
          active: active || 0,
          inactive: inactive || 0,
          visitors: visitors || 0,
          newThisMonth: newThisMonth || 0,
        };
      }
    }
  }

  return <AnalyticsView stats={stats} />;
}
