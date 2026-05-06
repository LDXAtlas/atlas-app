"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { motion } from "motion/react";
import { Plus, Loader2, X } from "lucide-react";

interface AddColumnInputProps {
  active: boolean;
  onSubmit: (name: string) => Promise<void>;
  onCancel: () => void;
  onActivate: () => void;
  viewMode?: "grid" | "list";
}

export function AddColumnInput({
  active,
  onSubmit,
  onCancel,
  onActivate,
  viewMode = "grid",
}: AddColumnInputProps) {
  const [name, setName] = useState("");
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null); // Added a ref for the container!

  useEffect(() => {
    if (active) {
      setName("");
      // Focus the input, and smoothly scroll the page down to it so it's never hidden!
      window.setTimeout(() => {
        inputRef.current?.focus();
        containerRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 80);
    }
  }, [active]);

  function commit() {
    const trimmed = name.trim();
    if (!trimmed) {
      onCancel();
      return;
    }
    startTransition(async () => {
      await onSubmit(trimmed);
      setName("");
    });
  }

  const widthClass = viewMode === "list" ? "w-full" : "w-[320px]";
  const label = viewMode === "list" ? "Add group" : "Add column";
  const placeholder = viewMode === "list" ? "Group name" : "Column name";

  if (!active) {
    return (
      <button
        type="button"
        onClick={onActivate}
        className={`shrink-0 h-12 self-start mt-1 mb-8 inline-flex items-center justify-center gap-1.5 rounded-xl border border-dashed border-[#D1D5DB] text-[13px] text-[#6B7280] hover:border-[#5CE1A5] hover:text-[#5CE1A5] hover:bg-white transition-colors ${widthClass}`}
        style={{ fontFamily: "var(--font-poppins)", fontWeight: 600 }}
      >
        <Plus className="size-4" />
        {label}
      </button>
    );
  }

  return (
    <motion.div
      ref={containerRef}
      // Added a vertical drop animation for list mode
      initial={{ opacity: 0, x: viewMode === "list" ? 0 : 20, y: viewMode === "list" ? -15 : 0 }}
      animate={{ opacity: 1, x: 0, y: 0 }}
      exit={{ opacity: 0, x: viewMode === "list" ? 0 : 20, y: viewMode === "list" ? -15 : 0 }}
      transition={{ duration: 0.25, ease: [0.23, 1, 0.32, 1] }}
      className={`shrink-0 rounded-xl bg-white border border-[#5CE1A5] p-3 flex flex-col gap-2 self-start mt-1 mb-8 ${widthClass}`}
    >
      <input
        ref={inputRef}
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit();
          } else if (e.key === "Escape") {
            onCancel();
          }
        }}
        placeholder={placeholder}
        className="h-9 px-2.5 rounded-lg border border-[#E5E7EB] bg-white text-[13px] text-[#2D333A] placeholder-[#9CA3AF] outline-none focus:border-[#5CE1A5] transition-colors"
        style={{ fontFamily: "var(--font-source-sans)" }}
      />
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={commit}
          disabled={pending}
          className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-[#5CE1A5] text-[#060C09] text-[12px] font-semibold hover:shadow-md transition-all disabled:opacity-50"
          style={{ fontFamily: "var(--font-poppins)" }}
        >
          {pending && <Loader2 className="size-3 animate-spin" />}
          Save
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={pending}
          className="size-8 rounded-lg flex items-center justify-center text-[#9CA3AF] hover:text-[#2D333A] hover:bg-[#F4F5F7] transition-colors"
          aria-label="Cancel"
        >
          <X className="size-3.5" />
        </button>
      </div>
    </motion.div>
  );
}