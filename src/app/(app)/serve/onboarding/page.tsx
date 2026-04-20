import { UserPlus } from "lucide-react";

export default function OnboardingPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
      <div
        className="size-16 rounded-2xl flex items-center justify-center mb-5"
        style={{ backgroundColor: "rgba(16, 185, 129, 0.08)" }}
      >
        <UserPlus className="size-8 text-[#10B981]" />
      </div>
      <h2
        className="text-2xl font-semibold text-[#2D333A] mb-2"
        style={{ fontFamily: "var(--font-poppins)" }}
      >
        Onboarding
      </h2>
      <p
        className="text-[#6B7280] text-[15px] max-w-md mb-4"
        style={{ fontFamily: "var(--font-source-sans)" }}
      >
        Welcome new volunteers with guided onboarding flows. Background checks, training steps, and team placement — all tracked in one place.
      </p>
      <span
        className="inline-flex items-center px-3 py-1 rounded-full text-[12px] font-medium text-[#10B981]"
        style={{ fontFamily: "var(--font-poppins)", backgroundColor: "rgba(16, 185, 129, 0.08)" }}
      >
        Coming Soon
      </span>
    </div>
  );
}
