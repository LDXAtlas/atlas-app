"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Mail, MoreHorizontal, Eye, Pencil, Trash2 } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import type { DirectoryPerson } from "@/app/actions/members";
import { ROLE_COLORS, ROLE_LABELS } from "@/lib/roles";
import { getIconByName } from "@/lib/icons";

interface PersonRowProps {
  person: DirectoryPerson;
  canRemove: boolean;
  onRemove: (person: DirectoryPerson) => void;
}

function avatarColor(person: DirectoryPerson): string {
  return person.primary_department?.color || "#5CE1A5";
}

function initialsOf(person: DirectoryPerson): string {
  const f = person.first_name?.[0] || "";
  const l = person.last_name?.[0] || "";
  return (f + l).toUpperCase() || "?";
}

function detailHref(person: DirectoryPerson): string {
  return person.type === "profile"
    ? `/directory/profile/${person.id}`
    : `/directory/${person.id}`;
}

export function PersonRow({ person, canRemove, onRemove }: PersonRowProps) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
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

  const roleStyle = ROLE_COLORS[person.role];
  const PrimaryIcon = person.primary_department
    ? getIconByName(person.primary_department.icon)
    : null;
  const extraCount = Math.max(0, person.ministry_count - 1);

  return (
    <div
      onClick={() => router.push(detailHref(person))}
      className="grid grid-cols-[1.4fr_1.5fr_120px_1.4fr_88px] gap-4 px-5 py-3 border-b border-[#F3F4F6] last:border-b-0 items-center hover:bg-[#FAFBFC] transition-colors cursor-pointer"
    >
      {/* NAME */}
      <div className="flex items-center gap-3 min-w-0">
        <div
          className="size-8 rounded-full flex items-center justify-center text-white text-[12px] shrink-0"
          style={{
            backgroundColor: avatarColor(person),
            fontFamily: "var(--font-poppins)",
            fontWeight: 600,
          }}
        >
          {initialsOf(person)}
        </div>
        <span
          className="text-[14px] text-[#2D333A] truncate"
          style={{ fontFamily: "var(--font-poppins)", fontWeight: 600 }}
        >
          {person.full_name || "Unnamed"}
        </span>
      </div>

      {/* CONTACT INFO */}
      <span
        className="text-[13px] text-[#2D333A] truncate"
        style={{ fontFamily: "var(--font-source-sans)" }}
      >
        {person.email || (
          <span className="text-[#9CA3AF]">No email on file</span>
        )}
      </span>

      {/* PRIMARY ROLE */}
      <div>
        <span
          className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold uppercase tracking-wide border"
          style={{
            fontFamily: "var(--font-poppins)",
            backgroundColor: roleStyle.bg,
            color: roleStyle.text,
            borderColor: roleStyle.border,
          }}
        >
          {ROLE_LABELS[person.role]}
        </span>
      </div>

      {/* MINISTRIES */}
      <div className="flex items-center gap-1.5 min-w-0">
        {person.primary_department && PrimaryIcon ? (
          <>
            <span
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold text-white truncate max-w-[140px]"
              style={{
                fontFamily: "var(--font-poppins)",
                backgroundColor: person.primary_department.color,
              }}
              title={person.primary_department.name}
            >
              <PrimaryIcon className="size-3 shrink-0" />
              <span className="truncate">{person.primary_department.name}</span>
            </span>
            {extraCount > 0 && (
              <span
                className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[11px] font-semibold bg-[#F3F4F6] text-[#6B7280] border border-[#E5E7EB]"
                style={{ fontFamily: "var(--font-poppins)" }}
              >
                +{extraCount}
              </span>
            )}
          </>
        ) : (
          <span
            className="text-[12px] text-[#9CA3AF]"
            style={{ fontFamily: "var(--font-source-sans)" }}
          >
            None
          </span>
        )}
      </div>

      {/* ACTION */}
      <div
        className="flex items-center justify-end gap-0.5"
        onClick={(e) => e.stopPropagation()}
      >
        {person.email ? (
          <a
            href={`mailto:${person.email}`}
            onClick={(e) => e.stopPropagation()}
            className="size-8 rounded-lg flex items-center justify-center text-[#9CA3AF] hover:text-[#2D333A] hover:bg-[#F4F5F7] transition-colors"
            aria-label={`Email ${person.full_name}`}
            title={`Email ${person.full_name}`}
          >
            <Mail className="size-4" />
          </a>
        ) : (
          <span className="size-8" />
        )}
        <div ref={menuRef} className="relative">
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="size-8 rounded-lg flex items-center justify-center text-[#9CA3AF] hover:text-[#2D333A] hover:bg-[#F4F5F7] transition-colors"
            aria-label="More actions"
            aria-expanded={menuOpen}
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
                className="absolute right-0 top-full mt-1 z-30 bg-white rounded-xl border border-[#E5E7EB] shadow-xl py-1.5 w-44"
                style={{ boxShadow: "0 8px 30px rgba(0,0,0,0.12)" }}
              >
                <Link
                  href={detailHref(person)}
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-2 px-3 py-2 text-[13px] text-[#2D333A] hover:bg-[#F4F5F7] transition-colors"
                  style={{ fontFamily: "var(--font-source-sans)" }}
                >
                  <Eye className="size-3.5 text-[#9CA3AF]" />
                  View Details
                </Link>
                <Link
                  href={detailHref(person)}
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-2 px-3 py-2 text-[13px] text-[#2D333A] hover:bg-[#F4F5F7] transition-colors"
                  style={{ fontFamily: "var(--font-source-sans)" }}
                >
                  <Pencil className="size-3.5 text-[#9CA3AF]" />
                  Edit
                </Link>
                {canRemove && (
                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      onRemove(person);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-[13px] text-[#DC2626] hover:bg-[#FEF2F2] transition-colors text-left"
                    style={{ fontFamily: "var(--font-source-sans)" }}
                  >
                    <Trash2 className="size-3.5" />
                    Remove
                  </button>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
