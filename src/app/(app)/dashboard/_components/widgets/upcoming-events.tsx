"use client";

import Link from "next/link";
import { Calendar, Clock, MapPin } from "lucide-react";

// ─── Types ──────────────────────────────────────────────

export interface UpcomingEventData {
  id: string;
  title: string;
  event_type: string;
  starts_at: string;
  is_all_day: boolean;
  location: string | null;
  color: string;
}

interface UpcomingEventsProps {
  events?: UpcomingEventData[];
}

// ─── Event Type Colors ──────────────────────────────────

const EVENT_TYPE_COLORS: Record<string, string> = {
  service: "#5CE1A5",
  meeting: "#3B82F6",
  rehearsal: "#8B5CF6",
  class: "#F59E0B",
  outreach: "#EC4899",
  social: "#10B981",
  general: "#6B7280",
  other: "#6B7280",
};

// ─── Helpers ────────────────────────────────────────────

function formatEventDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(now.getDate() + 1);

  if (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  ) {
    return "Today";
  }

  if (
    date.getFullYear() === tomorrow.getFullYear() &&
    date.getMonth() === tomorrow.getMonth() &&
    date.getDate() === tomorrow.getDate()
  ) {
    return "Tomorrow";
  }

  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function formatTime(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

// ─── Component ──────────────────────────────────────────

export function UpcomingEvents({ events = [] }: UpcomingEventsProps) {
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

      {/* Content */}
      {events.length === 0 ? (
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
      ) : (
        <div className="space-y-3 flex-1">
          {events.map((evt) => {
            const evtColor =
              evt.color || EVENT_TYPE_COLORS[evt.event_type] || "#6B7280";
            return (
              <div
                key={evt.id}
                className="flex gap-3 items-start p-3 rounded-xl hover:bg-[#F4F5F7]/50 transition-colors group"
              >
                {/* Color bar */}
                <div
                  className="w-1 rounded-full self-stretch shrink-0 min-h-[36px]"
                  style={{ backgroundColor: evtColor }}
                />

                <div className="flex-1 min-w-0">
                  <p
                    className="text-[13px] text-[#2D333A] truncate group-hover:text-[#5CE1A5] transition-colors"
                    style={{
                      fontFamily: "var(--font-poppins)",
                      fontWeight: 600,
                    }}
                  >
                    {evt.title}
                  </p>
                  <div className="flex items-center gap-2 mt-1 text-[#9CA3AF]">
                    <span
                      className="flex items-center gap-1 text-[11px]"
                      style={{ fontFamily: "var(--font-source-sans)" }}
                    >
                      <Clock className="size-3" />
                      {formatEventDate(evt.starts_at)}
                      {!evt.is_all_day && (
                        <> &middot; {formatTime(evt.starts_at)}</>
                      )}
                    </span>
                    {evt.location && (
                      <span
                        className="flex items-center gap-1 text-[11px]"
                        style={{ fontFamily: "var(--font-source-sans)" }}
                      >
                        <MapPin className="size-3" />
                        {evt.location}
                      </span>
                    )}
                  </div>
                </div>

                {/* Event type dot */}
                <div
                  className="size-2 rounded-full shrink-0 mt-2"
                  style={{ backgroundColor: evtColor }}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
