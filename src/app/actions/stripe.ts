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

  // Check for existing Stripe customer to avoid duplicates
  const existingCustomers = await stripe.customers.list({
    email: user.email!,
    limit: 1,
  });
  const existingCustomer = existingCustomers.data[0];

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
    ...(existingCustomer
      ? { customer: existingCustomer.id }
      : { customer_email: user.email! }),
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

  const returnUrl = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/settings/subscription`;

  // Create a portal configuration with plan switching enabled
  const configuration = await stripe.billingPortal.configurations.create({
    business_profile: {
      headline: "Manage your Atlas subscription",
    },
    features: {
      subscription_update: {
        enabled: true,
        default_allowed_updates: ["price"],
        products: [
          {
            product: process.env.STRIPE_PRODUCT_WORKSPACE || "",
            prices: [process.env.STRIPE_PRICE_WORKSPACE!],
          },
          {
            product: process.env.STRIPE_PRODUCT_SUITE || "",
            prices: [process.env.STRIPE_PRICE_SUITE!],
          },
          {
            product: process.env.STRIPE_PRODUCT_ULTIMATE || "",
            prices: [process.env.STRIPE_PRICE_ULTIMATE!],
          },
        ],
      },
      subscription_cancel: {
        enabled: true,
        mode: "at_period_end",
      },
      payment_method_update: {
        enabled: true,
      },
      invoice_history: {
        enabled: true,
      },
    },
  });

  const session = await stripe.billingPortal.sessions.create({
    customer: stripeCustomerId,
    configuration: configuration.id,
    return_url: returnUrl,
  });

  redirect(session.url);
}
