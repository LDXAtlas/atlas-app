"use client";

import { useState, useTransition } from "react";
import { Plus, Search, X } from "lucide-react";
import {
  addHuddleAttendee,
  markAttendance,
  removeHuddleAttendee,
  type HuddleAttendee,
} from "@/app/actions/huddles";
import { searchProfiles } from "@/app/actions/profiles";

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
    // Pre-populate with top profiles so users see something immediately.
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
          <div className="flex items-center gap-2 h-9 px-3 rounded-lg bg-white border border-[#E5E7EB] focus-within:border-[#5CE1A5]">
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
            <li
              key={a.id}
              className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-[#F8FAFC]"
            >
              <span
                className="size-7 rounded-full flex items-center justify-center text-[11px] font-semibold text-[#0F172A] shrink-0"
                style={{ backgroundColor: a.profile?.avatar_color || "#5CE1A5" }}
              >
                {initials(a.profile?.full_name || "?")}
              </span>
              <div className="flex-1 min-w-0">
                <p
                  className="text-[13px] text-[#2D333A] truncate"
                  style={{ fontFamily: "var(--font-poppins)", fontWeight: 600 }}
                >
                  {a.profile?.full_name || "Teammate"}
                </p>
                <p
                  className="text-[11px] text-[#9CA3AF]"
                  style={{ fontFamily: "var(--font-source-sans)" }}
                >
                  {a.role === "organizer" ? "Organizer" : a.role === "presenter" ? "Presenter" : "Attendee"}
                </p>
              </div>
              {canManage && (
                <>
                  <label
                    className="inline-flex items-center gap-1.5 text-[11.5px] text-[#6B7280]"
                    style={{ fontFamily: "var(--font-source-sans)" }}
                  >
                    <input
                      type="checkbox"
                      checked={a.attended}
                      onChange={() => toggleAttendance(a)}
                      className="size-3.5 rounded text-[#5CE1A5] border-[#E5E7EB]"
                    />
                    Present
                  </label>
                  <button
                    type="button"
                    onClick={() => remove(a)}
                    className="size-6 rounded-md flex items-center justify-center text-[#CBD5E1] hover:text-red-600 hover:bg-red-50"
                    aria-label="Remove attendee"
                  >
                    <X className="size-3" />
                  </button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function initials(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? "")
      .join("") || "·"
  );
}
