"use client";

import { useEffect, useState } from "react";
import { Plus, Users } from "lucide-react";
import { getHuddles, type HuddleListItem } from "@/app/actions/huddles";
import { HuddleCard } from "./huddle-card";
import { CreateHuddleModal } from "./create-huddle-modal";

interface HuddleListProps {
  initial: HuddleListItem[];
  initialFilter: "upcoming" | "past" | "all";
  canCreate: boolean;
  departments: { id: string; name: string; color: string }[];
  orgProfiles: { id: string; full_name: string }[];
}

export function HuddleList({
  initial,
  initialFilter,
  canCreate,
  departments,
  orgProfiles,
}: HuddleListProps) {
  const [filter, setFilter] = useState<"upcoming" | "past" | "all">(initialFilter);
  const [items, setItems] = useState<HuddleListItem[]>(initial);
  const [loading, setLoading] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getHuddles({ filter }).then((res) => {
      if (cancelled) return;
      if (res.success && res.data) setItems(res.data);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [filter]);

  return (
    <div className="max-w-4xl mx-auto px-5 py-6">
      <header className="flex items-start justify-between gap-3 mb-5 flex-wrap">
        <div>
          <h1
            className="text-2xl text-[#0F172A]"
            style={{ fontFamily: "var(--font-poppins)", fontWeight: 700 }}
          >
            Huddles
          </h1>
          <p
            className="text-[13px] text-[#6B7280] mt-0.5"
            style={{ fontFamily: "var(--font-source-sans)" }}
          >
            Make every meeting actionable.
          </p>
        </div>
        {canCreate && (
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="h-9 px-3.5 rounded-xl bg-[#5CE1A5] text-white text-[13px] font-semibold inline-flex items-center gap-1.5 hover:bg-[#4DD395] transition-colors"
            style={{ fontFamily: "var(--font-poppins)" }}
          >
            <Plus className="size-3.5" />
            New Huddle
          </button>
        )}
      </header>

      <nav className="flex items-center gap-1 mb-4">
        <FilterTab
          active={filter === "upcoming"}
          onClick={() => setFilter("upcoming")}
        >
          Upcoming
        </FilterTab>
        <FilterTab
          active={filter === "past"}
          onClick={() => setFilter("past")}
        >
          Past
        </FilterTab>
        <FilterTab active={filter === "all"} onClick={() => setFilter("all")}>
          All
        </FilterTab>
      </nav>

      {loading ? (
        <p
          className="text-[13px] text-[#9CA3AF] text-center py-6"
          style={{ fontFamily: "var(--font-source-sans)" }}
        >
          Loading…
        </p>
      ) : items.length === 0 ? (
        <EmptyState canCreate={canCreate} onCreate={() => setCreateOpen(true)} />
      ) : (
        <ul className="space-y-2">
          {items.map((h) => (
            <li key={h.id}>
              <HuddleCard huddle={h} />
            </li>
          ))}
        </ul>
      )}

      <CreateHuddleModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        departments={departments}
        orgProfiles={orgProfiles}
      />
    </div>
  );
}

function FilterTab({
  children,
  active,
  onClick,
}: {
  children: React.ReactNode;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-8 px-3 rounded-lg text-[12.5px] transition-colors ${
        active
          ? "bg-[#5CE1A5]/15 text-[#059669]"
          : "text-[#6B7280] hover:bg-[#F4F5F7] hover:text-[#2D333A]"
      }`}
      style={{
        fontFamily: "var(--font-poppins)",
        fontWeight: active ? 700 : 600,
      }}
    >
      {children}
    </button>
  );
}

function EmptyState({
  canCreate,
  onCreate,
}: {
  canCreate: boolean;
  onCreate: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-12 px-6 bg-white border border-dashed border-[#E5E7EB] rounded-2xl">
      <div
        className="size-12 rounded-2xl flex items-center justify-center mb-3"
        style={{ backgroundColor: "rgba(92, 225, 165, 0.10)" }}
      >
        <Users className="size-5 text-[#5CE1A5]" />
      </div>
      <h2
        className="text-[16px] text-[#0F172A]"
        style={{ fontFamily: "var(--font-poppins)", fontWeight: 700 }}
      >
        No huddles yet
      </h2>
      <p
        className="text-[13px] text-[#6B7280] max-w-sm mt-1 mb-3"
        style={{ fontFamily: "var(--font-source-sans)" }}
      >
        Plan a meeting, invite your team, and capture the decisions
        and follow-ups in one place.
      </p>
      {canCreate && (
        <button
          type="button"
          onClick={onCreate}
          className="h-9 px-4 rounded-xl bg-[#5CE1A5] text-white text-[13px] font-semibold inline-flex items-center gap-1.5 hover:bg-[#4DD395] transition-colors"
          style={{ fontFamily: "var(--font-poppins)" }}
        >
          <Plus className="size-3.5" />
          Create your first huddle
        </button>
      )}
    </div>
  );
}
