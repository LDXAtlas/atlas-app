"use client";

import Link from "next/link";

interface SubscriptionOverviewProps {
  tier: string;
  seatLimit: number;
  aiCreditsLimit: number;
  totalMembers: number;
}

const TIER_COLORS: Record<string, string> = {
  workspace: "#5CE1A5",
  suite: "#3B82F6",
  ultimate: "#F97316",
};

const TIER_LABELS: Record<string, string> = {
  workspace: "Workspace",
  suite: "Suite",
  ultimate: "Ultimate",
};

export function SubscriptionOverview({
  tier,
  seatLimit,
  aiCreditsLimit,
  totalMembers,
}: SubscriptionOverviewProps) {
  const tierColor = TIER_COLORS[tier] || TIER_COLORS.workspace;
  const tierLabel = TIER_LABELS[tier] || "Workspace";
  const seatsUsed = Math.min(totalMembers, seatLimit);
  const seatPercent =
    seatLimit > 0 ? Math.min((seatsUsed / seatLimit) * 100, 100) : 0;
  const aiCreditsUsed = 0;
  const aiPercent =
    aiCreditsLimit > 0
      ? Math.min((aiCreditsUsed / aiCreditsLimit) * 100, 100)
      : 0;

  return (
    <div
      className="bg-white rounded-3xl p-6 h-full flex flex-col border border-[#E5E7EB]/50 transition-all duration-300 hover:border-[#D1D5DB] hover:shadow-[0_12px_30px_-8px_rgba(0,0,0,0.08)]"
      style={{
        boxShadow:
          "0 4px 20px -2px rgba(0,0,0,0.02), 0 1px 4px -1px rgba(0,0,0,0.02)",
      }}
    >
      {/* Tier heading */}
      <div className="flex items-center gap-2 mb-1">
        <div
          className="size-3 rounded-full shrink-0"
          style={{ backgroundColor: tierColor }}
        />
        <h3
          className="text-xl text-[#2D333A]"
          style={{ fontFamily: "var(--font-poppins)", fontWeight: 700 }}
        >
          {tierLabel}
        </h3>
      </div>

      {/* Tier badge */}
      <span
        className="inline-flex items-center self-start px-3 py-1 rounded-full text-[11px] uppercase tracking-wide mb-4"
        style={{
          fontFamily: "var(--font-poppins)",
          fontWeight: 600,
          backgroundColor: `${tierColor}15`,
          color: tierColor,
        }}
      >
        {tierLabel} Plan
      </span>

      {/* Divider */}
      <div className="h-px w-full bg-[#E5E7EB] mb-4" />

      {/* Seats usage */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <span
            className="text-[13px] text-[#6B7280]"
            style={{
              fontFamily: "var(--font-source-sans)",
              fontWeight: 500,
            }}
          >
            Seats
          </span>
          <span
            className="text-[13px] text-[#2D333A]"
            style={{
              fontFamily: "var(--font-poppins)",
              fontWeight: 600,
            }}
          >
            {seatsUsed} / {seatLimit}
          </span>
        </div>
        <div className="h-2 w-full rounded-full bg-[#F4F5F7] overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${seatPercent}%`,
              backgroundColor: "#5CE1A5",
            }}
          />
        </div>
      </div>

      {/* AI Credits usage */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <span
            className="text-[13px] text-[#6B7280]"
            style={{
              fontFamily: "var(--font-source-sans)",
              fontWeight: 500,
            }}
          >
            AI Credits
          </span>
          <span
            className="text-[13px] text-[#2D333A]"
            style={{
              fontFamily: "var(--font-poppins)",
              fontWeight: 600,
            }}
          >
            {aiCreditsUsed} / {aiCreditsLimit.toLocaleString()}
          </span>
        </div>
        <div className="h-2 w-full rounded-full bg-[#F4F5F7] overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${aiPercent}%`,
              backgroundColor: "#5CE1A5",
            }}
          />
        </div>
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Manage link */}
      <Link
        href="/settings/subscription"
        className="text-[13px] text-[#5CE1A5] hover:underline mt-2"
        style={{ fontFamily: "var(--font-source-sans)", fontWeight: 600 }}
      >
        Manage Subscription &rarr;
      </Link>
    </div>
  );
}
