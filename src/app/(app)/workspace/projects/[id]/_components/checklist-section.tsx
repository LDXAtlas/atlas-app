"use client";

import { useState, useTransition, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Check, GripVertical, Plus, X } from "lucide-react";
import {
  createChecklistItem,
  deleteChecklistItem,
  reorderChecklistItems,
  updateChecklistItem,
  type ChecklistItem,
} from "@/app/actions/boards";

interface ChecklistSectionProps {
  cardId: string;
  items: ChecklistItem[];
  canEdit: boolean;
  onItemsChange?: (items: ChecklistItem[]) => void;
}

export function ChecklistSection({
  cardId,
  items: initial,
  canEdit,
  onItemsChange,
}: ChecklistSectionProps) {
  const [items, setItems] = useState<ChecklistItem[]>(initial);
  const [draft, setDraft] = useState("");
  const [adding, startAdd] = useTransition();
  const newItemRef = useRef<HTMLInputElement | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  useEffect(() => {
    setItems(initial);
  }, [initial]);

  function commit(next: ChecklistItem[]) {
    setItems(next);
    onItemsChange?.(next);
  }

  const completedCount = items.filter((i) => i.is_completed).length;
  const pct =
    items.length === 0 ? 0 : Math.round((completedCount / items.length) * 100);

  function handleToggle(item: ChecklistItem) {
    const next = items.map((i) =>
      i.id === item.id ? { ...i, is_completed: !i.is_completed } : i,
    );
    commit(next);
    updateChecklistItem(item.id, { is_completed: !item.is_completed }).then(
      (res) => {
        if (!res.success) {
          // Roll back on failure — we already applied the optimistic flip.
          commit(items);
          console.error("[checklist] toggle failed:", res.error);
        }
      },
    );
  }

  function handleEdit(itemId: string, title: string) {
    const trimmed = title.trim();
    if (!trimmed) return;
    const next = items.map((i) =>
      i.id === itemId ? { ...i, title: trimmed } : i,
    );
    commit(next);
    updateChecklistItem(itemId, { title: trimmed }).then((res) => {
      if (!res.success) console.error("[checklist] edit failed:", res.error);
    });
  }

  function handleDelete(itemId: string) {
    const prev = items;
    commit(items.filter((i) => i.id !== itemId));
    deleteChecklistItem(itemId).then((res) => {
      if (!res.success) {
        commit(prev);
        console.error("[checklist] delete failed:", res.error);
      }
    });
  }

  function handleAdd() {
    const trimmed = draft.trim();
    if (!trimmed) return;
    startAdd(async () => {
      const res = await createChecklistItem(cardId, trimmed);
      if (res.success && res.data) {
        commit([...items, res.data]);
        setDraft("");
        newItemRef.current?.focus();
      }
    });
  }

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIdx = items.findIndex((i) => i.id === active.id);
    const newIdx = items.findIndex((i) => i.id === over.id);
    if (oldIdx < 0 || newIdx < 0) return;
    const reordered = arrayMove(items, oldIdx, newIdx);
    commit(reordered);
    reorderChecklistItems(
      cardId,
      reordered.map((r) => r.id),
    ).then((res) => {
      if (!res.success) {
        commit(items);
        console.error("[checklist] reorder failed:", res.error);
      }
    });
  }

  return (
    <section className="bg-white border border-[#E5E7EB] rounded-2xl p-4">
      <header className="flex items-center justify-between mb-3 gap-3">
        <h3
          className="text-[14px] font-semibold text-[#2D333A]"
          style={{ fontFamily: "var(--font-poppins)" }}
        >
          Checklist
        </h3>
        {items.length > 0 && (
          <span
            className="text-[11px] text-[#6B7280] tabular-nums"
            style={{ fontFamily: "var(--font-source-sans)" }}
          >
            {completedCount} of {items.length} complete
          </span>
        )}
      </header>

      {items.length > 0 && (
        <div className="h-1.5 w-full bg-[#F3F4F6] rounded-full overflow-hidden mb-3">
          <motion.div
            className="h-full bg-[#5CE1A5]"
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.25, ease: "easeOut" }}
          />
        </div>
      )}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={items.map((i) => i.id)}
          strategy={verticalListSortingStrategy}
        >
          <ul className="space-y-1">
            <AnimatePresence initial={false}>
              {items.map((i) => (
                <ChecklistRow
                  key={i.id}
                  item={i}
                  canEdit={canEdit}
                  onToggle={() => handleToggle(i)}
                  onEdit={(t) => handleEdit(i.id, t)}
                  onDelete={() => handleDelete(i.id)}
                />
              ))}
            </AnimatePresence>
          </ul>
        </SortableContext>
      </DndContext>

      {canEdit && (
        <div className="mt-3 flex items-center gap-2">
          <input
            ref={newItemRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleAdd();
              }
            }}
            placeholder="Add an item…"
            disabled={adding}
            className="flex-1 h-9 px-3 rounded-lg border border-[#E5E7EB] bg-white text-[13px] text-[#2D333A] placeholder-[#9CA3AF] outline-none focus:border-[#5CE1A5] transition-colors"
            style={{ fontFamily: "var(--font-source-sans)" }}
          />
          <button
            type="button"
            onClick={handleAdd}
            disabled={!draft.trim() || adding}
            className="h-9 px-3 rounded-lg bg-[#F4F5F7] text-[#2D333A] text-[12px] font-semibold hover:bg-[#E5E7EB] disabled:opacity-50 transition-colors inline-flex items-center gap-1.5"
            style={{ fontFamily: "var(--font-poppins)" }}
          >
            <Plus className="size-3.5" />
            Add
          </button>
        </div>
      )}

      {items.length === 0 && !canEdit && (
        <p
          className="text-[13px] text-[#9CA3AF] text-center py-3"
          style={{ fontFamily: "var(--font-source-sans)" }}
        >
          No checklist items yet.
        </p>
      )}
    </section>
  );
}

