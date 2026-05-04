"use client";

import { useEffect, useRef, useState } from "react";
import { Plus, UserPlus, Heart, ChevronDown } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";

interface AddProfileDropdownProps {
  onInviteTeamMember: () => void;
  onAddCongregationMember: () => void;
}

export function AddProfileDropdown({
  onInviteTeamMember,
  onAddCongregationMember,
}: AddProfileDropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 h-10 px-4 rounded-xl bg-[#18181B] text-white text-[13px] font-semibold hover:bg-[#292524] transition-colors"
        style={{ fontFamily: "var(--font-poppins)" }}
        aria-expanded={open}
      >
        <Plus className="size-4" />
        Add Profile
        <ChevronDown className={`size-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -4 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-full mt-1.5 z-50 bg-white rounded-xl border border-[#E5E7EB] shadow-xl py-1.5 w-[260px]"
            style={{ boxShadow: "0 8px 30px rgba(0,0,0,0.12)" }}
          >
            <button
              onClick={() => {
                setOpen(false);
                onInviteTeamMember();
              }}
              className="w-full flex items-start gap-3 px-3 py-2.5 hover:bg-[#F4F5F7] transition-colors text-left"
            >
              <div className="size-8 rounded-lg bg-[#DBEAFE] text-[#2563EB] flex items-center justify-center shrink-0">
                <UserPlus className="size-4" />
              </div>
              <div className="min-w-0">
                <p
                  className="text-[13px] font-semibold text-[#2D333A]"
                  style={{ fontFamily: "var(--font-poppins)" }}
                >
                  Invite Team Member
                </p>
                <p
                  className="text-[11px] text-[#6B7280] leading-snug"
                  style={{ fontFamily: "var(--font-source-sans)" }}
                >
                  Send an email invite for app access
                </p>
              </div>
            </button>
            <button
              onClick={() => {
                setOpen(false);
                onAddCongregationMember();
              }}
              className="w-full flex items-start gap-3 px-3 py-2.5 hover:bg-[#F4F5F7] transition-colors text-left"
            >
              <div className="size-8 rounded-lg bg-[#D1FAE5] text-[#059669] flex items-center justify-center shrink-0">
                <Heart className="size-4" />
              </div>
              <div className="min-w-0">
                <p
                  className="text-[13px] font-semibold text-[#2D333A]"
                  style={{ fontFamily: "var(--font-poppins)" }}
                >
                  Add Congregation Member
                </p>
                <p
                  className="text-[11px] text-[#6B7280] leading-snug"
                  style={{ fontFamily: "var(--font-source-sans)" }}
                >
                  Add to roster without app access
                </p>
              </div>
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
