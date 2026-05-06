"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "motion/react";
import {
  Plus,
  Search,
  Folder,
  Star,
  Filter,
  Globe,
  ClipboardList,
  LayoutGrid,
  List,
  ChevronDown,
  Building,
} from "lucide-react";
import type { BoardSummary } from "@/app/actions/boards";
import { can } from "@/lib/permissions";
import type { Role } from "@/lib/permissions";
import { BoardCard } from "./board-row";
import { CreateBoardModal } from "./create-board-modal";

type FilterPill = "all" | "mine" | "active" | "archived";
type ViewMode = "grid" | "list";

interface BoardsListViewProps {
  boards: BoardSummary[];
  departments: { id: string; name: string; color: string }[];
  viewerRole: Role;
  viewerId: string | null;
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "JUST NOW";
  if (m < 60) return `${m}M AGO`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}H AGO`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}D AGO`;
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  }).toUpperCase();
}

export function BoardsListView({
  boards,
  departments,
  viewerRole,
  viewerId,
}: BoardsListViewProps) {
  const [showCreate, setShowCreate] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterPill>("all");
  const [departmentId, setDepartmentId] = useState<string | "all">("all");
  const [view, setView] = useState<ViewMode>("grid");

  // ADDED: Local state to make starring/unstarring instantly move cards and update counts
  const [localBoards, setLocalBoards] = useState(boards);
  
  // Keep synced if a new board is created on the server
  useEffect(() => {
    setLocalBoards(boards);
  }, [boards]);

  const handleToggleStar = (boardId: string) => {
    setLocalBoards((prev) =>
      prev.map((b) =>
        b.id === boardId ? { ...b, is_starred: !b.is_starred } : b
      )
    );
  };

  const canCreate = can.createDepartment(viewerRole);

  const visible = useMemo(() => {
    let list = localBoards; // Changed to use localBoards
    if (filter === "active") list = list.filter((b) => !b.is_archived);
    else if (filter === "archived") list = list.filter((b) => b.is_archived);
    else if (filter === "mine") list = list.filter((b) => b.is_starred);
    else list = list.filter((b) => !b.is_archived);

    if (departmentId !== "all") {
      list = list.filter((b) => b.department_id === departmentId);
    }

    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (b) =>
          b.name.toLowerCase().includes(q) ||
          (b.description?.toLowerCase().includes(q) ?? false),
      );
    }

    return list;
  }, [localBoards, filter, departmentId, search]); // Updated dependencies

  const starred = visible.filter((b) => b.is_starred);
  const others = visible.filter((b) => !b.is_starred);

  const lastActivity = localBoards.reduce<string | null>((acc, b) => { // Changed to localBoards
    if (!acc) return b.updated_at;
    return new Date(b.updated_at).getTime() > new Date(acc).getTime()
      ? b.updated_at
      : acc;
  }, null);

  // ... (keep the return statement and header JSX the same until the Sections)

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-5 mb-6">
        <div>
          <WorkspacePill />
          <h1
            className="text-[24px] text-[#2D333A] leading-tight mt-2"
            style={{ fontFamily: "var(--font-poppins)", fontWeight: 700 }}
          >
            Project Boards
          </h1>
          <p
            className="text-[14px] text-[#6B7280] mt-1"
            style={{ fontFamily: "var(--font-source-sans)" }}
          >
            Manage your ministry projects and staff workflows.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <ViewToggle value={view} onChange={setView} />
          <button
            type="button"
            disabled
            className="hidden md:inline-flex items-center gap-2 h-10 px-4 rounded-xl border border-[#E5E7EB] bg-white text-[13px] font-semibold text-[#2D333A] hover:bg-[#F4F5F7] transition-colors disabled:cursor-not-allowed disabled:opacity-80"
            style={{ fontFamily: "var(--font-poppins)" }}
            title="Coming soon"
          >
            <Globe className="size-4 text-[#6B7280]" />
            Browse Organization
          </button>
          {canCreate && (
            <button
              onClick={() => setShowCreate(true)}
              className="inline-flex items-center gap-2 h-10 px-5 rounded-xl bg-[#0F172A] text-white text-[13px] font-semibold hover:bg-[#1E293B] transition-colors shrink-0"
              style={{ fontFamily: "var(--font-poppins)" }}
            >
              <Plus className="size-4" />
              New Board
            </button>
          )}
        </div>
      </div>

      {/* Search / filters / count */}
      <div className="flex flex-col lg:flex-row lg:items-center gap-3 mb-8">
        <div className="flex flex-1 items-center gap-2 min-w-0">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-[#9CA3AF]" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search boards..."
              className="w-full pl-10 pr-4 h-11 rounded-xl border border-[#E5E7EB] bg-white text-[13px] text-[#2D333A] placeholder-[#9CA3AF] outline-none focus:border-[#5CE1A5] transition-colors"
              style={{ fontFamily: "var(--font-source-sans)" }}
            />
          </div>
          <button
            type="button"
            onClick={() =>
              setFilter((f) => (f === "all" ? "mine" : "all"))
            }
            className="inline-flex items-center gap-2 h-11 px-4 rounded-xl border border-[#E5E7EB] bg-white text-[13px] font-semibold text-[#2D333A] hover:bg-[#F4F5F7] transition-colors"
            style={{ fontFamily: "var(--font-poppins)" }}
            title={filter === "mine" ? "Showing My Boards — click to show All" : "Show My Boards only"}
          >
            <Filter className="size-4 text-[#6B7280]" />
            {filter === "mine" ? "My Boards" : "Filters"}
          </button>
          {departments.length > 0 && (
            <DepartmentSelect
              value={departmentId}
              onChange={setDepartmentId}
              departments={departments}
            />
          )}
        </div>
        <div
          className="flex items-center gap-3 text-[11px] text-[#9CA3AF] shrink-0"
          style={{ fontFamily: "var(--font-poppins)", fontWeight: 600 }}
        >
          <span>
            <span className="text-[#2D333A] tabular-nums">{visible.length}</span>
            {" "}
            {visible.length === 1 ? "board" : "boards"}
          </span>
          {lastActivity && (
            <>
              <span aria-hidden className="text-[#E5E7EB]">|</span>
              <span className="uppercase tracking-[0.08em] inline-flex items-center gap-1.5">
                Last active: {relativeTime(lastActivity)}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Sections */}
      {boards.length === 0 ? (
        <EmptyBoardsState
          canCreate={canCreate}
          onCreate={() => setShowCreate(true)}
        />
      ) : visible.length === 0 ? (
        <NoMatchesState
          onClear={() => {
            setSearch("");
            setFilter("all");
            setDepartmentId("all");
          }}
        />
      ) : (
        <div className="space-y-10">
          {starred.length > 0 && (
            <Section
              icon={
                <Star
                  className="size-3.5 text-[#F59E0B]"
                  fill="#F59E0B"
                  strokeWidth={1.5}
                />
              }
              label="Starred Boards"
              count={starred.length}
            >
              <BoardGrid view={view}>
                {starred.map((b, i) => (
                  <CardAnimated key={b.id} index={i}>
                    <BoardCard board={b} onToggleStar={() => handleToggleStar(b.id)} />
                  </CardAnimated>
                ))}
              </BoardGrid>
            </Section>
          )}

          {others.length > 0 && (
            <Section
              icon={<Folder className="size-3.5 text-[#3B82F6]" strokeWidth={1.7} />}
              label="Other Projects"
              count={others.length}
            >
              <BoardGrid view={view}>
                {others.map((b, i) => (
                  <CardAnimated key={b.id} index={starred.length + i}>
                    <BoardCard board={b} onToggleStar={() => handleToggleStar(b.id)} />
                  </CardAnimated>
                ))}
              </BoardGrid>
            </Section>
          )}
        </div>
      )}

      <CreateBoardModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        departments={departments}
        viewerId={viewerId}
      />
    </div>
  );
}

