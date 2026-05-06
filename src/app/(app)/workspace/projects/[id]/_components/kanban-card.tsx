"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Calendar,
  MessageSquare,
  CheckSquare,
  Paperclip,
  Image as ImageIcon,
  Folder,
  Pencil,
  CheckCircle2,
  Circle,
} from "lucide-react";
import type { BoardCardWithMeta } from "@/app/actions/boards";

interface KanbanCardProps {
  card: BoardCardWithMeta;
  /** When true, disables drag styling (used for DragOverlay rendering). */
  isOverlay?: boolean;
  /** Visual selected state (Phase 3 detail panel hook-up). */
  isSelected?: boolean;
  /** Callback for when the edit button is clicked. */
  onEdit?: (cardId: string) => void;
  /** Callback for when the complete button is clicked. */
  onToggleComplete?: (cardId: string, isCompleted: boolean) => void;
}

function initialsOf(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((n) => n[0])
      .join("")
      .toUpperCase() || "?"
  );
}

// ─── Priority derivation ────────────────────────────────────
type Priority = "high" | "med" | "low" | "completed";

function priorityFor(card: BoardCardWithMeta): Priority {
  if (card.is_completed) return "completed";
  if (!card.due_date) return "low";
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const due = new Date(card.due_date);
  const dueDay = new Date(due.getFullYear(), due.getMonth(), due.getDate());
  const diff = Math.round(
    (dueDay.getTime() - today.getTime()) / (24 * 60 * 60 * 1000),
  );
  if (diff < 0) return "high";
  if (diff <= 1) return "med";
  return "low";
}

const PRIORITY_STYLES: Record<
  Priority,
  { bg: string; fg: string; label: string }
> = {
  high: { bg: "#FEE2E2", fg: "#DC2626", label: "HIGH" },
  med: { bg: "#FEF3C7", fg: "#D97706", label: "MED" },
  low: { bg: "#D1FAE5", fg: "#059669", label: "LOW" },
  completed: { bg: "#F3F4F6", fg: "#6B7280", label: "COMPLETED" },
};

function formatShortDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// ─── @mention / #hashtag inline pills ───────────────────────
function renderInline(text: string): React.ReactNode[] {
  // Tokens: @word or #word (alphanumerics, dashes, underscores).
  const re = /(@[\w-]+|#[\w-]+)/g;
  const out: React.ReactNode[] = [];
  let last = 0;
  let key = 0;
  for (const match of text.matchAll(re)) {
    const idx = match.index ?? 0;
    if (idx > last) out.push(text.slice(last, idx));
    const token = match[0];
    if (token.startsWith("@")) {
      const name = token.slice(1);
      out.push(<MentionPill key={`m-${key++}`} name={name} />);
    } else {
      const tag = token.slice(1);
      out.push(<HashtagPill key={`h-${key++}`} tag={tag} />);
    }
    last = idx + token.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

function MentionPill({ name }: { name: string }) {
  return (
    <span
      className="inline-flex items-center gap-1 px-1.5 h-5 rounded-full align-middle"
      style={{
        fontFamily: "var(--font-poppins)",
        fontWeight: 600,
        fontSize: 11,
        backgroundColor: "#D1FAE5",
        color: "#059669",
      }}
    >
      <span
        className="size-3.5 rounded-full bg-[#059669] text-white flex items-center justify-center text-[7px] leading-none"
        aria-hidden
      >
        {initialsOf(name).slice(0, 2)}
      </span>
      @{name}
    </span>
  );
}

function HashtagPill({ tag }: { tag: string }) {
  return (
    <span
      className="inline-flex items-center gap-1 px-1.5 h-5 rounded-full align-middle"
      style={{
        fontFamily: "var(--font-poppins)",
        fontWeight: 600,
        fontSize: 11,
        backgroundColor: "#EDE9FE",
        color: "#7C3AED",
      }}
    >
      <Folder className="size-2.5" />#{tag}
    </span>
  );
}

// ─── Visual body — shared by DnD card AND the SSR-safe static card ──
function CardBody({
  card,
  isSelected,
  onEdit,
  onToggleComplete,
}: {
  card: BoardCardWithMeta;
  isSelected: boolean;
  onEdit?: (cardId: string) => void;
  onToggleComplete?: (cardId: string, isCompleted: boolean) => void;
}) {
  const priority = priorityFor(card);
  const pStyle = PRIORITY_STYLES[priority];
  const hasFooter =
    card.comment_count > 0 || card.checklist_total > 0 || !!card.cover_color;

  return (
    <>
      {card.cover_color && (
        <div
          className="h-1 w-full"
          style={{ backgroundColor: card.cover_color }}
        />
      )}
      <div className="p-4">
        {/* Top row: priority badge + date pill + assignee avatars */}
        <div className="flex items-center gap-2 mb-2">
          <span
            className="inline-flex items-center px-2 h-5 rounded-md tracking-[0.08em] uppercase"
            style={{
              fontFamily: "var(--font-poppins)",
              fontWeight: 700,
              fontSize: 10,
              backgroundColor: pStyle.bg,
              color: pStyle.fg,
            }}
          >
            {pStyle.label}
          </span>
          {card.due_date && (
            <span
              className="inline-flex items-center gap-1 px-2 h-5 rounded-md bg-[#F3F4F6] text-[#475569]"
              style={{
                fontFamily: "var(--font-poppins)",
                fontWeight: 600,
                fontSize: 11,
              }}
            >
              <Calendar className="size-3" />
              {formatShortDate(card.due_date)}
            </span>
          )}
          <div className="ml-auto flex items-center gap-1.5">
            <div className="flex items-center -space-x-1">
              {card.assignee && (
                <span
                  className="size-6 rounded-full ring-2 ring-white text-white flex items-center justify-center shrink-0"
                  style={{
                    fontFamily: "var(--font-poppins)",
                    fontWeight: 600,
                    fontSize: 10,
                    backgroundColor: card.assignee.avatar_color,
                  }}
                  title={card.assignee.full_name}
                >
                  {initialsOf(card.assignee.full_name)}
                </span>
              )}
            </div>
            {onEdit && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit(card.id);
                }}
                className="size-6 rounded-md flex items-center justify-center text-[#9CA3AF] hover:text-[#2D333A] hover:bg-[#F3F4F6] transition-colors"
                aria-label="Edit card"
              >
                <Pencil className="size-3" />
              </button>
            )}
          </div>
        </div>

        {/* Title and Completion Button */}
        <div className="flex items-start gap-2">
          {onToggleComplete && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggleComplete(card.id, !card.is_completed);
              }}
              className="mt-[3px] shrink-0 text-[#9CA3AF] hover:text-[#5CE1A5] transition-colors"
              aria-label={card.is_completed ? "Mark as incomplete" : "Mark as complete"}
            >
              {card.is_completed ? (
                <CheckCircle2 className="size-4 text-[#5CE1A5]" />
              ) : (
                <Circle className="size-4" />
              )}
            </button>
          )}
          <p
            className="text-[15px] leading-snug break-words line-clamp-2"
            style={{
              fontFamily: "var(--font-poppins)",
              fontWeight: 700,
              color: isSelected ? "#059669" : "#0F172A",
              textDecoration: card.is_completed ? "line-through" : "none",
              opacity: card.is_completed ? 0.6 : 1,
            }}
          >
            {card.title}
          </p>
        </div>

        {/* Description (with @mention / #hashtag pills) */}
        {card.description && (
          <p
            className="mt-1.5 text-[13px] text-[#6B7280] leading-relaxed line-clamp-3"
            style={{ fontFamily: "var(--font-source-sans)" }}
          >
            {renderInline(card.description)}
          </p>
        )}

        {/* Footer metadata */}
        {hasFooter && (
          <div className="flex items-center gap-3 mt-3 pt-3 border-t border-[#F3F4F6]">
            {card.comment_count > 0 && (
              <FooterStat
                icon={<MessageSquare className="size-3.5" />}
                value={card.comment_count}
              />
            )}
            {card.cover_color && (
              <FooterStat
                icon={<ImageIcon className="size-3.5" />}
                value={1}
              />
            )}
            <FooterStat
              icon={<Paperclip className="size-3.5" />}
              value={0}
              hideZero
            />
            {card.checklist_total > 0 && (
              <FooterStat
                icon={<CheckSquare className="size-3.5" />}
                value={`${card.checklist_completed}/${card.checklist_total}`}
              />
            )}
          </div>
        )}
      </div>
    </>
  );
}

