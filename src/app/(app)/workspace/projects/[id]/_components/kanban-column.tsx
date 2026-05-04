"use client";

import { useEffect, useRef, useState } from "react";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useDroppable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { Plus, MoreHorizontal, Pencil, Trash2, Palette } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import type { BoardColumnWithCards } from "@/app/actions/boards";
import { KanbanCard, StaticKanbanCard } from "./kanban-card";

const COLUMN_PRESET_COLORS = [
  "#9CA3AF", "#3B82F6", "#5CE1A5", "#F59E0B", "#F97316", "#EF4444",
  "#8B5CF6", "#EC4899", "#10B981", "#06B6D4", "#FBBF24", "#6366F1",
];

interface KanbanColumnProps {
  column: BoardColumnWithCards;
  canEdit: boolean;
  onAddCard: (columnId: string) => void;
  onRename: (columnId: string, name: string) => void;
  onChangeColor: (columnId: string, color: string) => void;
  onDelete: (columnId: string) => void;
  /** True while this column itself is the dragged item (overlay rendering). */
  isOverlay?: boolean;
}

export function KanbanColumn({
  column,
  canEdit,
  onAddCard,
  onRename,
  onChangeColor,
  onDelete,
  isOverlay = false,
}: KanbanColumnProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: `column-${column.id}`,
    data: { type: "column", columnId: column.id },
    disabled: isOverlay || !canEdit,
  });

  // Separate droppable for the column body so cards can be dropped onto an
  // empty column (where there are no card sortable items to land on).
  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: `column-drop-${column.id}`,
    data: { type: "column-body", columnId: column.id },
  });

  const [renaming, setRenaming] = useState(false);
  const [draftName, setDraftName] = useState(column.name);
  const [menuOpen, setMenuOpen] = useState(false);
  const [colorPickerOpen, setColorPickerOpen] = useState(false);

  const menuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!menuOpen && !colorPickerOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
        setColorPickerOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menuOpen, colorPickerOpen]);

  const style: React.CSSProperties = isOverlay
    ? { boxShadow: "0 18px 40px rgba(15, 23, 42, 0.18)", transform: "rotate(1deg)" }
    : {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
      };

  const cardIds = column.cards.map((c) => c.id);

  return (
    <div
      ref={isOverlay ? undefined : setNodeRef}
      style={style}
      className="shrink-0 w-[280px] rounded-xl border bg-[#FAFBFC] flex flex-col"
      data-column-id={column.id}
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-3 pt-3 pb-2">
        <span
          className="size-2 rounded-full shrink-0"
          style={{ backgroundColor: column.color }}
          aria-hidden
        />
        {renaming ? (
          <input
            autoFocus
            value={draftName}
            onChange={(e) => setDraftName(e.target.value)}
            onBlur={() => {
              const trimmed = draftName.trim();
              if (trimmed && trimmed !== column.name) onRename(column.id, trimmed);
              else setDraftName(column.name);
              setRenaming(false);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
              else if (e.key === "Escape") {
                setDraftName(column.name);
                setRenaming(false);
              }
            }}
            className="flex-1 h-6 px-1 -mx-1 text-[14px] text-[#2D333A] bg-white border border-[#5CE1A5] rounded outline-none"
            style={{ fontFamily: "var(--font-poppins)", fontWeight: 600 }}
          />
        ) : (
          <h3
            {...(isOverlay || !canEdit ? {} : attributes)}
            {...(isOverlay || !canEdit ? {} : listeners)}
            className="flex-1 text-[14px] text-[#2D333A] truncate cursor-grab active:cursor-grabbing select-none"
            style={{ fontFamily: "var(--font-poppins)", fontWeight: 600 }}
            title={canEdit ? "Drag to reorder column" : column.name}
          >
            {column.name}
          </h3>
        )}
        <span
          className="text-[11px] text-[#9CA3AF] tabular-nums shrink-0"
          style={{ fontFamily: "var(--font-poppins)", fontWeight: 600 }}
        >
          {column.cards.length}
        </span>
        {canEdit && !isOverlay && (
          <div ref={menuRef} className="relative">
            <button
              type="button"
              onClick={() => {
                setMenuOpen((v) => !v);
                setColorPickerOpen(false);
              }}
              className="size-6 rounded-md flex items-center justify-center text-[#9CA3AF] hover:text-[#2D333A] hover:bg-[#F3F4F6] transition-colors"
              aria-label="Column actions"
            >
              <MoreHorizontal className="size-3.5" />
            </button>
            <AnimatePresence>
              {menuOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -4, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -4, scale: 0.96 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-0 top-full mt-1 z-30 w-44 bg-white rounded-xl border border-[#E5E7EB] py-1.5 shadow-xl"
                  style={{ boxShadow: "0 8px 30px rgba(0,0,0,0.12)" }}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      setRenaming(true);
                      setDraftName(column.name);
                    }}
                    className="w-full text-left flex items-center gap-2 px-3 py-1.5 text-[13px] text-[#2D333A] hover:bg-[#F4F5F7]"
                    style={{ fontFamily: "var(--font-source-sans)" }}
                  >
                    <Pencil className="size-3.5 text-[#9CA3AF]" />
                    Rename
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      setColorPickerOpen(true);
                    }}
                    className="w-full text-left flex items-center gap-2 px-3 py-1.5 text-[13px] text-[#2D333A] hover:bg-[#F4F5F7]"
                    style={{ fontFamily: "var(--font-source-sans)" }}
                  >
                    <Palette className="size-3.5 text-[#9CA3AF]" />
                    Change color
                  </button>
                  <div className="h-px bg-[#F3F4F6] mx-2 my-1" />
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      onDelete(column.id);
                    }}
                    className="w-full text-left flex items-center gap-2 px-3 py-1.5 text-[13px] text-[#DC2626] hover:bg-[#FEF2F2]"
                    style={{ fontFamily: "var(--font-source-sans)" }}
                  >
                    <Trash2 className="size-3.5" />
                    Delete column
                  </button>
                </motion.div>
              )}
              {colorPickerOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -4, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -4, scale: 0.96 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-0 top-full mt-1 z-30 w-44 bg-white rounded-xl border border-[#E5E7EB] p-2 shadow-xl"
                  style={{ boxShadow: "0 8px 30px rgba(0,0,0,0.12)" }}
                >
                  <p
                    className="text-[10px] text-[#9CA3AF] uppercase tracking-[0.06em] mb-1.5 px-1"
                    style={{ fontFamily: "var(--font-poppins)", fontWeight: 600 }}
                  >
                    Column color
                  </p>
                  <div className="grid grid-cols-6 gap-1">
                    {COLUMN_PRESET_COLORS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => {
                          setColorPickerOpen(false);
                          if (c !== column.color) onChangeColor(column.id, c);
                        }}
                        className="size-5 rounded-md transition-transform hover:scale-110"
                        style={{
                          backgroundColor: c,
                          boxShadow:
                            c === column.color
                              ? "0 0 0 2px white, 0 0 0 3px #2D333A"
                              : undefined,
                        }}
                        aria-label={`Set color ${c}`}
                      />
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
        <span className="border-t-0" style={{ borderColor: "#E5E7EB" }} />
      </div>

      {/* Body — droppable area */}
      <div
        ref={setDropRef}
        className="px-3 pb-3 flex-1 transition-colors rounded-b-xl"
        style={{
          backgroundColor: isOver ? "rgba(92, 225, 165, 0.06)" : "transparent",
          minHeight: 40,
        }}
      >
        <SortableContext items={cardIds} strategy={verticalListSortingStrategy}>
          <div className="flex flex-col gap-2">
            <AnimatePresence initial={false}>
              {column.cards.map((card) => (
                <motion.div
                  key={card.id}
                  layout
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -10, transition: { duration: 0.18 } }}
                  transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
                >
                  <KanbanCard card={card} />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </SortableContext>

        {column.cards.length === 0 && (
          <p
            className="text-[12px] text-[#9CA3AF] px-1 py-2"
            style={{ fontFamily: "var(--font-source-sans)" }}
          >
            No cards yet
          </p>
        )}

        {canEdit && (
          <button
            type="button"
            onClick={() => onAddCard(column.id)}
            className="mt-2 w-full flex items-center justify-center gap-1.5 h-8 rounded-lg border border-dashed border-[#D1D5DB] text-[12px] text-[#6B7280] hover:border-[#5CE1A5] hover:text-[#5CE1A5] hover:bg-white transition-colors"
            style={{ fontFamily: "var(--font-poppins)", fontWeight: 600 }}
          >
            <Plus className="size-3.5" />
            Add card
          </button>
        )}
      </div>
    </div>
  );
}

// ─── SSR-safe static column ─────────────────────────────────
//
// Mirrors KanbanColumn's visual but doesn't subscribe to dnd-kit hooks, so
// the server render and the client first-paint produce identical HTML.
// BoardView swaps in the live KanbanColumn after the client mounts.
export function StaticKanbanColumn({
  column,
  canEdit,
}: {
  column: BoardColumnWithCards;
  canEdit: boolean;
}) {
  return (
    <div
      className="shrink-0 w-[280px] rounded-xl border bg-[#FAFBFC] flex flex-col"
      data-column-id={column.id}
    >
      <div className="flex items-center gap-2 px-3 pt-3 pb-2">
        <span
          className="size-2 rounded-full shrink-0"
          style={{ backgroundColor: column.color }}
          aria-hidden
        />
        <h3
          className="flex-1 text-[14px] text-[#2D333A] truncate select-none"
          style={{ fontFamily: "var(--font-poppins)", fontWeight: 600 }}
        >
          {column.name}
        </h3>
        <span
          className="text-[11px] text-[#9CA3AF] tabular-nums shrink-0"
          style={{ fontFamily: "var(--font-poppins)", fontWeight: 600 }}
        >
          {column.cards.length}
        </span>
      </div>
      <div className="px-3 pb-3 flex-1 rounded-b-xl" style={{ minHeight: 40 }}>
        <div className="flex flex-col gap-2">
          {column.cards.map((card) => (
            <StaticKanbanCard key={card.id} card={card} />
          ))}
        </div>
        {column.cards.length === 0 && (
          <p
            className="text-[12px] text-[#9CA3AF] px-1 py-2"
            style={{ fontFamily: "var(--font-source-sans)" }}
          >
            No cards yet
          </p>
        )}
        {canEdit && (
          <div
            className="mt-2 w-full flex items-center justify-center gap-1.5 h-8 rounded-lg border border-dashed border-[#D1D5DB] text-[12px] text-[#6B7280]"
            style={{ fontFamily: "var(--font-poppins)", fontWeight: 600 }}
            aria-hidden
          >
            <Plus className="size-3.5" />
            Add card
          </div>
        )}
      </div>
    </div>
  );
}
