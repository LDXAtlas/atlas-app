import { createClient } from "@/lib/supabase/server";
import { SubscriptionManager } from "./subscription-manager";

export default async function SubscriptionPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const tier = user?.user_metadata?.subscription_tier || null;
  const stripeCustomerId = user?.user_metadata?.stripe_customer_id || null;

  return (
    <SubscriptionManager
      currentTier={tier}
      hasStripeCustomer={!!stripeCustomerId}
    />
  );
}
