import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SignOutButton } from "./sign-out-button";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const fullName =
    user.user_metadata?.full_name || user.email || "there";

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-white px-4">
      <h1
        className="text-3xl font-bold text-foreground"
        style={{ fontFamily: "var(--font-poppins), system-ui, sans-serif" }}
      >
        Welcome, <span className="text-mint">{fullName}</span>
      </h1>
      <p
        className="mt-3 text-gray-500"
        style={{
          fontFamily: "var(--font-source-sans), system-ui, sans-serif",
        }}
      >
        Your Atlas dashboard is coming soon.
      </p>
      <SignOutButton />
    </div>
  );
}
