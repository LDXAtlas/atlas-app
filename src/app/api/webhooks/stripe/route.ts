import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getAllocationsForTier } from "@/lib/tier-allocations";
import type Stripe from "stripe";

export async function POST(request: Request) {
  console.log("=== STRIPE WEBHOOK RECEIVED ===");

  const body = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    console.log("WEBHOOK ERROR: No stripe-signature header");
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
    console.log("WEBHOOK ERROR: Signature verification failed:", message);
    return NextResponse.json(
      { error: `Webhook signature verification failed: ${message}` },
      { status: 400 }
    );
  }

  console.log("WEBHOOK EVENT TYPE:", event.type);

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

      console.log("CHECKOUT COMPLETED:", { userId, tier, organizationId, customerId });

      if (userId && tier) {
        // Update user metadata
        await supabaseAdmin.auth.admin.updateUserById(userId, {
          user_metadata: {
            subscription_tier: tier,
            stripe_customer_id: customerId,
          },
        });

        // Update organizations table with tier + allocations
        const allocations = getAllocationsForTier(tier);
        if (organizationId) {
          // Try by slug first
          const { data } = await supabaseAdmin
            .from("organizations")
            .update({
              subscription_tier: tier,
              stripe_customer_id: customerId,
              ...allocations,
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
                ...allocations,
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

      console.log("SUBSCRIPTION UPDATED:", { customerId });

      if (customerId) {
        const priceId = subscription.items.data[0]?.price.id;
        const tier = getTierFromPriceId(priceId);

        console.log("SUBSCRIPTION UPDATED — priceId:", priceId, "→ tier:", tier);

        if (tier) {
          // Update organizations table by stripe_customer_id with allocations
          const allocations = getAllocationsForTier(tier);
          const { data: orgData, error: orgError } = await supabaseAdmin
            .from("organizations")
            .update({ subscription_tier: tier, ...allocations })
            .eq("stripe_customer_id", customerId)
            .select();

          console.log("SUBSCRIPTION UPDATED — org update:", orgError ? `ERROR: ${orgError.message}` : `SUCCESS (${orgData?.length} rows)`);

          // Also update user metadata
          const { data } = await supabaseAdmin.auth.admin.listUsers();
          const user = data.users.find(
            (u) => u.user_metadata?.stripe_customer_id === customerId
          );
          if (user) {
            await supabaseAdmin.auth.admin.updateUserById(user.id, {
              user_metadata: { subscription_tier: tier },
            });
            console.log("SUBSCRIPTION UPDATED — user metadata updated for:", user.id);
          } else {
            console.log("SUBSCRIPTION UPDATED — no user found with stripe_customer_id:", customerId);
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

      console.log("SUBSCRIPTION DELETED:", { customerId });

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

  console.log("=== WEBHOOK PROCESSED SUCCESSFULLY ===");
  return NextResponse.json({ received: true });
}

function getTierFromPriceId(priceId: string | undefined): string | null {
  if (!priceId) return null;
  if (priceId === process.env.STRIPE_PRICE_WORKSPACE) return "workspace";
  if (priceId === process.env.STRIPE_PRICE_SUITE) return "suite";
  if (priceId === process.env.STRIPE_PRICE_ULTIMATE) return "ultimate";
  return null;
}
