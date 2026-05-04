"use client";

import { useMemo, useState, useTransition } from "react";
import {
  Search,
  Upload,
  Pencil,
  ChevronUp,
  ChevronDown,
  Users,
  Filter,
  Loader2,
} from "lucide-react";
import type { DirectoryPerson } from "@/app/actions/members";
import { ROLE_LABELS } from "@/lib/roles";
import type { Role } from "@/lib/permissions";
import { DirectoryShell } from "./directory-shell";
import { AddProfileDropdown } from "./add-profile-dropdown";
import { InviteTeamModal } from "./invite-team-modal";
import { PersonRow } from "./person-row";
import { AddMemberPanel } from "../add-member-panel";
import { ImportModal } from "../import-modal";
import { deleteMember } from "@/app/actions/members";
import { removeMember } from "@/app/actions/invitations";
import { useRouter } from "next/navigation";

type SortKey = "default" | "name" | "email" | "role" | "ministries";
type SortDir = "asc" | "desc";

const ROLE_ORDER: Record<Role, number> = {
  admin: 0,
  staff: 1,
  leader: 2,
  volunteer: 3,
  member: 4,
};

interface PeopleListProps {
  people: DirectoryPerson[];
  currentUserRole: Role;
  currentUserEmail: string;
}

export function PeopleList({ people, currentUserRole, currentUserEmail }: PeopleListProps) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("default");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [editMode, setEditMode] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [showAddMember, setShowAddMember] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [pendingRemoval, setPendingRemoval] = useState<DirectoryPerson | null>(null);
  const [isRemoving, startRemove] = useTransition();
  const [removeError, setRemoveError] = useState<string | null>(null);

  const isAdmin = currentUserRole === "admin";

  const filtered = useMemo(() => {
    let list = [...people];
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((p) => {
        return (
          p.full_name.toLowerCase().includes(q) ||
          (p.email?.toLowerCase().includes(q) ?? false) ||
          (p.phone?.includes(q) ?? false) ||
          (p.primary_department?.name.toLowerCase().includes(q) ?? false) ||
          ROLE_LABELS[p.role].toLowerCase().includes(q)
        );
      });
    }

    list.sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1;
      const nameA = `${a.last_name || a.first_name} ${a.first_name}`.toLowerCase();
      const nameB = `${b.last_name || b.first_name} ${b.first_name}`.toLowerCase();
      switch (sortKey) {
        case "name":
          return nameA.localeCompare(nameB) * dir;
        case "email":
          return (a.email || "").localeCompare(b.email || "") * dir;
        case "role": {
          const cmp = ROLE_ORDER[a.role] - ROLE_ORDER[b.role];
          return (cmp || nameA.localeCompare(nameB)) * dir;
        }
        case "ministries":
          return (b.ministry_count - a.ministry_count) * dir;
        case "default":
        default: {
          const cmp = ROLE_ORDER[a.role] - ROLE_ORDER[b.role];
          if (cmp !== 0) return cmp;
          return nameA.localeCompare(nameB);
        }
      }
    });

    return list;
  }, [people, search, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  function handleRemove(person: DirectoryPerson) {
    setRemoveError(null);
    setPendingRemoval(person);
  }

  function confirmRemove() {
    if (!pendingRemoval) return;
    const target = pendingRemoval;
    startRemove(async () => {
      const result =
        target.type === "profile"
          ? await removeMember(target.id)
          : await deleteMember(target.id);
      if ("error" in result && result.error) {
        setRemoveError(result.error);
      } else if ("success" in result && result.success === false) {
        setRemoveError(result.error || "Failed to remove.");
      } else {
        setPendingRemoval(null);
        router.refresh();
      }
    });
  }

  // ──────── Header action buttons ────────
  const actions = (
    <>
      <button
        onClick={() => setShowImport(true)}
        className="flex items-center gap-2 h-10 px-4 rounded-xl border border-[#E5E7EB] bg-white text-[13px] font-semibold text-[#2D333A] hover:bg-[#F4F5F7] transition-colors"
        style={{ fontFamily: "var(--font-poppins)" }}
      >
        <Upload className="size-4" />
        Mass Import
      </button>
      <AddProfileDropdown
        onInviteTeamMember={() => setShowInvite(true)}
        onAddCongregationMember={() => setShowAddMember(true)}
      />
    </>
  );

  // ──────── Search slot (right of tab bar) ────────
  const searchSlot = (
    <div className="relative w-full sm:w-[280px]">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-[#9CA3AF]" />
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search database..."
        className="w-full pl-10 pr-4 h-10 rounded-xl border border-[#E5E7EB] bg-white text-[13px] text-[#2D333A] placeholder-[#9CA3AF] outline-none focus:border-[#5CE1A5] transition-colors"
        style={{ fontFamily: "var(--font-source-sans)" }}
      />
    </div>
  );

  return (
    <DirectoryShell actions={actions} searchSlot={searchSlot}>
      {/* Filters bar */}
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <span
            className="text-[14px] text-[#6B7280] flex items-center gap-1.5"
            style={{ fontFamily: "var(--font-poppins)", fontWeight: 600 }}
          >
            <Filter className="size-3.5" />
            Filters:
          </span>
          <button
            disabled
            className="h-9 w-[120px] px-3 rounded-xl bg-[#F4F5F7] border border-[#E5E7EB] text-[12px] text-[#9CA3AF] flex items-center justify-between cursor-not-allowed"
            style={{ fontFamily: "var(--font-source-sans)" }}
            title="Coming soon"
          >
            Role
            <ChevronDown className="size-3.5" />
          </button>
          <button
            disabled
            className="h-9 w-[120px] px-3 rounded-xl bg-[#F4F5F7] border border-[#E5E7EB] text-[12px] text-[#9CA3AF] flex items-center justify-between cursor-not-allowed"
            style={{ fontFamily: "var(--font-source-sans)" }}
            title="Coming soon"
          >
            Ministry
            <ChevronDown className="size-3.5" />
          </button>
        </div>
        <button
          onClick={() => setEditMode((v) => !v)}
          className={`flex items-center gap-2 h-9 px-3.5 rounded-xl border text-[13px] font-semibold transition-colors ${
            editMode
              ? "border-[#5CE1A5] bg-[#5CE1A5]/10 text-[#059669]"
              : "border-[#E5E7EB] bg-white text-[#2D333A] hover:bg-[#F4F5F7]"
          }`}
          style={{ fontFamily: "var(--font-poppins)" }}
        >
          <Pencil className="size-3.5" />
          {editMode ? "Exit Edit Mode" : "Enter Edit Mode"}
        </button>
      </div>

      {/* Table card */}
      <div className="bg-white rounded-2xl border border-[#E5E7EB] overflow-visible">
        {filtered.length === 0 ? (
          <EmptyState
            hasPeople={people.length > 0}
            onInvite={() => setShowInvite(true)}
            onAddMember={() => setShowAddMember(true)}
          />
        ) : (
          <>
            {/* Header row */}
            <div className="grid grid-cols-[1.4fr_1.5fr_120px_1.4fr_88px] gap-4 px-5 py-3 border-b border-[#E5E7EB] bg-[#F9FAFB]">
              <SortHeader label="Name" k="name" current={sortKey} dir={sortDir} onClick={toggleSort} />
              <SortHeader label="Contact Information" k="email" current={sortKey} dir={sortDir} onClick={toggleSort} />
              <SortHeader label="Primary Role" k="role" current={sortKey} dir={sortDir} onClick={toggleSort} />
              <SortHeader label="Ministries" k="ministries" current={sortKey} dir={sortDir} onClick={toggleSort} />
              <span
                className="text-[11px] font-semibold text-[#9CA3AF] uppercase tracking-wider text-right"
                style={{ fontFamily: "var(--font-poppins)" }}
              >
                Action
              </span>
            </div>

            {filtered.map((person) => (
              <PersonRow
                key={`${person.type}-${person.id}`}
                person={person}
                canRemove={isAdmin}
                onRemove={handleRemove}
              />
            ))}
          </>
        )}
      </div>

      {/* Modals */}
      {showAddMember && (
        <AddMemberPanel onClose={() => setShowAddMember(false)} />
      )}
      {showImport && <ImportModal onClose={() => setShowImport(false)} />}
      <InviteTeamModal
        isOpen={showInvite}
        onClose={() => setShowInvite(false)}
        currentUserEmail={currentUserEmail}
      />

      {/* Remove confirm */}
      {pendingRemoval && (
        <RemoveConfirm
          person={pendingRemoval}
          isRemoving={isRemoving}
          error={removeError}
          onCancel={() => setPendingRemoval(null)}
          onConfirm={confirmRemove}
        />
      )}
    </DirectoryShell>
  );
}

// ─── Sort Header ────────────────────────────────────────
function SortHeader({
  label,
  k,
  current,
  dir,
  onClick,
}: {
  label: string;
  k: SortKey;
  current: SortKey;
  dir: SortDir;
  onClick: (k: SortKey) => void;
}) {
  const active = current === k;
  return (
    <button
      onClick={() => onClick(k)}
      className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-[#9CA3AF] hover:text-[#6B7280] transition-colors text-left group"
      style={{ fontFamily: "var(--font-poppins)" }}
    >
      <span>{label}</span>
      <span className={`transition-opacity ${active ? "opacity-100" : "opacity-0 group-hover:opacity-50"}`}>
        {active && dir === "desc" ? (
          <ChevronDown className="size-3" />
        ) : (
          <ChevronUp className="size-3" />
        )}
      </span>
    </button>
  );
}

// ─── Empty State ─────────────────────────────────────────
function EmptyState({
  hasPeople,
  onInvite,
  onAddMember,
}: {
  hasPeople: boolean;
  onInvite: () => void;
  onAddMember: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
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
        {hasPeople ? "No matching results" : "Your directory is empty"}
      </h3>
      <p
        className="text-[#6B7280] text-sm mb-5 max-w-sm"
        style={{ fontFamily: "var(--font-source-sans)" }}
      >
        {hasPeople
          ? "Try adjusting your filters or search."
          : "Invite a team member or add your first congregation member to get started."}
      </p>
      {!hasPeople && (
        <div className="flex items-center gap-3">
          <button
            onClick={onInvite}
            className="flex items-center gap-2 h-10 px-4 rounded-xl border border-[#E5E7EB] bg-white text-[13px] font-semibold text-[#2D333A] hover:bg-[#F4F5F7] transition-colors"
            style={{ fontFamily: "var(--font-poppins)" }}
          >
            Invite Team Member
          </button>
          <button
            onClick={onAddMember}
            className="flex items-center gap-2 h-10 px-4 rounded-xl bg-[#5CE1A5] text-[#060C09] text-[13px] font-semibold hover:shadow-md transition-all"
            style={{ fontFamily: "var(--font-poppins)" }}
          >
            Add Congregation Member
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Remove Confirmation ────────────────────────────────
function RemoveConfirm({
  person,
  isRemoving,
  error,
  onCancel,
  onConfirm,
}: {
  person: DirectoryPerson;
  isRemoving: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const message =
    person.type === "profile"
      ? "This will remove their access to the organization. Their assignments will be cleared, but their auth account will remain."
      : "This will permanently remove this person from your member roster.";

  return (
    <>
      <div
        className="fixed inset-0 bg-black/30 z-[90]"
        onClick={() => !isRemoving && onCancel()}
      />
      <div className="fixed inset-0 z-[91] flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
          <h3
            className="text-lg font-semibold text-[#2D333A] mb-2"
            style={{ fontFamily: "var(--font-poppins)" }}
          >
            Remove {person.full_name}?
          </h3>
          <p
            className="text-sm text-[#6B7280] mb-4"
            style={{ fontFamily: "var(--font-source-sans)" }}
          >
            {message}
          </p>
          {error && (
            <p
              className="text-sm text-red-600 mb-3 px-3 py-2 rounded-lg bg-red-50 border border-red-100"
              style={{ fontFamily: "var(--font-source-sans)" }}
            >
              {error}
            </p>
          )}
          <div className="flex items-center justify-end gap-3">
            <button
              onClick={onCancel}
              disabled={isRemoving}
              className="px-4 py-2.5 rounded-xl border border-[#E5E7EB] text-sm font-medium text-[#6B7280] hover:bg-[#F4F5F7] transition-colors"
              style={{ fontFamily: "var(--font-poppins)" }}
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              disabled={isRemoving}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition-colors disabled:opacity-50"
              style={{ fontFamily: "var(--font-poppins)" }}
            >
              {isRemoving && <Loader2 className="size-4 animate-spin" />}
              Remove
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
