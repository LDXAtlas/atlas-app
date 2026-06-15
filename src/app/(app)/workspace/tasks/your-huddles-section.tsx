"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, Users } from "lucide-react";
import type { HuddleListItem } from "@/app/actions/huddles";
import { MeetingSourceBadge } from "../huddles/_components/meeting-source-badge";

interface YourHuddlesSectionProps {
  huddles: HuddleListItem[];
}

// Collapsible "Your Huddles" rail above the My Tasks list. Hidden
// entirely when the viewer isn't on any upcoming or live huddles —
// otherwise the section would be empty noise.
export function YourHuddlesSection({ huddles }: YourHuddlesSectionProps) {
  const [expanded, setExpanded] = useState(true);
  if (huddles.length === 0) return null;

  const live = huddles.filter((h) => h.status === "in_progress").length;

  return (
    <section className="bg-white border border-[#E5E7EB] rounded-2xl mb-4">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between gap-2 px-4 py-3"
        aria-expanded={expanded}
      >
        <div className="flex items-center gap-2">
          <Users className="size-4 text-[#5CE1A5]" />
          <h2
            className="text-[14px] text-[#0F172A]"
            style={{ fontFamily: "var(--font-poppins)", fontWeight: 700 }}
          >
            Your Huddles
          </h2>
          <span
            className="text-[11px] text-[#6B7280] bg-[#F4F5F7] px-1.5 py-0.5 rounded-md tabular-nums"
            style={{ fontFamily: "var(--font-poppins)", fontWeight: 600 }}
          >
            {huddles.length}
          </span>
          {live > 0 && (
            <span
              className="inline-flex items-center gap-1 h-5 px-1.5 rounded-md text-[10px] uppercase tracking-wider"
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
              {live} live
            </span>
          )}
        </div>
        <ChevronDown
          className={`size-4 text-[#9CA3AF] transition-transform ${expanded ? "" : "-rotate-90"}`}
        />
      </button>
      {expanded && (
        <ul className="px-2 pb-2 space-y-1">
          {huddles.map((h) => (
            <li key={h.id}>
              <Link
                href={`/workspace/huddles/${h.id}`}
                className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-[#F8FAFC] transition-colors"
              >
                <span
                  className="flex-1 min-w-0 text-[13.5px] text-[#2D333A] truncate"
                  style={{
                    fontFamily: "var(--font-poppins)",
                    fontWeight: 600,
                  }}
                >
                  {h.title}
                </span>
                {h.status === "in_progress" && (
                  <span
                    className="inline-flex items-center gap-1 h-5 px-1.5 rounded-md text-[10px] uppercase tracking-wider"
                    style={{
                      backgroundColor: "#10B98118",
                      color: "#059669",
                      fontFamily: "var(--font-poppins)",
                      fontWeight: 700,
                    }}
                  >
                    <span className="size-1.5 rounded-full bg-[#10B981] animate-pulse" />
                    Live
                  </span>
                )}
                <MeetingSourceBadge
                  source={h.meeting_source}
                  detail={
                    h.meeting_source === "in_person" ? h.location : null
                  }
                />
                {h.scheduled_start && (
                  <span
                    className="text-[12px] text-[#6B7280] tabular-nums shrink-0"
                    style={{ fontFamily: "var(--font-source-sans)" }}
                  >
                    {formatWhen(h.scheduled_start)}
                  </span>
                )}
                <span
                  className="text-[12px] text-[#9CA3AF] tabular-nums"
                  style={{ fontFamily: "var(--font-source-sans)" }}
                >
                  {h.attendee_count} attendees
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function formatWhen(iso: string): string {
  try {
    const d = new Date(iso);
    const today = new Date();
    const isToday =
      d.getFullYear() === today.getFullYear() &&
      d.getMonth() === today.getMonth() &&
      d.getDate() === today.getDate();
    const time = d.toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
    });
    if (isToday) return `Today · ${time}`;
    return d.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    }) + ` · ${time}`;
  } catch {
    return iso;
  }
}
