import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type Stripe from "stripe";

export async function POST(request: Request) {
  const body = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "No signature" }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: `Webhook signature verification failed: ${message}` },
      { status: 400 }
    );
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.metadata?.user_id;
      const tier = session.metadata?.tier;
      const organizationId = session.metadata?.organization_id;
      const customerId =
        typeof session.customer === "string"
          ? session.customer
          : session.customer?.id;

      if (userId && tier) {
        // Update user metadata
        await supabaseAdmin.auth.admin.updateUserById(userId, {
          user_metadata: {
            subscription_tier: tier,
            stripe_customer_id: customerId,
          },
        });

        // Update organizations table
        if (organizationId) {
          // Try by slug first
          const { data } = await supabaseAdmin
            .from("organizations")
            .update({
              subscription_tier: tier,
              stripe_customer_id: customerId,
            })
            .eq("slug", organizationId)
            .select();

          // If no rows matched by slug, try by owner_id
          if (!data || data.length === 0) {
            await supabaseAdmin
              .from("organizations")
              .update({
                subscription_tier: tier,
                stripe_customer_id: customerId,
              })
              .eq("owner_id", userId);
          }
        }
      }
      break;
    }

    case "customer.subscription.updated": {
      const subscription = event.data.object as Stripe.Subscription;
      const customerId =
        typeof subscription.customer === "string"
          ? subscription.customer
          : subscription.customer?.id;

      if (customerId) {
        const priceId = subscription.items.data[0]?.price.id;
        const tier = getTierFromPriceId(priceId);

        if (tier) {
          // Update organizations table by stripe_customer_id
          await supabaseAdmin
            .from("organizations")
            .update({ subscription_tier: tier })
            .eq("stripe_customer_id", customerId);

          // Also update user metadata
          const { data } = await supabaseAdmin.auth.admin.listUsers();
          const user = data.users.find(
            (u) => u.user_metadata?.stripe_customer_id === customerId
          );
          if (user) {
            await supabaseAdmin.auth.admin.updateUserById(user.id, {
              user_metadata: { subscription_tier: tier },
            });
          }
        }
      }
      break;
    }

    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      const customerId =
        typeof subscription.customer === "string"
          ? subscription.customer
          : subscription.customer?.id;

      if (customerId) {
        // Update organizations table
        await supabaseAdmin
          .from("organizations")
          .update({ subscription_tier: null })
          .eq("stripe_customer_id", customerId);

        // Update user metadata
        const { data } = await supabaseAdmin.auth.admin.listUsers();
        const user = data.users.find(
          (u) => u.user_metadata?.stripe_customer_id === customerId
        );
        if (user) {
          await supabaseAdmin.auth.admin.updateUserById(user.id, {
            user_metadata: { subscription_tier: null },
          });
        }
      }
      break;
    }
  }

  return NextResponse.json({ received: true });
}

function getTierFromPriceId(priceId: string | undefined): string | null {
  if (!priceId) return null;
  if (priceId === process.env.STRIPE_PRICE_WORKSPACE) return "workspace";
  if (priceId === process.env.STRIPE_PRICE_SUITE) return "suite";
  if (priceId === process.env.STRIPE_PRICE_ULTIMATE) return "ultimate";
  return null;
}
