"use client";

import Link from "next/link";
import { Megaphone, Pin, ChevronRight, Globe } from "lucide-react";
import type { MinistryDetailAnnouncement } from "@/app/actions/ministry-hub";

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "Just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

interface AnnouncementsCardProps {
  announcements: MinistryDetailAnnouncement[];
  total: number;
  departmentId: string;
  departmentColor: string;
}

export function AnnouncementsCard({
  announcements,
  total,
  departmentId,
}: AnnouncementsCardProps) {
  return (
    <section className="bg-white rounded-2xl border border-[#E5E7EB] overflow-hidden">
      <CardHeader
        title="Announcements"
        count={total}
        icon={<Megaphone className="size-4 text-[#5CE1A5]" />}
        viewAllHref={`/workspace/announcements?ministry=${departmentId}`}
      />

      {announcements.length === 0 ? (
        <EmptyAnn departmentId={departmentId} />
      ) : (
        <ul>
          {announcements.map((a) => (
            <li
              key={a.id}
              className="border-t border-[#F3F4F6] hover:bg-[#FAFBFC] transition-colors"
            >
              <Link
                href={`/workspace/announcements?ministry=${departmentId}#a-${a.id}`}
                className="flex gap-3 px-5 py-4"
              >
                {a.cover_image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={a.cover_image_url}
                    alt=""
                    className="size-12 rounded-xl object-cover shrink-0"
                  />
                ) : (
                  <div className="size-12 rounded-xl bg-[#F4F5F7] flex items-center justify-center shrink-0">
                    <Megaphone className="size-5 text-[#9CA3AF]" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    {a.is_pinned && (
                      <Pin className="size-3 text-[#5CE1A5]" />
                    )}
                    {a.is_org_wide && (
                      <span
                        className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-[#6B7280]"
                        style={{ fontFamily: "var(--font-poppins)" }}
                      >
                        <Globe className="size-2.5" />
                        Org-wide
                      </span>
                    )}
                    {!a.is_read && (
                      <span className="inline-block size-1.5 rounded-full bg-[#5CE1A5]" />
                    )}
                  </div>
                  <p
                    className="text-[13px] text-[#2D333A] leading-snug truncate"
                    style={{ fontFamily: "var(--font-poppins)", fontWeight: 600 }}
                  >
                    {a.title}
                  </p>
                  <p
                    className="text-[12px] text-[#6B7280] mt-0.5"
                    style={{ fontFamily: "var(--font-source-sans)" }}
                  >
                    {a.author_name} · {relativeTime(a.published_at)}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function CardHeader({
  title,
  count,
  icon,
  viewAllHref,
}: {
  title: string;
  count: number;
  icon: React.ReactNode;
  viewAllHref: string;
}) {
  return (
    <div className="flex items-center justify-between px-5 py-4">
      <div className="flex items-center gap-2">
        <div className="size-7 rounded-lg bg-[#F4F5F7] flex items-center justify-center">
          {icon}
        </div>
        <h3
          className="text-[14px] text-[#2D333A]"
          style={{ fontFamily: "var(--font-poppins)", fontWeight: 600 }}
        >
          {title}
        </h3>
        {count > 0 && (
          <span
            className="text-[11px] font-semibold text-[#6B7280] bg-[#F3F4F6] px-1.5 py-0.5 rounded-md"
            style={{ fontFamily: "var(--font-poppins)" }}
          >
            {count}
          </span>
        )}
      </div>
      <Link
        href={viewAllHref}
        className="text-[12px] font-semibold text-[#5CE1A5] hover:text-[#3DB882] flex items-center gap-0.5 transition-colors"
        style={{ fontFamily: "var(--font-poppins)" }}
      >
        View all
        <ChevronRight className="size-3" />
      </Link>
    </div>
  );
}

function EmptyAnn({ departmentId }: { departmentId: string }) {
  return (
    <div className="border-t border-[#F3F4F6] px-5 py-10 text-center">
      <p
        className="text-[13px] text-[#9CA3AF] mb-2"
        style={{ fontFamily: "var(--font-source-sans)" }}
      >
        No announcements yet
      </p>
      <Link
        href={`/workspace/announcements?ministry=${departmentId}`}
        className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-[#5CE1A5] text-[#060C09] text-[12px] font-semibold hover:shadow-md transition-all"
        style={{ fontFamily: "var(--font-poppins)" }}
      >
        Post one
      </Link>
    </div>
  );
}
