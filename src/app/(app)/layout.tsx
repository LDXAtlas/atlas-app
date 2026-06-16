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

  // Avatar lives on the profiles row, not auth metadata. One small
  // query alongside the existing org fetch — threaded into the shell
  // for the sidebar bottom + topbar avatar slots.
  let userAvatarUrl: string | null = null;
  {
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("avatar_url")
      .eq("id", user.id)
      .maybeSingle();
    userAvatarUrl = profile?.avatar_url ?? null;
  }

  // Fetch organization subscription tier + name + logo for the sidebar
  // brand block. Single query — the tier was already being pulled here.
  let tier: SubscriptionTier | null = null;
  let orgName: string | null = null;
  let orgLogoUrl: string | null = null;
  const organizationSlug = user.user_metadata?.organization_slug;

  console.log("[AppLayout] Organization slug:", organizationSlug);

  if (organizationSlug) {
    // Use admin client to bypass RLS — ensures we always get the tier
    const { data: org, error: orgError } = await supabaseAdmin
      .from("organizations")
      .select("subscription_tier, name, logo_url")
      .eq("slug", organizationSlug)
      .single();

    console.log("[AppLayout] Org query result:", { org, error: orgError?.message });

    if (org?.subscription_tier) {
      tier = org.subscription_tier.trim().toLowerCase() as SubscriptionTier;
    }
    orgName = (org as { name?: string | null } | null)?.name ?? null;
    orgLogoUrl =
      (org as { logo_url?: string | null } | null)?.logo_url ?? null;
  }

  console.log("[AppLayout] Tier passed to AppShell:", tier);

  return (
    <AppShell
      userName={userName}
      userId={user.id}
      userAvatarUrl={userAvatarUrl}
      tier={tier}
      orgName={orgName}
      orgLogoUrl={orgLogoUrl}
    >
      {children}
    </AppShell>
  );
}