// ─── Workspace pill (used on this page + the detail header) ─
export function WorkspacePill() {
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 h-6 rounded-full text-[10px] tracking-[0.12em] uppercase"
      style={{
        fontFamily: "var(--font-poppins)",
        fontWeight: 700,
        backgroundColor: "rgba(59, 130, 246, 0.10)",
        color: "#2563EB",
      }}
    >
      <ClipboardList className="size-3" strokeWidth={2.2} />
      Workspace
    </span>
  );
}

// ─── View toggle ────────────────────────────────────────────
function ViewToggle({
  value,
  onChange,
}: {
  value: ViewMode;
  onChange: (v: ViewMode) => void;
}) {
  return (
    <div className="inline-flex items-center bg-[#F1F5F9] rounded-xl p-1">
      <button
        type="button"
        onClick={() => onChange("grid")}
        aria-pressed={value === "grid"}
        aria-label="Grid view"
        className="size-8 rounded-lg flex items-center justify-center transition-colors"
        style={{
          backgroundColor: value === "grid" ? "white" : "transparent",
          boxShadow: value === "grid" ? "0 1px 2px rgba(15, 23, 42, 0.08)" : undefined,
          color: value === "grid" ? "#0F172A" : "#94A3B8",
        }}
      >
        <LayoutGrid className="size-4" strokeWidth={2} />
      </button>
      <button
        type="button"
        onClick={() => onChange("list")}
        aria-pressed={value === "list"}
        aria-label="List view"
        className="size-8 rounded-lg flex items-center justify-center transition-colors"
        style={{
          backgroundColor: value === "list" ? "white" : "transparent",
          boxShadow: value === "list" ? "0 1px 2px rgba(15, 23, 42, 0.08)" : undefined,
          color: value === "list" ? "#0F172A" : "#94A3B8",
        }}
      >
        <List className="size-4" strokeWidth={2} />
      </button>
    </div>
  );
}

