"use client";

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Calendar as CalendarIcon,
  Search,
  Plus,
  Clock,
  MapPin,
  Users,
  X,
} from "lucide-react";
import { EventModal, type Department } from "./event-modal";
import { useRouter } from "next/navigation";

// ─── Types ──────────────────────────────────────────────

type EventTypeValue =
  | "general"
  | "service"
  | "meeting"
  | "rehearsal"
  | "class"
  | "outreach"
  | "social"
  | "other";

type EventStatusValue = "confirmed" | "tentative" | "cancelled";

type TabFilter = "upcoming" | "past" | "all";

export interface EventData {
  id: string;
  title: string;
  description: string | null;
  event_type: EventTypeValue;
  starts_at: string;
  ends_at: string | null;
  is_all_day: boolean;
  location: string | null;
  location_type: string;
  color: string;
  status: EventStatusValue;
  department_id: string | null;
  department_name: string | null;
  department_color: string | null;
  attendee_count: number;
}

interface EventsViewProps {
  events: EventData[];
  departments: Department[];
}

// ─── Event Type Colors ──────────────────────────────────

const EVENT_TYPE_CONFIG: Record<
  EventTypeValue,
  { label: string; color: string }
> = {
  service: { label: "Service", color: "#5CE1A5" },
  meeting: { label: "Meeting", color: "#3B82F6" },
  rehearsal: { label: "Rehearsal", color: "#8B5CF6" },
  class: { label: "Class", color: "#F59E0B" },
  outreach: { label: "Outreach", color: "#EC4899" },
  social: { label: "Social", color: "#10B981" },
  general: { label: "General", color: "#6B7280" },
  other: { label: "Other", color: "#6B7280" },
};

const STATUS_CONFIG: Record<EventStatusValue, { label: string; color: string }> = {
  confirmed: { label: "Confirmed", color: "#10B981" },
  tentative: { label: "Tentative", color: "#F59E0B" },
  cancelled: { label: "Cancelled", color: "#EF4444" },
};

const EVENT_TYPES: EventTypeValue[] = [
  "service",
  "meeting",
  "rehearsal",
  "class",
  "outreach",
  "social",
  "general",
  "other",
];

// ─── Helpers ────────────────────────────────────────────

function formatDate(dateStr: string): { day: string; month: string; weekday: string } {
  const date = new Date(dateStr);
  return {
    day: date.getDate().toString(),
    month: date.toLocaleDateString("en-US", { month: "short" }).toUpperCase(),
    weekday: date.toLocaleDateString("en-US", { weekday: "short" }),
  };
}

function formatTime(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function formatTimeRange(start: string, end: string | null): string {
  const startTime = formatTime(start);
  if (!end) return startTime;
  const endTime = formatTime(end);
  return `${startTime} - ${endTime}`;
}

// ─── Animations ─────────────────────────────────────────

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.04 } },
} as const;

const fadeUp = {
  hidden: { opacity: 0, y: 8 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: "spring" as const, stiffness: 140, damping: 18 },
  },
};

// ─── Event Card ─────────────────────────────────────────

