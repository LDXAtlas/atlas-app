"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { stripe } from "@/lib/stripe";
import { getAllocationsForTier } from "@/lib/tier-allocations";

function getTierFromPriceId(priceId: string): string | null {
  if (priceId === process.env.STRIPE_PRICE_WORKSPACE) return "workspace";
  if (priceId === process.env.STRIPE_PRICE_SUITE) return "suite";
  if (priceId === process.env.STRIPE_PRICE_ULTIMATE) return "ultimate";
  return null;
}

export async function syncWithStripe(): Promise<{ success: boolean; tier: string | null; error?: string }> {
  console.log("=== SYNC WITH STRIPE ===");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, tier: null, error: "Not authenticated" };
  }

  const orgSlug = user.user_metadata?.organization_slug;
  const stripeCustomerId = user.user_metadata?.stripe_customer_id;

  console.log("User:", user.id, "Org slug:", orgSlug, "Stripe customer:", stripeCustomerId);

  if (!stripeCustomerId) {
    return { success: false, tier: null, error: "No Stripe customer ID found" };
  }

  // Get active subscription from Stripe
  let subscription = null;

  const activeSubs = await stripe.subscriptions.list({
    customer: stripeCustomerId,
    status: "active",
    limit: 1,
  });

  if (activeSubs.data.length > 0) {
    subscription = activeSubs.data[0];
    console.log("Found active subscription:", subscription.id);
  } else {
    // Try trialing
    const trialingSubs = await stripe.subscriptions.list({
      customer: stripeCustomerId,
      status: "trialing",
      limit: 1,
    });

    if (trialingSubs.data.length > 0) {
      subscription = trialingSubs.data[0];
      console.log("Found trialing subscription:", subscription.id);
    }
  }

  if (!subscription) {
    console.log("No active or trialing subscription found");
    return { success: false, tier: null, error: "No active subscription found in Stripe" };
  }

  const priceId = subscription.items.data[0]?.price.id;
  console.log("Price ID from Stripe:", priceId);

  const tier = getTierFromPriceId(priceId);
  console.log("Mapped tier:", tier);

  if (!tier) {
    return { success: false, tier: null, error: `Unknown price ID: ${priceId}` };
  }

  // Update organizations table with tier and allocations
  const allocations = getAllocationsForTier(tier);
  const updateData = { subscription_tier: tier, ...allocations };
  console.log("Update data:", updateData);

  if (orgSlug) {
    const { error: orgError } = await supabaseAdmin
      .from("organizations")
      .update(updateData)
      .eq("slug", orgSlug);

    console.log("Org update by slug:", orgError ? `ERROR: ${orgError.message}` : "SUCCESS");
  } else {
    const { error: orgError } = await supabaseAdmin
      .from("organizations")
      .update(updateData)
      .eq("owner_id", user.id);

    console.log("Org update by owner_id:", orgError ? `ERROR: ${orgError.message}` : "SUCCESS");
  }

  // Also update user metadata
  await supabase.auth.updateUser({
    data: { subscription_tier: tier },
  });

  console.log("=== SYNC COMPLETE — tier:", tier, "===");

  revalidatePath("/settings/subscription");
  revalidatePath("/");

  return { success: true, tier };
}
