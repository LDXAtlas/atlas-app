"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Trash2, X } from "lucide-react";
import {
  deleteHuddle,
  updateHuddleSettings,
  type HuddleDetail,
  type HuddleVisibility,
} from "@/app/actions/huddles";

interface HuddleSettingsPanelProps {
  open: boolean;
  onClose: () => void;
  huddle: HuddleDetail;
  departments: { id: string; name: string }[];
  onPatch: (patch: Partial<HuddleDetail>) => void;
}

// Modal triggered from the header gear. Centralizes the per-huddle
// config knobs (visibility / department / retention) so they aren't
// mixed in with running-the-meeting controls, and parks Delete here
// behind a confirmation step so it's hard to hit by accident.
export function HuddleSettingsPanel({
  open,
  onClose,
  huddle,
  departments,
  onPatch,
}: HuddleSettingsPanelProps) {
  const router = useRouter();
  const [visibility, setVisibility] = useState<HuddleVisibility>(huddle.visibility);
  const [departmentId, setDepartmentId] = useState<string>(huddle.department_id ?? "");
  const [retentionDays, setRetentionDays] = useState<string>("30");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Reset the form when the modal opens — avoid stale draft state if
  // the user closes without saving and reopens.
  useEffect(() => {
    if (!open) return;
    setVisibility(huddle.visibility);
    setDepartmentId(huddle.department_id ?? "");
    setRetentionDays("30");
    setConfirmDelete(false);
    setError(null);
  }, [open, huddle.visibility, huddle.department_id]);

  function handleSave() {
    if (visibility === "department" && !departmentId) {
      setError("Pick a department for a department-scoped huddle.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await updateHuddleSettings(huddle.id, {
        visibility,
        departmentId: visibility === "department" ? departmentId : null,
        recordingRetentionDays: retentionDays
          ? Number(retentionDays)
          : null,
      });
      if (!res.success) {
        setError(res.error);
        return;
      }
      onPatch({
        visibility,
        department_id: visibility === "department" ? departmentId : null,
      });
      onClose();
    });
  }

  function handleDelete() {
    startTransition(async () => {
      const res = await deleteHuddle(huddle.id);
      if (!res.success) {
        setError(res.error);
        return;
      }
      router.push("/workspace/huddles");
    });
  }

  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="px-5 py-4 border-b border-[#E5E7EB] flex items-center justify-between">
          <h2
            className="text-[16px] text-[#0F172A]"
            style={{ fontFamily: "var(--font-poppins)", fontWeight: 700 }}
          >
            Huddle settings
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

          <Field label="Visibility">
            <div className="space-y-1.5">
              {(
                [
                  {
                    value: "invitees_only",
                    label: "Invitees only",
                    hint: "Only invited attendees can see this huddle.",
                  },
                  {
                    value: "department",
                    label: "Department",
                    hint: "Members of a specific department.",
                  },
                  {
                    value: "organization",
                    label: "Organization",
                    hint: "Everyone in your church.",
                  },
                  {
                    value: "private",
                    label: "Private",
                    hint: "Only you.",
                  },
                ] as const
              ).map((opt) => {
                const selected = visibility === opt.value;
                return (
                  <label
                    key={opt.value}
                    className={`flex items-start gap-2 px-3 py-2 rounded-xl border cursor-pointer transition-colors ${
                      selected
                        ? "border-[#5CE1A5] bg-[#5CE1A5]/5"
                        : "border-[#E5E7EB] hover:bg-[#F4F5F7]"
                    }`}
                  >
                    <input
                      type="radio"
                      name="huddle-visibility"
                      checked={selected}
                      onChange={() => setVisibility(opt.value)}
                      className="mt-1 text-[#5CE1A5] focus:ring-[#5CE1A5]"
                    />
                    <div>
                      <p
                        className="text-[13px] text-[#2D333A]"
                        style={{
                          fontFamily: "var(--font-poppins)",
                          fontWeight: 600,
                        }}
                      >
                        {opt.label}
                      </p>
                      <p
                        className="text-[11.5px] text-[#6B7280]"
                        style={{ fontFamily: "var(--font-source-sans)" }}
                      >
                        {opt.hint}
                      </p>
                    </div>
                  </label>
                );
              })}
            </div>
          </Field>

          {visibility === "department" && (
            <Field label="Department">
              <select
                value={departmentId}
                onChange={(e) => setDepartmentId(e.target.value)}
                className="w-full h-10 px-3 rounded-xl border border-[#E5E7EB] text-[13px] outline-none focus:border-[#5CE1A5] bg-white"
                style={{ fontFamily: "var(--font-source-sans)" }}
              >
                <option value="">Select a department…</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </Field>
          )}

          <Field label="Recording retention (days)">
            <input
              type="number"
              min={1}
              max={365}
              value={retentionDays}
              onChange={(e) => setRetentionDays(e.target.value)}
              placeholder="30"
              className="w-full h-10 px-3 rounded-xl border border-[#E5E7EB] text-[13px] outline-none focus:border-[#5CE1A5]"
              style={{ fontFamily: "var(--font-source-sans)" }}
            />
            <p
              className="text-[11.5px] text-[#9CA3AF] mt-1"
              style={{ fontFamily: "var(--font-source-sans)" }}
            >
              How long Atlas keeps the recording once Phase 2 ships.
              Default 30 days.
            </p>
          </Field>

          {huddle.viewer_can_manage && (
            <div className="pt-3 mt-3 border-t border-[#F1F5F9]">
              <p
                className="text-[11px] uppercase tracking-wider text-[#9CA3AF] mb-2"
                style={{
                  fontFamily: "var(--font-poppins)",
                  fontWeight: 600,
                }}
              >
                Danger zone
              </p>
              {confirmDelete ? (
                <div className="bg-red-50 border border-red-200 rounded-xl p-3">
                  <div className="flex items-start gap-2 mb-3">
                    <AlertTriangle className="size-4 text-red-600 mt-0.5 shrink-0" />
                    <p
                      className="text-[13px] text-red-700"
                      style={{ fontFamily: "var(--font-source-sans)" }}
                    >
                      Delete this huddle? Agenda, notes, decisions, and
                      action items are deleted too. Promoted tasks
                      keep working but lose their back-link. This can&rsquo;t
                      be undone.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleDelete}
                      disabled={pending}
                      className="h-8 px-3 rounded-lg bg-red-600 text-white text-[12px] font-semibold hover:bg-red-700 disabled:opacity-50"
                      style={{ fontFamily: "var(--font-poppins)" }}
                    >
                      {pending ? "Deleting…" : "Yes, delete"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(false)}
                      className="h-8 px-3 rounded-lg text-[12px] text-[#6B7280] hover:bg-white"
                      style={{ fontFamily: "var(--font-poppins)" }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  className="h-9 px-3 rounded-xl bg-white border border-red-200 text-[13px] text-red-600 hover:bg-red-50 inline-flex items-center gap-1.5"
                  style={{ fontFamily: "var(--font-poppins)", fontWeight: 600 }}
                >
                  <Trash2 className="size-3.5" />
                  Delete huddle
                </button>
              )}
            </div>
          )}
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
            onClick={handleSave}
            disabled={pending}
            className="h-9 px-4 rounded-xl bg-[#5CE1A5] text-white text-[13px] font-semibold hover:bg-[#4DD395] disabled:opacity-50"
            style={{ fontFamily: "var(--font-poppins)" }}
          >
            {pending ? "Saving…" : "Save settings"}
          </button>
        </footer>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label
        className="text-[11px] uppercase tracking-wider text-[#9CA3AF] block mb-1.5"
        style={{ fontFamily: "var(--font-poppins)", fontWeight: 600 }}
      >
        {label}
      </label>
      {children}
    </div>
  );
}
