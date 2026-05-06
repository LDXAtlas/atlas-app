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
  ArrowDownUp,
  User,
  Check,
  X,
  Search, 
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import type { BoardDetail } from "@/app/actions/boards";
import { archiveBoard, deleteBoard } from "@/app/actions/boards";
import { WorkspacePill } from "../../_components/boards-list";
import type { SortOption } from "./board-view";

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
  activeSort: SortOption;
  setActiveSort: (v: SortOption) => void;
  activeAssigneeTop: string | null;
  setActiveAssigneeTop: (id: string | null) => void;
  viewMode: "grid" | "list";
  setViewMode: (v: "grid" | "list") => void;
  activeTab: "board" | "overview"; // <-- ADD THIS
  setActiveTab: (v: "board" | "overview") => void; // <-- ADD THIS
  onAddColumn: () => void;
  onNewTask: () => void;
}

export function BoardDetailHeader({
  board,
  activeSort,
  setActiveSort,
  activeAssigneeTop,
  setActiveAssigneeTop,
  viewMode,
  setViewMode,
  activeTab,
  setActiveTab,
  onAddColumn,
  onNewTask,
}: BoardDetailHeaderProps) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [filterMenuOpen, setFilterMenuOpen] = useState(false);
  const [aiBriefOpen, setAiBriefOpen] = useState(false);
  const [addMemberOpen, setAddMemberOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const menuRef = useRef<HTMLDivElement>(null);
  const filterRef = useRef<HTMLDivElement>(null);

  const [starred, setStarred] = useState(true);

  // Close menus when clicking outside
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) {
        setFilterMenuOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setMenuOpen(false);
        setFilterMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen, filterMenuOpen]);

  function handleArchive() {
    setMenuOpen(false);
    startTransition(async () => {
      const r = await archiveBoard(board.id);
      if (r.success) router.push("/workspace/projects");
    });
  }

  function handleDelete() {
    setMenuOpen(false);
    if (!window.confirm(`Delete "${board.name}"? This removes the board, columns, cards, and comments. This can't be undone.`)) return;
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

  const hasActiveFilters = activeSort !== "manual" || activeAssigneeTop !== null;

  return (
    <header className="flex flex-col gap-5 mb-6">
      <WorkspacePill />

      <div className="flex items-start gap-4">
        <Link
          href="/workspace/projects"
          className="size-10 rounded-full border border-[#E5E7EB] bg-white flex items-center justify-center text-[#0F172A] hover:bg-[#F4F5F7] transition-colors shrink-0"
        >
          <ChevronLeft className="size-5" />
        </Link>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2.5">
            <span
              className="size-2.5 rounded-full shrink-0"
              style={{ backgroundColor: board.color }}
              aria-hidden
            />
            <h1
              className="text-[24px] text-[#2D333A] leading-tight truncate"
              style={{ fontFamily: "var(--font-poppins)", fontWeight: 700 }}
            >
              {board.name}
            </h1>
            <button
              type="button"
              onClick={() => setStarred((v) => !v)}
              className="size-7 rounded-md flex items-center justify-center hover:bg-[#F4F5F7] transition-colors shrink-0"
            >
              <motion.span
                key={String(starred)}
                initial={{ scale: 1.2 }}
                animate={{ scale: 1 }}
                transition={{ duration: 0.2 }}
                className="inline-flex"
              >
                <Star
                  className="size-4"
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
              className="text-[14px] text-[#6B7280] mt-1 truncate max-w-3xl"
              style={{ fontFamily: "var(--font-source-sans)" }}
            >
              {board.description}
            </p>
          )}
        </div>

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
                  style={{ backgroundColor: "#5CE1A5", fontFamily: "var(--font-poppins)", fontWeight: 600 }}
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

          {/* 1. The Add Member Button */}
          {board.viewer_can_edit && (
            <button
              type="button"
              onClick={() => setAddMemberOpen(true)}
              className="size-8 rounded-full border-2 border-dashed border-[#CBD5E1] flex items-center justify-center text-[#94A3B8] hover:text-[#5CE1A5] hover:border-[#5CE1A5] transition-colors"
              aria-label="Add member"
              title="Add a member"
            >
              <Plus className="size-4" />
            </button>
          )}

          {/* 2. The Settings Menu Button */}
          {board.viewer_can_edit && (
            <div ref={menuRef} className="relative">
              <button
                type="button"
                onClick={() => setMenuOpen((v) => !v)}
                disabled={pending}
                className="size-9 rounded-full border border-[#E5E7EB] bg-white flex items-center justify-center text-[#475569] hover:bg-[#F4F5F7] transition-colors disabled:opacity-50"
                aria-label="Board settings"
              >
                {pending ? <Loader2 className="size-4 animate-spin" /> : <Settings className="size-4" />}
              </button>
              <AnimatePresence>
                {menuOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -4, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -4, scale: 0.96 }}
                    transition={{ duration: 0.15 }}
                    className="absolute right-0 top-full mt-2 z-30 w-56 bg-white rounded-xl border border-[#E5E7EB] py-1.5 shadow-xl"
                  >
                    <MenuButton disabled icon={<Pencil className="size-3.5 text-[#9CA3AF]" />}>Edit Board</MenuButton>
                    <MenuButton disabled icon={<Users className="size-3.5 text-[#9CA3AF]" />}>Manage Members</MenuButton>
                    <MenuButton disabled icon={<Tag className="size-3.5 text-[#9CA3AF]" />}>Manage Labels</MenuButton>
                    <div className="h-px bg-[#F3F4F6] mx-2 my-1" />
                    <MenuButton onClick={handleArchive} icon={<Archive className="size-3.5 text-[#9CA3AF]" />}>Archive Board</MenuButton>
                    {board.viewer_can_delete && (
                      <MenuButton onClick={handleDelete} tone="danger" icon={<Trash2 className="size-3.5" />}>Delete Board</MenuButton>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>

      {/* Action Bar: Left side tools, Right side primary actions */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        
        {/* LEFT SIDE: View tools */}
        <div className="flex items-center gap-3 flex-wrap">
          
          {/* Board / Overview tabs */}
          <div className="inline-flex items-center bg-[#F1F5F9] rounded-xl p-1">
            <button
              type="button"
              onClick={() => setActiveTab("board")}
              className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg text-[13px] transition-colors"
              style={{
                fontFamily: "var(--font-poppins)", fontWeight: 600,
                backgroundColor: activeTab === "board" ? "white" : "transparent",
                boxShadow: activeTab === "board" ? "0 1px 2px rgba(15, 23, 42, 0.08)" : undefined,
                color: activeTab === "board" ? "#5CE1A5" : "#94A3B8",
              }}
            >
              <LayoutGrid className="size-4" /> Board
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("overview")}
              className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg text-[13px] transition-colors"
              style={{
                fontFamily: "var(--font-poppins)", fontWeight: 600,
                backgroundColor: activeTab === "overview" ? "white" : "transparent",
                boxShadow: activeTab === "overview" ? "0 1px 2px rgba(15, 23, 42, 0.08)" : undefined,
                color: activeTab === "overview" ? "#0F172A" : "#94A3B8",
              }}
            >
              <FileText className="size-4" /> Overview
            </button>
          </div>

          {/* FILTER / SORT DROPDOWN */}
          <div ref={filterRef} className="relative">
            <button
              type="button"
              onClick={() => setFilterMenuOpen(!filterMenuOpen)}
              className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-xl border text-[13px] font-semibold transition-colors relative"
              style={{
                fontFamily: "var(--font-poppins)",
                backgroundColor: hasActiveFilters ? "#F0FDF4" : "white",
                borderColor: hasActiveFilters ? "#5CE1A5" : "#E5E7EB",
                color: hasActiveFilters ? "#059669" : "#475569",
              }}
            >
              <SlidersHorizontal className="size-3.5" />
              {hasActiveFilters ? "Sorted" : "Filter"}
              {hasActiveFilters && (
                <span className="absolute -top-1 -right-1 size-2.5 bg-[#5CE1A5] rounded-full border border-white" />
              )}
            </button>

            <AnimatePresence>
              {filterMenuOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -4, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -4, scale: 0.96 }}
                  transition={{ duration: 0.15 }}
                  className="absolute left-0 top-full mt-2 z-30 w-64 bg-white rounded-xl border border-[#E5E7EB] py-2 shadow-xl"
                >
                  <div className="px-3 pb-1 mb-1 border-b border-[#F3F4F6]">
                    <p className="text-[10px] uppercase tracking-[0.08em] text-[#9CA3AF] mb-1" style={{ fontFamily: "var(--font-poppins)", fontWeight: 600 }}>Sort Cards</p>
                    <FilterOption
                      label="Manual (Default)"
                      icon={<LayoutGrid className="size-3.5" />}
                      active={activeSort === "manual"}
                      onClick={() => setActiveSort("manual")}
                    />
                    <FilterOption
                      label="Priority (High First)"
                      icon={<ArrowDownUp className="size-3.5" />}
                      active={activeSort === "priority"}
                      onClick={() => setActiveSort("priority")}
                    />
                    <FilterOption
                      label="Due Date (Nearest)"
                      icon={<ArrowDownUp className="size-3.5" />}
                      active={activeSort === "due_nearest"}
                      onClick={() => setActiveSort("due_nearest")}
                    />
                    <FilterOption
                      label="Due Date (Furthest)"
                      icon={<ArrowDownUp className="size-3.5" />}
                      active={activeSort === "due_furthest"}
                      onClick={() => setActiveSort("due_furthest")}
                    />
                  </div>

                  <div className="px-3 pt-1">
                    <p className="text-[10px] uppercase tracking-[0.08em] text-[#9CA3AF] mb-1" style={{ fontFamily: "var(--font-poppins)", fontWeight: 600 }}>Bring to Top</p>
                    <FilterOption
                      label="None"
                      icon={<Users className="size-3.5" />}
                      active={activeAssigneeTop === null}
                      onClick={() => setActiveAssigneeTop(null)}
                    />
                    {board.members.map((m) => (
                      <FilterOption
                        key={m.profile_id}
                        label={m.full_name}
                        icon={<User className="size-3.5" />}
                        active={activeAssigneeTop === m.profile_id}
                        onClick={() => setActiveAssigneeTop(m.profile_id)}
                      />
                    ))}
                  </div>

                  {hasActiveFilters && (
                    <div className="mt-2 px-3 pt-2 border-t border-[#F3F4F6]">
                      <button
                        onClick={() => {
                          setActiveSort("manual");
                          setActiveAssigneeTop(null);
                        }}
                        className="w-full text-center py-1.5 text-[12px] font-semibold text-[#DC2626] hover:bg-[#FEF2F2] rounded-lg transition-colors"
                        style={{ fontFamily: "var(--font-poppins)" }}
                      >
                        Clear Sort
                      </button>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* View toggle */}
          <div className="inline-flex items-center bg-[#F1F5F9] rounded-xl p-1">
            <button
              type="button"
              onClick={() => setViewMode("grid")}
              className="size-8 rounded-lg flex items-center justify-center transition-colors"
              style={{ backgroundColor: viewMode === "grid" ? "white" : "transparent", boxShadow: viewMode === "grid" ? "0 1px 2px rgba(15, 23, 42, 0.08)" : undefined, color: viewMode === "grid" ? "#0F172A" : "#94A3B8" }}
            >
              <LayoutGrid className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode("list")}
              className="size-8 rounded-lg flex items-center justify-center transition-colors"
              style={{ backgroundColor: viewMode === "list" ? "white" : "transparent", color: viewMode === "list" ? "#0F172A" : "#94A3B8" }}
            >
              <List className="size-4" />
            </button>
          </div>
        </div>

        {/* RIGHT SIDE: Primary actions */}
        {board.viewer_can_edit && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onAddColumn}
              className="hidden md:inline-flex items-center gap-1.5 h-10 px-3.5 rounded-xl border border-[#E5E7EB] bg-white text-[13px] font-semibold text-[#475569] hover:bg-[#F4F5F7] transition-colors"
              style={{ fontFamily: "var(--font-poppins)" }}
            >
              <Plus className="size-3.5" /> {viewMode === "list" ? "Add Group" : "Add Column"}
            </button>
            <button
              type="button"
              onClick={onNewTask}
              className="inline-flex items-center gap-2 h-10 px-5 rounded-xl bg-[#0F172A] text-white text-[13px] font-semibold hover:bg-[#1E293B] transition-colors"
              style={{ fontFamily: "var(--font-poppins)" }}
            >
              <Plus className="size-4" /> New Task
            </button>
          </div>
        )}
      </div>

      <BoardProgress
        totalCards={totalCards}
        doneCards={doneCards}
        percent={percent}
        segments={segments}
      />
      
      {/* Add Member Modal UI */}
      <AnimatePresence>
        {addMemberOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/30 p-4"
            onClick={() => setAddMemberOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 6 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 6 }}
              transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h3
                  className="text-[18px] text-[#0F172A]"
                  style={{ fontFamily: "var(--font-poppins)", fontWeight: 700 }}
                >
                  Add Members
                </h3>
                <button
                  onClick={() => setAddMemberOpen(false)}
                  className="size-8 rounded-lg flex items-center justify-center text-[#9CA3AF] hover:text-[#2D333A] hover:bg-[#F4F5F7] transition-colors"
                >
                  <X className="size-4" />
                </button>
              </div>
              
              <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-[#9CA3AF]" />
                <input
                  type="text"
                  placeholder="Search name or email..."
                  autoFocus
                  className="w-full h-10 pl-9 pr-3 rounded-xl border border-[#E5E7EB] text-[13px] text-[#2D333A] outline-none focus:border-[#5CE1A5] transition-colors"
                  style={{ fontFamily: "var(--font-source-sans)" }}
                />
              </div>
              
              <div className="border border-[#E5E7EB] bg-[#F8FAFC] rounded-xl overflow-hidden mb-5">
                <div className="px-3 py-6 text-center">
                  <div className="size-10 rounded-full bg-white border border-[#E5E7EB] flex items-center justify-center mx-auto mb-3 shadow-sm">
                    <Users className="size-5 text-[#9CA3AF]" />
                  </div>
                  <p className="text-[13px] text-[#475569] font-medium" style={{ fontFamily: "var(--font-source-sans)" }}>
                    Search for teammates to invite
                  </p>
                  <p className="text-[12px] text-[#9CA3AF] mt-1" style={{ fontFamily: "var(--font-source-sans)" }}>
                    They will get an email notification.
                  </p>
                </div>
              </div>
              
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setAddMemberOpen(false)}
                  className="h-10 px-5 rounded-xl bg-[#0F172A] text-white text-[13px] font-semibold hover:bg-[#1E293B] transition-colors"
                  style={{ fontFamily: "var(--font-poppins)" }}
                >
                  Done
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </header>
  );
}

