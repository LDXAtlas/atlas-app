"use client";

import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Plus,
  Search,
  Folder,
  Star,
  Filter,
  Clock,
  ChevronDown,
  Building,
} from "lucide-react";
import type { BoardSummary } from "@/app/actions/boards";
import { can } from "@/lib/permissions";
import type { Role } from "@/lib/permissions";
import { BoardRow } from "./board-row";
import { CreateBoardModal } from "./create-board-modal";

type FilterPill = "all" | "mine" | "active" | "archived";

interface BoardsListViewProps {
  boards: BoardSummary[];
  departments: { id: string; name: string; color: string }[];
  viewerRole: Role;
  viewerId: string | null;
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "Just now";
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

  // Permission to create. createBoard server action gates on admin/staff/leader.
  const canCreate = can.createDepartment(viewerRole);

  const visible = useMemo(() => {
    let list = boards;
    if (filter === "active") list = list.filter((b) => !b.is_archived);
    else if (filter === "archived") list = list.filter((b) => b.is_archived);
    else if (filter === "mine")
      list = list.filter((b) => b.is_starred);
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
  }, [boards, filter, departmentId, search]);

  const starred = visible.filter((b) => b.is_starred);
  const others = visible.filter((b) => !b.is_starred);

  const lastActivity = boards.reduce<string | null>((acc, b) => {
    if (!acc) return b.updated_at;
    return new Date(b.updated_at).getTime() > new Date(acc).getTime()
      ? b.updated_at
      : acc;
  }, null);

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-2">
        <div>
          <h1
            className="text-2xl text-[#2D333A] leading-tight"
            style={{ fontFamily: "var(--font-poppins)", fontWeight: 700 }}
          >
            Project Boards
          </h1>
          <p
            className="text-[14px] text-[#6B7280] mt-1 max-w-xl"
            style={{ fontFamily: "var(--font-source-sans)" }}
          >
            Manage your ministry projects and staff workflows.
          </p>
        </div>
        {canCreate && (
          <button
            onClick={() => setShowCreate(true)}
            className="inline-flex items-center gap-2 h-10 px-4 rounded-xl bg-[#5CE1A5] text-[#060C09] text-[13px] font-semibold hover:shadow-md transition-all shrink-0"
            style={{ fontFamily: "var(--font-poppins)" }}
          >
            <Plus className="size-4" />
            New Board
          </button>
        )}
      </div>

      {/* Divider */}
      <div className="h-px w-full bg-[#E5E7EB] my-5" />

