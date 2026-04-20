import { redirect } from "next/navigation";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export default async function ServeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await connection();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const organizationSlug = user.user_metadata?.organization_slug;

  if (organizationSlug) {
    // Use admin client to bypass RLS
    const { data: org } = await supabaseAdmin
      .from("organizations")
      .select("subscription_tier")
      .eq("slug", organizationSlug)
      .single();

    const tier = org?.subscription_tier?.trim().toLowerCase();

    if (!tier || tier === "workspace") {
      redirect("/upgrade/serve");
    }
  }

  return <>{children}</>;
}
