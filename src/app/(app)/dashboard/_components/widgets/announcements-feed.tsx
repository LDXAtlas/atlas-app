"use client";

import Link from "next/link";
import Image from "next/image";
import { Megaphone, Pin } from "lucide-react";

interface Announcement {
  id: string;
  title: string;
  content: string;
  category: string;
  is_pinned: boolean;
  published_at: string;
  author_name: string;
  is_read: boolean;
  target_department_name?: string | null;
  target_department_color?: string | null;
  cover_image_url?: string | null;
}

interface Props {
  announcements: Announcement[];
}

export function AnnouncementsFeed({ announcements }: Props) {
  const hasAnnouncements = announcements.length > 0;

  return (
    <div
      className="bg-white rounded-3xl p-6 h-full flex flex-col border border-[#E5E7EB]/50 transition-all duration-300 hover:border-[#D1D5DB] hover:shadow-[0_12px_30px_-8px_rgba(0,0,0,0.08)]"
      style={{
        boxShadow: "0 4px 20px -2px rgba(0,0,0,0.02), 0 1px 4px -1px rgba(0,0,0,0.02)",
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4 shrink-0">
        <h3
          className="text-[15px] text-[#2D333A]"
          style={{ fontFamily: "var(--font-poppins)", fontWeight: 600 }}
        >
          Announcements
        </h3>
        <Link
          href="/workspace/announcements"
          className="text-[13px] text-[#5CE1A5] hover:underline"
          style={{ fontFamily: "var(--font-source-sans)", fontWeight: 600 }}
        >
          View all &rarr;
        </Link>
      </div>

      {hasAnnouncements ? (
        <div className="flex-1 space-y-1 overflow-y-auto">
          {announcements.map((ann) => {
            const timeAgo = getTimeAgo(ann.published_at);
            return (
              <Link
                key={ann.id}
                href="/workspace/announcements"
                className="flex items-start gap-3 p-3 rounded-2xl hover:bg-[#FAFBFC] transition-colors group"
              >
                {/* Unread dot */}
                <div className="pt-2 shrink-0">
                  {!ann.is_read ? (
                    <div className="size-2 rounded-full bg-[#5CE1A5]" />
                  ) : (
                    <div className="size-2" />
                  )}
                </div>

                {/* Cover thumbnail */}
                {ann.cover_image_url && (
                  <div className="relative size-12 rounded-lg overflow-hidden shrink-0">
                    <Image
                      src={ann.cover_image_url}
                      alt={ann.title}
                      fill
                      className="object-cover"
                      sizes="48px"
                    />
                  </div>
                )}

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    {ann.is_pinned && <Pin className="size-3 text-[#F59E0B] shrink-0" />}
                    <h4
                      className="text-[14px] text-[#2D333A] truncate"
                      style={{ fontFamily: "var(--font-poppins)", fontWeight: 600 }}
                    >
                      {ann.title}
                    </h4>
                  </div>
                  <p
                    className="text-[13px] text-[#6B7280] line-clamp-1"
                    style={{ fontFamily: "var(--font-source-sans)" }}
                  >
                    {ann.content}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <span
                      className="text-[11px] text-[#9CA3AF]"
                      style={{ fontFamily: "var(--font-source-sans)" }}
                    >
                      {ann.author_name} · {timeAgo}
                    </span>
                    {ann.target_department_name && (
                      <span
                        className="text-[10px] font-medium px-1.5 py-0.5 rounded-md"
                        style={{
                          fontFamily: "var(--font-poppins)",
                          color: ann.target_department_color || "#8B5CF6",
                          backgroundColor: `${ann.target_department_color || "#8B5CF6"}10`,
                        }}
                      >
                        {ann.target_department_name}
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-10 text-center flex-1">
          <div
            className="size-12 rounded-full flex items-center justify-center mb-3"
            style={{ backgroundColor: "rgba(92, 225, 165, 0.08)" }}
          >
            <Megaphone className="size-6 text-[#5CE1A5]" />
          </div>
          <p className="text-[14px] text-[#6B7280]" style={{ fontFamily: "var(--font-source-sans)" }}>
            No announcements yet
          </p>
          <Link
            href="/workspace/announcements"
            className="text-[13px] text-[#5CE1A5] mt-2 hover:underline"
            style={{ fontFamily: "var(--font-source-sans)", fontWeight: 600 }}
          >
            Post an announcement &rarr;
          </Link>
        </div>
      )}
    </div>
  );
}

function getTimeAgo(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diff = now.getTime() - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
