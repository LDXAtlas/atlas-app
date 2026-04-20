import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PlanSelector } from "./plan-selector";

export default async function SelectPlanPage({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // If user already has a subscription, skip plan selection
  if (user?.user_metadata?.subscription_tier) {
    redirect("/dashboard");
  }

  return <PlanSelector searchParamsPromise={searchParams} />;
}