function ChecklistRow({
  item,
  canEdit,
  onToggle,
  onEdit,
  onDelete,
}: {
  item: ChecklistItem;
  canEdit: boolean;
  onToggle: () => void;
  onEdit: (title: string) => void;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(item.title);
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id, disabled: !canEdit });

  useEffect(() => {
    setDraft(item.title);
  }, [item.title]);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  } as const;

  return (
    <motion.li
      ref={setNodeRef}
      style={style}
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: isDragging ? 0.5 : 1, x: 0 }}
      exit={{ opacity: 0, x: -8, height: 0 }}
      transition={{ duration: 0.18 }}
      className="group flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-[#F8FAFC]"
    >
      {canEdit && (
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="size-4 text-[#CBD5E1] hover:text-[#6B7280] cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
          aria-label="Drag to reorder"
        >
          <GripVertical className="size-4" />
        </button>
      )}
      <button
        type="button"
        onClick={onToggle}
        disabled={!canEdit}
        className={`size-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
          item.is_completed
            ? "bg-[#5CE1A5] border-[#5CE1A5]"
            : "border-[#CBD5E1] hover:border-[#5CE1A5]"
        } ${!canEdit ? "cursor-default" : "cursor-pointer"}`}
        aria-label={item.is_completed ? "Mark incomplete" : "Mark complete"}
      >
        {item.is_completed && <Check className="size-3 text-white" />}
      </button>
      {editing ? (
        <input
          value={draft}
          autoFocus
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => {
            setEditing(false);
            if (draft.trim() && draft.trim() !== item.title) onEdit(draft);
            else setDraft(item.title);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              (e.target as HTMLInputElement).blur();
            } else if (e.key === "Escape") {
              setDraft(item.title);
              setEditing(false);
            }
          }}
          className="flex-1 h-7 px-2 -mx-1 rounded text-[13px] text-[#2D333A] outline-none border border-[#5CE1A5] bg-white"
          style={{ fontFamily: "var(--font-source-sans)" }}
        />
      ) : (
        <button
          type="button"
          disabled={!canEdit}
          onClick={() => canEdit && setEditing(true)}
          className={`flex-1 text-left text-[13px] truncate ${
            item.is_completed
              ? "text-[#9CA3AF] line-through"
              : "text-[#2D333A]"
          } ${canEdit ? "hover:underline" : ""}`}
          style={{ fontFamily: "var(--font-source-sans)" }}
        >
          {item.title}
        </button>
      )}
      {canEdit && (
        <button
          type="button"
          onClick={onDelete}
          className="size-6 rounded-md flex items-center justify-center text-[#CBD5E1] hover:text-[#EF4444] hover:bg-[#FEF2F2] opacity-0 group-hover:opacity-100 transition-all shrink-0"
          aria-label="Delete item"
        >
          <X className="size-3.5" />
        </button>
      )}
    </motion.li>
  );
}
