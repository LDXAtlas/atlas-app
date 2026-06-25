"use client";

import { useState, useTransition } from "react";
import { Plus, Search, X } from "lucide-react";
import {
  addHuddleAttendee,
  markAttendance,
  removeHuddleAttendee,
  updateAttendeeRole,
  type AttendeeRole,
  type HuddleAttendee,
} from "@/app/actions/huddles";
import { searchProfiles } from "@/app/actions/profiles";
import { AttendeeAvatar, displayName } from "./attendee-avatar";

interface AttendeeListProps {
  huddleId: string;
  attendees: HuddleAttendee[];
  canManage: boolean;
  onChange: (attendees: HuddleAttendee[]) => void;
}

export function AttendeeList({
  huddleId,
  attendees,
  canManage,
  onChange,
}: AttendeeListProps) {
  const [adding, setAdding] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<{ id: string; full_name: string; email: string | null }[]>([]);
  const [pending, startTransition] = useTransition();

  function openPicker() {
    setAdding(true);
    setQuery("");
    setResults([]);
    searchProfiles("").then((res) => {
      setResults(
        (res.data || []).slice(0, 10).map((p) => ({
          id: p.id,
          full_name: p.full_name || p.email?.split("@")[0] || "Teammate",
          email: p.email,
        })),
      );
    });
  }

  function handleQuery(q: string) {
    setQuery(q);
    searchProfiles(q).then((res) => {
      setResults(
        (res.data || []).slice(0, 10).map((p) => ({
          id: p.id,
          full_name: p.full_name || p.email?.split("@")[0] || "Teammate",
          email: p.email,
        })),
      );
    });
  }

  function add(profile: { id: string; full_name: string }) {
    if (attendees.some((a) => a.profile_id === profile.id)) return;
    startTransition(async () => {
      const res = await addHuddleAttendee(huddleId, profile.id);
      if (res.success && res.data) {
        onChange([...attendees, res.data]);
        setAdding(false);
      }
    });
  }

  function remove(attendee: HuddleAttendee) {
    onChange(attendees.filter((a) => a.id !== attendee.id));
    removeHuddleAttendee(attendee.id);
  }

  function toggleAttendance(attendee: HuddleAttendee) {
    const next = !attendee.attended;
    onChange(
      attendees.map((a) =>
        a.id === attendee.id ? { ...a, attended: next } : a,
      ),
    );
    markAttendance(attendee.id, next);
  }

  return (
    <section className="bg-white border border-[#E5E7EB] rounded-2xl p-5">
      <header className="flex items-center justify-between mb-3">
        <div>
          <h2
            className="text-[15px] text-[#0F172A]"
            style={{ fontFamily: "var(--font-poppins)", fontWeight: 700 }}
          >
            Attendance
          </h2>
          <p
            className="text-[12px] text-[#6B7280] mt-0.5"
            style={{ fontFamily: "var(--font-source-sans)" }}
          >
            {attendees.length} invited · {attendees.filter((a) => a.attended).length} present
          </p>
        </div>
        {canManage && !adding && (
          <button
            type="button"
            onClick={openPicker}
            className="h-8 px-3 rounded-lg bg-[#F4F5F7] text-[#2D333A] text-[12px] font-semibold inline-flex items-center gap-1 hover:bg-[#E5E7EB]"
            style={{ fontFamily: "var(--font-poppins)" }}
          >
            <Plus className="size-3.5" />
            Invite
          </button>
        )}
      </header>

      {adding && (
        <div className="mb-3 p-3 bg-[#F8FAFC] border border-[#E5E7EB] rounded-xl space-y-2">
          <div className="flex items-center gap-2 h-9 px-3 rounded-lg bg-white border border-[#E5E7EB] focus-within:border-[#3B82F6]">
            <Search className="size-3.5 text-[#9CA3AF]" />
            <input
              autoFocus
              value={query}
              onChange={(e) => handleQuery(e.target.value)}
              placeholder="Search teammates"
              className="flex-1 bg-transparent text-[13px] outline-none"
              style={{ fontFamily: "var(--font-source-sans)" }}
            />
            <button
              type="button"
              onClick={() => setAdding(false)}
              className="text-[#9CA3AF] hover:text-[#2D333A]"
              aria-label="Close"
            >
              <X className="size-3.5" />
            </button>
          </div>
          {results.length === 0 ? (
            <p
              className="text-[12px] text-[#9CA3AF] px-1"
              style={{ fontFamily: "var(--font-source-sans)" }}
            >
              No matches.
            </p>
          ) : (
            <ul className="max-h-48 overflow-auto bg-white border border-[#E5E7EB] rounded-lg">
              {results.map((r) => {
                const already = attendees.some((a) => a.profile_id === r.id);
                return (
                  <li key={r.id}>
                    <button
                      type="button"
                      onClick={() => add(r)}
                      disabled={already || pending}
                      className="w-full px-3 py-2 text-left text-[13px] hover:bg-[#F4F5F7] disabled:opacity-50 flex items-center gap-2"
                      style={{ fontFamily: "var(--font-source-sans)" }}
                    >
                      <span className="flex-1 truncate text-[#2D333A]">
                        {r.full_name}
                      </span>
                      {already && (
                        <span
                          className="text-[10px] text-[#9CA3AF] uppercase tracking-wider"
                          style={{ fontFamily: "var(--font-poppins)" }}
                        >
                          Invited
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      {attendees.length === 0 ? (
        <p
          className="text-[13px] text-[#9CA3AF] py-2"
          style={{ fontFamily: "var(--font-source-sans)" }}
        >
          No attendees yet.
        </p>
      ) : (
        <ul className="space-y-1">
          {attendees.map((a) => (
            <AttendeeRow
              key={a.id}
              attendee={a}
              canManage={canManage}
              onRoleChange={(role) => changeRole(a, role)}
              onToggleAttendance={() => toggleAttendance(a)}
              onRemove={() => remove(a)}
            />
          ))}
        </ul>
      )}
    </section>
  );

  function changeRole(attendee: HuddleAttendee, role: AttendeeRole) {
    if (attendee.role === role) return;
    onChange(
      attendees.map((a) =>
        a.id === attendee.id ? { ...a, role } : a,
      ),
    );
    updateAttendeeRole(attendee.id, role).then((res) => {
      if (!res.success) {
        onChange(
          attendees.map((a) =>
            a.id === attendee.id ? { ...a, role: attendee.role } : a,
          ),
        );
      }
    });
  }
}

function AttendeeRow({
  attendee: a,
  canManage,
  onRoleChange,
  onToggleAttendance,
  onRemove,
}: {
  attendee: HuddleAttendee;
  canManage: boolean;
  onRoleChange: (role: AttendeeRole) => void;
  onToggleAttendance: () => void;
  onRemove: () => void;
}) {
  const name = displayName(a.profile, "Guest");
  return (
    <li className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-[#F8FAFC]">
      <AttendeeAvatar profile={a.profile} fallbackLabel="Guest" size={28} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <p
            className="text-[13px] text-[#2D333A] truncate"
            style={{ fontFamily: "var(--font-poppins)", fontWeight: 600 }}
          >
            {name}
          </p>
          {a.role === "organizer" && (
            <span
              className="inline-flex h-4 px-1.5 rounded text-[9.5px] uppercase tracking-wider"
              style={{
                backgroundColor: "#F59E0B22",
                color: "#B45309",
                fontFamily: "var(--font-poppins)",
                fontWeight: 700,
              }}
            >
              Organizer
            </span>
          )}
          {a.role === "presenter" && (
            <span
              className="inline-flex h-4 px-1.5 rounded text-[9.5px] uppercase tracking-wider"
              style={{
                backgroundColor: "#8B5CF622",
                color: "#6D28D9",
                fontFamily: "var(--font-poppins)",
                fontWeight: 700,
              }}
            >
              Presenter
            </span>
          )}
          {a.role === "optional" && (
            <span
              className="inline-flex h-4 px-1.5 rounded text-[9.5px] uppercase tracking-wider bg-[#F3F4F6] text-[#6B7280]"
              style={{ fontFamily: "var(--font-poppins)", fontWeight: 700 }}
            >
              Optional
            </span>
          )}
        </div>
        {a.profile?.email && (
          <p
            className="text-[11px] text-[#9CA3AF] truncate"
            style={{ fontFamily: "var(--font-source-sans)" }}
          >
            {a.profile.email}
          </p>
        )}
      </div>
      {canManage && (
        <>
          <select
            value={a.role}
            onChange={(e) => onRoleChange(e.target.value as AttendeeRole)}
            className="h-7 px-2 rounded-md border border-[#E5E7EB] bg-white text-[11.5px] text-[#2D333A] outline-none focus:border-[#3B82F6]"
            style={{ fontFamily: "var(--font-source-sans)" }}
            aria-label="Attendee role"
          >
            <option value="organizer">Organizer</option>
            <option value="presenter">Presenter</option>
            <option value="attendee">Attendee</option>
            <option value="optional">Optional</option>
          </select>
          <label
            className="inline-flex items-center gap-1.5 text-[11.5px] text-[#6B7280]"
            style={{ fontFamily: "var(--font-source-sans)" }}
          >
            <input
              type="checkbox"
              checked={a.attended}
              onChange={onToggleAttendance}
              className="size-3.5 rounded text-[#3B82F6] border-[#E5E7EB]"
            />
            Present
          </label>
          {a.role !== "organizer" && (
            <button
              type="button"
              onClick={onRemove}
              className="size-6 rounded-md flex items-center justify-center text-[#CBD5E1] hover:text-red-600 hover:bg-red-50"
              aria-label="Remove attendee"
            >
              <X className="size-3" />
            </button>
          )}
        </>
      )}
    </li>
  );
}