// ─── Section wrapper ────────────────────────────────────────
function Section({
  icon,
  label,
  count,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="flex items-center gap-2 mb-3">
        {icon}
        <h2
          className="text-[15px] text-[#2D333A] leading-tight"
          style={{ fontFamily: "var(--font-poppins)", fontWeight: 700 }}
        >
          {label}
        </h2>
        <span
          className="text-[12px] text-[#9CA3AF] tabular-nums ml-0.5"
          style={{ fontFamily: "var(--font-poppins)", fontWeight: 600 }}
        >
          {count}
        </span>
      </div>
      {children}
    </section>
  );
}

function BoardGrid({
  view,
  children,
}: {
  view: ViewMode;
  children: React.ReactNode;
}) {
  if (view === "list") {
    return <div className="flex flex-col gap-3">{children}</div>;
  }
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">{children}</div>
  );
}

function CardAnimated({
  index,
  children,
}: {
  index: number;
  children: React.ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.22,
        delay: Math.min(index * 0.04, 0.3),
        ease: [0.23, 1, 0.32, 1],
      }}
    >
      {children}
    </motion.div>
  );
}

// ─── Department select ──────────────────────────────────────
function DepartmentSelect({
  value,
  onChange,
  departments,
}: {
  value: string | "all";
  onChange: (v: string | "all") => void;
  departments: { id: string; name: string; color: string }[];
}) {
  const [open, setOpen] = useState(false);
  const selected =
    value === "all" ? null : departments.find((d) => d.id === value);

  return (
    <div className="relative hidden md:block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-2 h-11 px-3.5 rounded-xl border border-[#E5E7EB] bg-white text-[13px] font-semibold text-[#2D333A] hover:bg-[#F4F5F7] transition-colors"
        style={{ fontFamily: "var(--font-poppins)" }}
      >
        {selected ? (
          <>
            <span
              className="size-2.5 rounded-full"
              style={{ backgroundColor: selected.color }}
            />
            <span className="truncate max-w-[140px]">{selected.name}</span>
          </>
        ) : (
          <>
            <Building className="size-3.5 text-[#9CA3AF]" />
            All depts
          </>
        )}
        <ChevronDown
          className={`size-3.5 text-[#9CA3AF] transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setOpen(false)}
          />
          <div
            className="absolute right-0 top-full mt-1.5 z-20 w-56 bg-white rounded-xl border border-[#E5E7EB] py-1.5"
            style={{ boxShadow: "0 8px 30px rgba(0,0,0,0.12)" }}
          >
            <button
              type="button"
              onClick={() => {
                onChange("all");
                setOpen(false);
              }}
              className="w-full text-left flex items-center gap-2 px-3 py-2 text-[13px] text-[#2D333A] hover:bg-[#F4F5F7]"
              style={{ fontFamily: "var(--font-source-sans)" }}
            >
              <Building className="size-3.5 text-[#9CA3AF]" />
              All departments
            </button>
            <div className="h-px bg-[#F3F4F6] mx-2 my-1" />
            {departments.map((d) => (
              <button
                key={d.id}
                type="button"
                onClick={() => {
                  onChange(d.id);
                  setOpen(false);
                }}
                className="w-full text-left flex items-center gap-2 px-3 py-2 text-[13px] text-[#2D333A] hover:bg-[#F4F5F7]"
                style={{ fontFamily: "var(--font-source-sans)" }}
              >
                <span
                  className="size-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: d.color }}
                />
                <span className="truncate">{d.name}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Empty states ───────────────────────────────────────────
function EmptyBoardsState({
  canCreate,
  onCreate,
}: {
  canCreate: boolean;
  onCreate: () => void;
}) {
  return (
    <div className="flex flex-col items-center text-center py-16">
      <div
        className="size-24 rounded-full flex items-center justify-center mb-6"
        style={{ backgroundColor: "rgba(92, 225, 165, 0.12)" }}
      >
        <Folder className="size-16 text-[#5CE1A5]" strokeWidth={1.4} />
      </div>
      <h2
        className="text-[#0F172A] text-xl mb-2"
        style={{ fontFamily: "var(--font-poppins)", fontWeight: 700 }}
      >
        No boards yet
      </h2>
      <p
        className="text-[14px] text-[#6B7280] max-w-md mb-6"
        style={{ fontFamily: "var(--font-source-sans)" }}
      >
        Create your first project board to organize team initiatives — sermon
        series, events, campaigns, and more.
      </p>
      {canCreate && (
        <button
          onClick={onCreate}
          className="inline-flex items-center gap-2 h-11 px-5 rounded-xl bg-[#0F172A] text-white text-[14px] font-semibold hover:bg-[#1E293B] transition-colors"
          style={{ fontFamily: "var(--font-poppins)" }}
        >
          <Plus className="size-4" />
          Create Board
        </button>
      )}
    </div>
  );
}

function NoMatchesState({ onClear }: { onClear: () => void }) {
  return (
    <div className="flex flex-col items-center text-center py-12 bg-white rounded-2xl border border-[#E5E7EB]">
      <div
        className="size-12 rounded-full flex items-center justify-center mb-3"
        style={{ backgroundColor: "#F4F5F7" }}
      >
        <Filter className="size-5 text-[#9CA3AF]" />
      </div>
      <h2
        className="text-[#0F172A] text-[15px] mb-1"
        style={{ fontFamily: "var(--font-poppins)", fontWeight: 600 }}
      >
        No boards match your filters
      </h2>
      <p
        className="text-[13px] text-[#6B7280] mb-4 max-w-sm"
        style={{ fontFamily: "var(--font-source-sans)" }}
      >
        Try clearing your filters or searching for a different name.
      </p>
      <button
        onClick={onClear}
        className="text-[12px] font-semibold text-[#5CE1A5] hover:text-[#3DB882] transition-colors"
        style={{ fontFamily: "var(--font-poppins)" }}
      >
        Clear filters
      </button>
    </div>
  );
}
