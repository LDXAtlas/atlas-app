"use client";

import Link from "next/link";
import { Calendar, CheckSquare, ListChecks, Users } from "lucide-react";
import type { HuddleListItem } from "@/app/actions/huddles";
import { MeetingSourceBadge } from "./meeting-source-badge";

const STATUS_LABEL: Record<HuddleListItem["status"], string> = {
  scheduled: "Scheduled",
  in_progress: "In progress",
  completed: "Completed",
  processing: "Processing",
  ready: "Ready",
  archived: "Archived",
};

const STATUS_COLOR: Record<HuddleListItem["status"], { bg: string; fg: string }> = {
  scheduled: { bg: "#F3F4F6", fg: "#6B7280" },
  in_progress: { bg: "#D1FAE5", fg: "#059669" },
  completed: { bg: "#DBEAFE", fg: "#2563EB" },
  processing: { bg: "#FEF3C7", fg: "#D97706" },
  ready: { bg: "#D1FAE5", fg: "#059669" },
  archived: { bg: "#F3F4F6", fg: "#9CA3AF" },
};

export function HuddleCard({ huddle }: { huddle: HuddleListItem }) {
  const status = STATUS_COLOR[huddle.status];
  return (
    <Link
      href={`/workspace/huddles/${huddle.id}`}
      className="block bg-white border border-[#E5E7EB] rounded-2xl px-4 py-3.5 hover:border-[#5CE1A5]/60 hover:shadow-[0_2px_10px_rgba(0,0,0,0.04)] transition-all"
    >
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <h3
              className="text-[15px] text-[#0F172A] truncate"
              style={{
                fontFamily: "var(--font-poppins)",
                fontWeight: 600,
              }}
            >
              {huddle.title}
            </h3>
            {huddle.status === "in_progress" ? (
              <span
                className="inline-flex h-5 pl-1.5 pr-2 rounded-md text-[10px] uppercase tracking-wider items-center gap-1.5"
                style={{
                  backgroundColor: "#10B98118",
                  color: "#059669",
                  fontFamily: "var(--font-poppins)",
                  fontWeight: 700,
                }}
              >
                <span className="relative inline-flex">
                  <span className="size-1.5 rounded-full bg-[#10B981] animate-pulse" />
                  <span className="absolute inset-0 size-1.5 rounded-full bg-[#10B981]/40 animate-ping" />
                </span>
                Live
              </span>
            ) : (
              <span
                className="inline-flex h-5 px-1.5 rounded-md text-[10px] uppercase tracking-wider"
                style={{
                  backgroundColor: status.bg,
                  color: status.fg,
                  fontFamily: "var(--font-poppins)",
                  fontWeight: 700,
                }}
              >
                {STATUS_LABEL[huddle.status]}
              </span>
            )}
          </div>

          {huddle.description && (
            <p
              className="text-[13px] text-[#6B7280] mb-2 line-clamp-1"
              style={{ fontFamily: "var(--font-source-sans)" }}
            >
              {huddle.description}
            </p>
          )}

          <div
            className="flex items-center gap-3 flex-wrap text-[12px] text-[#6B7280]"
            style={{ fontFamily: "var(--font-source-sans)" }}
          >
            {huddle.scheduled_start && (
              <span className="inline-flex items-center gap-1">
                <Calendar className="size-3" />
                {formatWhen(huddle.scheduled_start, huddle.scheduled_end)}
              </span>
            )}
            <MeetingSourceBadge
              source={huddle.meeting_source}
              detail={
                huddle.meeting_source === "in_person"
                  ? huddle.location
                  : huddle.meeting_source === "external_video_link"
                    ? null
                    : null
              }
            />
            <span className="inline-flex items-center gap-1">
              <Users className="size-3" />
              {huddle.attendee_count}
            </span>
            <span className="inline-flex items-center gap-1">
              <ListChecks className="size-3" />
              {huddle.agenda_count} agenda
            </span>
            <span className="inline-flex items-center gap-1">
              <CheckSquare className="size-3" />
              {huddle.action_item_count} actions
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}

function formatWhen(start: string, end: string | null): string {
  try {
    const s = new Date(start);
    const date = s.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });
    const sT = s.toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
    });
    if (!end) return `${date}, ${sT}`;
    const e = new Date(end);
    const eT = e.toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
    });
    return `${date}, ${sT} – ${eT}`;
  } catch {
    return start;
  }
}
