"use client";

import { useState } from "react";
import { createCheckoutSession, createBillingPortalSession, type StripeTier } from "@/app/actions/stripe";
import { Check, CreditCard, Users, Sparkles } from "lucide-react";

interface TierInfo {
  name: string;
  price: string;
  seats: number;
  credits: string;
  features: string[];
}

const TIERS: Record<string, TierInfo> = {
  workspace: {
    name: "Atlas Workspace",
    price: "$29.99/mo",
    seats: 5,
    credits: "500",
    features: ["Workspace module", "Announcements & Tasks", "Project Boards", "Unlimited Copilot"],
  },
  suite: {
    name: "Atlas Suite",
    price: "$79.99/mo",
    seats: 8,
    credits: "5,000",
    features: ["Workspace + Serve + Care", "Volunteer scheduling", "Care journal", "Priority support"],
  },
  ultimate: {
    name: "Atlas Ultimate",
    price: "$149.99/mo",
    seats: 15,
    credits: "20,000",
    features: ["All features unlocked", "AI Workflows", "Ministry Hub", "Dedicated account manager"],
  },
};

interface SubscriptionManagerProps {
  currentTier: string | null;
  hasStripeCustomer: boolean;
}

export function SubscriptionManager({ currentTier, hasStripeCustomer }: SubscriptionManagerProps) {
  const [loading, setLoading] = useState<string | null>(null);
  const tierInfo = currentTier ? TIERS[currentTier] : null;

  async function handleManageSubscription() {
    setLoading("portal");
    await createBillingPortalSession();
  }

  async function handleChangePlan(tier: StripeTier) {
    setLoading(tier);
    await createCheckoutSession(tier);
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
          <div>
            <h3
              className="text-[16px] font-semibold text-[#2D333A]"
              style={{ fontFamily: "var(--font-poppins)" }}
            >
              {tierInfo ? tierInfo.name : "No Active Plan"}
            </h3>
            <p
              className="text-[#6B7280] text-[14px] mt-1"
              style={{ fontFamily: "var(--font-source-sans)" }}
            >
              {tierInfo ? tierInfo.price : "Select a plan to get started"}
            </p>
          </div>
          {hasStripeCustomer && (
            <button
              onClick={handleManageSubscription}
              disabled={loading === "portal"}
              className="h-10 px-5 rounded-xl bg-[#F4F5F7] border border-[#E5E7EB] text-[#2D333A] text-[13px] font-semibold hover:border-[#5CE1A5] hover:text-[#5CE1A5] transition-all disabled:opacity-50"
              style={{ fontFamily: "var(--font-poppins)" }}
            >
              <CreditCard className="size-4 inline mr-2" />
              {loading === "portal" ? "Loading..." : "Manage Subscription"}
            </button>
          )}
        </div>

        {tierInfo && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-[#F4F5F7] rounded-xl p-4">
              <div className="flex items-center gap-2 text-[#6B7280] text-[12px] font-medium mb-1" style={{ fontFamily: "var(--font-source-sans)" }}>
                <Users className="size-3.5" />
                Seats
              </div>
              <p className="text-[#2D333A] text-[18px] font-semibold" style={{ fontFamily: "var(--font-poppins)" }}>
                1 <span className="text-[#6B7280] text-[13px] font-normal">/ {tierInfo.seats}</span>
              </p>
            </div>
            <div className="bg-[#F4F5F7] rounded-xl p-4">
              <div className="flex items-center gap-2 text-[#6B7280] text-[12px] font-medium mb-1" style={{ fontFamily: "var(--font-source-sans)" }}>
                <Sparkles className="size-3.5" />
                AI Credits
              </div>
              <p className="text-[#2D333A] text-[18px] font-semibold" style={{ fontFamily: "var(--font-poppins)" }}>
                0 <span className="text-[#6B7280] text-[13px] font-normal">/ {tierInfo.credits}</span>
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
      </div>

      {/* Change plan section */}
      <h3
        className="text-[16px] font-semibold text-[#2D333A] mb-4"
        style={{ fontFamily: "var(--font-poppins)" }}
      >
        {currentTier ? "Change Plan" : "Select a Plan"}
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {(Object.entries(TIERS) as [StripeTier, TierInfo][]).map(([tierId, info]) => {
          const isCurrent = tierId === currentTier;
          return (
            <div
              key={tierId}
              className={`rounded-2xl border p-5 ${
                isCurrent
                  ? "border-[#5CE1A5] bg-[#5CE1A5]/5"
                  : "border-[#E5E7EB] bg-white"
              }`}
            >
              <h4
                className="text-[14px] font-semibold text-[#2D333A] mb-1"
                style={{ fontFamily: "var(--font-poppins)" }}
              >
                {info.name}
              </h4>
              <p
                className="text-[#6B7280] text-[13px] mb-4"
                style={{ fontFamily: "var(--font-source-sans)" }}
              >
                {info.price}
              </p>
              <ul className="space-y-2 mb-5">
                {info.features.slice(0, 3).map((f) => (
                  <li
                    key={f}
                    className="flex items-center gap-2 text-[13px] text-[#2D333A]"
                    style={{ fontFamily: "var(--font-source-sans)" }}
                  >
                    <Check className="size-3.5 text-[#5CE1A5] shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
              {isCurrent ? (
                <div
                  className="h-9 rounded-lg flex items-center justify-center text-[12px] font-semibold text-[#5CE1A5] bg-[#5CE1A5]/10"
                  style={{ fontFamily: "var(--font-poppins)" }}
                >
                  Current Plan
                </div>
              ) : (
                <button
                  onClick={() => handleChangePlan(tierId)}
                  disabled={loading === tierId}
                  className="w-full h-9 rounded-lg bg-[#F4F5F7] border border-[#E5E7EB] text-[12px] font-semibold text-[#2D333A] hover:border-[#5CE1A5] hover:text-[#5CE1A5] transition-all disabled:opacity-50"
                  style={{ fontFamily: "var(--font-poppins)" }}
                >
                  {loading === tierId ? "Loading..." : currentTier ? "Switch Plan" : "Select"}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
