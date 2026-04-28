"use client";

import Link from "next/link";
import { CheckSquare } from "lucide-react";

export function MyTasks() {
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
          My Tasks
        </h3>
        <Link
          href="/workspace/tasks"
          className="text-[13px] text-[#5CE1A5] hover:underline"
          style={{ fontFamily: "var(--font-source-sans)", fontWeight: 600 }}
        >
          View all &rarr;
        </Link>
      </div>

      {/* Mini stat blocks */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        {[
          { label: "To Do", count: 0, color: "#F59E0B" },
          { label: "In Progress", count: 0, color: "#3B82F6" },
          { label: "Done", count: 0, color: "#5CE1A5" },
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded-xl p-3 text-center"
            style={{ backgroundColor: `${stat.color}0A` }}
          >
            <p
              className="text-xl text-[#2D333A] leading-none"
              style={{
                fontFamily: "var(--font-poppins)",
                fontWeight: 700,
              }}
            >
              {stat.count}
            </p>
            <p
              className="text-[12px] text-[#6B7280] mt-1"
              style={{
                fontFamily: "var(--font-source-sans)",
                fontWeight: 500,
              }}
            >
              {stat.label}
            </p>
          </div>
        ))}
      </div>

      {/* Empty state */}
      <div className="flex flex-col items-center justify-center py-6 text-center flex-1">
        <div
          className="size-10 rounded-full flex items-center justify-center mb-2"
          style={{ backgroundColor: "rgba(92, 225, 165, 0.08)" }}
        >
          <CheckSquare className="size-5 text-[#5CE1A5]" />
        </div>
        <p
          className="text-[13px] text-[#6B7280]"
          style={{ fontFamily: "var(--font-source-sans)" }}
        >
          No tasks assigned yet
        </p>
      </div>
    </div>
  );
}
