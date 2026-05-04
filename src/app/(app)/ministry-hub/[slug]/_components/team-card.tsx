"use client";

import Link from "next/link";
import { Users, ArrowRight } from "lucide-react";
import type { MinistryDetailMember } from "@/app/actions/ministry-hub";
import { ROLE_COLORS, ROLE_LABELS } from "@/lib/roles";

function initials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

interface TeamCardProps {
  team: MinistryDetailMember[];
  departmentId: string;
}

export function TeamCard({ team }: TeamCardProps) {
  return (
    <section className="bg-white rounded-2xl border border-[#E5E7EB] overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4">
        <div className="flex items-center gap-2">
          <div className="size-7 rounded-lg bg-[#DBEAFE] flex items-center justify-center">
            <Users className="size-4 text-[#3B82F6]" />
          </div>
          <h3
            className="text-[14px] text-[#2D333A]"
            style={{ fontFamily: "var(--font-poppins)", fontWeight: 600 }}
          >
            Team
          </h3>
          <span
            className="text-[11px] font-semibold text-[#6B7280] bg-[#F3F4F6] px-1.5 py-0.5 rounded-md"
            style={{ fontFamily: "var(--font-poppins)" }}
          >
            {team.length}
          </span>
        </div>
      </div>

      {team.length === 0 ? (
        <div className="border-t border-[#F3F4F6] px-5 py-8 text-center">
          <p
            className="text-[13px] text-[#9CA3AF]"
            style={{ fontFamily: "var(--font-source-sans)" }}
          >
            No team members assigned
          </p>
        </div>
      ) : (
        <ul className="border-t border-[#F3F4F6]">
          {team.map((m) => {
            const roleStyle = ROLE_COLORS[m.role];
            return (
              <li
                key={m.profile_id}
                className="px-5 py-3 border-b border-[#F3F4F6] last:border-b-0 flex items-center gap-3"
              >
                <div
                  className="size-8 rounded-full flex items-center justify-center text-white text-[11px] shrink-0"
                  style={{
                    backgroundColor: m.is_primary ? "#5CE1A5" : "#94A3B8",
                    fontFamily: "var(--font-poppins)",
                    fontWeight: 600,
                  }}
                >
                  {initials(m.full_name)}
                </div>
                <div className="flex-1 min-w-0">
                  <p
                    className="text-[13px] text-[#2D333A] truncate"
                    style={{ fontFamily: "var(--font-poppins)", fontWeight: 600 }}
                  >
                    {m.full_name}
                  </p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span
                      className="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded border"
                      style={{
                        fontFamily: "var(--font-poppins)",
                        backgroundColor: roleStyle.bg,
                        color: roleStyle.text,
                        borderColor: roleStyle.border,
                      }}
                    >
                      {ROLE_LABELS[m.role]}
                    </span>
                    <span
                      className="text-[10px] uppercase tracking-wide text-[#9CA3AF]"
                      style={{ fontFamily: "var(--font-poppins)", fontWeight: 600 }}
                    >
                      {m.is_primary ? "Primary" : "Secondary"}
                    </span>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <div className="border-t border-[#F3F4F6] px-5 py-3">
        <Link
          href="/directory/staff-management"
          className="text-[12px] font-semibold text-[#5CE1A5] hover:text-[#3DB882] flex items-center gap-0.5 transition-colors"
          style={{ fontFamily: "var(--font-poppins)" }}
        >
          Manage Team
          <ArrowRight className="size-3" />
        </Link>
      </div>
    </section>
  );
}
