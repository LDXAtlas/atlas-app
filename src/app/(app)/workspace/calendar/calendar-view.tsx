"use client";

import { useState, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Plus,
  Clock,
  MapPin,
  X,
  Trash2,
  Pencil,
  Copy,
  Link as LinkIcon,
  Repeat,
  Video,
  Check,
  FileText,
} from "lucide-react";
import {
  EventModal,
  type Department,
  type CustomEventType,
  type EventModalData,
} from "../events/event-modal";
import { deleteEvent } from "@/app/actions/events";
import { useRouter } from "next/navigation";

// ─── Types ──────────────────────────────────────────────

export interface CalendarEvent {
  id: string;
  title: string;
  description: string | null;
  event_type: string;
  starts_at: string;
  ends_at: string | null;
  is_all_day: boolean;
  location: string | null;
  location_type: string;
  virtual_url: string | null;
  color: string;
  status: string;
  department_id: string | null;
  departments: { id: string; name: string; color: string }[];
  recurrence_rule: string | null;
}

interface CalendarViewProps {
  events: CalendarEvent[];
  departments: Department[];
  customEventTypes: CustomEventType[];
  initialYear: number;
  initialMonth: number;
}

type CalendarViewMode = "month" | "week" | "day" | "agenda";

// ─── Event Type Colors ──────────────────────────────────

const EVENT_TYPE_COLORS: Record<string, string> = {
  service: "#5CE1A5",
  meeting: "#3B82F6",
  rehearsal: "#8B5CF6",
  class: "#F59E0B",
  outreach: "#EC4899",
  social: "#10B981",
  general: "#6B7280",
  other: "#6B7280",
};

const EVENT_TYPE_LABELS: Record<string, string> = {
  service: "Service",
  meeting: "Meeting",
  rehearsal: "Rehearsal",
  class: "Class",
  outreach: "Outreach",
  social: "Social",
  general: "General",
  other: "Other",
};

// ─── Helpers ────────────────────────────────────────────

const WEEK_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 1).getDay();
}

function isSameDay(d1: Date, d2: Date): boolean {
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  );
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
  const s = formatTime(start);
  if (!end) return s;
  return `${s} - ${formatTime(end)}`;
}

function formatFullDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function formatAgendaDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

function getWeekDays(year: number, month: number, day: number): Date[] {
  const date = new Date(year, month, day);
  const dayOfWeek = date.getDay();
  const result: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(date);
    d.setDate(date.getDate() - dayOfWeek + i);
    result.push(d);
  }
  return result;
}

function getHourFromDate(dateStr: string): number {
  const d = new Date(dateStr);
  return d.getHours() + d.getMinutes() / 60;
}

function describeRecurrence(rule: string | null): string | null {
  if (!rule) return null;
  const parts = rule.split(";");
  const map = new Map<string, string>();
  for (const p of parts) {
    const [k, v] = p.split("=");
    if (k && v) map.set(k, v);
  }
  const freq = (map.get("FREQ") || "").toLowerCase();
  const interval = parseInt(map.get("INTERVAL") || "1", 10);
  const freqLabel =
    freq === "daily"
      ? interval > 1 ? `every ${interval} days` : "daily"
      : freq === "weekly"
      ? interval > 1 ? `every ${interval} weeks` : "weekly"
      : freq === "monthly"
      ? interval > 1 ? `every ${interval} months` : "monthly"
      : freq === "yearly"
      ? interval > 1 ? `every ${interval} years` : "yearly"
      : freq;
  const days = map.get("BYDAY");
  let s = `Repeats ${freqLabel}`;
  if (days) s += ` on ${days}`;
  if (map.has("UNTIL")) s += ` until ${map.get("UNTIL")}`;
  if (map.has("COUNT")) s += ` (${map.get("COUNT")} times)`;
  return s;
}

function getAllEventDates(evt: CalendarEvent): Date[] {
  const baseDate = new Date(evt.starts_at);
  if (!evt.recurrence_rule) return [baseDate];
  
  const map = new Map<string, string>();
  for (const p of evt.recurrence_rule.split(";")) {
    const [k, v] = p.split("=");
    if (k && v) map.set(k, v);
  }
  
  const freq = (map.get("FREQ") || "").toLowerCase();
  if (!freq) return [baseDate];
  
  const interval = parseInt(map.get("INTERVAL") || "1", 10);
  const count = map.has("COUNT") ? parseInt(map.get("COUNT") || "10", 10) : null;
  const untilStr = map.get("UNTIL");
  const until = untilStr ? new Date(`${untilStr}T23:59:59`) : null;
  const weekdaysStr = map.get("BYDAY");

  const dates: Date[] = [];
  let currDate = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate());
  let occurrenceCount = 0;
  
  const jsDaysMap: Record<string, number> = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };
  const targetDays = weekdaysStr ? weekdaysStr.split(',').map(d => jsDaysMap[d]).filter(d => d !== undefined) : [baseDate.getDay()];
  
  let loops = 0;
  
  let limitCount = count !== null ? count : 730;
  
  if (freq === "weekly" && weekdaysStr) {
    let currentDay = new Date(currDate);
    // Align to Sunday to handle week boundaries
    let currentWeekStart = new Date(currentDay);
    currentWeekStart.setDate(currentWeekStart.getDate() - currentWeekStart.getDay());
    
    while (occurrenceCount < limitCount && loops < 3000) {
      loops++;
      if (until !== null && currentDay > until) break;
      
      // Only emit if it's on or after baseDate
      if (currentDay >= currDate && targetDays.includes(currentDay.getDay())) {
         dates.push(new Date(currentDay));
         occurrenceCount++;
      }
      
      currentDay.setDate(currentDay.getDate() + 1);
      
      if (currentDay.getDay() === 0) {
         currentDay.setDate(currentDay.getDate() + (interval - 1) * 7);
      }
    }
    return dates;
  }

  while (occurrenceCount < limitCount && loops < 3000) {
    loops++;
    if (until !== null && currDate > until) break;
    
    dates.push(new Date(currDate));
    occurrenceCount++;

    if (freq === "daily") {
      currDate.setDate(currDate.getDate() + interval);
    } else if (freq === "weekly") {
      currDate.setDate(currDate.getDate() + interval * 7);
    } else if (freq === "monthly") {
      currDate.setMonth(currDate.getMonth() + interval);
    } else if (freq === "yearly") {
      currDate.setFullYear(currDate.getFullYear() + interval);
    } else {
      break;
    }
  }
  
  return dates;
}

// ─── HOUR_LABELS ────────────────────────────────────────

const HOUR_LABELS: number[] = [];
for (let h = 6; h <= 22; h++) HOUR_LABELS.push(h);

