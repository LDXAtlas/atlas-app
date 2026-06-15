"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Search, X } from "lucide-react";
import { createHuddle, type HuddleMeetingSource, type HuddleVisibility } from "@/app/actions/huddles";
import { searchProfiles } from "@/app/actions/profiles";

interface CreateHuddleModalProps {
  open: boolean;
  onClose: () => void;
  departments: { id: string; name: string; color: string }[];
  orgProfiles: { id: string; full_name: string }[];
}

type AgendaDraft = { id: string; title: string; estimatedMinutes: string };

export function CreateHuddleModal({
  open,
  onClose,
  departments,
  orgProfiles,
}: CreateHuddleModalProps) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [scheduledStart, setScheduledStart] = useState("");
  const [scheduledEnd, setScheduledEnd] = useState("");
  const [meetingSource, setMeetingSource] = useState<HuddleMeetingSource>("in_person");
  const [externalUrl, setExternalUrl] = useState("");
  const [location, setLocation] = useState("");
  const [departmentId, setDepartmentId] = useState<string>("");
  const [visibility, setVisibility] = useState<HuddleVisibility>("invitees_only");
  const [attendees, setAttendees] = useState<{ id: string; full_name: string }[]>([]);
  const [attendeeQuery, setAttendeeQuery] = useState("");
  const [attendeeResults, setAttendeeResults] = useState<{ id: string; full_name: string; email: string | null }[]>([]);
  const [agendaDrafts, setAgendaDrafts] = useState<AgendaDraft[]>([]);
  const [agendaInput, setAgendaInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) {
      setTitle("");
      setDescription("");
      setScheduledStart("");
      setScheduledEnd("");
      setMeetingSource("in_person");
      setExternalUrl("");
      setLocation("");
      setDepartmentId("");
      setVisibility("invitees_only");
      setAttendees([]);
      setAttendeeQuery("");
      setAttendeeResults([]);
      setAgendaDrafts([]);
      setAgendaInput("");
      setError(null);
    }
  }, [open]);

  // Debounced attendee search.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const handle = setTimeout(async () => {
      const res = await searchProfiles(attendeeQuery);
      if (cancelled) return;
      setAttendeeResults(
        (res.data || []).map((p) => ({
          id: p.id,
          full_name: p.full_name || p.email?.split("@")[0] || "Teammate",
          email: p.email,
        })),
      );
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [attendeeQuery, open]);

  // Suggest profiles inline so the empty query shows real teammates.
  useEffect(() => {
    if (open && attendeeResults.length === 0 && !attendeeQuery) {
      setAttendeeResults(orgProfiles.slice(0, 8).map((p) => ({ id: p.id, full_name: p.full_name, email: null })));
    }
  }, [open, attendeeResults.length, attendeeQuery, orgProfiles]);

  function addAttendee(p: { id: string; full_name: string }) {
    if (attendees.some((a) => a.id === p.id)) return;
    setAttendees([...attendees, p]);
    setAttendeeQuery("");
  }

  function removeAttendee(id: string) {
    setAttendees(attendees.filter((a) => a.id !== id));
  }

  function addAgendaItem() {
    const trimmed = agendaInput.trim();
    if (!trimmed) return;
    setAgendaDrafts([
      ...agendaDrafts,
      { id: crypto.randomUUID(), title: trimmed, estimatedMinutes: "" },
    ]);
    setAgendaInput("");
  }

  function updateAgendaMinutes(id: string, value: string) {
    setAgendaDrafts(
      agendaDrafts.map((a) =>
        a.id === id ? { ...a, estimatedMinutes: value } : a,
      ),
    );
  }

  function removeAgendaItem(id: string) {
    setAgendaDrafts(agendaDrafts.filter((a) => a.id !== id));
  }

  function handleSubmit() {
    if (!title.trim()) {
      setError("Title is required.");
      return;
    }
    if (meetingSource === "external_video_link" && !externalUrl.trim()) {
      setError("External video link requires a URL.");
      return;
    }
    startTransition(async () => {
      const res = await createHuddle({
        title: title.trim(),
        description: description.trim() || undefined,
        scheduledStart: scheduledStart
          ? new Date(scheduledStart).toISOString()
          : null,
        scheduledEnd: scheduledEnd
          ? new Date(scheduledEnd).toISOString()
          : null,
        meetingSource,
        externalMeetingUrl: meetingSource === "external_video_link" ? externalUrl.trim() : null,
        location: meetingSource === "in_person" ? location.trim() : null,
        departmentId: departmentId || null,
        visibility,
        attendeeIds: attendees.map((a) => a.id),
        agendaItems: agendaDrafts.map((a) => ({
          title: a.title,
          estimatedMinutes: a.estimatedMinutes
            ? Number(a.estimatedMinutes)
            : undefined,
        })),
      });
      if (!res.success) {
        setError(res.error);
        return;
      }
      onClose();
      if (res.data?.id) {
        router.push(`/workspace/huddles/${res.data.id}`);
      }
    });
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[200] bg-black/40 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="px-5 py-4 border-b border-[#E5E7EB] flex items-center justify-between">
          <h2
            className="text-[16px] text-[#0F172A]"
            style={{ fontFamily: "var(--font-poppins)", fontWeight: 700 }}
          >
            New Huddle
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="size-9 rounded-xl flex items-center justify-center text-[#9CA3AF] hover:text-[#2D333A] hover:bg-[#F4F5F7]"
            aria-label="Close"
          >
            <X className="size-4" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {error && (
            <p
              className="text-[13px] text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2"
              style={{ fontFamily: "var(--font-source-sans)" }}
            >
              {error}
            </p>
          )}

          <Field label="Title" required>
            <input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Staff meeting"
              className="w-full h-10 px-3 rounded-xl border border-[#E5E7EB] text-[14px] outline-none focus:border-[#5CE1A5]"
              style={{ fontFamily: "var(--font-source-sans)" }}
            />
          </Field>

          <Field label="Description (optional)">
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="Quick context for attendees"
              className="w-full px-3 py-2 rounded-xl border border-[#E5E7EB] text-[13px] outline-none focus:border-[#5CE1A5] resize-none"
              style={{ fontFamily: "var(--font-source-sans)" }}
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Start">
              <input
                type="datetime-local"
                value={scheduledStart}
                onChange={(e) => setScheduledStart(e.target.value)}
                className="w-full h-10 px-3 rounded-xl border border-[#E5E7EB] text-[13px] outline-none focus:border-[#5CE1A5]"
                style={{ fontFamily: "var(--font-source-sans)" }}
              />
            </Field>
            <Field label="End">
              <input
                type="datetime-local"
                value={scheduledEnd}
                onChange={(e) => setScheduledEnd(e.target.value)}
                className="w-full h-10 px-3 rounded-xl border border-[#E5E7EB] text-[13px] outline-none focus:border-[#5CE1A5]"
                style={{ fontFamily: "var(--font-source-sans)" }}
              />
            </Field>
          </div>

          <Field label="Meeting source">
            <div className="flex items-center gap-2">
              {(
                [
                  ["in_person", "In person"],
                  ["external_video_link", "External video"],
                ] as const
              ).map(([value, label]) => {
                const active = meetingSource === value;
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setMeetingSource(value as HuddleMeetingSource)}
                    className={`h-9 px-3 rounded-xl text-[13px] transition-colors ${
                      active
                        ? "bg-[#5CE1A5]/15 text-[#059669] border border-[#5CE1A5]/40"
                        : "bg-[#F4F5F7] text-[#6B7280] border border-transparent hover:bg-[#E5E7EB]"
                    }`}
                    style={{
                      fontFamily: "var(--font-poppins)",
                      fontWeight: active ? 700 : 600,
                    }}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </Field>

          {meetingSource === "external_video_link" && (
            <Field label="Meeting URL">
              <input
                value={externalUrl}
                onChange={(e) => setExternalUrl(e.target.value)}
                placeholder="https://zoom.us/j/…"
                className="w-full h-10 px-3 rounded-xl border border-[#E5E7EB] text-[13px] outline-none focus:border-[#5CE1A5]"
                style={{ fontFamily: "var(--font-source-sans)" }}
              />
            </Field>
          )}

          {meetingSource === "in_person" && (
            <Field label="Location (optional)">
              <input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Main office, conference room A"
                className="w-full h-10 px-3 rounded-xl border border-[#E5E7EB] text-[13px] outline-none focus:border-[#5CE1A5]"
                style={{ fontFamily: "var(--font-source-sans)" }}
              />
            </Field>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Field label="Department (optional)">
              <select
                value={departmentId}
                onChange={(e) => setDepartmentId(e.target.value)}
                className="w-full h-10 px-3 rounded-xl border border-[#E5E7EB] text-[13px] outline-none focus:border-[#5CE1A5] bg-white"
                style={{ fontFamily: "var(--font-source-sans)" }}
              >
                <option value="">None</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Visibility">
              <select
                value={visibility}
                onChange={(e) => setVisibility(e.target.value as HuddleVisibility)}
                className="w-full h-10 px-3 rounded-xl border border-[#E5E7EB] text-[13px] outline-none focus:border-[#5CE1A5] bg-white"
                style={{ fontFamily: "var(--font-source-sans)" }}
              >
                <option value="invitees_only">Invitees only</option>
                <option value="department">Department</option>
                <option value="organization">Organization</option>
                <option value="private">Private</option>
              </select>
            </Field>
          </div>

          <Field label="Attendees">
            <div className="space-y-2">
              <div className="flex items-center gap-2 h-10 px-3 rounded-xl border border-[#E5E7EB] focus-within:border-[#5CE1A5]">
                <Search className="size-3.5 text-[#9CA3AF]" />
                <input
                  value={attendeeQuery}
                  onChange={(e) => setAttendeeQuery(e.target.value)}
                  placeholder="Search teammates"
                  className="flex-1 bg-transparent text-[13px] outline-none"
                  style={{ fontFamily: "var(--font-source-sans)" }}
                />
              </div>
              {attendeeResults.length > 0 && (
                <div className="bg-white border border-[#E5E7EB] rounded-xl max-h-40 overflow-auto">
                  {attendeeResults.map((r) => {
                    const already = attendees.some((a) => a.id === r.id);
                    return (
                      <button
                        type="button"
                        key={r.id}
                        onClick={() => addAttendee(r)}
                        disabled={already}
                        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-[#F4F5F7] disabled:opacity-50"
                      >
                        <span
                          className="text-[13px] text-[#2D333A] truncate"
                          style={{ fontFamily: "var(--font-source-sans)" }}
                        >
                          {r.full_name}
                        </span>
                        {already && (
                          <span
                            className="ml-auto text-[10px] text-[#9CA3AF] uppercase tracking-wider"
                            style={{ fontFamily: "var(--font-poppins)" }}
                          >
                            Added
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
              {attendees.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {attendees.map((a) => (
                    <span
                      key={a.id}
                      className="inline-flex items-center gap-1 h-6 px-2 rounded-md bg-[#5CE1A5]/12 text-[#059669] text-[11.5px]"
                      style={{ fontFamily: "var(--font-poppins)", fontWeight: 600 }}
                    >
                      {a.full_name}
                      <button
                        type="button"
                        onClick={() => removeAttendee(a.id)}
                        className="hover:text-red-600"
                      >
                        <X className="size-2.5" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </Field>

          <Field label="Agenda (optional)">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <input
                  value={agendaInput}
                  onChange={(e) => setAgendaInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addAgendaItem();
                    }
                  }}
                  placeholder="Add agenda item"
                  className="flex-1 h-9 px-3 rounded-xl border border-[#E5E7EB] text-[13px] outline-none focus:border-[#5CE1A5]"
                  style={{ fontFamily: "var(--font-source-sans)" }}
                />
                <button
                  type="button"
                  onClick={addAgendaItem}
                  disabled={!agendaInput.trim()}
                  className="h-9 px-3 rounded-xl bg-[#F4F5F7] text-[#2D333A] text-[12px] font-semibold disabled:opacity-50 hover:bg-[#E5E7EB]"
                  style={{ fontFamily: "var(--font-poppins)" }}
                >
                  <Plus className="size-3.5 inline mr-1" />
                  Add
                </button>
              </div>
              {agendaDrafts.length > 0 && (
                <ul className="space-y-1">
                  {agendaDrafts.map((a) => (
                    <li
                      key={a.id}
                      className="flex items-center gap-2 px-3 py-1.5 bg-[#F8FAFC] rounded-lg border border-[#E5E7EB]"
                    >
                      <span
                        className="flex-1 text-[13px] text-[#2D333A]"
                        style={{ fontFamily: "var(--font-source-sans)" }}
                      >
                        {a.title}
                      </span>
                      <input
                        value={a.estimatedMinutes}
                        onChange={(e) => updateAgendaMinutes(a.id, e.target.value)}
                        type="number"
                        min="0"
                        placeholder="min"
                        className="w-16 h-7 px-2 rounded-md border border-[#E5E7EB] text-[12px] outline-none focus:border-[#5CE1A5]"
                        style={{ fontFamily: "var(--font-source-sans)" }}
                      />
                      <button
                        type="button"
                        onClick={() => removeAgendaItem(a.id)}
                        className="size-6 rounded-md flex items-center justify-center text-[#9CA3AF] hover:text-red-600 hover:bg-red-50"
                      >
                        <X className="size-3" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Field>
        </div>

        <footer className="px-5 py-3 border-t border-[#E5E7EB] flex items-center justify-end gap-2 bg-[#F8FAFC]">
          <button
            type="button"
            onClick={onClose}
            className="h-9 px-3 rounded-xl text-[13px] text-[#6B7280] hover:bg-[#F4F5F7]"
            style={{ fontFamily: "var(--font-poppins)", fontWeight: 600 }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={pending || !title.trim()}
            className="h-9 px-4 rounded-xl bg-[#5CE1A5] text-white text-[13px] font-semibold hover:bg-[#4DD395] disabled:opacity-50"
            style={{ fontFamily: "var(--font-poppins)" }}
          >
            {pending ? "Creating…" : "Create Huddle"}
          </button>
        </footer>
      </div>
    </div>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label
        className="text-[11px] uppercase tracking-wider text-[#9CA3AF] block mb-1.5"
        style={{ fontFamily: "var(--font-poppins)", fontWeight: 600 }}
      >
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}
