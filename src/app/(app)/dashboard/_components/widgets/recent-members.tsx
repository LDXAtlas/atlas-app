"use client";

import Link from "next/link";
import { Users } from "lucide-react";

interface Member {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  membership_status: string;
  created_at: string;
}

interface RecentMembersProps {
  members: Member[];
}

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  active: { bg: "rgba(92, 225, 165, 0.10)", text: "#5CE1A5" },
  inactive: { bg: "rgba(107, 114, 128, 0.10)", text: "#6B7280" },
  visitor: { bg: "rgba(59, 130, 246, 0.10)", text: "#3B82F6" },
  new: { bg: "rgba(245, 158, 11, 0.10)", text: "#F59E0B" },
};

function getInitials(first: string, last: string): string {
  return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase();
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

export function RecentMembers({ members }: RecentMembersProps) {
  const isEmpty = members.length === 0;

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
          Recent Members
        </h3>
        <Link
          href="/directory"
          className="text-[13px] text-[#5CE1A5] hover:underline"
          style={{ fontFamily: "var(--font-source-sans)", fontWeight: 600 }}
        >
          View all &rarr;
        </Link>
      </div>

      {isEmpty ? (
        <div className="flex flex-col items-center justify-center py-12 text-center flex-1">
          <div
            className="size-12 rounded-full flex items-center justify-center mb-3"
            style={{ backgroundColor: "rgba(92, 225, 165, 0.08)" }}
          >
            <Users className="size-6 text-[#5CE1A5]" />
          </div>
          <p
            className="text-[14px] text-[#6B7280]"
            style={{ fontFamily: "var(--font-source-sans)" }}
          >
            No members yet
          </p>
          <Link
            href="/directory"
            className="text-[13px] text-[#5CE1A5] mt-2 hover:underline"
            style={{ fontFamily: "var(--font-source-sans)", fontWeight: 600 }}
          >
            Add your first member &rarr;
          </Link>
        </div>
      ) : (
        <div className="space-y-1 flex-1 overflow-y-auto min-h-0">
          {members.map((member) => {
            const initials = getInitials(member.first_name, member.last_name);
            const status = member.membership_status.toLowerCase();
            const colors = STATUS_COLORS[status] || STATUS_COLORS.active;

            return (
              <div
                key={member.id}
                className="flex items-center gap-4 py-3 px-2 rounded-lg hover:bg-[#F4F5F7] transition-colors"
              >
                {/* Avatar */}
                <div
                  className="size-10 rounded-full flex items-center justify-center shrink-0"
                  style={{ backgroundColor: "rgba(92, 225, 165, 0.10)" }}
                >
                  <span
                    className="text-[13px] text-[#5CE1A5]"
                    style={{
                      fontFamily: "var(--font-poppins)",
                      fontWeight: 600,
                    }}
                  >
                    {initials}
                  </span>
                </div>

                {/* Name + email */}
                <div className="flex-1 min-w-0">
                  <p
                    className="text-[14px] text-[#2D333A] truncate"
                    style={{
                      fontFamily: "var(--font-poppins)",
                      fontWeight: 600,
                    }}
                  >
                    {member.first_name} {member.last_name}
                  </p>
                  <p
                    className="text-[12px] text-[#6B7280] truncate"
                    style={{ fontFamily: "var(--font-source-sans)" }}
                  >
                    {member.email || "No email"}
                  </p>
                </div>

                {/* Status badge */}
                <span
                  className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] capitalize shrink-0"
                  style={{
                    fontFamily: "var(--font-poppins)",
                    fontWeight: 600,
                    backgroundColor: colors.bg,
                    color: colors.text,
                  }}
                >
                  {status}
                </span>

                {/* Date */}
                <span
                  className="text-[12px] text-[#9CA3AF] shrink-0 hidden sm:block"
                  style={{ fontFamily: "var(--font-source-sans)" }}
                >
                  {formatDate(member.created_at)}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
