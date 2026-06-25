"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { CheckSquare, MessageSquare } from "lucide-react";
import {
  createActionItem,
  createDecision,
  updateHuddleNotes,
  type HuddleActionItem,
  type HuddleDecision,
  type HuddleNotes,
} from "@/app/actions/huddles";

interface NotesTabProps {
  huddleId: string;
  notes: HuddleNotes | null;
  canEdit: boolean;
  onActionAdded: (item: HuddleActionItem) => void;
  onDecisionAdded: (decision: HuddleDecision) => void;
}

export function NotesTab({
  huddleId,
  notes,
  canEdit,
  onActionAdded,
  onDecisionAdded,
}: NotesTabProps) {
  const [content, setContent] = useState(notes?.content ?? "");
  const [editor, setEditor] = useState(notes?.editor ?? null);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(
    notes?.last_edited_at ?? null,
  );
  const [saving, setSaving] = useState(false);
  const dirtyRef = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [actionDraft, setActionDraft] = useState("");
  const [decisionDraft, setDecisionDraft] = useState("");
  const [pending, startTransition] = useTransition();

  function handleChange(next: string) {
    setContent(next);
    dirtyRef.current = true;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      if (!dirtyRef.current) return;
      setSaving(true);
      const res = await updateHuddleNotes(huddleId, next);
      setSaving(false);
      if (res.success) {
        dirtyRef.current = false;
        setLastSavedAt(new Date().toISOString());
        // Editor name persists for the rest of the session.
        if (!editor) setEditor(null);
      }
    }, 5000);
  }

  // Flush pending save on unmount.
  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
      if (dirtyRef.current) {
        updateHuddleNotes(huddleId, content).catch(() => {});
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [huddleId]);

  function addAction() {
    const trimmed = actionDraft.trim();
    if (!trimmed) return;
    startTransition(async () => {
      const res = await createActionItem(huddleId, trimmed);
      if (res.success && res.data) {
        onActionAdded(res.data);
        setActionDraft("");
      }
    });
  }

  function addDecision() {
    const trimmed = decisionDraft.trim();
    if (!trimmed) return;
    startTransition(async () => {
      const res = await createDecision(huddleId, trimmed);
      if (res.success && res.data) {
        onDecisionAdded(res.data);
        setDecisionDraft("");
      }
    });
  }

  return (
    <section className="space-y-3">
      <div className="bg-white border border-[#E5E7EB] rounded-2xl p-5">
        <header className="flex items-center justify-between mb-3">
          <div>
            <h2
              className="text-[15px] text-[#0F172A]"
              style={{ fontFamily: "var(--font-poppins)", fontWeight: 700 }}
            >
              Live notes
            </h2>
            <p
              className="text-[11.5px] text-[#9CA3AF] mt-0.5"
              style={{ fontFamily: "var(--font-source-sans)" }}
            >
              {saving
                ? "Saving…"
                : lastSavedAt
                  ? `Saved ${formatRelative(lastSavedAt)}${editor?.full_name ? ` · last edited by ${editor.full_name}` : ""}`
                  : "Notes autosave every 5 seconds"}
            </p>
          </div>
        </header>
        <textarea
          value={content}
          onChange={(e) => handleChange(e.target.value)}
          disabled={!canEdit}
          rows={14}
          placeholder={
            canEdit
              ? "Capture discussion, takeaways, and links here. Anyone on the huddle can edit."
              : "No notes recorded yet."
          }
          className="w-full px-3 py-2.5 rounded-xl border border-[#E5E7EB] bg-white text-[14px] text-[#2D333A] placeholder-[#9CA3AF] outline-none focus:border-[#3B82F6] resize-vertical"
          style={{ fontFamily: "var(--font-source-sans)", minHeight: "260px" }}
        />
      </div>

      {canEdit && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <QuickAddCard
            icon={<CheckSquare className="size-4 text-[#5CE1A5]" />}
            label="Add action item"
            value={actionDraft}
            onChange={setActionDraft}
            onSubmit={addAction}
            pending={pending}
            placeholder="What needs to happen, and who owns it?"
          />
          <QuickAddCard
            icon={<MessageSquare className="size-4 text-[#3B82F6]" />}
            label="Log a decision"
            value={decisionDraft}
            onChange={setDecisionDraft}
            onSubmit={addDecision}
            pending={pending}
            placeholder="What did the team decide?"
          />
        </div>
      )}
    </section>
  );
}

function QuickAddCard({
  icon,
  label,
  value,
  onChange,
  onSubmit,
  pending,
  placeholder,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  pending: boolean;
  placeholder: string;
}) {
  return (
    <div className="bg-white border border-[#E5E7EB] rounded-2xl p-4">
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <h3
          className="text-[13px] text-[#0F172A]"
          style={{ fontFamily: "var(--font-poppins)", fontWeight: 700 }}
        >
          {label}
        </h3>
      </div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={2}
        placeholder={placeholder}
        className="w-full px-3 py-2 rounded-xl border border-[#E5E7EB] text-[13px] outline-none focus:border-[#3B82F6] resize-none"
        style={{ fontFamily: "var(--font-source-sans)" }}
      />
      <div className="flex justify-end mt-2">
        <button
          type="button"
          onClick={onSubmit}
          disabled={!value.trim() || pending}
          className="h-8 px-3 rounded-lg bg-[#3B82F6] text-white text-[12px] font-semibold hover:bg-[#3B82F6]/80 disabled:opacity-50"
          style={{ fontFamily: "var(--font-poppins)" }}
        >
          Save
        </button>
      </div>
    </div>
  );
}

function formatRelative(iso: string): string {
  const ts = new Date(iso).getTime();
  const diff = Date.now() - ts;
  const s = Math.round(diff / 1000);
  if (s < 5) return "just now";
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return new Date(iso).toLocaleString();
}
