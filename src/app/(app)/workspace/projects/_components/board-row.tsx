"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  Star,
  Lock,
  EyeOff,
  Building,
  MessageSquare,
  Calendar,
  Megaphone,
  Clock,
} from "lucide-react";
import type { BoardSummary } from "@/app/actions/boards";
import { getIconByName } from "@/lib/icons";

interface BoardCardProps {
  board: BoardSummary;
  onToggleStar?: () => void;
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

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// ─── Board card (new design) ────────────────────────────────
export function BoardCard({ board, onToggleStar }: BoardCardProps) {
  const router = useRouter();
  const Icon = getIconByName(board.icon);
  const href = `/workspace/projects/${board.id}`;

  
  const starred = board.is_starred;

  const total = board.card_count;
  const done = board.completed_count;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  // Visibility hint icon — only show for non-organization boards.
  const visibilityHint = visibilityFor(board);

  return (
    <div
      role="link"
      tabIndex={0}
      onClick={() => router.push(href)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          router.push(href);
        }
      }}
      className="group bg-white rounded-2xl border border-[#E5E7EB] p-6 hover:border-[#5CE1A5]/60 hover:shadow-[0_4px_18px_rgba(15,23,42,0.06)] transition-[border-color,box-shadow] duration-200 cursor-pointer"
    >
      {/* Top row: icon + title + star */}
      <div className="flex items-start gap-4 mb-3">
        <div
          className="size-14 rounded-2xl flex items-center justify-center text-white shrink-0 shadow-sm"
          style={{ backgroundColor: board.color }}
        >
          <Icon className="size-7" strokeWidth={1.6} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3">
            <h3
              className="text-xl text-[#0F172A] leading-tight truncate"
              style={{ fontFamily: "var(--font-poppins)", fontWeight: 800 }}
            >
              {board.name}
            </h3>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (onToggleStar) onToggleStar();
              }}
              className="size-7 rounded-md flex items-center justify-center text-[#9CA3AF] hover:bg-[#F4F5F7] transition-colors shrink-0"
              aria-label={starred ? "Unstar board" : "Star board"}
              aria-pressed={starred}
            >
              <Star
                className="size-5 transition-colors"
                style={{
                  color: starred ? "#F59E0B" : "#CBD5E1",
                  fill: starred ? "#F59E0B" : "transparent",
                }}
                strokeWidth={1.7}
              />
            </button>
          </div>

          {/* Tag pills */}
          <div className="flex flex-wrap items-center gap-1.5 mt-2">
            {board.department_name && board.department_color && (
              <span
                className="inline-flex items-center px-2 h-5 rounded-full text-[10px] tracking-[0.08em] uppercase"
                style={{
                  fontFamily: "var(--font-poppins)",
                  fontWeight: 700,
                  backgroundColor: `${board.department_color}1F`,
                  color: board.department_color,
                }}
              >
                {board.department_name}
              </span>
            )}
            {visibilityHint && (
              <span
                className="inline-flex items-center gap-1 px-2 h-5 rounded-full text-[10px] tracking-[0.08em] uppercase bg-[#F4F5F7] text-[#6B7280]"
                style={{ fontFamily: "var(--font-poppins)", fontWeight: 700 }}
                title={visibilityHint.label}
              >
                <visibilityHint.Icon className="size-2.5" />
                {visibilityHint.label}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Description */}
      {board.description && (
        <p
          className="text-[14px] text-[#475569] leading-relaxed mt-1 line-clamp-2"
          style={{ fontFamily: "var(--font-source-sans)" }}
        >
          {board.description}
        </p>
      )}

      {/* Metadata pills */}
      <div className="flex items-center gap-2 mt-3 flex-wrap">
        {board.member_count > 0 && (
          <Pill
            icon={<MessageSquare className="size-3" />}
            text={`${board.member_count} ${board.member_count === 1 ? "Member" : "Members"}`}
            tone="purple"
          />
        )}
        <Pill
          icon={<Calendar className="size-3" />}
          text={formatDate(board.created_at)}
          tone="blue"
        />
        {total > 0 && done < total && (
          <Pill
            icon={<Megaphone className="size-3" />}
            text={`${total - done}`}
            tone="amber"
          />
        )}
      </div>

      {/* Progress section */}
      <div className="mt-4">
        <div className="flex items-center justify-between mb-1.5">
          <span
            className="text-[11px] tracking-[0.08em] uppercase text-[#475569]"
            style={{ fontFamily: "var(--font-poppins)", fontWeight: 700 }}
          >
            {done}/{total} {total === 1 ? "task" : "tasks"}
          </span>
          <span
            className="text-xl tabular-nums leading-none"
            style={{
              fontFamily: "var(--font-poppins)",
              fontWeight: 800,
              color: total === 0 ? "#CBD5E1" : board.color,
            }}
          >
            {pct}%
          </span>
        </div>
        <div className="h-1.5 w-full rounded-full bg-[#F1F5F9] overflow-hidden">
          <div
            className="h-full rounded-full transition-[width] duration-500 ease-out"
            style={{
              width: `${pct}%`,
              backgroundColor: total === 0 ? "transparent" : board.color,
            }}
          />
        </div>
      </div>

      {/* Footer: avatars + relative time */}
      <div className="flex items-center justify-between mt-4 pt-3 border-t border-[#F1F5F9]">
        <AvatarStack
          avatars={board.member_avatars}
          extra={Math.max(0, board.member_count - board.member_avatars.length)}
        />
        <span
          className="inline-flex items-center gap-1 text-[12px] text-[#9CA3AF]"
          style={{ fontFamily: "var(--font-source-sans)" }}
        >
          <Clock className="size-3.5" />
          {relativeTime(board.updated_at)}
        </span>
      </div>
    </div>
  );
}

