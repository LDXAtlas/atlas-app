"use client";

import { useEffect, useRef, useState } from "react";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { useDroppable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { Plus, MoreHorizontal, Pencil, Trash2, Palette, GripVertical } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import type { BoardColumnWithCards } from "@/app/actions/boards";
import { KanbanCard, StaticKanbanCard } from "./kanban-card";

const COLUMN_PRESET_COLORS = ["#9CA3AF", "#3B82F6", "#5CE1A5", "#F59E0B", "#F97316", "#EF4444", "#8B5CF6", "#EC4899", "#10B981", "#06B6D4", "#FBBF24", "#6366F1"];

interface KanbanColumnProps {
  column: BoardColumnWithCards;
  canEdit: boolean;
  onAddCard: (columnId: string) => void;
  onRename: (columnId: string, name: string) => void;
  onChangeColor: (columnId: string, color: string) => void;
  onDelete: (columnId: string) => void;
  onEditCard?: (cardId: string) => void;
  onToggleComplete?: (cardId: string, isCompleted: boolean) => void;
  isOverlay?: boolean;
  viewMode?: "grid" | "list";
}

export function KanbanColumn({
  column, canEdit, onAddCard, onRename, onChangeColor, onDelete, onEditCard, onToggleComplete, isOverlay = false, viewMode = "grid",
}: KanbanColumnProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `column-${column.id}`, data: { type: "column", columnId: column.id }, disabled: isOverlay || !canEdit,
  });

  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: `column-drop-${column.id}`, data: { type: "column-body", columnId: column.id },
  });

  const [renaming, setRenaming] = useState(false);
  const [draftName, setDraftName] = useState(column.name);
  const [menuOpen, setMenuOpen] = useState(false);
  const [colorPickerOpen, setColorPickerOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen && !colorPickerOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) { setMenuOpen(false); setColorPickerOpen(false); }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menuOpen, colorPickerOpen]);

  const style: React.CSSProperties = isOverlay
    ? { boxShadow: "0 18px 40px rgba(15, 23, 42, 0.18)", transform: "rotate(1deg)" }
    : { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 };

  const cardIds = column.cards.map((c) => c.id);

  // ================= LIST VIEW LAYOUT =================
  if (viewMode === "list") {
    return (
      <div ref={isOverlay ? undefined : setNodeRef} style={style} className="w-full flex flex-col mb-8" data-column-id={column.id}>
        <div className="flex items-center gap-3 mb-2 px-2 group/header">
          {canEdit && !isOverlay && (
            <button type="button" {...attributes} {...listeners} className="text-[#94A3B8] hover:text-[#475569] cursor-grab active:cursor-grabbing shrink-0 opacity-0 group-hover/header:opacity-100 transition-opacity">
              <GripVertical className="size-4" />
            </button>
          )}
          <span className="size-2.5 rounded-full shrink-0" style={{ backgroundColor: column.color }} />
          <h3 className="text-[15px] text-[#0F172A]" style={{ fontFamily: "var(--font-poppins)", fontWeight: 700 }}>{column.name}</h3>
          <span className="text-[11px] text-[#94A3B8] bg-[#F1F5F9] px-2 h-5 rounded-full flex items-center justify-center font-semibold tabular-nums">{column.cards.length}</span>
          {canEdit && !isOverlay && (
            <button onClick={() => onAddCard(column.id)} className="ml-2 flex items-center gap-1 text-[12px] text-[#9CA3AF] hover:text-[#5CE1A5] opacity-0 group-hover/header:opacity-100 transition-all font-semibold">
              <Plus className="size-3.5"/> Add task
            </button>
          )}
        </div>
        
        <div ref={setDropRef} className="flex flex-col bg-white border border-[#E5E7EB] rounded-2xl overflow-hidden shadow-sm" style={{ backgroundColor: isOver ? "rgba(92, 225, 165, 0.04)" : "white", minHeight: 40 }}>
          <SortableContext items={cardIds} strategy={verticalListSortingStrategy}>
            <AnimatePresence initial={false}>
              {column.cards.map((card, index) => (
                <motion.div key={card.id} layout initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.98 }} transition={{ layout: { type: "spring", bounce: 0.2, duration: 0.6, delay: index * 0.02 }, opacity: { duration: 0.2 } }}>
                  <KanbanCard card={card} viewMode="list" columnName={column.name} columnColor={column.color} onEdit={onEditCard} onToggleComplete={onToggleComplete} />
                </motion.div>
              ))}
            </AnimatePresence>
          </SortableContext>
          {column.cards.length === 0 && (
            <div className="px-5 py-4 text-[13px] text-[#9CA3AF]" style={{ fontFamily: "var(--font-source-sans)" }}>No tasks in this group.</div>
          )}
        </div>
      </div>
    );
  }

  // ================= GRID VIEW LAYOUT =================
  return (
    <div ref={isOverlay ? undefined : setNodeRef} style={style} className="shrink-0 w-[320px] rounded-2xl border border-[#E5E7EB] bg-[#F8FAFC] flex flex-col transition-all" data-column-id={column.id}>
      <div className="flex items-center gap-2 px-4 pt-4 pb-3 group/header">
        {canEdit && !isOverlay ? (
          <button type="button" {...attributes} {...listeners} className="text-[#94A3B8] hover:text-[#475569] cursor-grab active:cursor-grabbing shrink-0 transition-colors opacity-0 group-hover/header:opacity-100"><GripVertical className="size-4" /></button>
        ) : (<span className="size-4 shrink-0" aria-hidden />)}
        <span className="size-2.5 rounded-full shrink-0" style={{ backgroundColor: column.color }} aria-hidden />
        {renaming ? (
          <input autoFocus value={draftName} onChange={(e) => setDraftName(e.target.value)} onBlur={() => { const trimmed = draftName.trim(); if (trimmed && trimmed !== column.name) onRename(column.id, trimmed); else setDraftName(column.name); setRenaming(false); }} onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); else if (e.key === "Escape") { setDraftName(column.name); setRenaming(false); } }} className="flex-1 h-7 px-1.5 -mx-1 text-[15px] text-[#0F172A] bg-white border border-[#5CE1A5] rounded outline-none" style={{ fontFamily: "var(--font-poppins)", fontWeight: 700 }} />
        ) : (
          <h3 className="flex-1 text-[15px] text-[#0F172A] truncate select-none" style={{ fontFamily: "var(--font-poppins)", fontWeight: 700 }} title={column.name}>{column.name}</h3>
        )}
        <span className="text-[12px] text-[#94A3B8] tabular-nums shrink-0" style={{ fontFamily: "var(--font-poppins)", fontWeight: 600 }}>{column.cards.length}</span>
        {canEdit && !isOverlay && (
          <button type="button" onClick={() => onAddCard(column.id)} className="size-7 rounded-md flex items-center justify-center text-[#475569] hover:text-[#5CE1A5] hover:bg-white transition-colors"><Plus className="size-3.5" /></button>
        )}
        {canEdit && !isOverlay && (
          <div ref={menuRef} className="relative">
            <button type="button" onClick={() => { setMenuOpen((v) => !v); setColorPickerOpen(false); }} className="size-7 rounded-md flex items-center justify-center text-[#475569] hover:text-[#0F172A] hover:bg-white transition-colors"><MoreHorizontal className="size-3.5" /></button>
            <AnimatePresence>
              {menuOpen && (
                <motion.div initial={{ opacity: 0, y: -4, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -4, scale: 0.96 }} transition={{ duration: 0.15 }} className="absolute right-0 top-full mt-1 z-30 w-44 bg-white rounded-xl border border-[#E5E7EB] py-1.5 shadow-xl">
                  <button type="button" onClick={() => { setMenuOpen(false); setRenaming(true); setDraftName(column.name); }} className="w-full text-left flex items-center gap-2 px-3 py-1.5 text-[13px] text-[#2D333A] hover:bg-[#F4F5F7]"><Pencil className="size-3.5 text-[#9CA3AF]" /> Rename</button>
                  <button type="button" onClick={() => { setMenuOpen(false); setColorPickerOpen(true); }} className="w-full text-left flex items-center gap-2 px-3 py-1.5 text-[13px] text-[#2D333A] hover:bg-[#F4F5F7]"><Palette className="size-3.5 text-[#9CA3AF]" /> Change color</button>
                  <div className="h-px bg-[#F3F4F6] mx-2 my-1" />
                  <button type="button" onClick={() => { setMenuOpen(false); onDelete(column.id); }} className="w-full text-left flex items-center gap-2 px-3 py-1.5 text-[13px] text-[#DC2626] hover:bg-[#FEF2F2]"><Trash2 className="size-3.5" /> Delete column</button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>

      <div ref={setDropRef} className="px-4 pb-4 flex-1 transition-colors rounded-b-2xl" style={{ backgroundColor: isOver ? "rgba(92, 225, 165, 0.06)" : "transparent", minHeight: 40 }}>
        <SortableContext items={cardIds} strategy={verticalListSortingStrategy}>
          <div className="flex flex-col gap-3">
            <AnimatePresence initial={false}>
              {column.cards.map((card, index) => (
                <motion.div key={card.id} layout initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }} transition={{ layout: { type: "spring", bounce: 0.2, duration: 0.6, delay: index * 0.025 }, opacity: { duration: 0.2 } }}>
                  <KanbanCard card={card} viewMode="grid" onEdit={onEditCard} onToggleComplete={onToggleComplete} />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </SortableContext>
        {column.cards.length === 0 && <p className="text-[12px] text-[#94A3B8] px-1 py-3 text-center">No cards yet</p>}
        {canEdit && (
          <button type="button" onClick={() => onAddCard(column.id)} className="mt-3 w-full flex items-center justify-center gap-1.5 py-2.5 rounded-lg border border-dashed border-[#CBD5E1] text-[12px] text-[#64748B] hover:border-[#5CE1A5] hover:text-[#5CE1A5] hover:bg-white transition-colors">
            <Plus className="size-3.5" /> Add card
          </button>
        )}
      </div>
    </div>
  );
}

export function StaticKanbanColumn({ column, canEdit, onEditCard, onToggleComplete, viewMode = "grid" }: { column: BoardColumnWithCards; canEdit: boolean; onEditCard?: (cardId: string) => void; onToggleComplete?: (cardId: string, isCompleted: boolean) => void; viewMode?: "grid" | "list"; }) {
  if (viewMode === "list") {
    return (
      <div className="w-full flex flex-col mb-8" data-column-id={column.id}>
        <div className="flex items-center gap-3 mb-2 px-2">
          <span className="size-4" aria-hidden />
          <span className="size-2.5 rounded-full shrink-0" style={{ backgroundColor: column.color }} />
          <h3 className="text-[15px] text-[#0F172A]" style={{ fontFamily: "var(--font-poppins)", fontWeight: 700 }}>{column.name}</h3>
          <span className="text-[11px] text-[#94A3B8] bg-[#F1F5F9] px-2 h-5 rounded-full flex items-center justify-center font-semibold tabular-nums">{column.cards.length}</span>
        </div>
        <div className="flex flex-col bg-white border border-[#E5E7EB] rounded-2xl overflow-hidden shadow-sm" style={{ minHeight: 40 }}>
          {column.cards.map((card) => <StaticKanbanCard key={card.id} card={card} viewMode="list" columnName={column.name} columnColor={column.color} onEdit={onEditCard} onToggleComplete={onToggleComplete} />)}
          {column.cards.length === 0 && <div className="px-5 py-4 text-[13px] text-[#9CA3AF]">No tasks in this group.</div>}
        </div>
      </div>
    );
  }
  return (
    <div className="shrink-0 w-[320px] rounded-2xl border border-[#E5E7EB] bg-[#F8FAFC] flex flex-col" data-column-id={column.id}>
      <div className="flex items-center gap-2 px-4 pt-4 pb-3">
        <span className="size-4 shrink-0" aria-hidden />
        <span className="size-2.5 rounded-full shrink-0" style={{ backgroundColor: column.color }} aria-hidden />
        <h3 className="flex-1 text-[15px] text-[#0F172A] truncate select-none" style={{ fontFamily: "var(--font-poppins)", fontWeight: 700 }}>{column.name}</h3>
        <span className="text-[12px] text-[#94A3B8] tabular-nums shrink-0" style={{ fontFamily: "var(--font-poppins)", fontWeight: 600 }}>{column.cards.length}</span>
      </div>
      <div className="px-4 pb-4 flex-1 rounded-b-2xl" style={{ minHeight: 40 }}>
        <div className="flex flex-col gap-3">
          {column.cards.map((card) => <StaticKanbanCard key={card.id} card={card} viewMode="grid" onEdit={onEditCard} onToggleComplete={onToggleComplete} />)}
        </div>
        {column.cards.length === 0 && <p className="text-[12px] text-[#94A3B8] px-1 py-3 text-center">No cards yet</p>}
      </div>
    </div>
  );
}