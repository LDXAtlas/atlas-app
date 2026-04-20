"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { stripe } from "@/lib/stripe";

export type StripeTier = "workspace" | "suite" | "ultimate";

const PRICE_IDS: Record<StripeTier, string> = {
  workspace: process.env.STRIPE_PRICE_WORKSPACE!,
  suite: process.env.STRIPE_PRICE_SUITE!,
  ultimate: process.env.STRIPE_PRICE_ULTIMATE!,
};

export async function createCheckoutSession(tier: StripeTier) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const organizationId =
    user.user_metadata?.organization_slug || user.id;

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [
      {
        price: PRICE_IDS[tier],
        quantity: 1,
      },
    ],
    subscription_data: {
      trial_period_days: 30,
    },
    customer_email: user.email,
    success_url: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/onboarding/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/onboarding/select-plan`,
    metadata: {
      organization_id: organizationId,
      tier,
      user_id: user.id,
    },
  });

  if (session.url) {
    redirect(session.url);
  }
}

export async function createBillingPortalSession() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const stripeCustomerId = user.user_metadata?.stripe_customer_id;

  if (!stripeCustomerId) {
    redirect("/settings");
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: stripeCustomerId,
    return_url: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/settings`,
  });

  redirect(session.url);
}