function FooterStat({
  icon,
  value,
  hideZero = false,
}: {
  icon: React.ReactNode;
  value: number | string;
  hideZero?: boolean;
}) {
  if (hideZero && value === 0) return null;
  return (
    <span
      className="inline-flex items-center gap-1 text-[12px] text-[#9CA3AF]"
      style={{ fontFamily: "var(--font-source-sans)" }}
    >
      {icon}
      {value}
    </span>
  );
}

// ─── DnD-enabled (post-mount) ─────────────────────────────
export function KanbanCard({
  card,
  isOverlay = false,
  isSelected = false,
  onEdit,
  onToggleComplete,
}: KanbanCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: card.id,
    data: { type: "card", columnId: card.column_id, card },
    disabled: isOverlay,
  });

  const style: React.CSSProperties = isOverlay
    ? { boxShadow: "0 18px 40px rgba(15, 23, 42, 0.18)", transform: "rotate(1deg)" }
    : {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
      };

  return (
    <div
      ref={isOverlay ? undefined : setNodeRef}
      {...(isOverlay ? {} : attributes)}
      {...(isOverlay ? {} : listeners)}
      style={style}
      className={`group relative bg-white rounded-xl overflow-hidden ${
        isSelected
          ? "border-2 border-[#5CE1A5] bg-[#F0FDF4]"
          : "border border-[#E5E7EB]"
      } ${
        isOverlay
          ? "shadow-md"
          : `shadow-sm hover:shadow-md hover:border-[#5CE1A5]/50 cursor-grab active:cursor-grabbing transition-[border-color,box-shadow] duration-200`
      }`}
    >
      <CardBody card={card} isSelected={isSelected} onEdit={onEdit} onToggleComplete={onToggleComplete} />
    </div>
  );
}

// ─── Static (SSR + pre-mount) ─────────────────────────────
export function StaticKanbanCard({ card, onEdit, onToggleComplete }: { card: BoardCardWithMeta, onEdit?: (cardId: string) => void, onToggleComplete?: (cardId: string, isCompleted: boolean) => void }) {
  return (
    <div className="relative bg-white rounded-xl border border-[#E5E7EB] overflow-hidden shadow-sm">
      <CardBody card={card} isSelected={false} onEdit={onEdit} onToggleComplete={onToggleComplete} />
    </div>
  );
}