function formatHourLabel(h: number): string {
  const ampm = h >= 12 ? "PM" : "AM";
  const hr = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return `${hr} ${ampm}`;
}

// ─── Event Detail Panel ─────────────────────────────────

function EventDetailPanel({
  event,
  onClose,
  onEdit,
  onDeleted,
}: {
  event: CalendarEvent;
  onClose: () => void;
  onEdit: () => void;
  onDeleted: () => void;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [copied, setCopied] = useState(false);
  const evtColor =
    event.color || EVENT_TYPE_COLORS[event.event_type] || "#6B7280";
  const recurrenceDesc = describeRecurrence(event.recurrence_rule);

  async function handleDelete() {
    setDeleting(true);
    const result = await deleteEvent(event.id);
    if (result.success) {
      onDeleted();
    }
    setDeleting(false);
  }

  function handleCopyUrl() {
    if (event.virtual_url) {
      navigator.clipboard.writeText(event.virtual_url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <>
      {/* Overlay */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        onClick={onClose}
        className="fixed inset-0 z-[90] bg-black/20"
      />
      {/* Panel */}
      <motion.div
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
        className="fixed right-0 top-0 bottom-0 z-[95] w-full max-w-[640px] bg-white border-l border-[#E5E7EB] shadow-2xl flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E5E7EB] shrink-0">
          <div className="flex items-center gap-2">
            <button
              onClick={onEdit}
              className="size-9 flex items-center justify-center rounded-xl text-[#6B7280] hover:text-[#2D333A] hover:bg-[#F4F5F7] transition-all"
              title="Edit"
            >
              <Pencil className="size-4" />
            </button>
            {!confirmDelete ? (
              <button
                onClick={() => setConfirmDelete(true)}
                className="size-9 flex items-center justify-center rounded-xl text-[#6B7280] hover:text-[#EF4444] hover:bg-[#FEF2F2] transition-all"
                title="Delete"
              >
                <Trash2 className="size-4" />
              </button>
            ) : (
              <div className="flex items-center gap-1.5">
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="px-3 py-1.5 rounded-lg text-[12px] text-white transition-all disabled:opacity-50"
                  style={{
                    fontFamily: "var(--font-poppins)",
                    fontWeight: 600,
                    backgroundColor: "#EF4444",
                  }}
                >
                  {deleting ? "..." : "Confirm"}
                </button>
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="px-3 py-1.5 rounded-lg text-[12px] text-[#6B7280] border border-[#E5E7EB] hover:bg-[#F4F5F7] transition-all"
                  style={{ fontFamily: "var(--font-poppins)", fontWeight: 500 }}
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            className="size-9 flex items-center justify-center rounded-xl text-[#9CA3AF] hover:text-[#2D333A] hover:bg-[#F4F5F7] transition-all"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-5">
          {/* Title */}
          <h2
            className="text-xl text-[#2D333A]"
            style={{ fontFamily: "var(--font-poppins)", fontWeight: 700 }}
          >
            {event.title}
          </h2>

          {/* Date/time */}
          <div className="flex items-center gap-2 text-[#6B7280]">
            <Clock className="size-4 shrink-0" />
            <span
              className="text-[14px]"
              style={{ fontFamily: "var(--font-source-sans)" }}
            >
              {event.is_all_day
                ? `All Day - ${formatFullDate(event.starts_at)}`
                : `${formatFullDate(event.starts_at)} ${formatTimeRange(event.starts_at, event.ends_at)}`}
            </span>
          </div>

          {/* Type badge */}
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-[12px] uppercase tracking-wider"
              style={{
                fontFamily: "var(--font-poppins)",
                fontWeight: 700,
                backgroundColor: `${evtColor}14`,
                color: evtColor,
              }}
            >
              <div
                className="size-2 rounded-full"
                style={{ backgroundColor: evtColor }}
              />
              {EVENT_TYPE_LABELS[event.event_type] || event.event_type}
            </span>
            {event.status !== "confirmed" && (
              <span
                className="px-3 py-1 rounded-lg text-[12px] uppercase tracking-wider"
                style={{
                  fontFamily: "var(--font-poppins)",
                  fontWeight: 700,
                  backgroundColor:
                    event.status === "cancelled"
                      ? "rgba(239,68,68,0.08)"
                      : "rgba(245,158,11,0.08)",
                  color: event.status === "cancelled" ? "#EF4444" : "#F59E0B",
                }}
              >
                {event.status}
              </span>
            )}
          </div>

          {/* Recurrence */}
          {recurrenceDesc && (
            <div className="flex items-center gap-2 text-[#6B7280]">
              <Repeat className="size-4 shrink-0" />
              <span
                className="text-[14px]"
                style={{ fontFamily: "var(--font-source-sans)" }}
              >
                {recurrenceDesc}
              </span>
            </div>
          )}

          {/* Location */}
          {event.location && (
            <div className="flex items-center gap-2 text-[#6B7280]">
              <MapPin className="size-4 shrink-0" />
              <span
                className="text-[14px]"
                style={{ fontFamily: "var(--font-source-sans)" }}
              >
                {event.location}
              </span>
            </div>
          )}

          {/* Virtual URL */}
          {event.virtual_url && (
            <div className="flex items-center gap-2">
              <Video className="size-4 shrink-0 text-[#6B7280]" />
              <a
                href={event.virtual_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[14px] text-[#3B82F6] hover:underline truncate flex-1"
                style={{ fontFamily: "var(--font-source-sans)" }}
              >
                {event.virtual_url}
              </a>
              <button
                onClick={handleCopyUrl}
                className="size-8 flex items-center justify-center rounded-lg text-[#9CA3AF] hover:text-[#2D333A] hover:bg-[#F4F5F7] transition-all shrink-0"
                title="Copy URL"
              >
                {copied ? (
                  <Check className="size-3.5 text-[#5CE1A5]" />
                ) : (
                  <Copy className="size-3.5" />
                )}
              </button>
            </div>
          )}

          {/* Description */}
          {event.description && (
            <div className="pt-2 border-t border-[#E5E7EB]">
              <h4
                className="text-[12px] text-[#9CA3AF] uppercase tracking-wider mb-2"
                style={{ fontFamily: "var(--font-poppins)", fontWeight: 600 }}
              >
                Description
              </h4>
              <p
                className="text-[14px] text-[#2D333A] leading-relaxed whitespace-pre-wrap"
                style={{ fontFamily: "var(--font-source-sans)" }}
              >
                {event.description}
              </p>
            </div>
          )}

          {/* Linked Files */}
          <div className="pt-2 border-t border-[#E5E7EB]">
            <div className="flex items-center justify-between mb-3">
              <h4
                className="text-[12px] text-[#9CA3AF] uppercase tracking-wider"
                style={{ fontFamily: "var(--font-poppins)", fontWeight: 600 }}
              >
                Linked Files
              </h4>
              <button
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] text-[#2D333A] hover:bg-[#F4F5F7] border border-[#E5E7EB] transition-all"
                style={{ fontFamily: "var(--font-poppins)", fontWeight: 600 }}
              >
                <LinkIcon className="size-3" />
                Link File
              </button>
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center justify-between p-3 rounded-xl border border-[#E5E7EB] hover:border-[#D1D5DB] transition-all group cursor-pointer">
                <div className="flex items-center gap-3">
                  <div className="size-8 rounded-lg bg-[#F4F5F7] flex items-center justify-center shrink-0">
                    <FileText className="size-4 text-[#6B7280]" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[13px] text-[#2D333A] truncate" style={{ fontFamily: "var(--font-poppins)", fontWeight: 600 }}>Service_Run_Sheet.pdf</p>
                    <p className="text-[11px] text-[#9CA3AF]" style={{ fontFamily: "var(--font-source-sans)" }}>Added today &middot; 2.4 MB</p>
                  </div>
                </div>
                <button className="opacity-0 group-hover:opacity-100 p-1.5 text-[#9CA3AF] hover:text-[#EF4444] rounded-md hover:bg-[#FEF2F2] transition-all">
                  <X className="size-3.5" />
                </button>
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl border border-[#E5E7EB] hover:border-[#D1D5DB] transition-all group cursor-pointer">
                <div className="flex items-center gap-3">
                  <div className="size-8 rounded-lg bg-[#F4F5F7] flex items-center justify-center shrink-0">
                    <FileText className="size-4 text-[#6B7280]" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[13px] text-[#2D333A] truncate" style={{ fontFamily: "var(--font-poppins)", fontWeight: 600 }}>Sermon_Notes.docx</p>
                    <p className="text-[11px] text-[#9CA3AF]" style={{ fontFamily: "var(--font-source-sans)" }}>Added yesterday &middot; 1.1 MB</p>
                  </div>
                </div>
                <button className="opacity-0 group-hover:opacity-100 p-1.5 text-[#9CA3AF] hover:text-[#EF4444] rounded-md hover:bg-[#FEF2F2] transition-all">
                  <X className="size-3.5" />
                </button>
              </div>
            </div>
          </div>

          {/* Department badges */}
          {event.departments.length > 0 && (
            <div className="pt-2 border-t border-[#E5E7EB]">
              <h4
                className="text-[12px] text-[#9CA3AF] uppercase tracking-wider mb-2"
                style={{ fontFamily: "var(--font-poppins)", fontWeight: 600 }}
              >
                Departments
              </h4>
              <div className="flex flex-wrap gap-2">
                {event.departments.map((dept) => (
                  <span
                    key={dept.id}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-[12px]"
                    style={{
                      fontFamily: "var(--font-poppins)",
                      fontWeight: 600,
                      backgroundColor: `${dept.color}14`,
                      color: dept.color,
                    }}
                  >
                    <div
                      className="size-1.5 rounded-full"
                      style={{ backgroundColor: dept.color }}
                    />
                    {dept.name}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </>
  );
}

// ─── Mini Calendar ──────────────────────────────────────

function MiniCalendar({
  year,
  month,
  today,
  eventDays,
  onDayClick,
  onPrev,
  onNext,
}: {
  year: number;
  month: number;
  today: Date;
  eventDays: Set<string>;
  onDayClick: (date: Date) => void;
  onPrev: () => void;
  onNext: () => void;
}) {
  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <button
          onClick={onPrev}
          className="size-6 flex items-center justify-center rounded text-[#9CA3AF] hover:text-[#2D333A] transition-colors"
        >
          <ChevronLeft className="size-3.5" />
        </button>
        <span
          className="text-[12px] text-[#2D333A]"
          style={{ fontFamily: "var(--font-poppins)", fontWeight: 600 }}
        >
          {MONTH_NAMES[month].slice(0, 3)} {year}
        </span>
        <button
          onClick={onNext}
          className="size-6 flex items-center justify-center rounded text-[#9CA3AF] hover:text-[#2D333A] transition-colors"
        >
          <ChevronRight className="size-3.5" />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-0">
        {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
          <div
            key={i}
            className="h-6 flex items-center justify-center text-[9px] text-[#9CA3AF]"
            style={{ fontFamily: "var(--font-poppins)", fontWeight: 600 }}
          >
            {d}
          </div>
        ))}
        {Array.from({ length: firstDay }).map((_, i) => (
          <div key={`blank-${i}`} className="h-6" />
        ))}
        {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
          const date = new Date(year, month, day);
          const isToday = isSameDay(date, today);
          const key = `${year}-${month}-${day}`;
          const hasEvent = eventDays.has(key);

          return (
            <button
              key={day}
              onClick={() => onDayClick(date)}
              className="h-6 flex flex-col items-center justify-center rounded transition-all relative"
              style={{
                backgroundColor: isToday ? "#5CE1A5" : "transparent",
                color: isToday ? "white" : "#2D333A",
              }}
            >
              <span
                className="text-[10px] leading-none"
                style={{ fontFamily: "var(--font-poppins)", fontWeight: isToday ? 700 : 500 }}
              >
                {day}
              </span>
              {hasEvent && !isToday && (
                <div
                  className="size-1 rounded-full absolute bottom-0.5"
                  style={{ backgroundColor: "#5CE1A5" }}
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Month Grid ─────────────────────────────────────────

function MonthGrid({
  year,
  month,
  today,
  getEventsForDay,
  onDayClick,
  onEventClick,
}: {
  year: number;
  month: number;
  today: Date;
  getEventsForDay: (d: Date) => CalendarEvent[];
  onDayClick: (d: Date) => void;
  onEventClick: (e: CalendarEvent) => void;
}) {
  const daysInMonth = getDaysInMonth(year, month);
  const firstDayOfWeek = getFirstDayOfMonth(year, month);

  return (
    <motion.div
      key={`month-${year}-${month}`}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.2 }}
      className="flex-1 flex flex-col min-h-0"
    >
      <div
        className="flex-1 grid grid-cols-7 border border-[#E5E7EB]/50 rounded-2xl overflow-hidden bg-white"
        style={{
          boxShadow:
            "0 4px 20px -2px rgba(0,0,0,0.03), 0 1px 4px -1px rgba(0,0,0,0.02)",
        }}
      >
        {/* Weekday headers */}
        {WEEK_LABELS.map((label) => (
          <div
            key={label}
            className="h-10 border-b border-r border-[#E5E7EB]/50 last:border-r-0 bg-[#F4F5F7]/40 flex items-center justify-center"
          >
            <span
              className="text-[10px] text-[#9CA3AF] uppercase tracking-widest"
              style={{
                fontFamily: "var(--font-poppins)",
                fontWeight: 600,
              }}
            >
              {label}
            </span>
          </div>
        ))}

        {/* Leading blanks */}
        {Array.from({ length: firstDayOfWeek }).map((_, i) => (
          <div
            key={`blank-${i}`}
            className="border-b border-r border-[#E5E7EB]/50 last:border-r-0 bg-[#FAFAFA]/50 min-h-[90px]"
          />
        ))}

        {/* Day cells */}
        {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
          const date = new Date(year, month, day);
          const dayEvents = getEventsForDay(date);
          const isToday = isSameDay(date, today);
          const hasEvents = dayEvents.length > 0;

          const uniqueColors = [
            ...new Set(
              dayEvents.map(
                (e) =>
                  e.color || EVENT_TYPE_COLORS[e.event_type] || "#6B7280",
              ),
            ),
          ];

          return (
            <div
              key={day}
              onClick={() => onDayClick(date)}
              className="border-b border-r border-[#E5E7EB]/50 last:border-r-0 p-1.5 transition-all cursor-pointer relative group min-h-[90px] hover:bg-[#F4F5F7]/30"
            >
              <div className="flex items-center justify-between mb-1">
                <span
                  className="size-7 flex items-center justify-center rounded-lg text-[13px]"
                  style={{
                    fontFamily: "var(--font-poppins)",
                    fontWeight: 600,
                    backgroundColor: isToday ? "#5CE1A5" : "transparent",
                    color: isToday ? "white" : "#2D333A",
                  }}
                >
                  {day}
                </span>
                {hasEvents && (
                  <div className="flex gap-0.5">
                    {uniqueColors.slice(0, 4).map((c, idx) => (
                      <div
                        key={idx}
                        className="size-1.5 rounded-full"
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-0.5">
                {dayEvents.slice(0, 2).map((evt) => {
                  const evtColor =
                    evt.color ||
                    EVENT_TYPE_COLORS[evt.event_type] ||
                    "#6B7280";
                  return (
                    <div
                      key={`${evt.id}-${evt.starts_at}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        onEventClick(evt);
                      }}
                      className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] truncate border cursor-pointer hover:brightness-95 transition-all"
                      style={{
                        fontFamily: "var(--font-poppins)",
                        fontWeight: 600,
                        backgroundColor: `${evtColor}10`,
                        color: evtColor,
                        borderColor: `${evtColor}20`,
                      }}
                    >
                      <div
                        className="size-1.5 rounded-full shrink-0"
                        style={{ backgroundColor: evtColor }}
                      />
                      <span className="truncate">{evt.title}</span>
                    </div>
                  );
                })}
                {dayEvents.length > 2 && (
                  <p
                    className="text-[9px] text-[#9CA3AF] uppercase tracking-wider pl-1"
                    style={{
                      fontFamily: "var(--font-poppins)",
                      fontWeight: 600,
                    }}
                  >
                    +{dayEvents.length - 2} more
                  </p>
                )}
              </div>

              {hasEvents && (
                <div className="absolute bottom-1 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <span
                    className="text-[8px] text-[#5CE1A5] uppercase tracking-widest"
                    style={{
                      fontFamily: "var(--font-poppins)",
                      fontWeight: 600,
                    }}
                  >
                    View
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}

// ─── Week View ──────────────────────────────────────────

function WeekGrid({
  year,
  month,
  day,
  today,
  getEventsForDay,
  onEventClick,
  onDoubleClickSlot,
}: {
  year: number;
  month: number;
  day: number;
  today: Date;
  getEventsForDay: (d: Date) => CalendarEvent[];
  onEventClick: (e: CalendarEvent) => void;
  onDoubleClickSlot: (date: Date, hour: number) => void;
}) {
  const weekDays = getWeekDays(year, month, day);

  return (
    <motion.div
      key={`week-${year}-${month}-${day}`}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.2 }}
      className="flex-1 flex flex-col min-h-0"
    >
      <div
        className="flex-1 flex flex-col bg-white rounded-2xl border border-[#E5E7EB]/50 overflow-hidden"
        style={{
          boxShadow:
            "0 4px 20px -2px rgba(0,0,0,0.03), 0 1px 4px -1px rgba(0,0,0,0.02)",
        }}
      >
        {/* Day headers */}
        <div className="grid grid-cols-[60px_repeat(7,1fr)] border-b border-[#E5E7EB]/50 shrink-0">
          <div className="h-12 border-r border-[#E5E7EB]/50" />
          {weekDays.map((d, i) => {
            const isToday = isSameDay(d, today);
            return (
              <div
                key={i}
                className="h-12 border-r border-[#E5E7EB]/50 last:border-r-0 flex items-center justify-center gap-2"
              >
                <span
                  className="text-[10px] uppercase tracking-widest text-[#9CA3AF]"
                  style={{
                    fontFamily: "var(--font-poppins)",
                    fontWeight: 600,
                  }}
                >
                  {WEEK_LABELS[d.getDay()]}
                </span>
                <span
                  className="size-6 flex items-center justify-center rounded-lg text-[13px]"
                  style={{
                    fontFamily: "var(--font-poppins)",
                    fontWeight: 600,
                    backgroundColor: isToday ? "#5CE1A5" : "transparent",
                    color: isToday ? "white" : "#2D333A",
                  }}
                >
                  {d.getDate()}
                </span>
              </div>
            );
          })}
        </div>

        {/* Hour grid */}
        <div className="flex-1 overflow-y-auto">
          <div className="grid grid-cols-[60px_repeat(7,1fr)] relative">
            {HOUR_LABELS.map((h) => (
              <div key={h} className="contents">
                <div className="h-14 border-b border-r border-[#E5E7EB]/50 flex items-start justify-end pr-2 pt-0.5">
                  <span
                    className="text-[10px] text-[#9CA3AF]"
                    style={{
                      fontFamily: "var(--font-source-sans)",
                      fontWeight: 500,
                    }}
                  >
                    {formatHourLabel(h)}
                  </span>
                </div>
                {weekDays.map((d, di) => {
                  const dayEvts = getEventsForDay(d);
                  const hourEvts = dayEvts.filter((evt) => {
                    if (evt.is_all_day) return false;
                    const startH = Math.floor(getHourFromDate(evt.starts_at));
                    return startH === h;
                  });

                  return (
                    <div
                      key={di}
                      onDoubleClick={() => onDoubleClickSlot(d, h)}
                      className="h-14 border-b border-r border-[#E5E7EB]/50 last:border-r-0 relative px-0.5 py-0.5"
                    >
                      {hourEvts.map((evt) => {
                        const evtColor =
                          evt.color ||
                          EVENT_TYPE_COLORS[evt.event_type] ||
                          "#6B7280";
                        return (
                          <div
                            key={`${evt.id}-${evt.starts_at}`}
                            onClick={() => onEventClick(evt)}
                            className="text-[10px] px-1.5 py-0.5 rounded truncate cursor-pointer border hover:brightness-95 transition-all"
                            style={{
                              fontFamily: "var(--font-poppins)",
                              fontWeight: 600,
                              backgroundColor: `${evtColor}18`,
                              color: evtColor,
                              borderColor: `${evtColor}30`,
                            }}
                          >
                            {evt.title}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Day View ───────────────────────────────────────────

function DayGrid({
  date,
  today,
  events,
  onEventClick,
  onDoubleClickSlot,
}: {
  date: Date;
  today: Date;
  events: CalendarEvent[];
  onEventClick: (e: CalendarEvent) => void;
  onDoubleClickSlot: (date: Date, hour: number) => void;
}) {
  const isToday = isSameDay(date, today);

  return (
    <motion.div
      key={`day-${date.toISOString()}`}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.2 }}
      className="flex-1 flex flex-col min-h-0"
    >
      <div
        className="flex-1 flex flex-col bg-white rounded-2xl border border-[#E5E7EB]/50 overflow-hidden"
        style={{
          boxShadow:
            "0 4px 20px -2px rgba(0,0,0,0.03), 0 1px 4px -1px rgba(0,0,0,0.02)",
        }}
      >
        {/* Day header */}
        <div className="h-12 border-b border-[#E5E7EB]/50 flex items-center justify-center gap-3 shrink-0">
          <span
            className="text-[10px] uppercase tracking-widest text-[#9CA3AF]"
            style={{ fontFamily: "var(--font-poppins)", fontWeight: 600 }}
          >
            {WEEK_LABELS[date.getDay()]}
          </span>
          <span
            className="size-8 flex items-center justify-center rounded-lg text-[16px]"
            style={{
              fontFamily: "var(--font-poppins)",
              fontWeight: 700,
              backgroundColor: isToday ? "#5CE1A5" : "transparent",
              color: isToday ? "white" : "#2D333A",
            }}
          >
            {date.getDate()}
          </span>
          <span
            className="text-[12px] text-[#6B7280]"
            style={{ fontFamily: "var(--font-source-sans)" }}
          >
            {MONTH_NAMES[date.getMonth()]} {date.getFullYear()}
          </span>
        </div>

        {/* All-day events */}
        {events.filter((e) => e.is_all_day).length > 0 && (
          <div className="px-4 py-2 border-b border-[#E5E7EB]/50 flex flex-wrap gap-2">
            {events
              .filter((e) => e.is_all_day)
              .map((evt) => {
                const evtColor =
                  evt.color ||
                  EVENT_TYPE_COLORS[evt.event_type] ||
                  "#6B7280";
                return (
                  <div
                    key={`${evt.id}-${evt.starts_at}`}
                    onClick={() => onEventClick(evt)}
                    className="px-3 py-1.5 rounded-lg text-[12px] cursor-pointer border hover:brightness-95 transition-all"
                    style={{
                      fontFamily: "var(--font-poppins)",
                      fontWeight: 600,
                      backgroundColor: `${evtColor}14`,
                      color: evtColor,
                      borderColor: `${evtColor}25`,
                    }}
                  >
                    {evt.title} &middot; All Day
                  </div>
                );
              })}
          </div>
        )}

        {/* Hour grid */}
        <div className="flex-1 overflow-y-auto">
          {HOUR_LABELS.map((h) => {
            const hourEvts = events.filter((evt) => {
              if (evt.is_all_day) return false;
              const startH = Math.floor(getHourFromDate(evt.starts_at));
              return startH === h;
            });

            return (
              <div
                key={h}
                onDoubleClick={() => onDoubleClickSlot(date, h)}
                className="flex border-b border-[#E5E7EB]/50 min-h-[56px]"
              >
                <div className="w-16 shrink-0 border-r border-[#E5E7EB]/50 flex items-start justify-end pr-2 pt-1">
                  <span
                    className="text-[10px] text-[#9CA3AF]"
                    style={{
                      fontFamily: "var(--font-source-sans)",
                      fontWeight: 500,
                    }}
                  >
                    {formatHourLabel(h)}
                  </span>
                </div>
                <div className="flex-1 p-1 space-y-1">
                  {hourEvts.map((evt) => {
                    const evtColor =
                      evt.color ||
                      EVENT_TYPE_COLORS[evt.event_type] ||
                      "#6B7280";
                    return (
                      <div
                        key={`${evt.id}-${evt.starts_at}`}
                        onClick={() => onEventClick(evt)}
                        className="px-3 py-2 rounded-lg cursor-pointer border hover:brightness-95 transition-all"
                        style={{
                          backgroundColor: `${evtColor}14`,
                          borderColor: `${evtColor}25`,
                        }}
                      >
                        <div className="flex items-center gap-2">
                          <div
                            className="size-2 rounded-full shrink-0"
                            style={{ backgroundColor: evtColor }}
                          />
                          <span
                            className="text-[13px] truncate"
                            style={{
                              fontFamily: "var(--font-poppins)",
                              fontWeight: 600,
                              color: evtColor,
                            }}
                          >
                            {evt.title}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 mt-1 ml-4 text-[#9CA3AF]">
                          <span
                            className="text-[11px]"
                            style={{ fontFamily: "var(--font-source-sans)" }}
                          >
                            {formatTimeRange(evt.starts_at, evt.ends_at)}
                          </span>
                          {evt.location && (
                            <span
                              className="flex items-center gap-1 text-[11px]"
                              style={{
                                fontFamily: "var(--font-source-sans)",
                              }}
                            >
                              <MapPin className="size-3" />
                              {evt.location}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}

// ─── Agenda View ────────────────────────────────────────

function AgendaView({
  events,
  onEventClick,
}: {
  events: CalendarEvent[];
  onEventClick: (e: CalendarEvent) => void;
}) {
  const now = new Date();
  const twoWeeksOut = new Date(now);
  twoWeeksOut.setDate(twoWeeksOut.getDate() + 14);

  // Group events by date
  const grouped = useMemo(() => {
    const upcoming = events
      .filter((e) => {
        const d = new Date(e.starts_at);
        return d >= new Date(now.getFullYear(), now.getMonth(), now.getDate()) &&
          d <= twoWeeksOut &&
          e.status !== "cancelled";
      })
      .sort(
        (a, b) =>
          new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime(),
      );

    const groups = new Map<string, { date: Date; events: CalendarEvent[] }>();
    for (const evt of upcoming) {
      const d = new Date(evt.starts_at);
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      if (!groups.has(key)) {
        groups.set(key, {
          date: new Date(d.getFullYear(), d.getMonth(), d.getDate()),
          events: [],
        });
      }
      groups.get(key)!.events.push(evt);
    }
    return Array.from(groups.values());
  }, [events]);

  if (grouped.length === 0) {
    return (
      <motion.div
        key="agenda-empty"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.2 }}
        className="flex-1 flex items-center justify-center"
      >
        <div
          className="bg-white rounded-2xl border border-[#E5E7EB]/50 p-12 text-center"
          style={{
            boxShadow:
              "0 4px 20px -2px rgba(0,0,0,0.02), 0 1px 4px -1px rgba(0,0,0,0.02)",
          }}
        >
          <div
            className="size-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
            style={{ backgroundColor: "rgba(92, 225, 165, 0.08)" }}
          >
            <CalendarIcon className="size-7 text-[#5CE1A5]" />
          </div>
          <h3
            className="text-[16px] text-[#2D333A] mb-2"
            style={{ fontFamily: "var(--font-poppins)", fontWeight: 600 }}
          >
            No upcoming events
          </h3>
          <p
            className="text-[14px] text-[#9CA3AF]"
            style={{ fontFamily: "var(--font-source-sans)" }}
          >
            Nothing scheduled for the next two weeks.
          </p>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      key="agenda"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.2 }}
      className="flex-1 overflow-y-auto"
    >
      <div className="space-y-4">
        {grouped.map((group) => (
          <div key={group.date.toISOString()}>
            {/* Date header */}
            <div className="flex items-center gap-3 mb-2">
              <h3
                className="text-[14px] text-[#2D333A] whitespace-nowrap"
                style={{ fontFamily: "var(--font-poppins)", fontWeight: 600 }}
              >
                {formatAgendaDate(group.date)}
              </h3>
              <div className="flex-1 h-px bg-[#E5E7EB]" />
            </div>

            {/* Events */}
            <div className="space-y-2">
              {group.events.map((evt) => {
                const evtColor =
                  evt.color ||
                  EVENT_TYPE_COLORS[evt.event_type] ||
                  "#6B7280";
                return (
                  <div
                    key={`${evt.id}-${evt.starts_at}`}
                    onClick={() => onEventClick(evt)}
                    className="flex items-start gap-3 p-4 bg-white rounded-2xl border border-[#E5E7EB]/50 cursor-pointer hover:border-[#D1D5DB] transition-all"
                    style={{
                      boxShadow:
                        "0 2px 8px -2px rgba(0,0,0,0.04)",
                    }}
                  >
                    <div
                      className="w-1 rounded-full self-stretch shrink-0 min-h-[40px]"
                      style={{ backgroundColor: evtColor }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] uppercase tracking-wider"
                          style={{
                            fontFamily: "var(--font-poppins)",
                            fontWeight: 700,
                            backgroundColor: `${evtColor}14`,
                            color: evtColor,
                          }}
                        >
                          <div
                            className="size-1.5 rounded-full"
                            style={{ backgroundColor: evtColor }}
                          />
                          {EVENT_TYPE_LABELS[evt.event_type] || evt.event_type}
                        </span>
                        {evt.departments.map((dept) => (
                          <span
                            key={dept.id}
                            className="px-2 py-0.5 rounded-md text-[10px] uppercase tracking-wider"
                            style={{
                              fontFamily: "var(--font-poppins)",
                              fontWeight: 600,
                              backgroundColor: `${dept.color}14`,
                              color: dept.color,
                            }}
                          >
                            {dept.name}
                          </span>
                        ))}
                      </div>
                      <h4
                        className="text-[14px] text-[#2D333A] truncate"
                        style={{
                          fontFamily: "var(--font-poppins)",
                          fontWeight: 600,
                        }}
                      >
                        {evt.title}
                      </h4>
                      <div className="flex items-center gap-3 mt-1 text-[#9CA3AF]">
                        <span
                          className="flex items-center gap-1 text-[12px]"
                          style={{ fontFamily: "var(--font-source-sans)" }}
                        >
                          <Clock className="size-3" />
                          {evt.is_all_day
                            ? "All Day"
                            : formatTimeRange(evt.starts_at, evt.ends_at)}
                        </span>
                        {evt.location && (
                          <span
                            className="flex items-center gap-1 text-[12px]"
                            style={{ fontFamily: "var(--font-source-sans)" }}
                          >
                            <MapPin className="size-3" />
                            {evt.location}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

// ─── Main Component ─────────────────────────────────────

export function CalendarView({
  events,
  departments,
  customEventTypes,
  initialYear,
  initialMonth,
}: CalendarViewProps) {
  const router = useRouter();
  const [year, setYear] = useState(initialYear);
  const [month, setMonth] = useState(initialMonth);
  const [selectedDay, setSelectedDay] = useState(new Date().getDate());
  const [viewMode, setViewMode] = useState<CalendarViewMode>("month");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [detailEvent, setDetailEvent] = useState<CalendarEvent | null>(null);
  const [editEvent, setEditEvent] = useState<EventModalData | null>(null);
  const [initialDate, setInitialDate] = useState<string>("");
  const [initialTime, setInitialTime] = useState<string>("");

  const today = new Date();

  // Expand recurring events
  const expandedEvents = useMemo(() => {
    const result: CalendarEvent[] = [];
    for (const evt of events) {
      if (evt.status === "cancelled") continue;
      
      const dates = getAllEventDates(evt);
      for (let i = 0; i < dates.length; i++) {
        const d = dates[i];
        const occEvent = { ...evt };
        
        const origStart = new Date(evt.starts_at);
        const newStart = new Date(origStart);
        newStart.setFullYear(d.getFullYear(), d.getMonth(), d.getDate());
        occEvent.starts_at = newStart.toISOString();
        
        if (evt.ends_at) {
          const origEnd = new Date(evt.ends_at);
          const dayDiff = Math.round((origEnd.getTime() - origStart.getTime()) / 86400000);
          const endD = new Date(d);
          endD.setDate(endD.getDate() + dayDiff);
          const newEnd = new Date(origEnd);
          newEnd.setFullYear(endD.getFullYear(), endD.getMonth(), endD.getDate());
          occEvent.ends_at = newEnd.toISOString();
        }
        result.push(occEvent);
      }
    }
    return result;
  }, [events]);

  // Build event lookup by date
  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const evt of expandedEvents) {
      const date = new Date(evt.starts_at);
      const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(evt);
    }
    return map;
  }, [expandedEvents]);

  // Set of days with events (for mini calendar)
  const eventDays = useMemo(() => {
    const s = new Set<string>();
    for (const evt of expandedEvents) {
      const date = new Date(evt.starts_at);
      s.add(`${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`);
    }
    return s;
  }, [expandedEvents]);

  const getEventsForDay = useCallback(
    (d: Date): CalendarEvent[] => {
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      return eventsByDay.get(key) ?? [];
    },
    [eventsByDay],
  );

  // Navigation
  function goToPrevMonth() {
    if (month === 0) {
      setMonth(11);
      setYear(year - 1);
    } else {
      setMonth(month - 1);
    }
  }

  function goToNextMonth() {
    if (month === 11) {
      setMonth(0);
      setYear(year + 1);
    } else {
      setMonth(month + 1);
    }
  }

  function goToToday() {
    setYear(today.getFullYear());
    setMonth(today.getMonth());
    setSelectedDay(today.getDate());
  }

  function handleMiniDayClick(date: Date) {
    setYear(date.getFullYear());
    setMonth(date.getMonth());
    setSelectedDay(date.getDate());
  }

  function handleDayClick(date: Date) {
    setSelectedDay(date.getDate());
    setViewMode("day");
    setYear(date.getFullYear());
    setMonth(date.getMonth());
  }

  function handleDoubleClickSlot(date: Date, hour: number) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    setInitialDate(`${y}-${m}-${d}`);
    setInitialTime(`${String(hour).padStart(2, "0")}:00`);
    setEditEvent(null);
    setIsCreateOpen(true);
  }

  function handleEventClick(event: CalendarEvent) {
    setDetailEvent(event);
  }

  function handleEditFromDetail() {
    if (!detailEvent) return;
    setEditEvent({
      id: detailEvent.id,
      title: detailEvent.title,
      description: detailEvent.description,
      event_type: detailEvent.event_type,
      starts_at: detailEvent.starts_at,
      ends_at: detailEvent.ends_at,
      is_all_day: detailEvent.is_all_day,
      location: detailEvent.location,
      location_type: detailEvent.location_type,
      virtual_url: detailEvent.virtual_url,
      color: detailEvent.color,
      department_ids: detailEvent.departments.map((d) => d.id),
      recurrence_rule: detailEvent.recurrence_rule,
    });
    setDetailEvent(null);
    setIsCreateOpen(true);
  }

  // Upcoming events (next 3 for sidebar)
  const upcomingEvents = useMemo(() => {
    const nowStr = new Date().toISOString();
    return expandedEvents
      .filter((e) => e.starts_at >= nowStr)
      .sort(
        (a, b) =>
          new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime(),
      )
      .slice(0, 3);
  }, [expandedEvents]);

  const VIEW_MODES: { key: CalendarViewMode; label: string }[] = [
    { key: "month", label: "Month" },
    { key: "week", label: "Week" },
    { key: "day", label: "Day" },
    { key: "agenda", label: "Agenda" },
  ];

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-4 sm:px-6 lg:px-8 pt-4 sm:pt-6 lg:pt-8 pb-4 shrink-0">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-5">
          <div>
            <h1
              className="text-[24px] text-[#2D333A] leading-tight"
              style={{ fontFamily: "var(--font-poppins)", fontWeight: 700 }}
            >
              Calendar
            </h1>
            <p
              className="text-[15px] text-[#6B7280] mt-1"
              style={{ fontFamily: "var(--font-source-sans)" }}
            >
              All your events in one place.
            </p>
          </div>

          <button
            onClick={() => {
              setEditEvent(null);
              setInitialDate("");
              setInitialTime("");
              setIsCreateOpen(true);
            }}
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

        {/* Navigation row */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {/* Month nav */}
            <div className="flex items-center gap-1 bg-[#F4F5F7] p-1 rounded-xl">
              <button
                onClick={goToPrevMonth}
                className="p-2 rounded-lg text-[#6B7280] hover:bg-white hover:text-[#2D333A] hover:shadow-sm transition-all"
              >
                <ChevronLeft className="size-4" />
              </button>
              <span
                className="px-4 py-1.5 text-[14px] text-[#2D333A] min-w-[180px] text-center"
                style={{
                  fontFamily: "var(--font-poppins)",
                  fontWeight: 600,
                }}
              >
                {MONTH_NAMES[month]} {year}
              </span>
              <button
                onClick={goToNextMonth}
                className="p-2 rounded-lg text-[#6B7280] hover:bg-white hover:text-[#2D333A] hover:shadow-sm transition-all"
              >
                <ChevronRight className="size-4" />
              </button>
            </div>

            {/* Today button */}
            <button
              onClick={goToToday}
              className="px-3.5 py-2 bg-white border border-[#E5E7EB] rounded-xl text-[11px] text-[#6B7280] hover:text-[#5CE1A5] hover:border-[#5CE1A5]/30 transition-all uppercase tracking-wider"
              style={{
                fontFamily: "var(--font-poppins)",
                fontWeight: 600,
              }}
            >
              Today
            </button>
          </div>

          {/* View toggle with animated indicator */}
          <div className="flex p-1 bg-[#F4F5F7] rounded-xl relative">
            {VIEW_MODES.map((v) => (
              <button
                key={v.key}
                onClick={() => setViewMode(v.key)}
                className="px-4 py-1.5 rounded-lg text-[11px] uppercase tracking-wider transition-all relative z-10"
                style={{
                  fontFamily: "var(--font-poppins)",
                  fontWeight: 600,
                  color: viewMode === v.key ? "#5CE1A5" : "#9CA3AF",
                }}
              >
                {viewMode === v.key && (
                  <motion.div
                    layoutId="view-mode-indicator"
                    className="absolute inset-0 bg-white rounded-lg"
                    style={{
                      boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
                    }}
                    transition={{
                      type: "spring",
                      stiffness: 300,
                      damping: 30,
                    }}
                  />
                )}
                <span className="relative z-10">{v.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 flex min-h-0 px-4 sm:px-6 lg:px-8 pb-4 sm:pb-6 lg:pb-8 gap-6">
        {/* Main calendar area */}
        <div className="flex-1 flex flex-col min-h-0 min-w-0">
          <AnimatePresence mode="wait">
            {viewMode === "month" && (
              <MonthGrid
                year={year}
                month={month}
                today={today}
                getEventsForDay={getEventsForDay}
                onDayClick={handleDayClick}
                onEventClick={handleEventClick}
              />
            )}
            {viewMode === "week" && (
              <WeekGrid
                year={year}
                month={month}
                day={selectedDay}
                today={today}
                getEventsForDay={getEventsForDay}
                onEventClick={handleEventClick}
                onDoubleClickSlot={handleDoubleClickSlot}
              />
            )}
            {viewMode === "day" && (
              <DayGrid
                date={new Date(year, month, selectedDay)}
                today={today}
                events={getEventsForDay(new Date(year, month, selectedDay))}
                onEventClick={handleEventClick}
                onDoubleClickSlot={handleDoubleClickSlot}
              />
            )}
            {viewMode === "agenda" && (
              <AgendaView
                events={expandedEvents}
                onEventClick={handleEventClick}
              />
            )}
          </AnimatePresence>
        </div>

        {/* Right Sidebar (hidden below xl) */}
        <div className="hidden xl:flex flex-col gap-4 w-[280px] shrink-0">
          {/* Mini Calendar */}
          <div
            className="bg-white rounded-2xl border border-[#E5E7EB]/50 p-4"
            style={{
              boxShadow:
                "0 4px 20px -2px rgba(0,0,0,0.02), 0 1px 4px -1px rgba(0,0,0,0.02)",
            }}
          >
            <MiniCalendar
              year={year}
              month={month}
              today={today}
              eventDays={eventDays}
              onDayClick={handleMiniDayClick}
              onPrev={goToPrevMonth}
              onNext={goToNextMonth}
            />
          </div>

          {/* Calendar Sources */}
          <div
            className="bg-white rounded-2xl border border-[#E5E7EB]/50 p-4"
            style={{
              boxShadow:
                "0 4px 20px -2px rgba(0,0,0,0.02), 0 1px 4px -1px rgba(0,0,0,0.02)",
            }}
          >
            <h4
              className="text-[12px] text-[#9CA3AF] uppercase tracking-wider mb-3"
              style={{ fontFamily: "var(--font-poppins)", fontWeight: 600 }}
            >
              Calendar Sources
            </h4>
            <div className="space-y-2">
              {[
                { label: "My Events", color: "#5CE1A5" },
                { label: "Organization", color: "#3B82F6" },
                { label: "Tasks", color: "#F59E0B" },
              ].map((source) => (
                <label
                  key={source.label}
                  className="flex items-center gap-2.5 cursor-pointer group"
                >
                  <div
                    className="size-4 rounded border-2 flex items-center justify-center"
                    style={{ borderColor: source.color, backgroundColor: `${source.color}18` }}
                  >
                    <Check className="size-2.5" style={{ color: source.color }} />
                  </div>
                  <span
                    className="text-[13px] text-[#2D333A] group-hover:text-[#5CE1A5] transition-colors"
                    style={{ fontFamily: "var(--font-source-sans)" }}
                  >
                    {source.label}
                  </span>
                </label>
              ))}
              {departments.map((dept) => (
                <label
                  key={dept.id}
                  className="flex items-center gap-2.5 cursor-pointer group"
                >
                  <div
                    className="size-4 rounded border-2 flex items-center justify-center"
                    style={{ borderColor: dept.color, backgroundColor: `${dept.color}18` }}
                  >
                    <Check className="size-2.5" style={{ color: dept.color }} />
                  </div>
                  <span
                    className="text-[13px] text-[#2D333A] group-hover:text-[#5CE1A5] transition-colors"
                    style={{ fontFamily: "var(--font-source-sans)" }}
                  >
                    {dept.name}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Upcoming */}
          <div
            className="bg-white rounded-2xl border border-[#E5E7EB]/50 p-4"
            style={{
              boxShadow:
                "0 4px 20px -2px rgba(0,0,0,0.02), 0 1px 4px -1px rgba(0,0,0,0.02)",
            }}
          >
            <h4
              className="text-[12px] text-[#9CA3AF] uppercase tracking-wider mb-3"
              style={{ fontFamily: "var(--font-poppins)", fontWeight: 600 }}
            >
              Upcoming
            </h4>

            {upcomingEvents.length === 0 ? (
              <p
                className="text-[12px] text-[#9CA3AF] text-center py-3"
                style={{ fontFamily: "var(--font-source-sans)" }}
              >
                No upcoming events
              </p>
            ) : (
              <div className="space-y-3">
                {upcomingEvents.map((evt) => {
                  const evtColor =
                    evt.color ||
                    EVENT_TYPE_COLORS[evt.event_type] ||
                    "#6B7280";
                  const date = new Date(evt.starts_at);
                  return (
                    <div
                      key={`${evt.id}-${evt.starts_at}`}
                      onClick={() => handleEventClick(evt)}
                      className="flex gap-3 items-start cursor-pointer group"
                    >
                      <div
                        className="w-1 rounded-full self-stretch shrink-0 min-h-[36px]"
                        style={{ backgroundColor: evtColor }}
                      />
                      <div className="flex-1 min-w-0">
                        <p
                          className="text-[13px] text-[#2D333A] truncate group-hover:text-[#5CE1A5] transition-colors"
                          style={{
                            fontFamily: "var(--font-poppins)",
                            fontWeight: 600,
                          }}
                        >
                          {evt.title}
                        </p>
                        <p
                          className="text-[11px] text-[#9CA3AF] mt-0.5"
                          style={{ fontFamily: "var(--font-source-sans)" }}
                        >
                          {date.toLocaleDateString("en-US", {
                            weekday: "short",
                            month: "short",
                            day: "numeric",
                          })}
                          {!evt.is_all_day && (
                            <> &middot; {formatTime(evt.starts_at)}</>
                          )}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Event Detail Panel */}
      <AnimatePresence>
        {detailEvent && (
          <EventDetailPanel
            event={detailEvent}
            onClose={() => setDetailEvent(null)}
            onEdit={handleEditFromDetail}
            onDeleted={() => {
              setDetailEvent(null);
              router.refresh();
            }}
          />
        )}
      </AnimatePresence>

      {/* Create / Edit Event Modal */}
      <EventModal
        isOpen={isCreateOpen}
        onClose={() => {
          setIsCreateOpen(false);
          setEditEvent(null);
          setInitialDate("");
          setInitialTime("");
        }}
        onCreated={() => {
          router.refresh();
          setEditEvent(null);
          setInitialDate("");
          setInitialTime("");
        }}
        departments={departments}
        customEventTypes={customEventTypes}
        editEvent={editEvent}
        initialDate={initialDate}
        initialTime={initialTime}
      />
    </div>
  );
}
