"use client";

import { use } from "react";
import Link from "next/link";
import { Rocket, Crown } from "lucide-react";
import { createBillingPortalSession } from "@/app/actions/stripe";

interface ModuleInfo {
  name: string;
  description: string;
  requiredTier: string;
  tierLabel: string;
  price: string;
  features: string[];
  accentColor: string;
  icon: typeof Rocket;
}

const moduleData: Record<string, ModuleInfo> = {
  serve: {
    name: "Serve",
    description:
      "Schedule volunteers, manage onboarding, and track team health. Know who\u2019s serving, who\u2019s burning out, and who\u2019s ready for more \u2014 all in one place.",
    requiredTier: "Atlas Suite",
    tierLabel: "Suite",
    price: "$79.99/mo",
    features: ["Onboarding", "Scheduling", "Team Health"],
    accentColor: "#3B82F6",
    icon: Rocket,
  },
  care: {
    name: "Care",
    description:
      "Track pastoral care, follow-ups, and prayer requests. Never let someone fall through the cracks. Every need is logged, assigned, and followed up on.",
    requiredTier: "Atlas Suite",
    tierLabel: "Suite",
    price: "$79.99/mo",
    features: ["Care Journal", "Follow-Ups", "Prayer Wall"],
    accentColor: "#3B82F6",
    icon: Rocket,
  },
  workflows: {
    name: "Workflows",
    description:
      "Build automated sequences that handle repetitive tasks in the background. Sunday prep checklists, visitor follow-up emails, weekly pulse reports \u2014 running on autopilot so you can focus on ministry.",
    requiredTier: "Atlas Ultimate",
    tierLabel: "Ultimate",
    price: "$149.99/mo",
    features: ["Pre-built Templates", "Custom Workflow Creation", "Automated Sequences"],
    accentColor: "#F97316",
    icon: Crown,
  },
};

export default function UpgradePage({
  params,
}: {
  params: Promise<{ module: string }>;
}) {
  const { module } = use(params);
  const data = moduleData[module];

  if (!data) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-[#6B7280] text-lg" style={{ fontFamily: "var(--font-source-sans)" }}>
          Module not found.
        </p>
      </div>
    );
  }

  const TierIcon = data.icon;

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="max-w-lg w-full bg-white rounded-2xl p-10 shadow-sm border border-[#E5E7EB] text-center">
        {/* Tier icon */}
        <div className="flex justify-center mb-5">
          <div
            className="size-14 rounded-2xl flex items-center justify-center"
            style={{ backgroundColor: `${data.accentColor}10` }}
          >
            <TierIcon className="size-7" style={{ color: data.accentColor }} />
          </div>
        </div>

        {/* Heading */}
        <h1
          className="text-2xl font-bold text-[#2D333A] mb-2"
          style={{ fontFamily: "var(--font-poppins)" }}
        >
          Unlock {data.name}
        </h1>

        {/* Tier badge */}
        <div className="flex justify-center mb-6">
          <span
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[12px] font-semibold"
            style={{
              fontFamily: "var(--font-poppins)",
              color: data.accentColor,
              backgroundColor: `${data.accentColor}10`,
            }}
          >
            <TierIcon className="size-3.5" />
            {data.requiredTier} &mdash; {data.price}
          </span>
        </div>

        {/* Description */}
        <p
          className="text-[#6B7280] text-[15px] leading-relaxed mb-8"
          style={{ fontFamily: "var(--font-source-sans)" }}
        >
          {data.description}
        </p>

        {/* Features */}
        <ul className="text-left mb-8 space-y-2.5">
          {data.features.map((feature) => (
            <li key={feature} className="flex items-center gap-3">
              <div
                className="size-5 rounded-full flex items-center justify-center shrink-0"
                style={{ backgroundColor: `${data.accentColor}14` }}
              >
                <svg className="size-3" viewBox="0 0 12 12" fill="none">
                  <path d="M2.5 6L5 8.5L9.5 3.5" stroke={data.accentColor} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <span
                className="text-[#2D333A] text-[14px]"
                style={{ fontFamily: "var(--font-source-sans)" }}
              >
                {feature}
              </span>
            </li>
          ))}
        </ul>

        {/* Upgrade button */}
        <form action={createBillingPortalSession}>
          <button
            type="submit"
            className="inline-flex items-center justify-center w-full px-8 py-3 rounded-xl text-white font-semibold text-[15px] transition-all duration-200 hover:opacity-90 shadow-sm"
            style={{
              backgroundColor: data.accentColor,
              fontFamily: "var(--font-poppins)",
            }}
          >
            <TierIcon className="size-4 mr-2" />
            Upgrade to {data.tierLabel}
          </button>
        </form>

        <Link
          href="/dashboard"
          className="inline-block mt-5 text-[#6B7280] text-sm hover:text-[#2D333A] transition-colors"
          style={{ fontFamily: "var(--font-source-sans)" }}
        >
          &larr; Go Back
        </Link>
      </div>
    </div>
  );
}
