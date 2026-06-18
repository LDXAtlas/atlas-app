import Link from "next/link";
import { connection } from "next/server";
import { ArrowLeft, Sparkles } from "lucide-react";
import { getOrgAISettings } from "@/app/actions/ai-settings";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { AISettingsForm } from "./_components/ai-settings-form";

export default async function AISettingsPage() {
  await connection();
  const res = await getOrgAISettings();

  if (!res.success || !res.data) {
    return (
      <div className="max-w-3xl">
        <BackLink />
        <p
          className="text-[14px] text-[#6B7280]"
          style={{ fontFamily: "var(--font-source-sans)" }}
        >
          {res.success ? "AI settings not found." : res.error}
        </p>
      </div>
    );
  }

  // Fetch tier separately so the page can show the Workspace upgrade
  // nudge in the model-preference card without leaking tier into the
  // settings shape itself.
  const { data: org } = await supabaseAdmin
    .from("organizations")
    .select("subscription_tier")
    .eq("id", res.data.organizationId)
    .maybeSingle();
  const rawTier = (org?.subscription_tier as string | null)
    ?.trim()
    .toLowerCase();
  const tier: "workspace" | "suite" | "ultimate" | null =
    rawTier === "workspace" ||
    rawTier === "suite" ||
    rawTier === "ultimate"
      ? rawTier
      : null;

  return (
    <div className="max-w-3xl">
      <BackLink />

      <div className="flex items-start gap-3 mb-6">
        <div
          className="size-10 rounded-xl flex items-center justify-center shrink-0"
          style={{ backgroundColor: "rgba(92, 225, 165, 0.10)" }}
        >
          <Sparkles className="size-5 text-[#5CE1A5]" />
        </div>
        <div>
          <h1
            className="text-[24px] text-[#2D333A] leading-tight"
            style={{ fontFamily: "var(--font-poppins)", fontWeight: 700 }}
          >
            AI Control Center
          </h1>
          <p
            className="text-[14px] text-[#6B7280] mt-1 max-w-xl"
            style={{ fontFamily: "var(--font-source-sans)" }}
          >
            Configure how AI behaves across Atlas for your church.
            Guidelines and preferences here apply to every AI feature —
            summaries, chat, drafts, smart suggestions.
          </p>
        </div>
      </div>

      <AISettingsForm initial={res.data} tier={tier} />
    </div>
  );
}

function BackLink() {
  return (
    <Link
      href="/settings"
      className="inline-flex items-center gap-1.5 text-[13px] text-[#6B7280] hover:text-[#5CE1A5] transition-colors mb-4"
      style={{ fontFamily: "var(--font-source-sans)" }}
    >
      <ArrowLeft className="size-4" />
      Settings
    </Link>
  );
}
