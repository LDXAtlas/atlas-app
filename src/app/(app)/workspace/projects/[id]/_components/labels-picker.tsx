"use client";

import { useEffect, useState, useTransition } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Check, Plus, Search, Settings2, X } from "lucide-react";
import {
  addCardLabel,
  createBoardLabel,
  getBoardLabels,
  removeCardLabel,
  type CardLabel,
} from "@/app/actions/boards";

// Colors that match the existing card-cover palette.
export const LABEL_COLOR_OPTIONS = [
  { value: "#5CE1A5", name: "Mint" },
  { value: "#3B82F6", name: "Blue" },
  { value: "#8B5CF6", name: "Purple" },
  { value: "#F59E0B", name: "Amber" },
  { value: "#F97316", name: "Orange" },
  { value: "#EF4444", name: "Red" },
  { value: "#9CA3AF", name: "Gray" },
  { value: "#EC4899", name: "Pink" },
];

interface LabelsPickerProps {
  boardId: string;
  cardId: string;
  assignedLabels: CardLabel[];
  canEdit: boolean;
  onChange: (labels: CardLabel[]) => void;
  onOpenManage: () => void;
  onClose: () => void;
}

export function LabelsPicker({
  boardId,
  cardId,
  assignedLabels,
  canEdit,
  onChange,
  onOpenManage,
  onClose,
}: LabelsPickerProps) {
  const [boardLabels, setBoardLabels] = useState<CardLabel[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState(LABEL_COLOR_OPTIONS[0].value);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;
    getBoardLabels(boardId).then((res) => {
      if (cancelled) return;
      if (res.success && res.data) setBoardLabels(res.data);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [boardId]);

  const assignedIds = new Set(assignedLabels.map((l) => l.id));
  const filtered = boardLabels.filter((l) =>
    l.name.toLowerCase().includes(query.trim().toLowerCase()),
  );

  function toggle(label: CardLabel) {
    const isAssigned = assignedIds.has(label.id);
    if (isAssigned) {
      onChange(assignedLabels.filter((l) => l.id !== label.id));
      startTransition(async () => {
        const res = await removeCardLabel(cardId, label.id);
        if (!res.success) console.error("[labels] remove:", res.error);
      });
    } else {
      onChange([...assignedLabels, label]);
      startTransition(async () => {
        const res = await addCardLabel(cardId, label.id);
        if (!res.success) console.error("[labels] add:", res.error);
      });
    }
  }

  function handleCreate() {
    const trimmed = newName.trim();
    if (!trimmed) return;
    startTransition(async () => {
      const res = await createBoardLabel(boardId, trimmed, newColor);
      if (res.success && res.data) {
        setBoardLabels((prev) =>
          [...prev, res.data!].sort((a, b) => a.name.localeCompare(b.name)),
        );
        // Auto-assign to the card so the user doesn't have to click twice.
        const add = await addCardLabel(cardId, res.data.id);
        if (add.success) onChange([...assignedLabels, res.data]);
        setNewName("");
        setCreating(false);
      } else {
        console.error("[labels] create:", res.success ? "" : res.error);
      }
    });
  }

  return (
    <>
      <button
        type="button"
        aria-hidden="true"
        className="fixed inset-0 z-30 cursor-default"
        onClick={onClose}
      />
      <motion.div
        initial={{ opacity: 0, y: 4, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 4, scale: 0.98 }}
        transition={{ duration: 0.15 }}
        className="absolute right-0 top-full mt-2 w-72 bg-white border border-[#E5E7EB] rounded-xl shadow-xl z-40 overflow-hidden"
      >
        <div className="p-3 border-b border-[#F1F5F9] space-y-2">
          <div className="flex items-center gap-2">
            <Search className="size-3.5 text-[#9CA3AF]" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search labels"
              className="flex-1 h-7 text-[13px] text-[#2D333A] outline-none bg-transparent"
              style={{ fontFamily: "var(--font-source-sans)" }}
            />
          </div>
        </div>

        <div className="max-h-64 overflow-auto py-2">
          {loading ? (
            <p
              className="text-[12px] text-[#9CA3AF] px-4 py-2"
              style={{ fontFamily: "var(--font-source-sans)" }}
            >
              Loading…
            </p>
          ) : filtered.length === 0 ? (
            <p
              className="text-[12px] text-[#9CA3AF] px-4 py-2"
              style={{ fontFamily: "var(--font-source-sans)" }}
            >
              {boardLabels.length === 0
                ? "No labels yet — create one below."
                : "No matches."}
            </p>
          ) : (
            <ul>
              {filtered.map((l) => {
                const checked = assignedIds.has(l.id);
                return (
                  <li key={l.id}>
                    <button
                      type="button"
                      onClick={() => toggle(l)}
                      disabled={!canEdit || pending}
                      className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-[#F4F5F7] text-left disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <span
                        className="h-5 px-2 rounded text-[11px] font-semibold text-white inline-flex items-center"
                        style={{
                          backgroundColor: l.color,
                          fontFamily: "var(--font-poppins)",
                        }}
                      >
                        {l.name}
                      </span>
                      {checked && (
                        <Check className="size-3.5 text-[#5CE1A5] ml-auto" />
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {canEdit && (
          <div className="border-t border-[#F1F5F9] p-3 space-y-2">
            <AnimatePresence initial={false}>
              {creating ? (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.15 }}
                  className="space-y-2"
                >
                  <input
                    value={newName}
                    autoFocus
                    onChange={(e) => setNewName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleCreate();
                      } else if (e.key === "Escape") {
                        setCreating(false);
                      }
                    }}
                    placeholder="Label name"
                    className="w-full h-8 px-2 rounded-md border border-[#E5E7EB] text-[13px] outline-none focus:border-[#5CE1A5]"
                    style={{ fontFamily: "var(--font-source-sans)" }}
                  />
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
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleCreate}
                      disabled={!newName.trim() || pending}
                      className="h-7 px-3 rounded-lg bg-[#5CE1A5] text-white text-[12px] font-semibold hover:bg-[#4DD395] disabled:opacity-50 transition-colors"
                      style={{ fontFamily: "var(--font-poppins)" }}
                    >
                      Create
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setCreating(false);
                        setNewName("");
                      }}
                      className="h-7 px-3 rounded-lg text-[12px] text-[#6B7280] hover:bg-[#F4F5F7] transition-colors"
                      style={{ fontFamily: "var(--font-poppins)" }}
                    >
                      Cancel
                    </button>
                  </div>
                </motion.div>
              ) : (
                <motion.button
                  type="button"
                  onClick={() => setCreating(true)}
                  initial={false}
                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-[#F4F5F7] text-[13px] text-[#2D333A] text-left"
                  style={{ fontFamily: "var(--font-source-sans)" }}
                >
                  <Plus className="size-3.5 text-[#5CE1A5]" />
                  Create new label
                </motion.button>
              )}
            </AnimatePresence>
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenManage();
              }}
              className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-[#F4F5F7] text-[12px] text-[#6B7280] text-left"
              style={{ fontFamily: "var(--font-source-sans)" }}
            >
              <Settings2 className="size-3.5" />
              Manage labels
            </button>
          </div>
        )}
      </motion.div>
    </>
  );
}

// Small read-only chips list — used by the sidebar slot.
export function AssignedLabelsList({
  labels,
  onClick,
  canEdit,
}: {
  labels: CardLabel[];
  onClick?: () => void;
  canEdit: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {labels.map((l) => (
        <span
          key={l.id}
          className="h-6 px-2 rounded-md text-[11px] font-semibold text-white inline-flex items-center"
          style={{
            backgroundColor: l.color,
            fontFamily: "var(--font-poppins)",
          }}
        >
          {l.name}
        </span>
      ))}
      {canEdit && (
        <button
          type="button"
          onClick={onClick}
          className="h-6 px-2 rounded-md text-[11px] text-[#6B7280] bg-[#F4F5F7] hover:bg-[#E5E7EB] inline-flex items-center gap-1 transition-colors"
          style={{
            fontFamily: "var(--font-poppins)",
            fontWeight: 600,
          }}
        >
          <Plus className="size-3" />
          {labels.length === 0 ? "Add labels" : "Edit"}
        </button>
      )}
    </div>
  );
}

export type { CardLabel };
