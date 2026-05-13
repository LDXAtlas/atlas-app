"use client";

import { useEffect, useState, useTransition } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Check, Plus, Trash2, X } from "lucide-react";
import {
  createBoardLabel,
  deleteBoardLabel,
  getBoardLabels,
  updateBoardLabel,
  type CardLabel,
} from "@/app/actions/boards";
import { LABEL_COLOR_OPTIONS } from "./labels-picker";

type LabelWithUsage = CardLabel & { usage_count: number };

interface ManageLabelsModalProps {
  open: boolean;
  onClose: () => void;
  boardId: string;
  boardName: string;
  /** Called whenever the label catalog changes so callers can re-fetch the
   *  per-card label list. */
  onMutated?: () => void;
}

export function ManageLabelsModal({
  open,
  onClose,
  boardId,
  boardName,
  onMutated,
}: ManageLabelsModalProps) {
  const [labels, setLabels] = useState<LabelWithUsage[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState(LABEL_COLOR_OPTIONS[0].value);
  const [pending, startTransition] = useTransition();
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    getBoardLabels(boardId).then((res) => {
      if (cancelled) return;
      if (res.success && res.data) setLabels(res.data);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [open, boardId]);

  function handleRename(id: string, name: string) {
    const trimmed = name.trim();
    if (!trimmed) return;
    startTransition(async () => {
      const res = await updateBoardLabel(id, { name: trimmed });
      if (res.success && res.data) {
        setLabels((prev) =>
          prev
            .map((l) => (l.id === id ? { ...l, name: res.data!.name } : l))
            .sort((a, b) => a.name.localeCompare(b.name)),
        );
        onMutated?.();
      }
    });
  }

  function handleRecolor(id: string, color: string) {
    startTransition(async () => {
      const res = await updateBoardLabel(id, { color });
      if (res.success && res.data) {
        setLabels((prev) =>
          prev.map((l) => (l.id === id ? { ...l, color: res.data!.color } : l)),
        );
        onMutated?.();
      }
    });
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      const res = await deleteBoardLabel(id);
      if (res.success) {
        setLabels((prev) => prev.filter((l) => l.id !== id));
        setConfirmDeleteId(null);
        onMutated?.();
      }
    });
  }

  function handleCreate() {
    const trimmed = newName.trim();
    if (!trimmed) return;
    startTransition(async () => {
      const res = await createBoardLabel(boardId, trimmed, newColor);
      if (res.success && res.data) {
        setLabels((prev) =>
          [...prev, { ...res.data!, usage_count: 0 }].sort((a, b) =>
            a.name.localeCompare(b.name),
          ),
        );
        setNewName("");
        onMutated?.();
      }
    });
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
            className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="flex items-center justify-between px-5 py-4 border-b border-[#E5E7EB]">
              <div>
                <h2
                  className="text-[16px] font-semibold text-[#2D333A]"
                  style={{ fontFamily: "var(--font-poppins)" }}
                >
                  Manage labels
                </h2>
                <p
                  className="text-[12px] text-[#6B7280] mt-0.5"
                  style={{ fontFamily: "var(--font-source-sans)" }}
                >
                  for {boardName}
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="size-9 rounded-xl hover:bg-[#F4F5F7] flex items-center justify-center text-[#6B7280]"
                aria-label="Close"
              >
                <X className="size-4" />
              </button>
            </header>

            <div className="flex-1 overflow-auto px-5 py-4 space-y-3">
              {loading ? (
                <p
                  className="text-[13px] text-[#9CA3AF]"
                  style={{ fontFamily: "var(--font-source-sans)" }}
                >
                  Loading…
                </p>
              ) : labels.length === 0 ? (
                <p
                  className="text-[13px] text-[#9CA3AF]"
                  style={{ fontFamily: "var(--font-source-sans)" }}
                >
                  No labels yet. Create one below.
                </p>
              ) : (
                <ul className="space-y-2">
                  {labels.map((l) => (
                    <ManageLabelRow
                      key={l.id}
                      label={l}
                      confirming={confirmDeleteId === l.id}
                      onConfirmDelete={() => setConfirmDeleteId(l.id)}
                      onCancelConfirm={() => setConfirmDeleteId(null)}
                      onRename={(n) => handleRename(l.id, n)}
                      onRecolor={(c) => handleRecolor(l.id, c)}
                      onDelete={() => handleDelete(l.id)}
                      pending={pending}
                    />
                  ))}
                </ul>
              )}
            </div>

            <footer className="px-5 py-4 border-t border-[#E5E7EB] bg-[#F8FAFC] space-y-2">
              <p
                className="text-[11px] uppercase tracking-wider text-[#6B7280]"
                style={{ fontFamily: "var(--font-poppins)", fontWeight: 600 }}
              >
                Create label
              </p>
              <div className="flex items-center gap-2">
                <input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleCreate();
                    }
                  }}
                  placeholder="Label name"
                  className="flex-1 h-9 px-3 rounded-lg border border-[#E5E7EB] bg-white text-[13px] outline-none focus:border-[#5CE1A5]"
                  style={{ fontFamily: "var(--font-source-sans)" }}
                />
                <button
                  type="button"
                  onClick={handleCreate}
                  disabled={!newName.trim() || pending}
                  className="h-9 px-3 rounded-lg bg-[#5CE1A5] text-white text-[12px] font-semibold inline-flex items-center gap-1.5 hover:bg-[#4DD395] disabled:opacity-50 transition-colors"
                  style={{ fontFamily: "var(--font-poppins)" }}
                >
                  <Plus className="size-3.5" />
                  Create
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {LABEL_COLOR_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setNewColor(opt.value)}
                    className="size-6 rounded-md transition-transform hover:scale-110"
                    style={{
                      backgroundColor: opt.value,
                      boxShadow:
                        newColor === opt.value
                          ? "0 0 0 2px white, 0 0 0 4px #5CE1A5"
                          : undefined,
                    }}
                    aria-label={opt.name}
                  />
                ))}
              </div>
            </footer>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function ManageLabelRow({
  label,
  confirming,
  onConfirmDelete,
  onCancelConfirm,
  onRename,
  onRecolor,
  onDelete,
  pending,
}: {
  label: LabelWithUsage;
  confirming: boolean;
  onConfirmDelete: () => void;
  onCancelConfirm: () => void;
  onRename: (n: string) => void;
  onRecolor: (c: string) => void;
  onDelete: () => void;
  pending: boolean;
}) {
  const [name, setName] = useState(label.name);
  const [colorPickerOpen, setColorPickerOpen] = useState(false);
  useEffect(() => setName(label.name), [label.name]);

  return (
    <li className="flex items-center gap-2 p-2 rounded-xl border border-[#E5E7EB] bg-white">
      <div className="relative">
        <button
          type="button"
          onClick={() => setColorPickerOpen((v) => !v)}
          className="size-6 rounded-md ring-1 ring-black/5"
          style={{ backgroundColor: label.color }}
          aria-label="Change color"
        />
        {colorPickerOpen && (
          <>
            <button
              type="button"
              aria-hidden="true"
              className="fixed inset-0 z-30"
              onClick={() => setColorPickerOpen(false)}
            />
            <div className="absolute left-0 top-8 z-40 p-2 bg-white border border-[#E5E7EB] rounded-xl shadow-lg flex flex-wrap gap-1.5 w-44">
              {LABEL_COLOR_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    onRecolor(opt.value);
                    setColorPickerOpen(false);
                  }}
                  className="size-6 rounded-md flex items-center justify-center"
                  style={{ backgroundColor: opt.value }}
                >
                  {opt.value === label.color && (
                    <Check className="size-3.5 text-white" />
                  )}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={() => {
          if (name.trim() && name.trim() !== label.name) onRename(name);
          else setName(label.name);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          else if (e.key === "Escape") {
            setName(label.name);
            (e.target as HTMLInputElement).blur();
          }
        }}
        className="flex-1 h-7 px-2 rounded-md text-[13px] text-[#2D333A] bg-transparent outline-none focus:bg-[#F4F5F7]"
        style={{ fontFamily: "var(--font-source-sans)" }}
      />
      <span
        className="text-[11px] text-[#9CA3AF] tabular-nums shrink-0"
        style={{ fontFamily: "var(--font-source-sans)" }}
      >
        Used on {label.usage_count} card{label.usage_count === 1 ? "" : "s"}
      </span>
      {confirming ? (
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={onDelete}
            disabled={pending}
            className="h-7 px-2 rounded-md bg-[#EF4444] text-white text-[11px] font-semibold disabled:opacity-50"
            style={{ fontFamily: "var(--font-poppins)" }}
          >
            Confirm
          </button>
          <button
            type="button"
            onClick={onCancelConfirm}
            className="h-7 px-2 rounded-md text-[11px] text-[#6B7280] hover:bg-[#F4F5F7]"
            style={{ fontFamily: "var(--font-poppins)" }}
          >
            Cancel
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={onConfirmDelete}
          className="size-7 rounded-md flex items-center justify-center text-[#9CA3AF] hover:text-[#EF4444] hover:bg-[#FEF2F2] transition-colors shrink-0"
          aria-label="Delete label"
        >
          <Trash2 className="size-3.5" />
        </button>
      )}
    </li>
  );
}
