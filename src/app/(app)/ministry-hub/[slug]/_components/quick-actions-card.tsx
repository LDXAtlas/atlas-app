"use client";

import Link from "next/link";
import { Megaphone, CheckSquare, Calendar, Zap } from "lucide-react";

interface QuickActionsCardProps {
  departmentId: string;
}

export function QuickActionsCard({ departmentId }: QuickActionsCardProps) {
  return (
    <section className="bg-white rounded-2xl border border-[#E5E7EB] overflow-hidden">
      <div className="flex items-center gap-2 px-5 py-4">
        <div className="size-7 rounded-lg bg-[#5CE1A5]/10 flex items-center justify-center">
          <Zap className="size-4 text-[#5CE1A5]" />
        </div>
        <h3
          className="text-[14px] text-[#2D333A]"
          style={{ fontFamily: "var(--font-poppins)", fontWeight: 600 }}
        >
          Quick Actions
        </h3>
      </div>
      <div className="border-t border-[#F3F4F6] p-3 space-y-2">
        <ActionLink
          href={`/workspace/announcements?ministry=${departmentId}`}
          icon={<Megaphone className="size-4 text-[#5CE1A5]" />}
          label="Post Announcement to this ministry"
        />
        <ActionLink
          href={`/workspace/tasks?ministry=${departmentId}`}
          icon={<CheckSquare className="size-4 text-[#7C3AED]" />}
          label="Create Task for this team"
        />
        <ActionLink
          href={`/workspace/calendar?ministry=${departmentId}`}
          icon={<Calendar className="size-4 text-[#F97316]" />}
          label="Schedule Event"
        />
      </div>
    </section>
  );
}

function ActionLink({
  href,
  icon,
  label,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl border border-[#E5E7EB] hover:border-[#5CE1A5] hover:bg-[#5CE1A5]/5 transition-colors text-left"
    >
      <div className="size-8 rounded-lg bg-[#F4F5F7] flex items-center justify-center shrink-0">
        {icon}
      </div>
      <span
        className="text-[13px] text-[#2D333A] flex-1"
        style={{ fontFamily: "var(--font-poppins)", fontWeight: 500 }}
      >
        {label}
      </span>
    </Link>
  );
}
