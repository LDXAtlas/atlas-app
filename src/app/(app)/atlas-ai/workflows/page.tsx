import { Zap } from "lucide-react";

export default function WorkflowsPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
      <div
        className="size-16 rounded-2xl flex items-center justify-center mb-5"
        style={{ background: "linear-gradient(135deg, rgba(92, 225, 165, 0.08), rgba(139, 92, 246, 0.08))" }}
      >
        <Zap className="size-8 text-[#8B5CF6]" />
      </div>
      <h2
        className="text-2xl font-semibold text-[#2D333A] mb-2"
        style={{ fontFamily: "var(--font-poppins)" }}
      >
        Workflows
      </h2>
      <p
        className="text-[#6B7280] text-[15px] max-w-md mb-4"
        style={{ fontFamily: "var(--font-source-sans)" }}
      >
        Automate repetitive tasks with AI-powered workflows. Sunday prep checklists, visitor follow-ups, weekly reports — all running in the background.
      </p>
      <span
        className="inline-flex items-center px-3 py-1 rounded-full text-[12px] font-medium text-[#8B5CF6]"
        style={{ fontFamily: "var(--font-poppins)", backgroundColor: "rgba(139, 92, 246, 0.08)" }}
      >
        Coming Soon
      </span>
    </div>
  );
}
