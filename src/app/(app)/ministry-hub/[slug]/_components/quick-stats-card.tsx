"use client";

import { Activity } from "lucide-react";

interface QuickStatsCardProps {
  activity: { posts: number; tasksCompleted: number; eventsHeld: number };
}

export function QuickStatsCard({ activity }: QuickStatsCardProps) {
  const rows = [
    { label: "Posts", value: activity.posts },
    { label: "Tasks Completed", value: activity.tasksCompleted },
    { label: "Events Held", value: activity.eventsHeld },
  ];
  return (
    <section className="bg-white rounded-2xl border border-[#E5E7EB] overflow-hidden">
      <div className="flex items-center gap-2 px-5 py-4">
        <div className="size-7 rounded-lg bg-[#FFEDD5] flex items-center justify-center">
          <Activity className="size-4 text-[#F97316]" />
        </div>
        <h3
          className="text-[14px] text-[#2D333A]"
          style={{ fontFamily: "var(--font-poppins)", fontWeight: 600 }}
        >
          Activity This Week
        </h3>
      </div>
      <div className="border-t border-[#F3F4F6]">
        {rows.map((r) => (
          <div
            key={r.label}
            className="flex items-center justify-between px-5 py-3 border-b border-[#F3F4F6] last:border-b-0"
          >
            <span
              className="text-[13px] text-[#6B7280]"
              style={{ fontFamily: "var(--font-source-sans)" }}
            >
              {r.label}
            </span>
            <span
              className="text-[15px] text-[#2D333A]"
              style={{ fontFamily: "var(--font-poppins)", fontWeight: 700 }}
            >
              {r.value}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
