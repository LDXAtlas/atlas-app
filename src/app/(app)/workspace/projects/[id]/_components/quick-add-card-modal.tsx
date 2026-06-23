"use client";

import { useEffect, useState, useTransition } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, Loader2, AlertCircle, Calendar, User, Palette, ChevronDown } from "lucide-react";
import { createCard } from "@/app/actions/boards";
import type { BoardCardWithMeta } from "@/app/actions/boards";

const CARD_COVER_OPTIONS: { value: string | null; label: string; bg: string }[] = [
  { value: null, label: "No color", bg: "transparent" },
  { value: "#5CE1A5", label: "Mint", bg: "#5CE1A5" },
  { value: "#3B82F6", label: "Blue", bg: "#3B82F6" },
  { value: "#8B5CF6", label: "Purple", bg: "#8B5CF6" },
  { value: "#F59E0B", label: "Amber", bg: "#F59E0B" },
  { value: "#F97316", label: "Orange", bg: "#F97316" },
  { value: "#EF4444", label: "Red", bg: "#EF4444" },
  { value: "#9CA3AF", label: "Gray", bg: "#9CA3AF" },
];

interface QuickAddCardModalProps {
  open: boolean;
  onClose: () => void;
  columnId: string | null;
  columns: { id: string; name: string }[];
  orgProfiles: { id: string; full_name: string }[];
  defaultAssigneeId: string | null;
  onCreated: (columnId: string, card: BoardCardWithMeta) => void;
}

