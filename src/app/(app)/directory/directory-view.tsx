"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  Plus,
  Upload,
  ChevronDown,
  Users,
  ArrowUpDown,
} from "lucide-react";
import type { Member, MembershipStatus, SortOption } from "./types";
import { AddMemberPanel } from "./add-member-panel";
import { ImportModal } from "./import-modal";

// ─── Status badge colors ────────────────────────────────
const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  active: { bg: "#DCFCE7", text: "#15803D" },
  inactive: { bg: "#F3F4F6", text: "#6B7280" },
  visitor: { bg: "#DBEAFE", text: "#1D4ED8" },
  new: { bg: "#FEF3C7", text: "#B45309" },
};

const MEMBER_TYPE_LABELS: Record<string, string> = {
  member: "Member",
  regular_attender: "Regular Attender",
  visitor: "Visitor",
  staff: "Staff",
};

// ─── Component ──────────────────────────────────────────
export function DirectoryView({ members }: { members: Member[] }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<MembershipStatus>("all");
  const [sort, setSort] = useState<SortOption>("name-az");
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [showAddPanel, setShowAddPanel] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);

  const filtered = useMemo(() => {
    let list = [...members];

    // Filter by status
    if (statusFilter !== "all") {
      list = list.filter((m) => m.membership_status === statusFilter);
    }

    // Filter by search
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (m) =>
          `${m.first_name} ${m.last_name}`.toLowerCase().includes(q) ||
          (m.email?.toLowerCase().includes(q) ?? false) ||
          (m.phone?.includes(q) ?? false),
      );
    }

    // Sort
    list.sort((a, b) => {
      switch (sort) {
        case "name-az":
          return `${a.last_name} ${a.first_name}`.localeCompare(
            `${b.last_name} ${b.first_name}`,
          );
        case "name-za":
          return `${b.last_name} ${b.first_name}`.localeCompare(
            `${a.last_name} ${a.first_name}`,
          );
        case "newest":
          return (
            new Date(b.created_at).getTime() -
            new Date(a.created_at).getTime()
          );
        case "oldest":
          return (
            new Date(a.created_at).getTime() -
            new Date(b.created_at).getTime()
          );
        default:
          return 0;
      }
    });

    return list;
  }, [members, search, statusFilter, sort]);

  const statusFilters: { label: string; value: MembershipStatus }[] = [
    { label: "All", value: "all" },
    { label: "Active", value: "active" },
    { label: "Inactive", value: "inactive" },
    { label: "Visitor", value: "visitor" },
    { label: "New", value: "new" },
  ];

  const sortOptions: { label: string; value: SortOption }[] = [
    { label: "Name A-Z", value: "name-az" },
    { label: "Name Z-A", value: "name-za" },
    { label: "Newest", value: "newest" },
    { label: "Oldest", value: "oldest" },
  ];

  return (
    <div className="max-w-[1200px] mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1
            className="text-2xl font-semibold text-[#2D333A]"
            style={{ fontFamily: "var(--font-poppins)" }}
          >
            Directory
          </h1>
          <p
            className="text-[#6B7280] text-sm mt-1 flex items-center gap-1.5"
            style={{ fontFamily: "var(--font-source-sans)" }}
          >
            <Users className="size-4" />
            {filtered.length} {filtered.length === 1 ? "Member" : "Members"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowImportModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[#E5E7EB] bg-white text-[#2D333A] text-sm font-medium hover:bg-[#F4F5F7] transition-colors"
            style={{ fontFamily: "var(--font-poppins)" }}
          >
            <Upload className="size-4" />
            Import
          </button>
          <button
            onClick={() => setShowAddPanel(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#5CE1A5] text-white text-sm font-medium hover:bg-[#4FD498] transition-colors shadow-sm"
            style={{ fontFamily: "var(--font-poppins)" }}
          >
            <Plus className="size-4" />
            Add Member
          </button>
        </div>
      </div>

      {/* Search + Filters */}
      <div className="bg-white rounded-2xl border border-[#E5E7EB] p-4 mb-4">
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-[#9CA3AF]" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, email, or phone..."
              className="w-full bg-[#F4F5F7] border border-transparent focus:border-[#5CE1A5] rounded-xl py-2.5 pl-10 pr-4 text-sm text-[#2D333A] placeholder-[#9CA3AF] outline-none transition-all"
              style={{ fontFamily: "var(--font-source-sans)" }}
            />
          </div>

          {/* Sort dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowSortMenu(!showSortMenu)}
              className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-[#E5E7EB] bg-white text-sm text-[#6B7280] hover:bg-[#F4F5F7] transition-colors whitespace-nowrap"
              style={{ fontFamily: "var(--font-source-sans)" }}
            >
              <ArrowUpDown className="size-4" />
              {sortOptions.find((s) => s.value === sort)?.label}
              <ChevronDown className="size-3.5" />
            </button>
            {showSortMenu && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setShowSortMenu(false)}
                />
                <div className="absolute right-0 top-full mt-1 bg-white border border-[#E5E7EB] rounded-xl shadow-lg z-20 py-1 min-w-[160px]">
                  {sortOptions.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => {
                        setSort(opt.value);
                        setShowSortMenu(false);
                      }}
                      className={`w-full text-left px-4 py-2 text-sm hover:bg-[#F4F5F7] transition-colors ${
                        sort === opt.value
                          ? "text-[#5CE1A5] font-medium"
                          : "text-[#2D333A]"
                      }`}
                      style={{ fontFamily: "var(--font-source-sans)" }}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Status filter pills */}
        <div className="flex flex-wrap gap-2 mt-3">
          {statusFilters.map((f) => (
            <button
              key={f.value}
              onClick={() => setStatusFilter(f.value)}
              className={`px-3.5 py-1.5 rounded-full text-[13px] font-medium transition-all ${
                statusFilter === f.value
                  ? "bg-[#5CE1A5] text-white shadow-sm"
                  : "bg-[#F4F5F7] text-[#6B7280] hover:bg-[#E5E7EB]"
              }`}
              style={{ fontFamily: "var(--font-poppins)" }}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Members List */}
      <div className="bg-white rounded-2xl border border-[#E5E7EB] overflow-hidden">
        {filtered.length === 0 ? (
          <EmptyState
            hasMembers={members.length > 0}
            onAdd={() => setShowAddPanel(true)}
          />
        ) : (
          <>
            {/* Desktop Table Header */}
            <div
              className="hidden md:grid grid-cols-[1fr_1fr_140px_120px_120px_1fr] gap-4 px-5 py-3 border-b border-[#E5E7EB] bg-[#F9FAFB] text-[12px] font-semibold text-[#9CA3AF] uppercase tracking-wide"
              style={{ fontFamily: "var(--font-poppins)" }}
            >
              <span>Name</span>
              <span>Email</span>
              <span>Phone</span>
              <span>Status</span>
              <span>Type</span>
              <span>Tags</span>
            </div>

            {/* Rows */}
            {filtered.map((member) => (
              <MemberRow
                key={member.id}
                member={member}
                onClick={() => router.push(`/directory/${member.id}`)}
              />
            ))}
          </>
        )}
      </div>

      {/* Panels / Modals */}
      {showAddPanel && (
        <AddMemberPanel onClose={() => setShowAddPanel(false)} />
      )}
      {showImportModal && (
        <ImportModal onClose={() => setShowImportModal(false)} />
      )}
    </div>
  );
}

// ─── Member Row ─────────────────────────────────────────
function MemberRow({
  member,
  onClick,
}: {
  member: Member;
  onClick: () => void;
}) {
  const initials =
    (member.first_name[0] ?? "") + (member.last_name[0] ?? "");
  const statusStyle =
    STATUS_COLORS[member.membership_status] ?? STATUS_COLORS.active;
  const typeLabel =
    MEMBER_TYPE_LABELS[member.member_type] ?? member.member_type;

  return (
    <button
      onClick={onClick}
      className="w-full text-left border-b border-[#F3F4F6] last:border-b-0 hover:bg-[#F9FAFB] transition-colors cursor-pointer"
    >
      {/* Desktop */}
      <div className="hidden md:grid grid-cols-[1fr_1fr_140px_120px_120px_1fr] gap-4 px-5 py-3.5 items-center">
        {/* Name + avatar */}
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="size-9 rounded-full flex items-center justify-center shrink-0 text-white text-[13px] font-semibold"
            style={{
              backgroundColor: "#5CE1A5",
              fontFamily: "var(--font-poppins)",
            }}
          >
            {initials.toUpperCase()}
          </div>
          <span
            className="text-[14px] font-medium text-[#2D333A] truncate"
            style={{ fontFamily: "var(--font-poppins)" }}
          >
            {member.first_name} {member.last_name}
          </span>
        </div>

        {/* Email */}
        <span
          className="text-[13px] text-[#6B7280] truncate"
          style={{ fontFamily: "var(--font-source-sans)" }}
        >
          {member.email || "\u2014"}
        </span>

        {/* Phone */}
        <span
          className="text-[13px] text-[#6B7280]"
          style={{ fontFamily: "var(--font-source-sans)" }}
        >
          {member.phone || "\u2014"}
        </span>

        {/* Status badge */}
        <span
          className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold capitalize w-fit"
          style={{
            backgroundColor: statusStyle.bg,
            color: statusStyle.text,
            fontFamily: "var(--font-poppins)",
          }}
        >
          {member.membership_status}
        </span>

        {/* Type */}
        <span
          className="text-[13px] text-[#6B7280]"
          style={{ fontFamily: "var(--font-source-sans)" }}
        >
          {typeLabel}
        </span>

        {/* Tags */}
        <div className="flex flex-wrap gap-1 min-w-0">
          {(member.tags ?? []).slice(0, 3).map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-[#F3F4F6] text-[#6B7280] truncate max-w-[100px]"
              style={{ fontFamily: "var(--font-source-sans)" }}
            >
              {tag}
            </span>
          ))}
          {(member.tags?.length ?? 0) > 3 && (
            <span
              className="text-[11px] text-[#9CA3AF]"
              style={{ fontFamily: "var(--font-source-sans)" }}
            >
              +{member.tags!.length - 3}
            </span>
          )}
        </div>
      </div>

      {/* Mobile */}
      <div className="md:hidden px-4 py-3.5 flex items-center gap-3">
        <div
          className="size-10 rounded-full flex items-center justify-center shrink-0 text-white text-[14px] font-semibold"
          style={{
            backgroundColor: "#5CE1A5",
            fontFamily: "var(--font-poppins)",
          }}
        >
          {initials.toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <p
            className="text-[14px] font-medium text-[#2D333A] truncate"
            style={{ fontFamily: "var(--font-poppins)" }}
          >
            {member.first_name} {member.last_name}
          </p>
          <p
            className="text-[12px] text-[#6B7280] truncate"
            style={{ fontFamily: "var(--font-source-sans)" }}
          >
            {member.email || member.phone || "No contact info"}
          </p>
        </div>
        <span
          className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold capitalize shrink-0"
          style={{
            backgroundColor: statusStyle.bg,
            color: statusStyle.text,
            fontFamily: "var(--font-poppins)",
          }}
        >
          {member.membership_status}
        </span>
      </div>
    </button>
  );
}

// ─── Empty State ────────────────────────────────────────
function EmptyState({
  hasMembers,
  onAdd,
}: {
  hasMembers: boolean;
  onAdd: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4">
      <div
        className="size-14 rounded-2xl flex items-center justify-center mb-4"
        style={{ backgroundColor: "rgba(92, 225, 165, 0.08)" }}
      >
        <Users className="size-7 text-[#5CE1A5]" />
      </div>
      <h3
        className="text-lg font-semibold text-[#2D333A] mb-1"
        style={{ fontFamily: "var(--font-poppins)" }}
      >
        {hasMembers ? "No members match your search" : "No members yet"}
      </h3>
      <p
        className="text-[#6B7280] text-sm mb-5 text-center max-w-sm"
        style={{ fontFamily: "var(--font-source-sans)" }}
      >
        {hasMembers
          ? "Try adjusting your search or filters."
          : "Add your first member to get started with your church directory."}
      </p>
      {!hasMembers && (
        <button
          onClick={onAdd}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#5CE1A5] text-white text-sm font-medium hover:bg-[#4FD498] transition-colors shadow-sm"
          style={{ fontFamily: "var(--font-poppins)" }}
        >
          <Plus className="size-4" />
          Add Member
        </button>
      )}
    </div>
  );
}
