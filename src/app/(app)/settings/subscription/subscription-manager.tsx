"use client";

import { useState } from "react";
import { createBillingPortalSession } from "@/app/actions/stripe";
import { syncWithStripe } from "@/app/actions/sync-stripe";
import { Check, CreditCard, Users, Sparkles, Zap, Rocket, Crown, RefreshCw } from "lucide-react";

interface TierInfo {
  name: string;
  price: string;
  seats: number;
  credits: string;
  color: string;
  icon: typeof Zap;
  features: string[];
}

const TIERS: Record<string, TierInfo> = {
  workspace: {
    name: "Atlas Workspace",
    price: "$29.99/mo",
    seats: 5,
    credits: "500",
    color: "#5CE1A5",
    icon: Zap,
    features: ["Workspace module", "Announcements & Tasks", "Project Boards", "Unlimited Copilot"],
  },
  suite: {
    name: "Atlas Suite",
    price: "$79.99/mo",
    seats: 8,
    credits: "5,000",
    color: "#3B82F6",
    icon: Rocket,
    features: ["Workspace + Serve + Care", "Volunteer scheduling", "Care journal", "Priority support"],
  },
  ultimate: {
    name: "Atlas Ultimate",
    price: "$149.99/mo",
    seats: 15,
    credits: "20,000",
    color: "#F97316",
    icon: Crown,
    features: ["All features unlocked", "AI Workflows", "Ministry Hub", "Dedicated account manager"],
  },
};

interface SubscriptionManagerProps {
  currentTier: string | null;
  hasStripeCustomer: boolean;
  seatLimit?: number;
  aiCreditsLimit?: number;
}

export function SubscriptionManager({ currentTier, hasStripeCustomer, seatLimit = 5, aiCreditsLimit = 500 }: SubscriptionManagerProps) {
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const tierInfo = currentTier ? TIERS[currentTier] : null;
  const TierIcon = tierInfo?.icon || Zap;
  const tierColor = tierInfo?.color || "#5CE1A5";

  async function handleManageSubscription() {
    setLoading(true);
    await createBillingPortalSession();
  }

  async function handleSync() {
    setSyncing(true);
    setSyncMessage(null);
    const result = await syncWithStripe();
    setSyncing(false);
    if (result.success) {
      setSyncMessage(`Synced — ${result.tier}`);
      setTimeout(() => setSyncMessage(null), 3000);
    } else {
      setSyncMessage(result.error || "Sync failed");
      setTimeout(() => setSyncMessage(null), 5000);
    }
  }

  return (
    <div className="max-w-4xl">
      <h2
        className="text-2xl font-semibold text-[#2D333A] mb-6"
        style={{ fontFamily: "var(--font-poppins)" }}
      >
        Subscription
      </h2>

      {/* Current plan */}
      <div className="bg-white rounded-2xl border border-[#E5E7EB] p-6 mb-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            {/* Tier icon badge */}
            <div
              className="size-11 rounded-xl flex items-center justify-center shrink-0"
              style={{ backgroundColor: `${tierColor}12` }}
            >
              <TierIcon className="size-5" style={{ color: tierColor }} />
            </div>
            <div>
              <h3
                className="text-[16px] font-semibold text-[#2D333A]"
                style={{ fontFamily: "var(--font-poppins)" }}
              >
                {tierInfo ? tierInfo.name : "No Active Plan"}
              </h3>
              <p
                className="text-[14px] mt-0.5"
                style={{ fontFamily: "var(--font-source-sans)", color: tierInfo ? tierColor : "#6B7280" }}
              >
                {tierInfo ? tierInfo.price : "No active subscription"}
              </p>
            </div>
          </div>
          {hasStripeCustomer && (
            <div className="flex items-center gap-2">
              <button
                onClick={handleManageSubscription}
                disabled={loading}
                className="h-10 px-5 rounded-xl text-white text-[13px] font-semibold hover:opacity-90 transition-all disabled:opacity-50"
                style={{ fontFamily: "var(--font-poppins)", backgroundColor: tierColor }}
              >
                <CreditCard className="size-4 inline mr-2" />
                {loading ? "Loading..." : "Manage Subscription"}
              </button>
              <button
                onClick={handleSync}
                disabled={syncing}
                className="h-10 px-3 rounded-xl bg-[#F4F5F7] border border-[#E5E7EB] text-[#6B7280] text-[12px] font-medium hover:border-[#5CE1A5] hover:text-[#5CE1A5] transition-all disabled:opacity-50"
                style={{ fontFamily: "var(--font-poppins)" }}
                title="Sync subscription tier with Stripe"
              >
                <RefreshCw className={`size-4 ${syncing ? "animate-spin" : ""}`} />
              </button>
              {syncMessage && (
                <span
                  className="text-[12px] font-medium text-[#5CE1A5]"
                  style={{ fontFamily: "var(--font-source-sans)" }}
                >
                  {syncMessage}
                </span>
              )}
            </div>
          )}
        </div>

        {tierInfo && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <div className="bg-[#F4F5F7] rounded-xl p-4">
              <div className="flex items-center gap-2 text-[#6B7280] text-[12px] font-medium mb-1" style={{ fontFamily: "var(--font-source-sans)" }}>
                <Users className="size-3.5" />
                Seats
              </div>
              <p className="text-[#2D333A] text-[18px] font-semibold" style={{ fontFamily: "var(--font-poppins)" }}>
                1 <span className="text-[#6B7280] text-[13px] font-normal">/ {seatLimit}</span>
              </p>
            </div>
            <div className="bg-[#F4F5F7] rounded-xl p-4">
              <div className="flex items-center gap-2 text-[#6B7280] text-[12px] font-medium mb-1" style={{ fontFamily: "var(--font-source-sans)" }}>
                <Sparkles className="size-3.5" />
                AI Credits
              </div>
              <p className="text-[#2D333A] text-[18px] font-semibold" style={{ fontFamily: "var(--font-poppins)" }}>
                0 <span className="text-[#6B7280] text-[13px] font-normal">/ {aiCreditsLimit.toLocaleString()}</span>
              </p>
            </div>
            <div className="bg-[#F4F5F7] rounded-xl p-4">
              <div className="flex items-center gap-2 text-[#6B7280] text-[12px] font-medium mb-1" style={{ fontFamily: "var(--font-source-sans)" }}>
                <CreditCard className="size-3.5" />
                Next Billing
              </div>
              <p className="text-[#2D333A] text-[14px] font-semibold" style={{ fontFamily: "var(--font-poppins)" }}>
                —
              </p>
            </div>
          </div>
        )}

        {tierInfo && (
          <div>
            <h4
              className="text-[13px] font-semibold text-[#2D333A] mb-3"
              style={{ fontFamily: "var(--font-poppins)" }}
            >
              Plan Features
            </h4>
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {tierInfo.features.map((f) => (
                <li
                  key={f}
                  className="flex items-center gap-2 text-[13px] text-[#2D333A]"
                  style={{ fontFamily: "var(--font-source-sans)" }}
                >
                  <Check className="size-3.5 shrink-0" style={{ color: tierColor }} />
                  {f}
                </li>
              ))}
            </ul>
          </div>
        )}

        {hasStripeCustomer && (
          <p
            className="mt-6 text-[12px] text-[#9CA3AF]"
            style={{ fontFamily: "var(--font-source-sans)" }}
          >
            To upgrade, downgrade, update payment method, or cancel — click &ldquo;Manage Subscription&rdquo; above.
          </p>
        )}
      </div>
    </div>
  );
}
