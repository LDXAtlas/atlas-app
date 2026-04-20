import { Users } from "lucide-react";

export default function TeamHealthPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
      <div
        className="size-16 rounded-2xl flex items-center justify-center mb-5"
        style={{ backgroundColor: "rgba(16, 185, 129, 0.08)" }}
      >
        <Users className="size-8 text-[#10B981]" />
      </div>
      <h2
        className="text-2xl font-semibold text-[#2D333A] mb-2"
        style={{ fontFamily: "var(--font-poppins)" }}
      >
        Team Health
      </h2>
      <p
        className="text-[#6B7280] text-[15px] max-w-md mb-4"
        style={{ fontFamily: "var(--font-source-sans)" }}
      >
        Monitor volunteer engagement and burnout signals. See who&apos;s overcommitted, who&apos;s disengaging, and who&apos;s ready for more responsibility.
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
