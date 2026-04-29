"use client";

import { useState, useTransition } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, Clock, MapPin, Video, Globe, Plus, Repeat } from "lucide-react";
import {
  createEvent,
  updateEvent,
  createCustomEventType,
  updateCustomEventType,
  deleteCustomEventType,
} from "@/app/actions/events";

// ─── Types ──────────────────────────────────────────────

export type EventTypeOption =
  | "general"
  | "service"
  | "meeting"
  | "rehearsal"
  | "class"
  | "outreach"
  | "social"
  | "other";

export type LocationType = "in_person" | "virtual" | "hybrid";

export interface Department {
  id: string;
  name: string;
  color: string;
}

export interface CustomEventType {
  id: string;
  name: string;
  color: string;
}

export interface EventModalData {
  id: string;
  title: string;
  description: string | null;
  event_type: string;
  custom_event_type_id?: string | null;
  starts_at: string;
  ends_at: string | null;
  is_all_day: boolean;
  location: string | null;
  location_type: string;
  virtual_url?: string | null;
  color: string;
  department_ids: string[];
  recurrence_rule: string | null;
}

interface EventModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated?: () => void;
  departments: Department[];
  customEventTypes?: CustomEventType[];
  editEvent?: EventModalData | null;
}

// ─── Event Type Config ──────────────────────────────────

const EVENT_TYPE_CONFIG: Record<
  EventTypeOption,
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

const COLOR_PALETTE = [
  "#5CE1A5",
  "#3B82F6",
  "#8B5CF6",
  "#F59E0B",
  "#EC4899",
  "#10B981",
  "#EF4444",
  "#6B7280",
];

const RECURRENCE_FREQUENCIES = [
  { key: "daily", label: "Daily" },
  { key: "weekly", label: "Weekly" },
  { key: "monthly", label: "Monthly" },
  { key: "yearly", label: "Yearly" },
] as const;

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// ─── Helpers ──────────────────────────────────────────────

function parseRecurrenceRule(rule: string | null): {
  frequency: string;
  interval: number;
  weekdays: string[];
  endType: "never" | "on_date" | "after_count";
  endDate: string;
  endCount: number;
} {
  const defaults = {
    frequency: "weekly",
    interval: 1,
    weekdays: [] as string[],
    endType: "never" as const,
    endDate: "",
    endCount: 10,
  };
  if (!rule) return defaults;

  const parts = rule.split(";");
  const map = new Map<string, string>();
  for (const p of parts) {
    const [k, v] = p.split("=");
    if (k && v) map.set(k, v);
  }

  return {
    frequency: (map.get("FREQ") || "weekly").toLowerCase(),
    interval: parseInt(map.get("INTERVAL") || "1", 10),
    weekdays: map.get("BYDAY")?.split(",") || [],
    endType: map.has("UNTIL") ? "on_date" : map.has("COUNT") ? "after_count" : "never",
    endDate: map.get("UNTIL") || "",
    endCount: parseInt(map.get("COUNT") || "10", 10),
  };
}

function buildRecurrenceRule(
  frequency: string,
  interval: number,
  weekdays: string[],
  endType: string,
  endDate: string,
  endCount: number,
): string {
  const parts = [`FREQ=${frequency.toUpperCase()}`, `INTERVAL=${interval}`];
  if (frequency === "weekly" && weekdays.length > 0) {
    parts.push(`BYDAY=${weekdays.join(",")}`);
  }
  if (endType === "on_date" && endDate) {
    parts.push(`UNTIL=${endDate}`);
  } else if (endType === "after_count") {
    parts.push(`COUNT=${endCount}`);
  }
  return parts.join(";");
}

// ─── Component ──────────────────────────────────────────