function EventCard({ event }: { event: EventData }) {
  const dateInfo = formatDate(event.starts_at);
  const typeConfig = EVENT_TYPE_CONFIG[event.event_type] || EVENT_TYPE_CONFIG.general;
  const statusConfig = STATUS_CONFIG[event.status] || STATUS_CONFIG.confirmed;

  return (
    <motion.div
      variants={fadeUp}
      className="bg-white rounded-2xl border border-[#E5E7EB]/50 cursor-pointer group transition-all duration-300"
      style={{
        boxShadow:
          "0 4px 20px -2px rgba(0,0,0,0.02), 0 1px 4px -1px rgba(0,0,0,0.02)",
      }}
      whileHover={{
        boxShadow: "0 12px 30px -8px rgba(0,0,0,0.08)",
        borderColor: "#D1D5DB",
      }}
    >
      <div className="p-5 flex items-start gap-5">
        {/* Left: Date Block */}
        <div
          className="shrink-0 w-16 h-16 rounded-xl flex flex-col items-center justify-center border"
          style={{
            backgroundColor: `${event.color || typeConfig.color}08`,
            borderColor: `${event.color || typeConfig.color}20`,
          }}
        >
          <span
            className="text-[22px] leading-none text-[#2D333A]"
            style={{ fontFamily: "var(--font-poppins)", fontWeight: 700 }}
          >
            {dateInfo.day}
          </span>
          <span
            className="text-[11px] tracking-wider mt-0.5"
            style={{
              fontFamily: "var(--font-poppins)",
              fontWeight: 600,
              color: event.color || typeConfig.color,
            }}
          >
            {dateInfo.month}
          </span>
        </div>

        {/* Center: Details */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            {/* Event type badge */}
            <span
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] uppercase tracking-wider"
              style={{
                fontFamily: "var(--font-poppins)",
                fontWeight: 700,
                backgroundColor: `${typeConfig.color}14`,
                color: typeConfig.color,
              }}
            >
              <div
                className="size-1.5 rounded-full"
                style={{ backgroundColor: typeConfig.color }}
              />
              {typeConfig.label}
            </span>
            {event.status !== "confirmed" && (
              <span
                className="px-2 py-0.5 rounded-md text-[10px] uppercase tracking-wider"
                style={{
                  fontFamily: "var(--font-poppins)",
                  fontWeight: 700,
                  backgroundColor: `${statusConfig.color}10`,
                  color: statusConfig.color,
                }}
              >
                {statusConfig.label}
              </span>
            )}
          </div>

          <h3
            className="text-[16px] text-[#2D333A] mb-1.5 group-hover:text-[#5CE1A5] transition-colors truncate"
            style={{ fontFamily: "var(--font-poppins)", fontWeight: 600 }}
          >
            {event.title}
          </h3>

          <div className="flex flex-wrap items-center gap-3 text-[#9CA3AF]">
            <span
              className="flex items-center gap-1 text-[13px]"
              style={{ fontFamily: "var(--font-source-sans)" }}
            >
              <Clock className="size-3.5" />
              {event.is_all_day
                ? "All Day"
                : formatTimeRange(event.starts_at, event.ends_at)}
            </span>
            {event.location && (
              <span
                className="flex items-center gap-1 text-[13px]"
                style={{ fontFamily: "var(--font-source-sans)" }}
              >
                <MapPin className="size-3.5" />
                {event.location}
              </span>
            )}
          </div>
        </div>

        {/* Right: Meta */}
        <div className="shrink-0 flex flex-col items-end gap-2">
          {event.attendee_count > 0 && (
            <span
              className="flex items-center gap-1 text-[12px] text-[#6B7280]"
              style={{
                fontFamily: "var(--font-source-sans)",
                fontWeight: 500,
              }}
            >
              <Users className="size-3.5" />
              {event.attendee_count}
            </span>
          )}
          {event.department_name && (
            <span
              className="px-2 py-0.5 rounded-md text-[10px] uppercase tracking-wider"
              style={{
                fontFamily: "var(--font-poppins)",
                fontWeight: 600,
                backgroundColor: `${event.department_color || "#6B7280"}14`,
                color: event.department_color || "#6B7280",
              }}
            >
              {event.department_name}
            </span>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// ─── Component ──────────────────────────────────────────

export function EventsView({ events, departments }: EventsViewProps) {
  const router = useRouter();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [tabFilter, setTabFilter] = useState<TabFilter>("upcoming");
  const [typeFilter, setTypeFilter] = useState<EventTypeValue | "all">("all");
  const [search, setSearch] = useState("");

  const now = new Date().toISOString();

  const filteredEvents = useMemo(() => {
    return events
      .filter((e) => {
        // Tab filter
        if (tabFilter === "upcoming" && e.starts_at < now) return false;
        if (tabFilter === "past" && e.starts_at >= now) return false;
        // Type filter
        if (typeFilter !== "all" && e.event_type !== typeFilter) return false;
        // Search
        if (search) {
          const q = search.toLowerCase();
          if (
            !e.title.toLowerCase().includes(q) &&
            !e.description?.toLowerCase().includes(q) &&
            !e.location?.toLowerCase().includes(q)
          )
            return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (tabFilter === "past") {
          return new Date(b.starts_at).getTime() - new Date(a.starts_at).getTime();
        }
        return new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime();
      });
  }, [events, tabFilter, typeFilter, search, now]);

  const tabs: { key: TabFilter; label: string }[] = [
    { key: "upcoming", label: "Upcoming" },
    { key: "past", label: "Past" },
    { key: "all", label: "All Events" },
  ];

  return (
    <div className="h-full flex flex-col overflow-y-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 px-4 sm:px-6 lg:px-8 pt-4 sm:pt-6 lg:pt-8">
        <div>
          <h1
            className="text-[24px] text-[#2D333A] leading-tight"
            style={{ fontFamily: "var(--font-poppins)", fontWeight: 700 }}
          >
            Events
          </h1>
          <p
            className="text-[15px] text-[#6B7280] mt-1"
            style={{ fontFamily: "var(--font-source-sans)" }}
          >
            Plan, organize, and manage church events.
          </p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="px-5 py-2.5 rounded-xl text-white text-[14px] hover:brightness-105 active:scale-[0.98] transition-all flex items-center gap-2 shrink-0"
          style={{
            fontFamily: "var(--font-poppins)",
            fontWeight: 600,
            backgroundColor: "#2D333A",
          }}
        >
          <Plus className="size-4" /> Create Event
        </button>
      </div>

      {/* Content */}
      <div className="p-4 sm:p-6 lg:p-8 max-w-[1400px] mx-auto w-full flex-1 flex flex-col space-y-6">
        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            {/* Tab pills */}
            <div className="flex items-center bg-[#F4F5F7] rounded-xl p-0.5">
              {tabs.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setTabFilter(tab.key)}
                  className="px-3 py-1.5 rounded-lg text-[12px] transition-all"
                  style={{
                    fontFamily: "var(--font-poppins)",
                    fontWeight: tabFilter === tab.key ? 600 : 500,
                    backgroundColor:
                      tabFilter === tab.key ? "white" : "transparent",
                    color: tabFilter === tab.key ? "#2D333A" : "#9CA3AF",
                    boxShadow:
                      tabFilter === tab.key
                        ? "0 1px 3px rgba(0,0,0,0.08)"
                        : "none",
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Type filter pills */}
            <div className="flex items-center gap-1 flex-wrap">
              <button
                onClick={() => setTypeFilter("all")}
                className="px-2.5 py-1 rounded-lg border text-[11px] transition-all"
                style={{
                  fontFamily: "var(--font-poppins)",
                  fontWeight: typeFilter === "all" ? 600 : 500,
                  borderColor: typeFilter === "all" ? "#5CE1A5" : "#E5E7EB",
                  backgroundColor:
                    typeFilter === "all" ? "#5CE1A508" : "white",
                  color: typeFilter === "all" ? "#5CE1A5" : "#9CA3AF",
                }}
              >
                All
              </button>
              {EVENT_TYPES.map((type) => {
                const config = EVENT_TYPE_CONFIG[type];
                const active = typeFilter === type;
                return (
                  <button
                    key={type}
                    onClick={() => setTypeFilter(type)}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg border text-[11px] transition-all"
                    style={{
                      fontFamily: "var(--font-poppins)",
                      fontWeight: active ? 600 : 500,
                      borderColor: active ? config.color : "#E5E7EB",
                      backgroundColor: active
                        ? `${config.color}08`
                        : "white",
                      color: active ? config.color : "#9CA3AF",
                    }}
                  >
                    <div
                      className="size-1.5 rounded-full"
                      style={{
                        backgroundColor: active ? config.color : "#D1D5DB",
                      }}
                    />
                    {config.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Search */}
          <div className="relative w-full sm:w-auto">
            <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]" />
            <input
              type="text"
              placeholder="Search events..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full sm:w-64 pl-9 pr-3 py-2 rounded-xl border border-[#E5E7EB] text-[13px] text-[#2D333A] placeholder-[#9CA3AF] focus:border-[#5CE1A5] focus:outline-none transition-all bg-white"
              style={{ fontFamily: "var(--font-source-sans)" }}
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9CA3AF] hover:text-[#6B7280]"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Events List */}
        <AnimatePresence mode="wait">
          {filteredEvents.length === 0 ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="bg-white rounded-2xl border border-[#E5E7EB]/50 py-16"
              style={{
                boxShadow:
                  "0 4px 20px -2px rgba(0,0,0,0.02), 0 1px 4px -1px rgba(0,0,0,0.02)",
              }}
            >
              <div className="text-center">
                <div
                  className="size-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
                  style={{ backgroundColor: "rgba(92, 225, 165, 0.08)" }}
                >
                  <CalendarIcon className="size-8 text-[#5CE1A5]" />
                </div>
                <h3
                  className="text-[18px] text-[#2D333A] mb-2"
                  style={{
                    fontFamily: "var(--font-poppins)",
                    fontWeight: 600,
                  }}
                >
                  {search || typeFilter !== "all"
                    ? "No matching events"
                    : "No events yet"}
                </h3>
                <p
                  className="text-[14px] text-[#9CA3AF] max-w-md mx-auto mb-6"
                  style={{ fontFamily: "var(--font-source-sans)" }}
                >
                  {search || typeFilter !== "all"
                    ? "Try adjusting your filters to find what you're looking for."
                    : "Create your first event to start planning."}
                </p>
                <button
                  onClick={() => setIsModalOpen(true)}
                  className="px-5 py-2.5 rounded-xl text-white text-[14px] hover:brightness-105 transition-all inline-flex items-center gap-2"
                  style={{
                    fontFamily: "var(--font-poppins)",
                    fontWeight: 600,
                    backgroundColor: "#5CE1A5",
                    boxShadow: "0 4px 14px -2px rgba(92, 225, 165, 0.4)",
                  }}
                >
                  <Plus className="size-4" /> Create Event
                </button>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="events"
              variants={staggerContainer}
              initial="hidden"
              animate="visible"
              className="space-y-3"
            >
              {filteredEvents.map((event) => (
                <EventCard key={event.id} event={event} />
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Create Event Modal */}
      <EventModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onCreated={() => router.refresh()}
        departments={departments}
      />
    </div>
  );
}
