"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  Megaphone,
  CheckSquare,
  Calendar,
  MoreHorizontal,
  Pencil,
  Users,
  Clock,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import type { MinistryDetail } from "@/app/actions/ministry-hub";
import { getIconByName } from "@/lib/icons";
import { can } from "@/lib/permissions";

interface MinistryHeaderProps {
  detail: MinistryDetail;
}

export function MinistryHeader({ detail }: MinistryHeaderProps) {
  const { department, viewerRole, team } = detail;
  const Icon = getIconByName(department.icon);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node))
        setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  const canEdit = can.editDepartment(viewerRole);
  const memberCount = team.length;

  return (
    <div
      className="relative rounded-2xl border border-[#E5E7EB] overflow-hidden"
      style={{
        background: `linear-gradient(135deg, ${department.color}14, white 70%)`,
      }}
    >
      <div
        className="absolute inset-y-0 left-0 w-1.5"
        style={{ backgroundColor: department.color }}
      />
      <div className="px-6 py-5 flex flex-col lg:flex-row lg:items-center gap-5">
        {/* Icon + name */}
        <div className="flex items-center gap-4 flex-1 min-w-0">
          <div
            className="size-14 rounded-2xl flex items-center justify-center text-white shrink-0 shadow-sm"
            style={{ backgroundColor: department.color }}
          >
            <Icon className="size-7" />
          </div>
          <div className="min-w-0">
            <h1
              className="text-[26px] text-[#2D333A] leading-tight truncate"
              style={{ fontFamily: "var(--font-poppins)", fontWeight: 700 }}
            >
              {department.name}
            </h1>
            {department.description && (
              <p
                className="text-[13px] text-[#6B7280] mt-1 max-w-[60ch]"
                style={{ fontFamily: "var(--font-source-sans)" }}
              >
                {department.description}
              </p>
            )}
            <div className="flex items-center gap-4 mt-2 text-[12px] text-[#6B7280]">
              <span
                className="flex items-center gap-1"
                style={{ fontFamily: "var(--font-source-sans)" }}
              >
                <Users className="size-3.5" />
                {memberCount} {memberCount === 1 ? "member" : "members"}
              </span>
              {detail.announcements[0] && (
                <span
                  className="flex items-center gap-1"
                  style={{ fontFamily: "var(--font-source-sans)" }}
                >
                  <Clock className="size-3.5" />
                  Last activity{" "}
                  {new Date(
                    detail.announcements[0].published_at,
                  ).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 shrink-0">
          <Link
            href={`/workspace/announcements?ministry=${department.id}`}
            className="flex items-center gap-2 h-9 px-3.5 rounded-xl bg-[#5CE1A5] text-[#060C09] text-[13px] font-semibold hover:shadow-md transition-all"
            style={{ fontFamily: "var(--font-poppins)" }}
          >
            <Megaphone className="size-4" />
            Post to ministry
          </Link>
          <Link
            href={`/workspace/tasks?ministry=${department.id}`}
            className="flex items-center gap-2 h-9 px-3.5 rounded-xl border border-[#E5E7EB] bg-white text-[13px] font-semibold text-[#2D333A] hover:bg-[#F4F5F7] transition-colors"
            style={{ fontFamily: "var(--font-poppins)" }}
          >
            <CheckSquare className="size-4" />
            Create Task
          </Link>
          <Link
            href={`/workspace/calendar?ministry=${department.id}`}
            className="flex items-center gap-2 h-9 px-3.5 rounded-xl border border-[#E5E7EB] bg-white text-[13px] font-semibold text-[#2D333A] hover:bg-[#F4F5F7] transition-colors"
            style={{ fontFamily: "var(--font-poppins)" }}
          >
            <Calendar className="size-4" />
            Schedule Event
          </Link>
          <div ref={menuRef} className="relative">
            <button
              onClick={() => setMenuOpen((v) => !v)}
              className="size-9 rounded-xl border border-[#E5E7EB] bg-white flex items-center justify-center text-[#6B7280] hover:bg-[#F4F5F7] transition-colors"
              aria-label="More actions"
            >
              <MoreHorizontal className="size-4" />
            </button>
            <AnimatePresence>
              {menuOpen && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: -4 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: -4 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-0 top-full mt-1.5 z-30 bg-white rounded-xl border border-[#E5E7EB] shadow-xl py-1.5 w-48"
                  style={{ boxShadow: "0 8px 30px rgba(0,0,0,0.12)" }}
                >
                  {canEdit && (
                    <Link
                      href="/directory/staff-management"
                      onClick={() => setMenuOpen(false)}
                      className="flex items-center gap-2 px-3 py-2 text-[13px] text-[#2D333A] hover:bg-[#F4F5F7] transition-colors"
                      style={{ fontFamily: "var(--font-source-sans)" }}
                    >
                      <Pencil className="size-3.5 text-[#9CA3AF]" />
                      Edit Department
                    </Link>
                  )}
                  <Link
                    href={`/directory/staff-management`}
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-2 px-3 py-2 text-[13px] text-[#2D333A] hover:bg-[#F4F5F7] transition-colors"
                    style={{ fontFamily: "var(--font-source-sans)" }}
                  >
                    <Users className="size-3.5 text-[#9CA3AF]" />
                    Manage Members
                  </Link>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}
