"use client";

import Link from "next/link";
import { Calendar } from "lucide-react";

export function UpcomingEvents() {
  return (
    <div
      className="bg-white rounded-3xl p-6 h-full flex flex-col border border-[#E5E7EB]/50 transition-all duration-300 hover:border-[#D1D5DB] hover:shadow-[0_12px_30px_-8px_rgba(0,0,0,0.08)]"
      style={{
        boxShadow:
          "0 4px 20px -2px rgba(0,0,0,0.02), 0 1px 4px -1px rgba(0,0,0,0.02)",
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4 shrink-0">
        <h3
          className="text-[15px] text-[#2D333A]"
          style={{ fontFamily: "var(--font-poppins)", fontWeight: 600 }}
        >
          Upcoming Events
        </h3>
        <Link
          href="/workspace/events"
          className="text-[13px] text-[#5CE1A5] hover:underline"
          style={{ fontFamily: "var(--font-source-sans)", fontWeight: 600 }}
        >
          View all &rarr;
        </Link>
      </div>

      {/* Empty state */}
      <div className="flex flex-col items-center justify-center py-10 text-center flex-1">
        <div
          className="size-12 rounded-full flex items-center justify-center mb-3"
          style={{ backgroundColor: "rgba(92, 225, 165, 0.08)" }}
        >
          <Calendar className="size-6 text-[#5CE1A5]" />
        </div>
        <p
          className="text-[14px] text-[#6B7280]"
          style={{ fontFamily: "var(--font-source-sans)" }}
        >
          No upcoming events
        </p>
      </div>
    </div>
  );
}
