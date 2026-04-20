import { ClipboardCheck } from "lucide-react";

export default function FollowUpsPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
      <div
        className="size-16 rounded-2xl flex items-center justify-center mb-5"
        style={{ backgroundColor: "rgba(236, 72, 153, 0.08)" }}
      >
        <ClipboardCheck className="size-8 text-[#EC4899]" />
      </div>
      <h2
        className="text-2xl font-semibold text-[#2D333A] mb-2"
        style={{ fontFamily: "var(--font-poppins)" }}
      >
        Follow-Ups
      </h2>
      <p
        className="text-[#6B7280] text-[15px] max-w-md mb-4"
        style={{ fontFamily: "var(--font-source-sans)" }}
      >
        Never let someone fall through the cracks. Assign follow-ups, set reminders, and track completion so every person feels seen and cared for.
      </p>
      <span
        className="inline-flex items-center px-3 py-1 rounded-full text-[12px] font-medium text-[#EC4899]"
        style={{ fontFamily: "var(--font-poppins)", backgroundColor: "rgba(236, 72, 153, 0.08)" }}
      >
        Coming Soon
      </span>
    </div>
  );
}
