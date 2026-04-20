import { redirect } from "next/navigation";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { AppShell } from "./_components/shell";

export type SubscriptionTier = "workspace" | "suite" | "ultimate";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await connection();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const userName =
    user.user_metadata?.full_name || user.email || "User";

  // Fetch organization subscription tier
  let tier: SubscriptionTier | null = null;
  const organizationSlug = user.user_metadata?.organization_slug;

  console.log("[AppLayout] Organization slug:", organizationSlug);

  if (organizationSlug) {
    // Use admin client to bypass RLS — ensures we always get the tier
    const { data: org, error: orgError } = await supabaseAdmin
      .from("organizations")
      .select("subscription_tier")
      .eq("slug", organizationSlug)
      .single();

    console.log("[AppLayout] Org query result:", { org, error: orgError?.message });

    if (org?.subscription_tier) {
      tier = org.subscription_tier.trim().toLowerCase() as SubscriptionTier;
    }
  }

  console.log("[AppLayout] Tier passed to AppShell:", tier);

  return (
    <AppShell userName={userName} tier={tier}>
      {children}
    </AppShell>
  );
}
