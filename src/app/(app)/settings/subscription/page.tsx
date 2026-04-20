import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { SubscriptionManager } from "./subscription-manager";

export default async function SubscriptionPage() {
  await connection();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const stripeCustomerId = user?.user_metadata?.stripe_customer_id || null;
  const organizationSlug = user?.user_metadata?.organization_slug;

  let tier: string | null = null;
  let seatLimit = 5;
  let aiCreditsLimit = 500;

  if (organizationSlug) {
    const { data: org } = await supabaseAdmin
      .from("organizations")
      .select("subscription_tier, seat_limit, ai_credits_limit")
      .eq("slug", organizationSlug)
      .single();

    if (org) {
      tier = org.subscription_tier;
      seatLimit = org.seat_limit ?? 5;
      aiCreditsLimit = org.ai_credits_limit ?? 500;
    }
  }

  return (
    <SubscriptionManager
      currentTier={tier}
      hasStripeCustomer={!!stripeCustomerId}
      seatLimit={seatLimit}
      aiCreditsLimit={aiCreditsLimit}
    />
  );
}