      {/* Filter / search row */}
      <div className="flex flex-col lg:flex-row lg:items-center gap-3 mb-5">
        <div className="flex flex-1 items-center gap-2 min-w-0">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-[#9CA3AF]" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search boards..."
              className="w-full pl-10 pr-4 h-10 rounded-xl border border-[#E5E7EB] bg-white text-[13px] text-[#2D333A] placeholder-[#9CA3AF] outline-none focus:border-[#5CE1A5] transition-colors"
              style={{ fontFamily: "var(--font-source-sans)" }}
            />
          </div>
          <FilterPills value={filter} onChange={setFilter} />
          {departments.length > 0 && (
            <DepartmentSelect
              value={departmentId}
              onChange={setDepartmentId}
              departments={departments}
            />
          )}
        </div>
        <div
          className="flex items-center gap-3 text-[12px] text-[#9CA3AF] shrink-0"
          style={{ fontFamily: "var(--font-poppins)" }}
        >
          <span>
            <span className="text-[#2D333A] font-semibold tabular-nums">
              {visible.length}
            </span>{" "}
            {visible.length === 1 ? "board" : "boards"}
          </span>
          {lastActivity && (
            <>
              <span aria-hidden className="text-[#E5E7EB]">|</span>
              <span className="inline-flex items-center gap-1.5 uppercase tracking-[0.06em]">
                <Clock className="size-3" />
                Last active {relativeTime(lastActivity)}
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
        <NoMatchesState onClear={() => { setSearch(""); setFilter("all"); setDepartmentId("all"); }} />
      ) : (
        <div className="space-y-8">
          {starred.length > 0 && (
            <Section
              icon={<Star className="size-3.5 text-[#F59E0B]" fill="#F59E0B" />}
              label="Starred Boards"
              count={starred.length}
            >
              {starred.map((b, i) => (
                <RowAnimated key={b.id} index={i}>
                  <BoardRow board={b} />
                </RowAnimated>
              ))}
            </Section>
          )}

          {others.length > 0 && (
            <Section
              icon={<Folder className="size-3.5 text-[#9CA3AF]" />}
              label="All Projects"
              count={others.length}
            >
              {others.map((b, i) => (
                <RowAnimated key={b.id} index={starred.length + i}>
                  <BoardRow board={b} />
                </RowAnimated>
              ))}
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

// ─── Section ─────────────────────────────────────────────────
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
          className="text-[15px] text-[#2D333A]"
          style={{ fontFamily: "var(--font-poppins)", fontWeight: 600 }}
        >
          {label}
        </h2>
        <span
          className="text-[12px] text-[#9CA3AF] tabular-nums"
          style={{ fontFamily: "var(--font-poppins)", fontWeight: 600 }}
        >
          {count}
        </span>
      </div>
      <div className="flex flex-col gap-2.5">{children}</div>
    </section>
  );
}

function RowAnimated({
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
        delay: Math.min(index * 0.03, 0.25),
        ease: [0.23, 1, 0.32, 1],
      }}
    >
      {children}
    </motion.div>
  );
}

// ─── Filter pills ───────────────────────────────────────────
function FilterPills({
  value,
  onChange,
}: {
  value: FilterPill;
  onChange: (v: FilterPill) => void;
}) {
  const opts: { id: FilterPill; label: string }[] = [
    { id: "all", label: "All" },
    { id: "mine", label: "My Boards" },
    { id: "active", label: "Active" },
    { id: "archived", label: "Archived" },
  ];
  return (
    <div className="hidden md:flex items-center bg-[#F4F5F7] rounded-xl p-1 gap-1">
      {opts.map((o) => {
        const active = value === o.id;
        return (
          <button
            key={o.id}
            type="button"
            onClick={() => onChange(o.id)}
            className="h-8 px-3 rounded-lg text-[12px] transition-colors"
            style={{
              fontFamily: "var(--font-poppins)",
              fontWeight: 600,
              backgroundColor: active ? "white" : "transparent",
              color: active ? "#2D333A" : "#6B7280",
              boxShadow: active ? "0 1px 2px rgba(15, 23, 42, 0.06)" : undefined,
            }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
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
        className="inline-flex items-center gap-2 h-10 px-3 rounded-xl border border-[#E5E7EB] bg-white text-[13px] text-[#2D333A] hover:bg-[#F4F5F7] transition-colors"
        style={{ fontFamily: "var(--font-poppins)", fontWeight: 600 }}
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
            All departments
          </>
        )}
        <ChevronDown
          className={`size-3.5 text-[#9CA3AF] transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      <AnimatePresence>
        {open && (
          <>
            <div
              className="fixed inset-0 z-10"
              onClick={() => setOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: -4 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: -4 }}
              transition={{ duration: 0.15 }}
              className="absolute right-0 top-full mt-1.5 z-20 w-56 bg-white rounded-xl border border-[#E5E7EB] shadow-xl py-1.5"
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
            </motion.div>
          </>
        )}
      </AnimatePresence>
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
        className="text-[#2D333A] text-xl mb-2"
        style={{ fontFamily: "var(--font-poppins)", fontWeight: 700 }}
      >
        No boards yet
      </h2>
      <p
        className="text-[14px] text-[#6B7280] max-w-md mb-6"
        style={{ fontFamily: "var(--font-source-sans)" }}
      >
        Create your first project board to organize team initiatives —
        sermon series, events, campaigns, and more.
      </p>
      {canCreate && (
        <button
          onClick={onCreate}
          className="inline-flex items-center gap-2 h-11 px-5 rounded-xl bg-[#5CE1A5] text-[#060C09] text-[14px] font-semibold hover:shadow-md transition-all"
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
        className="text-[#2D333A] text-[15px] mb-1"
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
