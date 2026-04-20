"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function completeOnboarding(tier: string, customerId: string) {
  console.log("=== ONBOARDING SUCCESS DEBUG ===");
  console.log("Tier received:", tier);
  console.log("Customer ID received:", customerId);

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    console.log("ERROR: No user found, redirecting to login");
    redirect("/login");
  }

  console.log("User ID:", user.id);
  console.log("User email:", user.email);
  console.log("User metadata:", JSON.stringify(user.user_metadata, null, 2));

  const organizationSlug = user.user_metadata?.organization_slug;
  console.log("Organization slug from metadata:", organizationSlug);

  // 1. Update user metadata via the user's own session
  const { error: authError } = await supabase.auth.updateUser({
    data: {
      subscription_tier: tier,
      stripe_customer_id: customerId,
    },
  });
  console.log("User metadata update result:", authError ? `ERROR: ${authError.message}` : "SUCCESS");

  // 2. Update organizations table using admin client (bypasses RLS)
  if (organizationSlug) {
    console.log("Attempting org update by slug:", organizationSlug);
    const { data: orgData, error: orgError } = await supabaseAdmin
      .from("organizations")
      .update({
        subscription_tier: tier,
        stripe_customer_id: customerId,
      })
      .eq("slug", organizationSlug)
      .select();

    console.log("Org update by slug result:", orgError ? `ERROR: ${orgError.message}` : "SUCCESS");
    console.log("Org update rows affected:", orgData?.length ?? 0);
    console.log("Org update data:", JSON.stringify(orgData, null, 2));

    if (!orgData || orgData.length === 0) {
      console.log("No org found by slug, trying by owner_id:", user.id);
      const { data: orgData2, error: orgError2 } = await supabaseAdmin
        .from("organizations")
        .update({
          subscription_tier: tier,
          stripe_customer_id: customerId,
        })
        .eq("owner_id", user.id)
        .select();

      console.log("Org update by owner_id result:", orgError2 ? `ERROR: ${orgError2.message}` : "SUCCESS");
      console.log("Org update by owner_id rows:", orgData2?.length ?? 0);
      console.log("Org update by owner_id data:", JSON.stringify(orgData2, null, 2));
    }
  } else {
    console.log("No org slug in metadata, trying by owner_id:", user.id);
    const { data: orgData, error: orgError } = await supabaseAdmin
      .from("organizations")
      .update({
        subscription_tier: tier,
        stripe_customer_id: customerId,
      })
      .eq("owner_id", user.id)
      .select();

    console.log("Org update by owner_id result:", orgError ? `ERROR: ${orgError.message}` : "SUCCESS");
    console.log("Org update by owner_id rows:", orgData?.length ?? 0);
    console.log("Org update by owner_id data:", JSON.stringify(orgData, null, 2));
  }

  // 3. Also log what the org table currently looks like for this user
  const { data: currentOrg } = await supabaseAdmin
    .from("organizations")
    .select("*")
    .or(`slug.eq.${organizationSlug},owner_id.eq.${user.id}`)
    .limit(5);
  console.log("Current org records for this user:", JSON.stringify(currentOrg, null, 2));
  console.log("=== END ONBOARDING SUCCESS DEBUG ===");

  redirect("/dashboard");
}
