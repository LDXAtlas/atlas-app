"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronLeft,
  Star,
  Sparkles,
  Plus,
  Settings,
  Pencil,
  Users,
  Tag,
  Archive,
  Trash2,
  Loader2,
  LayoutGrid,
  List,
  FileText,
  SlidersHorizontal,
  CheckCircle2,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import type { BoardDetail } from "@/app/actions/boards";
import { archiveBoard, deleteBoard } from "@/app/actions/boards";
import { WorkspacePill } from "../../_components/boards-list";

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

interface BoardDetailHeaderProps {
  board: BoardDetail;
  /** Opens the inline "Add Column" placeholder at the right edge. */
  onAddColumn: () => void;
  /** Opens the quick-add card modal targeting the first column. */
  onNewTask: () => void;
}

export function BoardDetailHeader({
  board,
  onAddColumn,
  onNewTask,
}: BoardDetailHeaderProps) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [aiBriefOpen, setAiBriefOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const menuRef = useRef<HTMLDivElement>(null);

  // Local star toggle (visual only — see comment in board-row.tsx).
  const [starred, setStarred] = useState(true);

  // View toggle and tabs are placeholder-controlled state for now.
  const [tab, setTab] = useState<"board" | "overview">("board");
  const [view, setView] = useState<"grid" | "list">("grid");

  useEffect(() => {
    if (!menuOpen) return;
    function onDoc(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setMenuOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  function handleArchive() {
    setMenuOpen(false);
    startTransition(async () => {
      const r = await archiveBoard(board.id);
      if (r.success) router.push("/workspace/projects");
    });
  }

  function handleDelete() {
    setMenuOpen(false);
    if (
      !window.confirm(
        `Delete "${board.name}"? This removes the board, columns, cards, and comments. This can't be undone.`,
      )
    )
      return;
    startTransition(async () => {
      const r = await deleteBoard(board.id);
      if (r.success) router.push("/workspace/projects");
    });
  }

  // ─── Progress data ─────────────────────────────────────────
  const { totalCards, doneCards, percent, segments } = useMemo(() => {
    let total = 0;
    let done = 0;
    const segs: { id: string; color: string; pct: number }[] = [];
    board.columns.forEach((col) => {
      total += col.cards.length;
      col.cards.forEach((c) => {
        if (c.is_completed) done += 1;
      });
    });
    if (total > 0) {
      board.columns.forEach((col) => {
        const pct = (col.cards.length / total) * 100;
        if (pct > 0) {
          segs.push({ id: col.id, color: col.color, pct });
        }
      });
    }
    return {
      totalCards: total,
      doneCards: done,
      percent: total > 0 ? Math.round((done / total) * 100) : 0,
      segments: segs,
    };
  }, [board.columns]);

  const visibleAvatars = board.members.slice(0, 3);
  const extra = Math.max(0, board.members.length - visibleAvatars.length);

  return (
    <header className="flex flex-col gap-5 mb-6">
      {/* Workspace pill */}
      <WorkspacePill />

      {/* Title row */}
      <div className="flex items-start gap-4">
        {/* Back button */}
        <Link
          href="/workspace/projects"
          className="size-10 rounded-full border border-[#E5E7EB] bg-white flex items-center justify-center text-[#0F172A] hover:bg-[#F4F5F7] transition-colors shrink-0"
          aria-label="Back to projects"
        >
          <ChevronLeft className="size-5" />
        </Link>

        {/* Identity */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3">
            <span
              className="size-3 rounded-full shrink-0"
              style={{ backgroundColor: board.color }}
              aria-hidden
            />
            <h1
              className="text-3xl lg:text-4xl text-[#0F172A] leading-tight truncate"
              style={{ fontFamily: "var(--font-poppins)", fontWeight: 800 }}
            >
              {board.name}
            </h1>
            <button
              type="button"
              onClick={() => setStarred((v) => !v)}
              className="size-8 rounded-md flex items-center justify-center hover:bg-[#F4F5F7] transition-colors shrink-0"
              aria-label={starred ? "Unstar board" : "Star board"}
              aria-pressed={starred}
            >
              <motion.span
                key={String(starred)}
                initial={{ scale: 1.2 }}
                animate={{ scale: 1 }}
                transition={{ duration: 0.2 }}
                className="inline-flex"
              >
                <Star
                  className="size-6"
                  style={{
                    color: starred ? "#F59E0B" : "#CBD5E1",
                    fill: starred ? "#F59E0B" : "transparent",
                  }}
                  strokeWidth={1.7}
                />
              </motion.span>
            </button>
          </div>
          {board.description && (
            <p
              className="text-[15px] text-[#6B7280] mt-1 truncate max-w-3xl"
              style={{ fontFamily: "var(--font-source-sans)" }}
            >
              {board.description}
            </p>
          )}
        </div>

        {/* Right cluster */}
        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => setAiBriefOpen(true)}
            className="hidden md:inline-flex items-center gap-1.5 h-9 px-3.5 rounded-full border text-[12px] font-semibold transition-colors"
            style={{
              fontFamily: "var(--font-poppins)",
              backgroundColor: "#F0FDF4",
              color: "#059669",
              borderColor: "rgba(92, 225, 165, 0.4)",
            }}
            title="AI Brief — coming soon"
          >
            <Sparkles className="size-3.5" />
            AI Brief
          </button>

          {visibleAvatars.length > 0 && (
            <div className="hidden md:flex items-center -space-x-2">
              {visibleAvatars.map((m) => (
                <Link
                  key={m.profile_id}
                  href={`/directory/profile/${m.profile_id}`}
                  title={`${m.full_name} · ${m.role}`}
                  className="size-8 rounded-full ring-2 ring-white flex items-center justify-center text-[10px] text-white shrink-0 hover:z-10"
                  style={{
                    backgroundColor: "#5CE1A5",
                    fontFamily: "var(--font-poppins)",
                    fontWeight: 600,
                  }}
                >
                  {initialsOf(m.full_name)}
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
          )}

          {board.viewer_can_edit && (
            <button
              type="button"
              disabled
              className="size-8 rounded-full border-2 border-dashed border-[#CBD5E1] flex items-center justify-center text-[#94A3B8] hover:text-[#5CE1A5] hover:border-[#5CE1A5] transition-colors disabled:cursor-not-allowed"
              aria-label="Add member"
              title="Manage members — coming in Phase 3"
            >
              <Plus className="size-4" />
            </button>
          )}

          {board.viewer_can_edit && (
            <div ref={menuRef} className="relative">
              <button
                type="button"
                onClick={() => setMenuOpen((v) => !v)}
                disabled={pending}
                className="size-9 rounded-full border border-[#E5E7EB] bg-white flex items-center justify-center text-[#475569] hover:bg-[#F4F5F7] transition-colors disabled:opacity-50"
                aria-label="Board settings"
              >
                {pending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Settings className="size-4" />
                )}
              </button>
              <AnimatePresence>
                {menuOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -4, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -4, scale: 0.96 }}
                    transition={{ duration: 0.15 }}
                    className="absolute right-0 top-full mt-2 z-30 w-56 bg-white rounded-xl border border-[#E5E7EB] py-1.5"
                    style={{ boxShadow: "0 8px 30px rgba(0,0,0,0.12)" }}
                  >
                    <MenuButton disabled icon={<Pencil className="size-3.5 text-[#9CA3AF]" />}>
                      Edit Board
                    </MenuButton>
                    <MenuButton disabled icon={<Users className="size-3.5 text-[#9CA3AF]" />}>
                      Manage Members
                    </MenuButton>
                    <MenuButton disabled icon={<Tag className="size-3.5 text-[#9CA3AF]" />}>
                      Manage Labels
                    </MenuButton>
                    <div className="h-px bg-[#F3F4F6] mx-2 my-1" />
                    <MenuButton
                      onClick={handleArchive}
                      icon={<Archive className="size-3.5 text-[#9CA3AF]" />}
                    >
                      Archive Board
                    </MenuButton>
                    {board.viewer_can_delete && (
                      <MenuButton
                        onClick={handleDelete}
                        tone="danger"
                        icon={<Trash2 className="size-3.5" />}
                      >
                        Delete Board
                      </MenuButton>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>

      {/* Tabs + filter + view toggle + new task */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="flex items-center gap-3 flex-wrap">
          {/* Board / Overview tabs */}
          <div className="inline-flex items-center bg-[#F1F5F9] rounded-xl p-1">
            <button
              type="button"
              onClick={() => setTab("board")}
              aria-pressed={tab === "board"}
              className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg text-[13px] transition-colors"
              style={{
                fontFamily: "var(--font-poppins)",
                fontWeight: 600,
                backgroundColor: tab === "board" ? "white" : "transparent",
                boxShadow:
                  tab === "board" ? "0 1px 2px rgba(15, 23, 42, 0.08)" : undefined,
                color: tab === "board" ? "#5CE1A5" : "#94A3B8",
              }}
            >
              <LayoutGrid className="size-4" />
              Board
            </button>
            <button
              type="button"
              onClick={() => setTab("overview")}
              aria-pressed={tab === "overview"}
              className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg text-[13px] transition-colors disabled:cursor-not-allowed"
              style={{
                fontFamily: "var(--font-poppins)",
                fontWeight: 600,
                backgroundColor: tab === "overview" ? "white" : "transparent",
                boxShadow:
                  tab === "overview" ? "0 1px 2px rgba(15, 23, 42, 0.08)" : undefined,
                color: tab === "overview" ? "#0F172A" : "#94A3B8",
              }}
              title="Overview view coming soon"
            >
              <FileText className="size-4" />
              Overview
            </button>
          </div>

          {/* Filter */}
          <button
            type="button"
            disabled
            className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-xl border border-[#E5E7EB] bg-white text-[13px] font-semibold text-[#475569] hover:bg-[#F4F5F7] transition-colors disabled:cursor-not-allowed"
            style={{ fontFamily: "var(--font-poppins)" }}
            title="Filter coming soon"
          >
            <SlidersHorizontal className="size-3.5" />
            Filter
          </button>

          {/* View toggle */}
          <div className="inline-flex items-center bg-[#F1F5F9] rounded-xl p-1">
            <button
              type="button"
              onClick={() => setView("grid")}
              aria-pressed={view === "grid"}
              className="size-8 rounded-lg flex items-center justify-center transition-colors"
              style={{
                backgroundColor: view === "grid" ? "white" : "transparent",
                boxShadow:
                  view === "grid" ? "0 1px 2px rgba(15, 23, 42, 0.08)" : undefined,
                color: view === "grid" ? "#0F172A" : "#94A3B8",
              }}
              aria-label="Grid view"
            >
              <LayoutGrid className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => setView("list")}
              aria-pressed={view === "list"}
              className="size-8 rounded-lg flex items-center justify-center transition-colors"
              style={{
                backgroundColor: view === "list" ? "white" : "transparent",
                boxShadow:
                  view === "list" ? "0 1px 2px rgba(15, 23, 42, 0.08)" : undefined,
                color: view === "list" ? "#0F172A" : "#94A3B8",
              }}
              aria-label="List view"
            >
              <List className="size-4" />
            </button>
          </div>
        </div>

        {board.viewer_can_edit && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onAddColumn}
              className="hidden md:inline-flex items-center gap-1.5 h-10 px-3.5 rounded-xl border border-[#E5E7EB] bg-white text-[13px] font-semibold text-[#475569] hover:bg-[#F4F5F7] transition-colors"
              style={{ fontFamily: "var(--font-poppins)" }}
            >
              <Plus className="size-3.5" />
              Add Column
            </button>
            <button
              type="button"
              onClick={onNewTask}
              className="inline-flex items-center gap-2 h-10 px-5 rounded-xl bg-[#0F172A] text-white text-[13px] font-semibold hover:bg-[#1E293B] transition-colors"
              style={{ fontFamily: "var(--font-poppins)" }}
            >
              <Plus className="size-4" />
              New Task
            </button>
          </div>
        )}
      </div>

      {/* Board progress */}
      <BoardProgress
        totalCards={totalCards}
        doneCards={doneCards}
        percent={percent}
        segments={segments}
      />

      {/* AI Brief placeholder modal */}
      <AnimatePresence>
        {aiBriefOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/30 p-4"
            onClick={() => setAiBriefOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 6 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 6 }}
              transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 text-center"
              onClick={(e) => e.stopPropagation()}
            >
              <div
                className="size-14 rounded-2xl mx-auto mb-4 flex items-center justify-center"
                style={{ backgroundColor: "#F0FDF4" }}
              >
                <Sparkles className="size-7 text-[#059669]" />
              </div>
              <h3
                className="text-[18px] text-[#0F172A] mb-2"
                style={{ fontFamily: "var(--font-poppins)", fontWeight: 700 }}
              >
                AI Brief — coming soon
              </h3>
              <p
                className="text-[14px] text-[#6B7280] mb-5"
                style={{ fontFamily: "var(--font-source-sans)" }}
              >
                We&apos;re building a smart summary that pulls from this
                board&apos;s recent activity, blockers, and upcoming due dates so
                you can catch up in seconds.
              </p>
              <button
                type="button"
                onClick={() => setAiBriefOpen(false)}
                className="inline-flex items-center gap-1.5 h-10 px-5 rounded-xl bg-[#0F172A] text-white text-[13px] font-semibold hover:bg-[#1E293B] transition-colors"
                style={{ fontFamily: "var(--font-poppins)" }}
              >
                Got it
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}

// ─── Board progress ─────────────────────────────────────────
function BoardProgress({
  totalCards,
  doneCards,
  percent,
  segments,
}: {
  totalCards: number;
  doneCards: number;
  percent: number;
  segments: { id: string; color: string; pct: number }[];
}) {
  const tone =
    percent >= 75
      ? "#10B981"
      : percent >= 40
        ? "#F59E0B"
        : percent === 0
          ? "#CBD5E1"
          : "#3B82F6";
  return (
    <div>
      <div className="flex items-center gap-3 mb-2">
        <span
          className="text-[11px] tracking-[0.08em] uppercase text-[#6B7280]"
          style={{ fontFamily: "var(--font-poppins)", fontWeight: 700 }}
        >
          Board Progress
        </span>
        <span
          className="text-2xl tabular-nums leading-none"
          style={{ fontFamily: "var(--font-poppins)", fontWeight: 800, color: tone }}
        >
          {percent}%
        </span>
        <span
          className="ml-auto inline-flex items-center gap-1.5 h-6 px-2.5 rounded-full text-[12px]"
          style={{
            fontFamily: "var(--font-poppins)",
            fontWeight: 600,
            backgroundColor: "#D1FAE5",
            color: "#059669",
          }}
        >
          <CheckCircle2 className="size-3.5" />
          {doneCards}/{totalCards} done
        </span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-[#F1F5F9] overflow-hidden flex">
        {segments.length === 0 ? (
          <div className="h-full w-full" />
        ) : (
          segments.map((s) => (
            <div
              key={s.id}
              className="h-full transition-[width] duration-500 ease-out"
              style={{ width: `${s.pct}%`, backgroundColor: s.color }}
            />
          ))
        )}
      </div>
    </div>
  );
}

function MenuButton({
  children,
  icon,
  onClick,
  disabled = false,
  tone,
}: {
  children: React.ReactNode;
  icon: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  tone?: "danger";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="w-full text-left flex items-center gap-2 px-3 py-2 text-[13px] transition-colors disabled:cursor-not-allowed"
      style={{
        fontFamily: "var(--font-source-sans)",
        color: disabled ? "#9CA3AF" : tone === "danger" ? "#DC2626" : "#2D333A",
      }}
      title={disabled ? "Coming in Phase 3" : undefined}
    >
      {icon}
      {children}
    </button>
  );
}