export function QuickAddCardModal({
  open,
  onClose,
  columnId,
  columns,
  orgProfiles,
  defaultAssigneeId,
  onCreated,
}: QuickAddCardModalProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [assignee, setAssignee] = useState<string>("");
  const [dueDate, setDueDate] = useState<string>("");
  const [coverColor, setCoverColor] = useState<string | null>(null);
  const [selectedColumnId, setSelectedColumnId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    setTitle("");
    setDescription("");
    setAssignee(defaultAssigneeId ?? "");
    setDueDate("");
    setCoverColor(null);
    setSelectedColumnId(columnId);
    setError(null);
  }, [open, defaultAssigneeId, columnId]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedColumnId) return;
    if (!title.trim()) {
      setError("Give the card a title.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await createCard(selectedColumnId, {
        title: title.trim(),
        description: description.trim() || null,
        assigned_to: assignee || null,
        due_date: dueDate ? new Date(dueDate).toISOString() : null,
        cover_color: coverColor,
      });
      if (!result.success) {
        setError(result.error);
        return;
      }
      if (result.data) {
        onCreated(selectedColumnId, result.data);
      }
      onClose();
    });
  }

  return (
    <AnimatePresence>
      {open && selectedColumnId && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/30 p-4"
          onClick={() => !pending && onClose()}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 6 }}
            transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
            className="bg-white rounded-2xl shadow-2xl w-full max-w-[480px] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-[#E5E7EB] flex items-center justify-between">
              <div className="min-w-0">
                <p
                  className="text-[10px] uppercase tracking-[0.08em] text-[#9CA3AF]"
                  style={{ fontFamily: "var(--font-poppins)", fontWeight: 600 }}
                >
                  New card in
                </p>
                <div className="relative inline-flex items-center group/select">
                  <select
                    value={selectedColumnId || ""}
                    onChange={(e) => setSelectedColumnId(e.target.value)}
                    className="text-[15px] text-[#2D333A] truncate bg-transparent outline-none cursor-pointer group-hover/select:bg-[#F4F5F7] rounded pl-1 pr-6 -ml-1 py-0.5 transition-colors appearance-none"
                    style={{ fontFamily: "var(--font-poppins)", fontWeight: 700 }}
                  >
                    {columns.map((col) => (
                      <option key={col.id} value={col.id}>
                        {col.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="size-4 text-[#9CA3AF] pointer-events-none absolute right-1" />
                </div>
              </div>
              <button
                onClick={onClose}
                className="size-8 rounded-lg flex items-center justify-center text-[#9CA3AF] hover:text-[#2D333A] hover:bg-[#F4F5F7] transition-colors"
                aria-label="Close"
              >
                <X className="size-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4">
              {error && (
                <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-red-50 border border-red-100">
                  <AlertCircle className="size-4 text-red-500 mt-0.5 shrink-0" />
                  <p
                    className="text-[13px] text-red-600"
                    style={{ fontFamily: "var(--font-source-sans)" }}
                  >
                    {error}
                  </p>
                </div>
              )}

              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="What needs to be done?"
                autoFocus
                className="w-full h-10 px-3 rounded-xl border border-[#E5E7EB] bg-white text-[14px] text-[#2D333A] placeholder-[#9CA3AF] outline-none focus:border-[#3B82F6] transition-colors"
                style={{ fontFamily: "var(--font-source-sans)", fontWeight: 600 }}
              />

              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                placeholder="Add a description (optional)"
                className="w-full px-3 py-2.5 rounded-xl border border-[#E5E7EB] bg-white text-[13px] text-[#2D333A] placeholder-[#9CA3AF] outline-none focus:border-[#3B82F6] transition-colors resize-none"
                style={{ fontFamily: "var(--font-source-sans)" }}
              />

              <div className="grid grid-cols-2 gap-3">
                <Field icon={<User className="size-3.5" />} label="Assignee">
                  <select
                    value={assignee}
                    onChange={(e) => setAssignee(e.target.value)}
                    className="w-full h-9 px-2.5 rounded-lg border border-[#E5E7EB] bg-white text-[13px] text-[#2D333A] outline-none focus:border-[#3B82F6] transition-colors"
                    style={{ fontFamily: "var(--font-source-sans)" }}
                  >
                    <option value="">Unassigned</option>
                    {orgProfiles.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.full_name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field icon={<Calendar className="size-3.5" />} label="Due date">
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full h-9 px-2.5 rounded-lg border border-[#E5E7EB] bg-white text-[13px] text-[#2D333A] outline-none focus:border-[#3B82F6] transition-colors"
                    style={{ fontFamily: "var(--font-source-sans)" }}
                  />
                </Field>
              </div>

              <Field icon={<Palette className="size-3.5" />} label="Cover color">
                <div className="flex items-center gap-1.5 flex-wrap">
                  {CARD_COVER_OPTIONS.map((opt) => {
                    const selected = coverColor === opt.value;
                    return (
                      <button
                        key={opt.label}
                        type="button"
                        onClick={() => setCoverColor(opt.value)}
                        className="size-7 rounded-md transition-transform hover:scale-105 flex items-center justify-center"
                        style={{
                          backgroundColor:
                            opt.value === null ? "#F3F4F6" : opt.bg,
                          boxShadow: selected
                            ? "0 0 0 2px white, 0 0 0 4px #3B82F6"
                            : undefined,
                          border:
                            opt.value === null
                              ? "1px dashed #D1D5DB"
                              : undefined,
                        }}
                        aria-label={opt.label}
                        title={opt.label}
                      />
                    );
                  })}
                </div>
              </Field>
            </form>

            <div className="px-5 py-4 border-t border-[#E5E7EB] flex items-center justify-end gap-3 bg-white">
              <button
                type="button"
                onClick={onClose}
                disabled={pending}
                className="h-9 px-4 rounded-xl border border-[#E5E7EB] text-[13px] font-semibold text-[#2D333A] hover:bg-[#F4F5F7] transition-colors"
                style={{ fontFamily: "var(--font-poppins)" }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={pending}
                className="inline-flex items-center gap-1.5 h-9 px-4 rounded-xl bg-[#3B82F6] text-white text-[13px] font-semibold hover:bg-[#2563EB] hover:shadow-md transition-all disabled:opacity-50"
                style={{ fontFamily: "var(--font-poppins)" }}
              >
                {pending && <Loader2 className="size-3.5 animate-spin" />}
                {pending ? "Adding..." : "Add Card"}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Field({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label
        className="flex items-center gap-1.5 mb-1 text-[11px] uppercase tracking-[0.06em] text-[#6B7280]"
        style={{ fontFamily: "var(--font-poppins)", fontWeight: 600 }}
      >
        <span className="text-[#9CA3AF]">{icon}</span>
        {label}
      </label>
      {children}
    </div>
  );
}