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
    success_url: `${process.env.NEXT_PUBLIC_SITE_URL || "https://app.atlaschurchsolutions.com"}/onboarding/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${process.env.NEXT_PUBLIC_SITE_URL || "https://app.atlaschurchsolutions.com"}/onboarding/select-plan`,
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

  const returnUrl = `${process.env.NEXT_PUBLIC_SITE_URL || "https://app.atlaschurchsolutions.com"}/settings/subscription`;

  // Try creating a portal with full plan switching, fall back to basic portal
  let sessionUrl: string;

  try {
    console.log("=== BILLING PORTAL DEBUG ===");
    console.log("Customer ID:", stripeCustomerId);
    console.log("STRIPE_PRODUCT_WORKSPACE:", process.env.STRIPE_PRODUCT_WORKSPACE);
    console.log("STRIPE_PRODUCT_SUITE:", process.env.STRIPE_PRODUCT_SUITE);
    console.log("STRIPE_PRODUCT_ULTIMATE:", process.env.STRIPE_PRODUCT_ULTIMATE);
    console.log("STRIPE_PRICE_WORKSPACE:", process.env.STRIPE_PRICE_WORKSPACE);
    console.log("STRIPE_PRICE_SUITE:", process.env.STRIPE_PRICE_SUITE);
    console.log("STRIPE_PRICE_ULTIMATE:", process.env.STRIPE_PRICE_ULTIMATE);

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
              product: process.env.STRIPE_PRODUCT_WORKSPACE!,
              prices: [process.env.STRIPE_PRICE_WORKSPACE!],
            },
            {
              product: process.env.STRIPE_PRODUCT_SUITE!,
              prices: [process.env.STRIPE_PRICE_SUITE!],
            },
            {
              product: process.env.STRIPE_PRODUCT_ULTIMATE!,
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

    console.log("Portal configuration created:", configuration.id);

    const session = await stripe.billingPortal.sessions.create({
      customer: stripeCustomerId,
      configuration: configuration.id,
      return_url: returnUrl,
    });

    sessionUrl = session.url;
  } catch (err) {
    console.error("=== BILLING PORTAL ERROR ===");
    console.error("Full error:", err);
    if (err && typeof err === "object" && "message" in err) {
      console.error("Error message:", (err as { message: string }).message);
    }
    if (err && typeof err === "object" && "raw" in err) {
      console.error("Raw error:", (err as { raw: unknown }).raw);
    }

    // Fallback: create a basic portal session without custom configuration
    console.log("Falling back to basic portal session (no plan switching)");
    const session = await stripe.billingPortal.sessions.create({
      customer: stripeCustomerId,
      return_url: returnUrl,
    });

    sessionUrl = session.url;
  }

  redirect(sessionUrl);
}
