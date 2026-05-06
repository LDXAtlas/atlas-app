"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Calendar, MessageSquare, CheckSquare, Paperclip, Image as ImageIcon,
  Folder, Pencil, CheckCircle2, Circle, GripVertical, ChevronDown, Check, MoreHorizontal
} from "lucide-react";
import type { BoardCardWithMeta } from "@/app/actions/boards";

interface KanbanCardProps {
  card: BoardCardWithMeta;
  isOverlay?: boolean;
  isSelected?: boolean;
  viewMode?: "grid" | "list";
  columnName?: string;
  columnColor?: string;
  onEdit?: (cardId: string) => void;
  onToggleComplete?: (cardId: string, isCompleted: boolean) => void;
}

function initialsOf(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((n) => n[0]).join("").toUpperCase() || "?";
}

type Priority = "high" | "med" | "low" | "completed";

function priorityFor(card: BoardCardWithMeta): Priority {
  if (card.is_completed) return "completed";
  if (!card.due_date) return "low";
  const now = new Date();
  const diff = Math.round((new Date(card.due_date).getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
  if (diff < 0) return "high";
  if (diff <= 1) return "med";
  return "low";
}

const PRIORITY_STYLES: Record<Priority, { bg: string; fg: string; label: string }> = {
  high: { bg: "#FEE2E2", fg: "#DC2626", label: "HIGH" },
  med: { bg: "#FEF3C7", fg: "#D97706", label: "MED" },
  low: { bg: "#F1F5F9", fg: "#475569", label: "LOW" },
  completed: { bg: "#F3F4F6", fg: "#9CA3AF", label: "DONE" },
};

function formatShortDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function renderInline(text: string): React.ReactNode[] {
  const re = /(@[\w-]+|#[\w-]+)/g;
  const out: React.ReactNode[] = [];
  let last = 0; let key = 0;
  for (const match of text.matchAll(re)) {
    const idx = match.index ?? 0;
    if (idx > last) out.push(text.slice(last, idx));
    const token = match[0];
    if (token.startsWith("@")) out.push(<MentionPill key={`m-${key++}`} name={token.slice(1)} />);
    else out.push(<HashtagPill key={`h-${key++}`} tag={token.slice(1)} />);
    last = idx + token.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

function MentionPill({ name }: { name: string }) {
  return (
    <span className="inline-flex items-center gap-1 px-1.5 h-5 rounded-full align-middle mx-1 bg-[#D1FAE5] text-[#059669]" style={{ fontFamily: "var(--font-poppins)", fontWeight: 600, fontSize: 11 }}>
      <span className="size-3.5 rounded-full bg-[#059669] text-white flex items-center justify-center text-[7px] leading-none" aria-hidden>{initialsOf(name).slice(0, 2)}</span>
      @{name}
    </span>
  );
}

function HashtagPill({ tag }: { tag: string }) {
  return <span className="inline-flex items-center gap-1 px-1.5 h-5 rounded-full align-middle mx-1 bg-[#EDE9FE] text-[#7C3AED]" style={{ fontFamily: "var(--font-poppins)", fontWeight: 600, fontSize: 11 }}><Folder className="size-2.5" />#{tag}</span>;
}

// ─── Shared Card Body (Grid View) ────────────────────────────────────
function GridCardBody({ card, isSelected, onEdit, onToggleComplete }: any) {
  const priority = priorityFor(card);
  const pStyle = PRIORITY_STYLES[priority];
  const hasFooter = card.comment_count > 0 || card.checklist_total > 0 || !!card.cover_color;

  return (
    <>
      {card.cover_color && <div className="h-1 w-full" style={{ backgroundColor: card.cover_color }} />}
      <div className="p-4">
        <div className="flex items-center gap-2 mb-2">
          <span className="inline-flex items-center px-2 h-5 rounded-md tracking-[0.08em] uppercase" style={{ fontFamily: "var(--font-poppins)", fontWeight: 700, fontSize: 10, backgroundColor: pStyle.bg, color: pStyle.fg }}>{pStyle.label}</span>
          {card.due_date && (
            <span className="inline-flex items-center gap-1 px-2 h-5 rounded-md bg-[#F3F4F6] text-[#475569]" style={{ fontFamily: "var(--font-poppins)", fontWeight: 600, fontSize: 11 }}>
              <Calendar className="size-3" />{formatShortDate(card.due_date)}
            </span>
          )}
          <div className="ml-auto flex items-center gap-1.5">
            <div className="flex items-center -space-x-1">
              {card.assignee && (
                <span className="size-6 rounded-full ring-2 ring-white text-white flex items-center justify-center shrink-0" style={{ fontFamily: "var(--font-poppins)", fontWeight: 600, fontSize: 10, backgroundColor: card.assignee.avatar_color }} title={card.assignee.full_name}>{initialsOf(card.assignee.full_name)}</span>
              )}
            </div>
            {onEdit && <button type="button" onClick={(e) => { e.stopPropagation(); onEdit(card.id); }} className="size-6 rounded-md flex items-center justify-center text-[#9CA3AF] hover:text-[#2D333A] hover:bg-[#F3F4F6] transition-colors"><Pencil className="size-3" /></button>}
          </div>
        </div>
        <div className="flex items-start gap-2">
          {onToggleComplete && (
            <button type="button" onClick={(e) => { e.stopPropagation(); onToggleComplete(card.id, !card.is_completed); }} className="mt-[3px] shrink-0 text-[#9CA3AF] hover:text-[#5CE1A5] transition-colors">
              {card.is_completed ? <CheckCircle2 className="size-4 text-[#5CE1A5]" /> : <Circle className="size-4" />}
            </button>
          )}
          <p className="text-[15px] leading-snug break-words line-clamp-2" style={{ fontFamily: "var(--font-poppins)", fontWeight: 700, color: isSelected ? "#059669" : "#0F172A", textDecoration: card.is_completed ? "line-through" : "none", opacity: card.is_completed ? 0.6 : 1 }}>{card.title}</p>
        </div>
        {card.description && <p className="mt-1.5 text-[13px] text-[#6B7280] leading-relaxed line-clamp-3" style={{ fontFamily: "var(--font-source-sans)" }}>{renderInline(card.description)}</p>}
        {hasFooter && (
          <div className="flex items-center gap-3 mt-3 pt-3 border-t border-[#F3F4F6]">
            {card.comment_count > 0 && <span className="inline-flex items-center gap-1 text-[12px] text-[#9CA3AF]"><MessageSquare className="size-3.5" />{card.comment_count}</span>}
            {card.checklist_total > 0 && <span className="inline-flex items-center gap-1 text-[12px] text-[#9CA3AF]"><CheckSquare className="size-3.5" />{`${card.checklist_completed}/${card.checklist_total}`}</span>}
          </div>
        )}
      </div>
    </>
  );
}

// ─── DnD Wrapper ─────────────────────────────────────────────
export function KanbanCard({ card, isOverlay = false, isSelected = false, viewMode = "grid", columnName, columnColor, onEdit, onToggleComplete }: KanbanCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: card.id, data: { type: "card", columnId: card.column_id, card }, disabled: isOverlay,
  });

  const style: React.CSSProperties = isOverlay
    ? { boxShadow: "0 18px 40px rgba(15, 23, 42, 0.18)", transform: "rotate(1deg)" }
    : { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 };

  const priority = priorityFor(card);
  const pStyle = PRIORITY_STYLES[priority];

  if (viewMode === "list") {
    return (
      <div ref={isOverlay ? undefined : setNodeRef} style={style} className={`group flex flex-col lg:flex-row lg:items-center px-4 py-3.5 border-b border-[#F3F4F6] last:border-0 bg-white transition-colors hover:bg-[#F8FAFC] ${isOverlay ? "shadow-xl border-y rounded-xl scale-[1.02] z-50" : ""}`}>
        {/* Left: Drag + Checkbox */}
        <div className="w-12 flex items-center gap-3 shrink-0">
          <button type="button" {...attributes} {...listeners} className="text-[#CBD5E1] hover:text-[#94A3B8] cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity">
            <GripVertical className="size-4" />
          </button>
          <button onClick={() => onToggleComplete?.(card.id, !card.is_completed)} className="text-[#CBD5E1] hover:text-[#5CE1A5] transition-colors shrink-0">
            {card.is_completed ? <div className="size-4 rounded-[4px] bg-[#5CE1A5] flex items-center justify-center"><Check className="size-3 text-white" strokeWidth={3}/></div> : <div className="size-4 rounded-[4px] border border-[#CBD5E1]" />}
          </button>
        </div>
        
        {/* Priority */}
        <div className="w-[100px] shrink-0 mt-2 lg:mt-0 ml-12 lg:ml-0">
          <span className="inline-flex items-center px-2 h-5 rounded-full tracking-[0.08em] uppercase" style={{ fontFamily: "var(--font-poppins)", fontWeight: 700, fontSize: 10, backgroundColor: pStyle.bg, color: pStyle.fg }}>{pStyle.label}</span>
        </div>
        
        {/* Task Info */}
        <div className="flex-1 min-w-0 pr-6 mt-1 lg:mt-0 ml-12 lg:ml-0 cursor-pointer" onClick={() => onEdit?.(card.id)}>
          <p className="text-[14px] leading-tight text-[#0F172A] truncate" style={{ fontFamily: "var(--font-poppins)", fontWeight: 600, textDecoration: card.is_completed ? "line-through" : "none", opacity: card.is_completed ? 0.6 : 1 }}>{card.title}</p>
          {card.description && <p className="text-[13px] text-[#6B7280] truncate mt-0.5" style={{ fontFamily: "var(--font-source-sans)" }}>{renderInline(card.description)}</p>}
        </div>
        
        {/* Mobile Spacer */}
        <div className="flex items-center gap-4 mt-3 lg:mt-0 ml-12 lg:ml-0">
          {/* Status Badge */}
          <div className="w-[140px] shrink-0 hidden lg:block">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[12px] bg-[#F1F5F9] text-[#475569]" style={{ fontFamily: "var(--font-poppins)", fontWeight: 600 }}>
              <span className="size-1.5 rounded-full" style={{ backgroundColor: columnColor || "#CBD5E1" }}/>
              {columnName || "Unknown"} <ChevronDown className="size-3 text-[#9CA3AF] ml-1"/>
            </span>
          </div>

          {/* Assignees */}
          <div className="w-[120px] shrink-0">
            {card.assignee && (
              <div className="flex items-center gap-2">
                <span className="size-6 rounded-full text-white flex items-center justify-center shrink-0" style={{ fontFamily: "var(--font-poppins)", fontWeight: 600, fontSize: 10, backgroundColor: card.assignee.avatar_color }} title={card.assignee.full_name}>{initialsOf(card.assignee.full_name)}</span>
              </div>
            )}
          </div>

          {/* Due Date */}
          <div className="w-[100px] shrink-0">
            {card.due_date ? (
              <span className="inline-flex items-center gap-1.5 text-[12px] text-[#475569]" style={{ fontFamily: "var(--font-source-sans)", fontWeight: 600 }}>
                <Calendar className="size-3.5 text-[#9CA3AF]" /> {formatShortDate(card.due_date)}
              </span>
            ) : <span className="text-[#CBD5E1]">-</span>}
          </div>

          {/* Activity Icons */}
          <div className="w-[100px] shrink-0 flex items-center gap-3">
            {card.comment_count > 0 && <span className="flex items-center gap-1 text-[12px] text-[#9CA3AF]"><MessageSquare className="size-3.5" /> {card.comment_count}</span>}
            {card.checklist_total > 0 && <span className="flex items-center gap-1 text-[12px] text-[#9CA3AF]"><Paperclip className="size-3.5" /> 1</span>}
            <button type="button" onClick={() => onEdit?.(card.id)} className="ml-auto text-[#CBD5E1] hover:text-[#0F172A] opacity-0 group-hover:opacity-100 transition-all"><MoreHorizontal className="size-4"/></button>
          </div>
        </div>
      </div>
    );
  }

  // Grid View Return
  return (
    <div ref={isOverlay ? undefined : setNodeRef} {...(isOverlay ? {} : attributes)} {...(isOverlay ? {} : listeners)} style={style} className={`group relative bg-white rounded-xl overflow-hidden ${isSelected ? "border-2 border-[#5CE1A5] bg-[#F0FDF4]" : "border border-[#E5E7EB]"} ${isOverlay ? "shadow-md" : "shadow-sm hover:shadow-md hover:border-[#5CE1A5]/50 cursor-grab active:cursor-grabbing transition-[border-color,box-shadow] duration-200"}`}>
      <GridCardBody card={card} isSelected={isSelected} onEdit={onEdit} onToggleComplete={onToggleComplete} />
    </div>
  );
}

// ─── Static Wrapper ──────────────────────────────────────────
export function StaticKanbanCard({ card, viewMode = "grid", columnName, columnColor, onEdit, onToggleComplete }: any) {
  if (viewMode === "list") {
    // Exact same UI as the Drag version but without the drag hooks
    return (
      <div className="group flex flex-col lg:flex-row lg:items-center px-4 py-3.5 border-b border-[#F3F4F6] last:border-0 bg-white">
        <div className="w-12 flex items-center gap-3 shrink-0">
          <div className="size-4" /> {/* Spacer for drag handle */}
          <div className="size-4 rounded-[4px] border border-[#CBD5E1]" />
        </div>
        <div className="w-[100px] shrink-0 mt-2 lg:mt-0 ml-12 lg:ml-0">
          <span className="inline-flex items-center px-2 h-5 rounded-full tracking-[0.08em] uppercase" style={{ fontFamily: "var(--font-poppins)", fontWeight: 700, fontSize: 10, backgroundColor: PRIORITY_STYLES[priorityFor(card)].bg, color: PRIORITY_STYLES[priorityFor(card)].fg }}>{PRIORITY_STYLES[priorityFor(card)].label}</span>
        </div>
        <div className="flex-1 min-w-0 pr-6 mt-1 lg:mt-0 ml-12 lg:ml-0">
          <p className="text-[14px] leading-tight text-[#0F172A] truncate" style={{ fontFamily: "var(--font-poppins)", fontWeight: 600 }}>{card.title}</p>
        </div>
        <div className="flex items-center gap-4 mt-3 lg:mt-0 ml-12 lg:ml-0">
          <div className="w-[140px] shrink-0 hidden lg:block"><span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[12px] bg-[#F1F5F9] text-[#475569]"><span className="size-1.5 rounded-full" style={{ backgroundColor: columnColor || "#CBD5E1" }}/>{columnName || "Unknown"}</span></div>
          <div className="w-[120px] shrink-0" />
          <div className="w-[100px] shrink-0" />
          <div className="w-[100px] shrink-0" />
        </div>
      </div>
    );
  }
  return (
    <div className="relative bg-white rounded-xl border border-[#E5E7EB] overflow-hidden shadow-sm">
      <GridCardBody card={card} isSelected={false} onEdit={onEdit} onToggleComplete={onToggleComplete} />
    </div>
  );
}