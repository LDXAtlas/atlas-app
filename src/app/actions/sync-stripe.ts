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
  console.log("=== SYNC WITH STRIPE START ===");

  // Verify admin client has correct key
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  console.log("SUPABASE_SERVICE_ROLE_KEY exists:", !!serviceRoleKey);
  console.log("SUPABASE_SERVICE_ROLE_KEY starts with:", serviceRoleKey?.substring(0, 10));

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    console.log("ERROR: No user found");
    return { success: false, tier: null, error: "Not authenticated" };
  }

  const orgSlug = user.user_metadata?.organization_slug;
  const stripeCustomerId = user.user_metadata?.stripe_customer_id;

  console.log("User ID:", user.id);
  console.log("Org slug:", orgSlug);
  console.log("Stripe customer:", stripeCustomerId);

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
  console.log("ENV price IDs — workspace:", process.env.STRIPE_PRICE_WORKSPACE, "suite:", process.env.STRIPE_PRICE_SUITE, "ultimate:", process.env.STRIPE_PRICE_ULTIMATE);

  const tier = getTierFromPriceId(priceId);
  console.log("Mapped tier:", tier);

  if (!tier) {
    return { success: false, tier: null, error: `Unknown price ID: ${priceId}` };
  }

  // Update organizations table with tier and allocations
  const allocations = getAllocationsForTier(tier);
  const updateData = { subscription_tier: tier, ...allocations };
  console.log("Update payload:", JSON.stringify(updateData));
  console.log("WHERE clause: slug =", orgSlug);

  if (orgSlug) {
    const { data: updateResult, error: orgError, count } = await supabaseAdmin
      .from("organizations")
      .update(updateData)
      .eq("slug", orgSlug)
      .select();

    console.log("Update result — error:", orgError ? JSON.stringify(orgError) : "none");
    console.log("Update result — data:", JSON.stringify(updateResult));
    console.log("Update result — rows returned:", updateResult?.length ?? 0);

    // Read back the row to confirm
    const { data: readBack, error: readError } = await supabaseAdmin
      .from("organizations")
      .select("id, slug, subscription_tier, seat_limit, ai_credits_limit")
      .eq("slug", orgSlug)
      .single();

    console.log("READ BACK after update:", JSON.stringify(readBack));
    console.log("READ BACK error:", readError ? JSON.stringify(readError) : "none");
  } else {
    const { data: updateResult, error: orgError } = await supabaseAdmin
      .from("organizations")
      .update(updateData)
      .eq("owner_id", user.id)
      .select();

    console.log("Update by owner_id — error:", orgError ? JSON.stringify(orgError) : "none");
    console.log("Update by owner_id — data:", JSON.stringify(updateResult));

    const { data: readBack } = await supabaseAdmin
      .from("organizations")
      .select("id, slug, subscription_tier, seat_limit, ai_credits_limit")
      .eq("owner_id", user.id)
      .single();

    console.log("READ BACK after update:", JSON.stringify(readBack));
  }

  // Also update user metadata
  const { error: metaError } = await supabase.auth.updateUser({
    data: { subscription_tier: tier },
  });
  console.log("User metadata update:", metaError ? `ERROR: ${metaError.message}` : "SUCCESS");

  console.log("=== SYNC COMPLETE — tier:", tier, "===");

  revalidatePath("/settings/subscription");
  revalidatePath("/");

  return { success: true, tier };
}
