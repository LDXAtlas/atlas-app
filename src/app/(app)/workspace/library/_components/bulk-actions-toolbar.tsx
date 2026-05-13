"use client";

import { motion, AnimatePresence } from "motion/react";
import { Bookmark, FolderInput, Tag, Trash2, X } from "lucide-react";

interface BulkActionsToolbarProps {
  count: number;
  onClear: () => void;
  onMove: () => void;
  onTag: () => void;
  onPin: () => void;
  onDelete: () => void;
}

export function BulkActionsToolbar({
  count,
  onClear,
  onMove,
  onTag,
  onPin,
  onDelete,
}: BulkActionsToolbarProps) {
  return (
    <AnimatePresence>
      {count > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 24 }}
          transition={{ duration: 0.2 }}
          className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[110] bg-[#0F172A] text-white rounded-2xl shadow-2xl px-4 py-2.5 flex items-center gap-2"
          style={{ fontFamily: "var(--font-poppins)" }}
        >
          <span
            className="text-[13px] font-semibold tabular-nums"
            style={{ fontFamily: "var(--font-poppins)", fontWeight: 600 }}
          >
            {count} selected
          </span>
          <span className="h-5 w-px bg-white/15 mx-1" />
          <BulkBtn icon={<FolderInput className="size-3.5" />} onClick={onMove}>
            Move
          </BulkBtn>
          <BulkBtn icon={<Tag className="size-3.5" />} onClick={onTag}>
            Tag
          </BulkBtn>
          <BulkBtn icon={<Bookmark className="size-3.5" />} onClick={onPin}>
            Pin
          </BulkBtn>
          <BulkBtn
            icon={<Trash2 className="size-3.5" />}
            onClick={onDelete}
            tone="danger"
          >
            Delete
          </BulkBtn>
          <span className="h-5 w-px bg-white/15 mx-1" />
          <button
            type="button"
            onClick={onClear}
            className="size-8 rounded-lg flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10"
            aria-label="Cancel selection"
          >
            <X className="size-3.5" />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function BulkBtn({
  icon,
  onClick,
  tone = "default",
  children,
}: {
  icon: React.ReactNode;
  onClick: () => void;
  tone?: "default" | "danger";
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-8 px-2.5 rounded-lg text-[12px] font-semibold inline-flex items-center gap-1.5 transition-colors ${
        tone === "danger"
          ? "text-red-300 hover:bg-red-500/15 hover:text-red-200"
          : "text-white/85 hover:bg-white/10 hover:text-white"
      }`}
      style={{ fontFamily: "var(--font-poppins)" }}
    >
      {icon}
      {children}
    </button>
  );
}
