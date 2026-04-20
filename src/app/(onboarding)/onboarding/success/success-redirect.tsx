"use client";

import { useEffect } from "react";
import { completeOnboarding } from "./actions";

export function SuccessRedirect({ tier, customerId }: { tier: string; customerId: string }) {
  useEffect(() => {
    completeOnboarding(tier, customerId);
  }, [tier, customerId]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <div className="size-12 mx-auto mb-4 rounded-full bg-[#5CE1A5]/10 flex items-center justify-center">
          <div className="size-6 rounded-full bg-[#5CE1A5] animate-pulse" />
        </div>
        <p className="text-[#2D333A] text-[15px] font-medium" style={{ fontFamily: "var(--font-poppins)" }}>
          Setting up your account...
        </p>
      </div>
    </div>
  );
}
