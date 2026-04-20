"use client";

import { use, useState } from "react";
import { createCheckoutSession, type StripeTier } from "@/app/actions/stripe";
import { Check } from "lucide-react";

interface Plan {
  id: StripeTier;
  name: string;
  price: string;
  priceAmount: number;
  popular?: boolean;
  features: string[];
}

const plans: Plan[] = [
  {
    id: "workspace",
    name: "Atlas Workspace",
    price: "$29.99",
    priceAmount: 29.99,
    features: [
      "5 team seats",
      "500 AI credits / month",
      "Unlimited Copilot access",
      "Workspace module",
      "Announcements & Tasks",
      "Project Boards",
    ],
  },
  {
    id: "suite",
    name: "Atlas Suite",
    price: "$79.99",
    priceAmount: 79.99,
    popular: true,
    features: [
      "8 team seats",
      "5,000 AI credits / month",
      "Workspace + Serve + Care",
      "Volunteer scheduling",
      "Care journal & follow-ups",
      "Prayer wall",
      "Priority support",
    ],
  },
  {
    id: "ultimate",
    name: "Atlas Ultimate",
    price: "$149.99",
    priceAmount: 149.99,
    features: [
      "15 team seats",
      "20,000 AI credits / month",
      "All features unlocked",
      "AI Workflows & Automations",
      "Ministry Hub",
      "Advanced analytics",
      "Dedicated account manager",
    ],
  },
];

interface PlanSelectorProps {
  searchParamsPromise: Promise<{ plan?: string }>;
}

export function PlanSelector({ searchParamsPromise }: PlanSelectorProps) {
  const searchParams = use(searchParamsPromise);
  const preselected = searchParams.plan as StripeTier | undefined;
  const [selected, setSelected] = useState<StripeTier | null>(
    preselected && ["workspace", "suite", "ultimate"].includes(preselected)
      ? preselected
      : null
  );
  const [loading, setLoading] = useState(false);

  async function handleStartTrial() {
    if (!selected) return;
    setLoading(true);
    await createCheckoutSession(selected);
  }

  return (
    <div className="flex flex-col items-center px-4 py-16 max-w-6xl mx-auto">
      {/* Header */}
      <div className="text-center mb-12">
        <h1
          className="text-3xl font-bold text-[#2D333A] mb-3"
          style={{ fontFamily: "var(--font-poppins)" }}
        >
          Choose your plan
        </h1>
        <p
          className="text-[#6B7280] text-lg max-w-md mx-auto"
          style={{ fontFamily: "var(--font-source-sans)" }}
        >
          Start with a 30-day free trial. No credit card required.
        </p>
      </div>

      {/* Plan cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full mb-10">
        {plans.map((plan) => {
          const isSelected = selected === plan.id;
          return (
            <button
              key={plan.id}
              onClick={() => setSelected(plan.id)}
              className={`relative flex flex-col rounded-2xl border-2 p-6 text-left transition-all duration-200 ${
                isSelected
                  ? "border-[#5CE1A5] shadow-lg shadow-[#5CE1A5]/10"
                  : "border-[#E5E7EB] hover:border-[#5CE1A5]/50 hover:shadow-md"
              }`}
            >
              {/* Popular badge */}
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span
                    className="bg-[#5CE1A5] text-white text-[11px] font-semibold px-3 py-1 rounded-full uppercase tracking-wide"
                    style={{ fontFamily: "var(--font-poppins)" }}
                  >
                    Most Popular
                  </span>
                </div>
              )}

              {/* Plan name */}
              <h3
                className="text-[16px] font-semibold text-[#2D333A] mb-1"
                style={{ fontFamily: "var(--font-poppins)" }}
              >
                {plan.name}
              </h3>

              {/* Price */}
              <div className="flex items-baseline gap-1 mb-5">
                <span
                  className="text-3xl font-bold text-[#2D333A]"
                  style={{ fontFamily: "var(--font-poppins)" }}
                >
                  {plan.price}
                </span>
                <span
                  className="text-[#6B7280] text-sm"
                  style={{ fontFamily: "var(--font-source-sans)" }}
                >
                  /month
                </span>
              </div>

              {/* Features */}
              <ul className="flex-1 space-y-3 mb-6">
                {plan.features.map((feature) => (
                  <li
                    key={feature}
                    className="flex items-start gap-2 text-[14px] text-[#2D333A]"
                    style={{ fontFamily: "var(--font-source-sans)" }}
                  >
                    <Check className="size-4 text-[#5CE1A5] shrink-0 mt-0.5" />
                    {feature}
                  </li>
                ))}
              </ul>

              {/* Selection indicator */}
              <div
                className={`h-11 rounded-full flex items-center justify-center font-semibold text-[14px] transition-all duration-200 ${
                  isSelected
                    ? "bg-[#5CE1A5] text-white"
                    : "bg-[#F4F5F7] text-[#6B7280]"
                }`}
                style={{ fontFamily: "var(--font-poppins)" }}
              >
                {isSelected ? "Selected" : "Select Plan"}
              </div>
            </button>
          );
        })}
      </div>

      {/* Start trial button */}
      <button
        onClick={handleStartTrial}
        disabled={!selected || loading}
        className="h-12 px-10 rounded-full bg-[#5CE1A5] font-semibold text-white transition-all duration-200 hover:shadow-lg hover:shadow-[#5CE1A5]/20 active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed"
        style={{ fontFamily: "var(--font-poppins)" }}
      >
        {loading ? "Setting up..." : "Start Free Trial"}
      </button>

      <p
        className="mt-4 text-[13px] text-[#9CA3AF]"
        style={{ fontFamily: "var(--font-source-sans)" }}
      >
        30-day free trial &middot; No credit card required &middot; Cancel anytime
      </p>
    </div>
  );
}