export function EventModal({
  isOpen,
  onClose,
  onCreated,
  departments,
  customEventTypes = [],
  editEvent,
}: EventModalProps) {
  const [isPending, startTransition] = useTransition();
  const isEditing = !!editEvent;

  // Form state
  const [title, setTitle] = useState(editEvent?.title || "");
  const [description, setDescription] = useState(editEvent?.description || "");
  const [eventType, setEventType] = useState<string>(editEvent?.event_type || "general");
  const [customEventTypeId, setCustomEventTypeId] = useState<string | null>(editEvent?.custom_event_type_id || null);
  const [showManageTypes, setShowManageTypes] = useState(false);
  const [startDate, setStartDate] = useState(
    editEvent ? editEvent.starts_at.slice(0, 10) : "",
  );
  const [startTime, setStartTime] = useState(
    editEvent ? editEvent.starts_at.slice(11, 16) : "09:00",
  );
  const [endDate, setEndDate] = useState(
    editEvent?.ends_at ? editEvent.ends_at.slice(0, 10) : "",
  );
  const [endTime, setEndTime] = useState(
    editEvent?.ends_at ? editEvent.ends_at.slice(11, 16) : "10:00",
  );
  const [isAllDay, setIsAllDay] = useState(editEvent?.is_all_day || false);
  const [location, setLocation] = useState(editEvent?.location || "");
  const [locationType, setLocationType] = useState<LocationType>(
    (editEvent?.location_type as LocationType) || "in_person",
  );
  const [virtualUrl, setVirtualUrl] = useState(editEvent?.virtual_url || "");
  const [departmentIds, setDepartmentIds] = useState<string[]>(editEvent?.department_ids || []);
  const [color, setColor] = useState(editEvent?.color || "#5CE1A5");
  const [error, setError] = useState("");

  // Recurring state
  const parsed = parseRecurrenceRule(editEvent?.recurrence_rule || null);
  const [isRecurring, setIsRecurring] = useState(!!editEvent?.recurrence_rule);
  const [recFrequency, setRecFrequency] = useState(parsed.frequency);
  const [recInterval, setRecInterval] = useState(parsed.interval);
  const [recWeekdays, setRecWeekdays] = useState<string[]>(parsed.weekdays);
  const [recEndType, setRecEndType] = useState(parsed.endType);
  const [recEndDate, setRecEndDate] = useState(parsed.endDate);
  const [recEndCount, setRecEndCount] = useState(parsed.endCount);

  // Custom type creation
  const [showNewType, setShowNewType] = useState(false);
  const [newTypeName, setNewTypeName] = useState("");
  const [newTypeColor, setNewTypeColor] = useState("#6B7280");
  const [isCreatingType, startCreatingType] = useTransition();

  function resetForm() {
    setTitle("");
    setDescription("");
    setEventType("general");
    setCustomEventTypeId(null);
    setShowManageTypes(false);
    setStartDate("");
    setStartTime("09:00");
    setEndDate("");
    setEndTime("10:00");
    setIsAllDay(false);
    setLocation("");
    setLocationType("in_person");
    setVirtualUrl("");
    setDepartmentIds([]);
    setColor("#5CE1A5");
    setError("");
    setIsRecurring(false);
    setRecFrequency("weekly");
    setRecInterval(1);
    setRecWeekdays([]);
    setRecEndType("never");
    setRecEndDate("");
    setRecEndCount(10);
    setShowNewType(false);
    setNewTypeName("");
    setNewTypeColor("#6B7280");
  }

  function handleClose() {
    resetForm();
    onClose();
  }

  function toggleDepartment(id: string) {
    setDepartmentIds((prev) =>
      prev.includes(id) ? prev.filter((d) => d !== id) : [...prev, id],
    );
  }

  function toggleWeekday(day: string) {
    const short = day.slice(0, 2).toUpperCase();
    setRecWeekdays((prev) =>
      prev.includes(short) ? prev.filter((d) => d !== short) : [...prev, short],
    );
  }

  function handleCreateCustomType() {
    if (!newTypeName.trim()) return;
    startCreatingType(async () => {
      const result = await createCustomEventType(newTypeName.trim(), newTypeColor);
      if (result.success && result.id) {
        // Select the new custom type by UUID
        setEventType("other");
        setCustomEventTypeId(result.id);
        setColor(newTypeColor);
        setShowNewType(false);
        setNewTypeName("");
        setNewTypeColor("#6B7280");
        onCreated?.();
      }
    });
  }

  function handleSubmit() {
    if (!title.trim()) {
      setError("Title is required.");
      return;
    }
    if (!startDate) {
      setError("Start date is required.");
      return;
    }

    setError("");

    const startsAt = isAllDay
      ? `${startDate}T00:00:00`
      : `${startDate}T${startTime}:00`;
    const endsAtDate = endDate || startDate;
    const endsAt = isAllDay
      ? `${endsAtDate}T23:59:59`
      : `${endsAtDate}T${endTime}:00`;

    const recurrenceRule = isRecurring
      ? buildRecurrenceRule(
          recFrequency,
          recInterval,
          recWeekdays,
          recEndType,
          recEndDate,
          recEndCount,
        )
      : undefined;

    startTransition(async () => {
      const payload = {
        title: title.trim(),
        description: description.trim() || undefined,
        event_type: customEventTypeId ? "other" : eventType,
        custom_event_type_id: customEventTypeId || null,
        starts_at: startsAt,
        ends_at: endsAt,
        is_all_day: isAllDay,
        location: location.trim() || undefined,
        location_type: locationType,
        virtual_url: virtualUrl.trim() || undefined,
        department_id: departmentIds[0] || null,
        department_ids: departmentIds,
        color,
        recurrence_rule: recurrenceRule,
      };

      const result = isEditing
        ? await updateEvent(editEvent!.id, payload)
        : await createEvent(payload);

      if (result.success) {
        handleClose();
        onCreated?.();
      } else {
        setError(result.error || `Failed to ${isEditing ? "update" : "create"} event.`);
      }
    });
  }

  function selectPresetType(key: string, typeColor: string) {
    setEventType(key);
    setCustomEventTypeId(null);
    setColor(typeColor);
  }

  function selectCustomType(ct: CustomEventType) {
    setEventType("other");
    setCustomEventTypeId(ct.id);
    setColor(ct.color);
  }

  // Is the current selection a specific custom type?
  const isCustomSelected = !!customEventTypeId;
  const selectedCustomType = customEventTypes.find((ct) => ct.id === customEventTypeId);

  const allTypes: { key: string; label: string; color: string; isCustom: boolean; customId?: string }[] = [
    ...Object.entries(EVENT_TYPE_CONFIG)
      .filter(([key]) => key !== "other") // hide "other" from list — it's set automatically
      .map(([key, config]) => ({
        key,
        label: config.label,
        color: config.color,
        isCustom: false,
      })),
    ...customEventTypes.map((ct) => ({
      key: `custom-${ct.id}`,
      label: ct.name,
      color: ct.color,
      isCustom: true,
      customId: ct.id,
    })),
  ];

  return (
    <>
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            className="absolute inset-0 bg-black/30 backdrop-blur-[2px]"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ type: "spring", stiffness: 300, damping: 28 }}
            className="relative bg-white rounded-2xl shadow-2xl w-full max-w-[540px] overflow-hidden flex flex-col max-h-[90vh]"
            style={{
              boxShadow: "0 25px 60px -12px rgba(0,0,0,0.15)",
            }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-[#E5E7EB] shrink-0">
              <h2
                className="text-[18px] text-[#2D333A]"
                style={{ fontFamily: "var(--font-poppins)", fontWeight: 600 }}
              >
                {isEditing ? "Edit Event" : "Create Event"}
              </h2>
              <button
                onClick={handleClose}
                className="size-8 flex items-center justify-center rounded-xl text-[#9CA3AF] hover:text-[#2D333A] hover:bg-[#F4F5F7] transition-all"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* Body */}
            <div className="px-6 py-5 space-y-5 overflow-y-auto flex-1">
              {/* Error */}
              {error && (
                <div
                  className="px-4 py-2.5 rounded-xl bg-[#FEF2F2] border border-[#FECACA] text-[13px] text-[#EF4444]"
                  style={{ fontFamily: "var(--font-source-sans)" }}
                >
                  {error}
                </div>
              )}

              {/* Title */}
              <div>
                <label
                  className="block text-[13px] text-[#2D333A] mb-1.5"
                  style={{
                    fontFamily: "var(--font-poppins)",
                    fontWeight: 500,
                  }}
                >
                  Event Title
                </label>
                <input
                  type="text"
                  autoFocus
                  placeholder="e.g. Sunday Morning Service"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full h-11 px-4 rounded-xl border border-[#E5E7EB] text-[14px] text-[#2D333A] placeholder-[#9CA3AF] outline-none focus:border-[#5CE1A5] focus:ring-2 focus:ring-[#5CE1A5]/15 transition-all"
                  style={{ fontFamily: "var(--font-source-sans)" }}
                />
              </div>

              {/* Description */}
              <div>
                <label
                  className="block text-[13px] text-[#2D333A] mb-1.5"
                  style={{
                    fontFamily: "var(--font-poppins)",
                    fontWeight: 500,
                  }}
                >
                  Description{" "}
                  <span className="text-[#9CA3AF]" style={{ fontWeight: 400 }}>
                    (optional)
                  </span>
                </label>
                <textarea
                  placeholder="Add details about this event..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  className="w-full px-4 py-3 rounded-xl border border-[#E5E7EB] text-[14px] text-[#2D333A] placeholder-[#9CA3AF] outline-none focus:border-[#5CE1A5] focus:ring-2 focus:ring-[#5CE1A5]/15 transition-all resize-none"
                  style={{ fontFamily: "var(--font-source-sans)" }}
                />
              </div>

              {/* Event Type */}
              <div>
                <label
                  className="block text-[13px] text-[#2D333A] mb-1.5"
                  style={{
                    fontFamily: "var(--font-poppins)",
                    fontWeight: 500,
                  }}
                >
                  Event Type
                </label>
                <div className="flex flex-wrap gap-2">
                  {allTypes.map((t) => {
                    const active = t.isCustom
                      ? customEventTypeId === t.customId
                      : eventType === t.key && !isCustomSelected;
                    return (
                      <button
                        key={t.key}
                        type="button"
                        onClick={() => {
                          if (t.isCustom && t.customId) {
                            selectCustomType({ id: t.customId, name: t.label, color: t.color });
                          } else {
                            selectPresetType(t.key, t.color);
                          }
                        }}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border transition-all text-[13px]"
                        style={{
                          fontFamily: "var(--font-source-sans)",
                          fontWeight: active ? 600 : 400,
                          borderColor: active ? t.color : "#E5E7EB",
                          backgroundColor: active ? `${t.color}18` : "white",
                          color: active ? t.color : "#6B7280",
                        }}
                      >
                        <div
                          className="size-2 rounded-full shrink-0"
                          style={{
                            backgroundColor: active ? t.color : "#D1D5DB",
                          }}
                        />
                        {t.label}
                      </button>
                    );
                  })}
                  {/* Create new type */}
                  {!showNewType ? (
                    <button
                      type="button"
                      onClick={() => setShowNewType(true)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-dashed border-[#D1D5DB] text-[13px] text-[#9CA3AF] hover:border-[#5CE1A5] hover:text-[#5CE1A5] transition-all"
                      style={{ fontFamily: "var(--font-source-sans)" }}
                    >
                      <Plus className="size-3" />
                      Create new type
                    </button>
                  ) : (
                    <div className="w-full flex items-center gap-2 mt-1">
                      <input
                        type="text"
                        placeholder="Type name..."
                        value={newTypeName}
                        onChange={(e) => setNewTypeName(e.target.value)}
                        className="flex-1 h-9 px-3 rounded-lg border border-[#E5E7EB] text-[13px] text-[#2D333A] placeholder-[#9CA3AF] outline-none focus:border-[#5CE1A5] transition-all"
                        style={{ fontFamily: "var(--font-source-sans)" }}
                      />
                      <div className="flex items-center gap-1">
                        {COLOR_PALETTE.map((c) => (
                          <button
                            key={c}
                            type="button"
                            onClick={() => setNewTypeColor(c)}
                            className="size-5 rounded-md transition-all"
                            style={{
                              backgroundColor: c,
                              boxShadow:
                                newTypeColor === c
                                  ? `0 0 0 2px white, 0 0 0 3px ${c}`
                                  : "none",
                            }}
                          />
                        ))}
                      </div>
                      <button
                        type="button"
                        onClick={handleCreateCustomType}
                        disabled={isCreatingType || !newTypeName.trim()}
                        className="h-9 px-3 rounded-lg text-white text-[12px] transition-all disabled:opacity-50"
                        style={{
                          fontFamily: "var(--font-poppins)",
                          fontWeight: 600,
                          backgroundColor: "#5CE1A5",
                        }}
                      >
                        {isCreatingType ? "..." : "Add"}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowNewType(false);
                          setNewTypeName("");
                        }}
                        className="h-9 px-2 rounded-lg text-[#9CA3AF] hover:text-[#6B7280] transition-all"
                      >
                        <X className="size-4" />
                      </button>
                    </div>
                  )}
                  {/* Manage types link */}
                  {customEventTypes.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setShowManageTypes(true)}
                      className="text-[11px] text-[#9CA3AF] hover:text-[#5CE1A5] transition-colors"
                      style={{ fontFamily: "var(--font-source-sans)" }}
                    >
                      Manage types
                    </button>
                  )}
                </div>
              </div>

              {/* All-day toggle */}
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setIsAllDay(!isAllDay)}
                  className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors"
                  style={{
                    backgroundColor: isAllDay ? "#5CE1A5" : "#E5E7EB",
                  }}
                >
                  <span
                    className="inline-block size-4 rounded-full bg-white transition-transform shadow-sm"
                    style={{
                      transform: isAllDay
                        ? "translateX(22px)"
                        : "translateX(4px)",
                    }}
                  />
                </button>
                <span
                  className="text-[13px] text-[#2D333A]"
                  style={{
                    fontFamily: "var(--font-poppins)",
                    fontWeight: 500,
                  }}
                >
                  All-day event
                </span>
              </div>

              {/* Date & Time */}
              <div className="flex items-end gap-3">
                <div className="flex-1">
                  <label
                    className="block text-[13px] text-[#2D333A] mb-1.5"
                    style={{
                      fontFamily: "var(--font-poppins)",
                      fontWeight: 500,
                    }}
                  >
                    Start
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => {
                        setStartDate(e.target.value);
                        if (!endDate) setEndDate(e.target.value);
                      }}
                      className="flex-1 h-11 px-3 rounded-xl border border-[#E5E7EB] text-[14px] text-[#2D333A] outline-none focus:border-[#5CE1A5] focus:ring-2 focus:ring-[#5CE1A5]/15 transition-all"
                      style={{ fontFamily: "var(--font-source-sans)" }}
                    />
                    {!isAllDay && (
                      <div className="relative">
                        <Clock className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-[#9CA3AF] pointer-events-none" />
                        <input
                          type="time"
                          value={startTime}
                          onChange={(e) => {
                            setStartTime(e.target.value);
                            if (e.target.value >= endTime) {
                              const [h, m] = e.target.value
                                .split(":")
                                .map(Number);
                              setEndTime(
                                `${String((h + 1) % 24).padStart(2, "0")}:${String(m).padStart(2, "0")}`,
                              );
                            }
                          }}
                          className="h-11 pl-9 pr-3 rounded-xl border border-[#E5E7EB] text-[14px] text-[#2D333A] outline-none focus:border-[#5CE1A5] focus:ring-2 focus:ring-[#5CE1A5]/15 transition-all w-[130px]"
                          style={{ fontFamily: "var(--font-source-sans)" }}
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-end gap-3">
                <div className="flex-1">
                  <label
                    className="block text-[13px] text-[#2D333A] mb-1.5"
                    style={{
                      fontFamily: "var(--font-poppins)",
                      fontWeight: 500,
                    }}
                  >
                    End
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="flex-1 h-11 px-3 rounded-xl border border-[#E5E7EB] text-[14px] text-[#2D333A] outline-none focus:border-[#5CE1A5] focus:ring-2 focus:ring-[#5CE1A5]/15 transition-all"
                      style={{ fontFamily: "var(--font-source-sans)" }}
                    />
                    {!isAllDay && (
                      <div className="relative">
                        <Clock className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-[#9CA3AF] pointer-events-none" />
                        <input
                          type="time"
                          value={endTime}
                          onChange={(e) => setEndTime(e.target.value)}
                          className="h-11 pl-9 pr-3 rounded-xl border border-[#E5E7EB] text-[14px] text-[#2D333A] outline-none focus:border-[#5CE1A5] focus:ring-2 focus:ring-[#5CE1A5]/15 transition-all w-[130px]"
                          style={{ fontFamily: "var(--font-source-sans)" }}
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Recurring toggle */}
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setIsRecurring(!isRecurring)}
                    className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors"
                    style={{
                      backgroundColor: isRecurring ? "#5CE1A5" : "#E5E7EB",
                    }}
                  >
                    <span
                      className="inline-block size-4 rounded-full bg-white transition-transform shadow-sm"
                      style={{
                        transform: isRecurring
                          ? "translateX(22px)"
                          : "translateX(4px)",
                      }}
                    />
                  </button>
                  <span
                    className="flex items-center gap-1.5 text-[13px] text-[#2D333A]"
                    style={{
                      fontFamily: "var(--font-poppins)",
                      fontWeight: 500,
                    }}
                  >
                    <Repeat className="size-3.5" />
                    Recurring
                  </span>
                </div>

                {isRecurring && (
                  <div className="pl-2 space-y-3 border-l-2 border-[#5CE1A5]/20 ml-5">
                    {/* Frequency */}
                    <div className="flex items-center gap-2 flex-wrap">
                      {RECURRENCE_FREQUENCIES.map((f) => (
                        <button
                          key={f.key}
                          type="button"
                          onClick={() => setRecFrequency(f.key)}
                          className="px-3 py-1.5 rounded-lg border text-[12px] transition-all"
                          style={{
                            fontFamily: "var(--font-poppins)",
                            fontWeight: recFrequency === f.key ? 600 : 400,
                            borderColor:
                              recFrequency === f.key ? "#5CE1A5" : "#E5E7EB",
                            backgroundColor:
                              recFrequency === f.key
                                ? "rgba(92,225,165,0.08)"
                                : "white",
                            color:
                              recFrequency === f.key ? "#5CE1A5" : "#6B7280",
                          }}
                        >
                          {f.label}
                        </button>
                      ))}
                    </div>

                    {/* Interval */}
                    <div className="flex items-center gap-2">
                      <span
                        className="text-[12px] text-[#6B7280]"
                        style={{ fontFamily: "var(--font-source-sans)" }}
                      >
                        Every
                      </span>
                      <input
                        type="number"
                        min={1}
                        max={99}
                        value={recInterval}
                        onChange={(e) =>
                          setRecInterval(Math.max(1, parseInt(e.target.value) || 1))
                        }
                        className="w-16 h-8 px-2 rounded-lg border border-[#E5E7EB] text-[13px] text-[#2D333A] text-center outline-none focus:border-[#5CE1A5] transition-all"
                        style={{ fontFamily: "var(--font-source-sans)" }}
                      />
                      <span
                        className="text-[12px] text-[#6B7280]"
                        style={{ fontFamily: "var(--font-source-sans)" }}
                      >
                        {recFrequency === "daily"
                          ? recInterval > 1 ? "days" : "day"
                          : recFrequency === "weekly"
                          ? recInterval > 1 ? "weeks" : "week"
                          : recFrequency === "monthly"
                          ? recInterval > 1 ? "months" : "month"
                          : recInterval > 1 ? "years" : "year"}
                      </span>
                    </div>

                    {/* Weekly: day-of-week checkboxes */}
                    {recFrequency === "weekly" && (
                      <div className="flex items-center gap-1.5">
                        {WEEKDAYS.map((day) => {
                          const short = day.slice(0, 2).toUpperCase();
                          const active = recWeekdays.includes(short);
                          return (
                            <button
                              key={day}
                              type="button"
                              onClick={() => toggleWeekday(day)}
                              className="size-8 rounded-lg text-[11px] transition-all border"
                              style={{
                                fontFamily: "var(--font-poppins)",
                                fontWeight: active ? 600 : 400,
                                borderColor: active ? "#5CE1A5" : "#E5E7EB",
                                backgroundColor: active
                                  ? "rgba(92,225,165,0.08)"
                                  : "white",
                                color: active ? "#5CE1A5" : "#9CA3AF",
                              }}
                            >
                              {day.charAt(0)}
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {/* End condition */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className="text-[12px] text-[#6B7280]"
                        style={{ fontFamily: "var(--font-source-sans)" }}
                      >
                        Ends:
                      </span>
                      {(
                        [
                          { key: "never", label: "Never" },
                          { key: "on_date", label: "On date" },
                          { key: "after_count", label: "After" },
                        ] as const
                      ).map((opt) => (
                        <button
                          key={opt.key}
                          type="button"
                          onClick={() => setRecEndType(opt.key)}
                          className="px-2.5 py-1 rounded-lg border text-[11px] transition-all"
                          style={{
                            fontFamily: "var(--font-poppins)",
                            fontWeight: recEndType === opt.key ? 600 : 400,
                            borderColor:
                              recEndType === opt.key ? "#5CE1A5" : "#E5E7EB",
                            backgroundColor:
                              recEndType === opt.key
                                ? "rgba(92,225,165,0.08)"
                                : "white",
                            color:
                              recEndType === opt.key ? "#5CE1A5" : "#6B7280",
                          }}
                        >
                          {opt.label}
                        </button>
                      ))}
                      {recEndType === "on_date" && (
                        <input
                          type="date"
                          value={recEndDate}
                          onChange={(e) => setRecEndDate(e.target.value)}
                          className="h-8 px-2 rounded-lg border border-[#E5E7EB] text-[12px] text-[#2D333A] outline-none focus:border-[#5CE1A5] transition-all"
                          style={{ fontFamily: "var(--font-source-sans)" }}
                        />
                      )}
                      {recEndType === "after_count" && (
                        <div className="flex items-center gap-1.5">
                          <input
                            type="number"
                            min={1}
                            value={recEndCount}
                            onChange={(e) =>
                              setRecEndCount(
                                Math.max(1, parseInt(e.target.value) || 1),
                              )
                            }
                            className="w-16 h-8 px-2 rounded-lg border border-[#E5E7EB] text-[12px] text-[#2D333A] text-center outline-none focus:border-[#5CE1A5] transition-all"
                            style={{ fontFamily: "var(--font-source-sans)" }}
                          />
                          <span
                            className="text-[12px] text-[#6B7280]"
                            style={{ fontFamily: "var(--font-source-sans)" }}
                          >
                            occurrences
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Location type toggle */}
              <div>
                <label
                  className="block text-[13px] text-[#2D333A] mb-1.5"
                  style={{
                    fontFamily: "var(--font-poppins)",
                    fontWeight: 500,
                  }}
                >
                  Location Type
                </label>
                <div className="flex items-center bg-[#F4F5F7] rounded-xl p-0.5 w-fit">
                  {(
                    [
                      {
                        key: "in_person" as LocationType,
                        label: "In Person",
                        icon: MapPin,
                      },
                      {
                        key: "virtual" as LocationType,
                        label: "Virtual",
                        icon: Video,
                      },
                      {
                        key: "hybrid" as LocationType,
                        label: "Hybrid",
                        icon: Globe,
                      },
                    ] as const
                  ).map((opt) => (
                    <button
                      key={opt.key}
                      type="button"
                      onClick={() => setLocationType(opt.key)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] transition-all"
                      style={{
                        fontFamily: "var(--font-poppins)",
                        fontWeight: locationType === opt.key ? 600 : 500,
                        backgroundColor:
                          locationType === opt.key ? "white" : "transparent",
                        color:
                          locationType === opt.key ? "#2D333A" : "#9CA3AF",
                        boxShadow:
                          locationType === opt.key
                            ? "0 1px 3px rgba(0,0,0,0.08)"
                            : "none",
                      }}
                    >
                      <opt.icon className="size-3.5" />
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Location input */}
              {(locationType === "in_person" || locationType === "hybrid") && (
                <div>
                  <label
                    className="block text-[13px] text-[#2D333A] mb-1.5"
                    style={{
                      fontFamily: "var(--font-poppins)",
                      fontWeight: 500,
                    }}
                  >
                    Location
                  </label>
                  <div className="relative">
                    <MapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 size-3.5 text-[#9CA3AF] pointer-events-none" />
                    <input
                      type="text"
                      placeholder="e.g. Main Sanctuary"
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      className="w-full h-11 pl-9 pr-4 rounded-xl border border-[#E5E7EB] text-[14px] text-[#2D333A] placeholder-[#9CA3AF] outline-none focus:border-[#5CE1A5] focus:ring-2 focus:ring-[#5CE1A5]/15 transition-all"
                      style={{ fontFamily: "var(--font-source-sans)" }}
                    />
                  </div>
                </div>
              )}

              {/* Virtual URL */}
              {(locationType === "virtual" || locationType === "hybrid") && (
                <div>
                  <label
                    className="block text-[13px] text-[#2D333A] mb-1.5"
                    style={{
                      fontFamily: "var(--font-poppins)",
                      fontWeight: 500,
                    }}
                  >
                    Virtual URL
                  </label>
                  <div className="relative">
                    <Video className="absolute left-3.5 top-1/2 -translate-y-1/2 size-3.5 text-[#9CA3AF] pointer-events-none" />
                    <input
                      type="url"
                      placeholder="https://zoom.us/j/..."
                      value={virtualUrl}
                      onChange={(e) => setVirtualUrl(e.target.value)}
                      className="w-full h-11 pl-9 pr-4 rounded-xl border border-[#E5E7EB] text-[14px] text-[#2D333A] placeholder-[#9CA3AF] outline-none focus:border-[#5CE1A5] focus:ring-2 focus:ring-[#5CE1A5]/15 transition-all"
                      style={{ fontFamily: "var(--font-source-sans)" }}
                    />
                  </div>
                </div>
              )}

              {/* Departments (multi-select) */}
              <div>
                <label
                  className="block text-[13px] text-[#2D333A] mb-1.5"
                  style={{
                    fontFamily: "var(--font-poppins)",
                    fontWeight: 500,
                  }}
                >
                  Departments{" "}
                  <span className="text-[#9CA3AF]" style={{ fontWeight: 400 }}>
                    (optional)
                  </span>
                </label>
                <div className="flex flex-wrap gap-2">
                  {departments.map((dept) => {
                    const active = departmentIds.includes(dept.id);
                    return (
                      <button
                        key={dept.id}
                        type="button"
                        onClick={() => toggleDepartment(dept.id)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border transition-all text-[12px]"
                        style={{
                          fontFamily: "var(--font-source-sans)",
                          fontWeight: active ? 600 : 400,
                          borderColor: active ? dept.color : "#E5E7EB",
                          backgroundColor: active
                            ? `${dept.color}18`
                            : "white",
                          color: active ? dept.color : "#6B7280",
                        }}
                      >
                        <div
                          className="size-2 rounded-full shrink-0"
                          style={{
                            backgroundColor: active ? dept.color : "#D1D5DB",
                          }}
                        />
                        {dept.name}
                      </button>
                    );
                  })}
                  {departments.length === 0 && (
                    <span
                      className="text-[12px] text-[#9CA3AF]"
                      style={{ fontFamily: "var(--font-source-sans)" }}
                    >
                      No departments available
                    </span>
                  )}
                </div>
              </div>

              {/* Color Picker */}
              <div>
                <label
                  className="block text-[13px] text-[#2D333A] mb-1.5"
                  style={{
                    fontFamily: "var(--font-poppins)",
                    fontWeight: 500,
                  }}
                >
                  Color
                </label>
                <div className="flex items-center gap-2">
                  {COLOR_PALETTE.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setColor(c)}
                      className="size-7 rounded-lg transition-all"
                      style={{
                        backgroundColor: c,
                        boxShadow:
                          color === c
                            ? `0 0 0 2px white, 0 0 0 4px ${c}`
                            : "none",
                        transform: color === c ? "scale(1.1)" : "scale(1)",
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 pb-6 pt-4 border-t border-[#E5E7EB] flex items-center gap-3 shrink-0">
              <button
                onClick={handleClose}
                disabled={isPending}
                className="flex-1 h-11 rounded-xl border border-[#E5E7EB] text-[13px] text-[#6B7280] hover:bg-[#F4F5F7] transition-all"
                style={{
                  fontFamily: "var(--font-poppins)",
                  fontWeight: 600,
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={isPending}
                className="flex-1 h-11 rounded-xl text-white text-[13px] hover:brightness-105 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-60"
                style={{
                  fontFamily: "var(--font-poppins)",
                  fontWeight: 600,
                  backgroundColor: "#5CE1A5",
                  boxShadow: "0 4px 14px -2px rgba(92, 225, 165, 0.4)",
                }}
              >
                {isPending
                  ? isEditing
                    ? "Updating..."
                    : "Creating..."
                  : isEditing
                  ? "Update Event"
                  : "Create Event"}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>

    {/* Manage Types Modal */}
    <AnimatePresence>
      {showManageTypes && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowManageTypes(false)}
            className="fixed inset-0 z-[100] bg-black/30 backdrop-blur-sm"
          />
          <div className="fixed inset-0 z-[105] flex items-center justify-center p-6 pointer-events-none">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="pointer-events-auto w-full max-w-[400px] bg-white rounded-2xl shadow-2xl border border-[#E5E7EB]/50 overflow-hidden"
            >
              <div className="flex items-center justify-between px-6 py-4 border-b border-[#E5E7EB]">
                <h3 className="text-[16px] text-[#2D333A]" style={{ fontFamily: "var(--font-poppins)", fontWeight: 600 }}>
                  Manage Event Types
                </h3>
                <button onClick={() => setShowManageTypes(false)} className="p-1 text-[#6B7280] hover:text-[#2D333A]">
                  <X className="size-5" />
                </button>
              </div>
              <div className="p-4 space-y-2 max-h-[60vh] overflow-y-auto">
                {customEventTypes.length === 0 ? (
                  <p className="text-center text-[13px] text-[#9CA3AF] py-6" style={{ fontFamily: "var(--font-source-sans)" }}>
                    No custom types yet. Create one from the event form.
                  </p>
                ) : (
                  customEventTypes.map((ct) => (
                    <ManageTypeRow key={ct.id} type={ct} onUpdated={() => onCreated?.()} />
                  ))
                )}
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
    </>
  );
}

// ─── Manage Type Row ────────────────────────────────────
function ManageTypeRow({ type, onUpdated }: { type: CustomEventType; onUpdated: () => void }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(type.name);
  const [color, setColor] = useState(type.color);
  const [deleting, setDeleting] = useState(false);
  const [saving, startSaving] = useTransition();

  function handleSave() {
    if (!name.trim()) return;
    startSaving(async () => {
      await updateCustomEventType(type.id, name.trim(), color);
      setEditing(false);
      onUpdated();
    });
  }

  function handleDelete() {
    startSaving(async () => {
      await deleteCustomEventType(type.id);
      onUpdated();
    });
  }

  if (deleting) {
    return (
      <div className="flex items-center justify-between p-3 bg-red-50 rounded-xl border border-red-100">
        <p className="text-[13px] text-red-600" style={{ fontFamily: "var(--font-source-sans)" }}>
          Delete &ldquo;{type.name}&rdquo;?
        </p>
        <div className="flex gap-2">
          <button onClick={() => setDeleting(false)} className="text-[12px] text-[#6B7280] px-2 py-1 rounded-lg hover:bg-white" style={{ fontWeight: 600 }}>
            Cancel
          </button>
          <button onClick={handleDelete} disabled={saving} className="text-[12px] text-white bg-[#EF4444] px-2 py-1 rounded-lg disabled:opacity-50" style={{ fontWeight: 600 }}>
            Delete
          </button>
        </div>
      </div>
    );
  }

  if (editing) {
    return (
      <div className="p-3 bg-[#F4F5F7] rounded-xl border border-[#E5E7EB] space-y-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full h-9 px-3 rounded-lg border border-[#E5E7EB] bg-white text-[13px] text-[#2D333A] outline-none focus:border-[#5CE1A5]"
        />
        <div className="flex items-center gap-1">
          {["#5CE1A5","#3B82F6","#8B5CF6","#F59E0B","#EC4899","#10B981","#EF4444","#6B7280"].map((c) => (
            <button
              key={c}
              onClick={() => setColor(c)}
              className="size-5 rounded-md"
              style={{ backgroundColor: c, boxShadow: color === c ? `0 0 0 2px white, 0 0 0 3px ${c}` : "none" }}
            />
          ))}
        </div>
        <div className="flex gap-2 justify-end">
          <button onClick={() => { setEditing(false); setName(type.name); setColor(type.color); }} className="text-[12px] text-[#6B7280] px-2 py-1 rounded-lg hover:bg-white" style={{ fontWeight: 600 }}>
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving || !name.trim()} className="text-[12px] text-white bg-[#5CE1A5] px-3 py-1 rounded-lg disabled:opacity-50" style={{ fontWeight: 600 }}>
            Save
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 p-3 rounded-xl hover:bg-[#F4F5F7] transition-colors group">
      <div className="size-3 rounded-full shrink-0" style={{ backgroundColor: type.color }} />
      <span className="flex-1 text-[14px] text-[#2D333A]" style={{ fontFamily: "var(--font-source-sans)", fontWeight: 500 }}>
        {type.name}
      </span>
      <button onClick={() => setEditing(true)} className="text-[11px] text-[#9CA3AF] hover:text-[#5CE1A5] opacity-0 group-hover:opacity-100 transition-all" style={{ fontWeight: 600 }}>
        Edit
      </button>
      <button onClick={() => setDeleting(true)} className="text-[11px] text-[#9CA3AF] hover:text-[#EF4444] opacity-0 group-hover:opacity-100 transition-all" style={{ fontWeight: 600 }}>
        Delete
      </button>
    </div>
  );
}