// ─── Filter Option Component ───────────────────────────────
function FilterOption({ label, icon, active, onClick }: { label: string; icon: React.ReactNode; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-[#F4F5F7] transition-colors group"
    >
      <div className="flex items-center gap-2 text-[13px]" style={{ fontFamily: "var(--font-source-sans)", color: active ? "#059669" : "#2D333A", fontWeight: active ? 600 : 400 }}>
        <span className={active ? "text-[#059669]" : "text-[#9CA3AF] group-hover:text-[#6B7280]"}>{icon}</span>
        {label}
      </div>
      {active && <Check className="size-3.5 text-[#059669]" />}
    </button>
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
  const tone = percent >= 75 ? "#10B981" : percent >= 40 ? "#F59E0B" : percent === 0 ? "#CBD5E1" : "#3B82F6";
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
          style={{ fontFamily: "var(--font-poppins)", fontWeight: 600, backgroundColor: "#D1FAE5", color: "#059669" }}
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

function MenuButton({ children, icon, onClick, disabled = false, tone }: { children: React.ReactNode; icon: React.ReactNode; onClick?: () => void; disabled?: boolean; tone?: "danger" }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="w-full text-left flex items-center gap-2 px-3 py-2 text-[13px] transition-colors disabled:cursor-not-allowed"
      style={{ fontFamily: "var(--font-source-sans)", color: disabled ? "#9CA3AF" : tone === "danger" ? "#DC2626" : "#2D333A" }}
    >
      {icon}
      {children}
    </button>
  );
}