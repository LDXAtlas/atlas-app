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
    <div className="min-h-screen w-full bg-[#F8FAFC]">
      <header className="w-full px-5 md:px-10 lg:px-12 pt-8 md:pt-12 pb-6 flex flex-col md:flex-row md:items-end justify-between gap-5 border-b border-[#E5E7EB]">
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
            className="w-full md:w-auto h-9 px-3.5 rounded-xl bg-[#3B82F6] text-white text-[13px] font-semibold flex items-center justify-center gap-1.5 hover:bg-[#2563EB] hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 active:shadow-none transition-all duration-200"
            style={{ fontFamily: "var(--font-poppins)" }}
          >
            <Plus className="size-3.5" />
            New Huddle
          </button>
        )}
      </header>

      {/* Main Content Area */}
      <div className="w-full px-5 md:px-10 lg:px-12 py-6">
        <div className="max-w-4xl mx-auto w-full">
          <nav
            className="flex items-center justify-center gap-2 mb-6 overflow-x-auto pb-2 -mx-2 px-2 md:mx-0 md:px-0"
            style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
          >
            <style>{`nav::-webkit-scrollbar { display: none; }`}</style>
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

          <div className="w-full">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-20 opacity-70">
                <svg 
                  className="size-6 text-[#3B82F6] animate-spin mb-3" 
                  xmlns="http://www.w3.org/2000/svg" 
                  fill="none" 
                  viewBox="0 0 24 24"
                >
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <p
                  className="text-[13px] text-[#9CA3AF]"
                  style={{ fontFamily: "var(--font-source-sans)" }}
                >
                  Loading huddles…
                </p>
              </div>
            ) : items.length === 0 ? (
              <EmptyState canCreate={canCreate} onCreate={() => setCreateOpen(true)} />
            ) : (
              <ul className="space-y-3">
                {items.map((h) => (
                  <li
                    key={h.id}
                    className="group transform transition-all duration-300 hover:-translate-y-1"
                  >
                    <HuddleCard huddle={h} />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

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
      className={`h-8 px-3 rounded-lg text-[12.5px] whitespace-nowrap transition-all duration-200 ${
        active
          ? "bg-[#3B82F6]/15 text-[#2563EB] shadow-sm"
          : "text-[#6B7280] hover:bg-white hover:text-[#2D333A] hover:shadow-sm border border-transparent hover:border-[#E5E7EB]"
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
    <div className="flex flex-col items-center justify-center text-center py-16 px-6 border-2 border-dashed border-[#E5E7EB] rounded-3xl transition-colors duration-300 hover:border-[#3B82F6]/30 hover:bg-[#F8FAFC]/50">
      <div
        className="size-12 rounded-2xl flex items-center justify-center mb-3 transition-transform duration-300 hover:scale-110"
        style={{ backgroundColor: "rgba(59, 130, 246, 0.10)" }}
      >
        <Users className="size-5 text-[#3B82F6]" />
      </div>
      <h2
        className="text-[16px] text-[#0F172A]"
        style={{ fontFamily: "var(--font-poppins)", fontWeight: 700 }}
      >
        No huddles yet
      </h2>
      <p
        className="text-[13px] text-[#6B7280] max-w-sm mt-1 mb-4 leading-relaxed"
        style={{ fontFamily: "var(--font-source-sans)" }}
      >
        Plan a meeting, invite your team, and capture the decisions
        and follow-ups in one place.
      </p>
      {canCreate && (
        <button
          type="button"
          onClick={onCreate}
          className="h-9 px-4 rounded-xl bg-[#3B82F6] text-white text-[13px] font-semibold inline-flex items-center gap-1.5 hover:bg-[#2563EB] hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200"
          style={{ fontFamily: "var(--font-poppins)" }}
        >
          <Plus className="size-3.5" />
          Create your first huddle
        </button>
      )}
    </div>
  );
}