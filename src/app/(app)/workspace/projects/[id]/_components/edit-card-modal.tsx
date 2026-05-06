"use client";

import { useEffect, useState, useTransition } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, Loader2, AlertCircle, Calendar, User, Palette, CheckSquare } from "lucide-react";
import { updateCard } from "@/app/actions/boards";
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

interface EditCardModalProps {
  open: boolean;
  onClose: () => void;
  card: BoardCardWithMeta | null;
  orgProfiles: { id: string; full_name: string }[];
  onUpdated: (card: BoardCardWithMeta) => void;
}

export function EditCardModal({
  open,
  onClose,
  card,
  orgProfiles,
  onUpdated,
}: EditCardModalProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [assignee, setAssignee] = useState<string>("");
  const [dueDate, setDueDate] = useState<string>("");
  const [coverColor, setCoverColor] = useState<string | null>(null);
  const [isCompleted, setIsCompleted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!open || !card) return;
    setTitle(card.title || "");
    setDescription(card.description || "");
    setAssignee(card.assigned_to || "");
    setDueDate(card.due_date ? card.due_date.split("T")[0] : "");
    setCoverColor(card.cover_color || null);
    setIsCompleted(!!card.is_completed);
    setError(null);
  }, [open, card]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!card) return;
    if (!title.trim()) {
      setError("Give the card a title.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await updateCard(card.id, {
        title: title.trim(),
        description: description.trim() || null,
        assigned_to: assignee || null,
        due_date: dueDate ? new Date(dueDate).toISOString() : null,
        cover_color: coverColor,
        is_completed: isCompleted,
      });
      if (!result.success) {
        setError(result.error);
        return;
      }
      
      const profile = assignee ? orgProfiles.find(p => p.id === assignee) : null;
      
      onUpdated({
        ...card,
        title: title.trim(),
        description: description.trim() || null,
        assigned_to: assignee || null,
        due_date: dueDate ? new Date(dueDate).toISOString() : null,
        cover_color: coverColor,
        is_completed: isCompleted,
        assignee: assignee && profile ? {
          id: assignee,
          full_name: profile.full_name,
          avatar_color: card.assignee?.avatar_color || "#5CE1A5",
        } : null,
      });
      onClose();
    });
  }

  return (
    <AnimatePresence>
      {open && card && (
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
                  Edit card
                </p>
                <h2
                  className="text-[15px] text-[#2D333A] truncate"
                  style={{ fontFamily: "var(--font-poppins)", fontWeight: 700 }}
                >
                  {card.title}
                </h2>
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
                className="w-full h-10 px-3 rounded-xl border border-[#E5E7EB] bg-white text-[14px] text-[#2D333A] placeholder-[#9CA3AF] outline-none focus:border-[#5CE1A5] transition-colors"
                style={{ fontFamily: "var(--font-source-sans)", fontWeight: 600 }}
              />

              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                placeholder="Add a description (optional)"
                className="w-full px-3 py-2.5 rounded-xl border border-[#E5E7EB] bg-white text-[13px] text-[#2D333A] placeholder-[#9CA3AF] outline-none focus:border-[#5CE1A5] transition-colors resize-none"
                style={{ fontFamily: "var(--font-source-sans)" }}
              />

              {/* Quick metadata */}
              <div className="grid grid-cols-2 gap-3">
                <Field icon={<User className="size-3.5" />} label="Assignee">
                  <select
                    value={assignee}
                    onChange={(e) => setAssignee(e.target.value)}
                    className="w-full h-9 px-2.5 rounded-lg border border-[#E5E7EB] bg-white text-[13px] text-[#2D333A] outline-none focus:border-[#5CE1A5] transition-colors"
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
                    className="w-full h-9 px-2.5 rounded-lg border border-[#E5E7EB] bg-white text-[13px] text-[#2D333A] outline-none focus:border-[#5CE1A5] transition-colors"
                    style={{ fontFamily: "var(--font-source-sans)" }}
                  />
                </Field>
              </div>

              <div className="flex items-center gap-4">
                <div className="flex-1">
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
                                ? "0 0 0 2px white, 0 0 0 4px #5CE1A5"
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
                </div>
                <div>
                  <Field icon={<CheckSquare className="size-3.5" />} label="Status">
                    <label className="flex items-center gap-2 mt-1 cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={isCompleted} 
                        onChange={(e) => setIsCompleted(e.target.checked)} 
                        className="size-4 rounded text-[#5CE1A5] focus:ring-[#5CE1A5] border-[#E5E7EB]" 
                      />
                      <span className="text-[13px] text-[#2D333A]" style={{ fontFamily: "var(--font-source-sans)" }}>Completed</span>
                    </label>
                  </Field>
                </div>
              </div>
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
                className="inline-flex items-center gap-1.5 h-9 px-4 rounded-xl bg-[#5CE1A5] text-[#060C09] text-[13px] font-semibold hover:shadow-md transition-all disabled:opacity-50"
                style={{ fontFamily: "var(--font-poppins)" }}
              >
                {pending && <Loader2 className="size-3.5 animate-spin" />}
                {pending ? "Saving..." : "Save Changes"}
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

