import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // If user already has a subscription tier, send them to dashboard
  if (user.user_metadata?.subscription_tier) {
    redirect("/dashboard");
  }

  return (
    <div className="min-h-screen bg-white">
      {children}
    </div>
  );
}
