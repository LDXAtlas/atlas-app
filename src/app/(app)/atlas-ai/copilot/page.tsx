import { Sparkles } from "lucide-react";

export default function CopilotPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
      <div
        className="size-16 rounded-2xl flex items-center justify-center mb-5"
        style={{ backgroundColor: "rgba(92, 225, 165, 0.08)" }}
      >
        <Sparkles className="size-8 text-[#5CE1A5]" />
      </div>
      <h2
        className="text-2xl font-semibold text-[#2D333A] mb-2"
        style={{ fontFamily: "var(--font-poppins)" }}
      >
        Atlas Copilot
      </h2>
      <p
        className="text-[#6B7280] text-[15px] max-w-md mb-4"
        style={{ fontFamily: "var(--font-source-sans)" }}
      >
        Your AI ministry assistant. Ask questions, draft messages, summarize notes, and get intelligent suggestions — unlimited on every plan.
      </p>
      <span
        className="inline-flex items-center px-3 py-1 rounded-full text-[12px] font-medium text-[#5CE1A5] bg-[#5CE1A5]/8"
        style={{ fontFamily: "var(--font-poppins)" }}
      >
        Coming Soon
      </span>
    </div>
  );
}