// Backwards-compat alias — older imports referenced `BoardRow`.
export const BoardRow = BoardCard;

// ─── Helpers ────────────────────────────────────────────────
function visibilityFor(board: BoardSummary): {
  Icon: typeof Lock;
  label: string;
} | null {
  if (board.visibility === "private") return { Icon: Lock, label: "Private" };
  if (board.visibility === "invitees_only")
    return { Icon: EyeOff, label: "Invitees" };
  if (board.visibility === "department")
    return { Icon: Building, label: board.department_name || "Department" };
  return null;
}

function Pill({
  icon,
  text,
  tone,
}: {
  icon: React.ReactNode;
  text: string;
  tone: "purple" | "blue" | "amber";
}) {
  const palette = {
    purple: { bg: "#EDE9FE", fg: "#7C3AED" },
    blue: { bg: "#DBEAFE", fg: "#2563EB" },
    amber: { bg: "#FEF3C7", fg: "#D97706" },
  }[tone];
  return (
    <span
      className="inline-flex items-center gap-1.5 h-6 px-2 rounded-full text-[11px]"
      style={{
        fontFamily: "var(--font-poppins)",
        fontWeight: 600,
        backgroundColor: palette.bg,
        color: palette.fg,
      }}
    >
      {icon}
      {text}
    </span>
  );
}

function AvatarStack({
  avatars,
  extra,
}: {
  avatars: BoardSummary["member_avatars"];
  extra: number;
}) {
  if (avatars.length === 0) return <div />;
  const visible = avatars.slice(0, 4);
  return (
    <div className="flex items-center -space-x-2">
      {visible.map((p) => (
        <Link
          key={p.id}
          href={`/directory/profile/${p.id}`}
          onClick={(e) => e.stopPropagation()}
          title={p.full_name}
          className="size-8 rounded-full ring-2 ring-white flex items-center justify-center text-[11px] text-white shrink-0 hover:z-10"
          style={{
            backgroundColor: "#5CE1A5",
            fontFamily: "var(--font-poppins)",
            fontWeight: 600,
          }}
        >
          {initialsOf(p.full_name)}
        </Link>
      ))}
      {extra > 0 && (
        <span
          className="size-8 rounded-full ring-2 ring-white bg-[#F1F5F9] text-[#475569] flex items-center justify-center text-[11px] shrink-0"
          style={{ fontFamily: "var(--font-poppins)", fontWeight: 600 }}
        >
          +{extra}
        </span>
      )}
    </div>
  );
}
