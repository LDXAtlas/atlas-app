import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { stripe } from "@/lib/stripe";
import { SuccessRedirect } from "./success-redirect";

export default async function OnboardingSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string }>;
}) {
  const { session_id } = await searchParams;

  console.log("=== SUCCESS PAGE DEBUG ===");
  console.log("session_id from URL:", session_id);

  if (!session_id) {
    console.log("No session_id, redirecting to select-plan");
    redirect("/onboarding/select-plan");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Retrieve the Stripe checkout session
  let tier = "workspace";
  let customerId = "";

  try {
    const session = await stripe.checkout.sessions.retrieve(session_id);
    console.log("Full Stripe session:", JSON.stringify({
      id: session.id,
      metadata: session.metadata,
      customer: session.customer,
      subscription: session.subscription,
      status: session.status,
      payment_status: session.payment_status,
    }, null, 2));

    tier = (session.metadata?.tier as string) || "workspace";
    customerId =
      typeof session.customer === "string"
        ? session.customer
        : session.customer?.id || "";

    console.log("Extracted tier:", tier);
    console.log("Extracted customerId:", customerId);
  } catch (err) {
    console.log("ERROR retrieving Stripe session:", err);
  }

  console.log("Passing to SuccessRedirect — tier:", tier, "customerId:", customerId);
  console.log("=== END SUCCESS PAGE DEBUG ===");

  return <SuccessRedirect tier={tier} customerId={customerId} />;
}
