import { redirect } from "next/navigation";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";

export default async function WorkflowsLayout({
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
    const { data: org } = await supabase
      .from("organizations")
      .select("subscription_tier")
      .eq("slug", organizationSlug)
      .single();

    const tier = org?.subscription_tier;
    if (tier === "workspace" || tier === "suite") {
      redirect("/upgrade/workflows");
    }
  }

  return <>{children}</>;
}
