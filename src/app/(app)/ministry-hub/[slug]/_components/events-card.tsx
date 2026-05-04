"use client";

import Link from "next/link";
import { Calendar, MapPin, ChevronRight, Video } from "lucide-react";
import type { MinistryDetailEvent } from "@/app/actions/ministry-hub";

interface EventsCardProps {
  events: MinistryDetailEvent[];
  departmentId: string;
}

export function EventsCard({ events, departmentId }: EventsCardProps) {
  return (
    <section className="bg-white rounded-2xl border border-[#E5E7EB] overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4">
        <div className="flex items-center gap-2">
          <div className="size-7 rounded-lg bg-[#FFEDD5] flex items-center justify-center">
            <Calendar className="size-4 text-[#F97316]" />
          </div>
          <h3
            className="text-[14px] text-[#2D333A]"
            style={{ fontFamily: "var(--font-poppins)", fontWeight: 600 }}
          >
            Upcoming Events
          </h3>
          {events.length > 0 && (
            <span
              className="text-[11px] font-semibold text-[#6B7280] bg-[#F3F4F6] px-1.5 py-0.5 rounded-md"
              style={{ fontFamily: "var(--font-poppins)" }}
            >
              {events.length}
            </span>
          )}
        </div>
        <Link
          href={`/workspace/calendar?ministry=${departmentId}`}
          className="text-[12px] font-semibold text-[#5CE1A5] hover:text-[#3DB882] flex items-center gap-0.5 transition-colors"
          style={{ fontFamily: "var(--font-poppins)" }}
        >
          View all
          <ChevronRight className="size-3" />
        </Link>
      </div>

      {events.length === 0 ? (
        <div className="border-t border-[#F3F4F6] px-5 py-10 text-center">
          <p
            className="text-[13px] text-[#9CA3AF]"
            style={{ fontFamily: "var(--font-source-sans)" }}
          >
            No upcoming events
          </p>
        </div>
      ) : (
        <ul>
          {events.map((e) => {
            const date = new Date(e.starts_at);
            const monthShort = date.toLocaleDateString("en-US", {
              month: "short",
            });
            const day = date.getDate();
            return (
              <li
                key={e.id}
                className="border-t border-[#F3F4F6] hover:bg-[#FAFBFC] transition-colors"
              >
                <Link
                  href={`/workspace/calendar?ministry=${departmentId}#e-${e.id}`}
                  className="flex gap-3 px-5 py-4 items-start"
                >
                  <div
                    className="rounded-xl size-12 flex flex-col items-center justify-center shrink-0 text-white"
                    style={{ backgroundColor: e.color }}
                  >
                    <span
                      className="text-[9px] uppercase tracking-wide leading-none"
                      style={{ fontFamily: "var(--font-poppins)", fontWeight: 600 }}
                    >
                      {monthShort}
                    </span>
                    <span
                      className="text-[16px] leading-tight mt-0.5"
                      style={{ fontFamily: "var(--font-poppins)", fontWeight: 700 }}
                    >
                      {day}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p
                      className="text-[13px] text-[#2D333A] leading-snug truncate"
                      style={{ fontFamily: "var(--font-poppins)", fontWeight: 600 }}
                    >
                      {e.title}
                    </p>
                    <p
                      className="text-[12px] text-[#6B7280] mt-0.5"
                      style={{ fontFamily: "var(--font-source-sans)" }}
                    >
                      {e.is_all_day
                        ? "All day"
                        : date.toLocaleTimeString("en-US", {
                            hour: "numeric",
                            minute: "2-digit",
                          })}
                    </p>
                    {e.location && (
                      <p
                        className="text-[12px] text-[#9CA3AF] mt-0.5 flex items-center gap-1 truncate"
                        style={{ fontFamily: "var(--font-source-sans)" }}
                      >
                        {e.location.startsWith("http") ? (
                          <Video className="size-3 shrink-0" />
                        ) : (
                          <MapPin className="size-3 shrink-0" />
                        )}
                        <span className="truncate">{e.location}</span>
                      </p>
                    )}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
