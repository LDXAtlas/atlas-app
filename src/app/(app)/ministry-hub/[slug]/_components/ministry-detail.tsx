"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { MinistryDetail } from "@/app/actions/ministry-hub";
import { MinistryHeader } from "./ministry-header";
import { AnnouncementsCard } from "./announcements-card";
import { EventsCard } from "./events-card";
import { TasksCard } from "./tasks-card";
import { TeamCard } from "./team-card";
import { QuickActionsCard } from "./quick-actions-card";
import { QuickStatsCard } from "./quick-stats-card";

interface MinistryDetailViewProps {
  detail: MinistryDetail;
}

export function MinistryDetailView({ detail }: MinistryDetailViewProps) {
  const { department } = detail;
  return (
    <div className="space-y-5">
      <Link
        href="/ministry-hub"
        className="inline-flex items-center gap-1.5 text-[13px] text-[#6B7280] hover:text-[#5CE1A5] transition-colors"
        style={{ fontFamily: "var(--font-source-sans)" }}
      >
        <ArrowLeft className="size-4" />
        All Ministries
      </Link>

      <MinistryHeader detail={detail} />

      {/* 3-column grid: 40 / 40 / 20 */}
      <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1.4fr_1fr] gap-5">
        {/* Left: announcements + events */}
        <div className="space-y-5 min-w-0">
          <AnnouncementsCard
            announcements={detail.announcements}
            total={detail.totalAnnouncements}
            departmentId={department.id}
            departmentColor={department.color}
          />
          <EventsCard
            events={detail.events}
            departmentId={department.id}
          />
        </div>

        {/* Center: tasks + quick actions */}
        <div className="space-y-5 min-w-0">
          <TasksCard
            tasks={detail.tasks}
            counts={detail.taskCounts}
            departmentId={department.id}
          />
          <QuickActionsCard departmentId={department.id} />
        </div>

        {/* Right: team + quick stats */}
        <div className="space-y-5 min-w-0">
          <TeamCard team={detail.team} departmentId={department.id} />
          <QuickStatsCard activity={detail.weeklyActivity} />
        </div>
      </div>
    </div>
  );
}
