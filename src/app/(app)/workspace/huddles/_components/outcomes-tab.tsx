"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import {
  CheckCircle2,
  ExternalLink,
  MessageSquare,
  Plus,
  Sparkles,
  X,
} from "lucide-react";
import {
  createActionItem,
  createDecision,
  deleteActionItem,
  deleteDecision,
  promoteActionItemToTask,
  type HuddleActionItem,
  type HuddleDecision,
} from "@/app/actions/huddles";

interface OutcomesTabProps {
  huddleId: string;
  actionItems: HuddleActionItem[];
  decisions: HuddleDecision[];
  canEdit: boolean;
  onActionsChange: (items: HuddleActionItem[]) => void;
  onDecisionsChange: (items: HuddleDecision[]) => void;
}

// Results of the meeting only. Attendance + role management moved up
// to the Overview tab where it logically belongs ("who's here?" is a
// setup-time question, not a results-time one).
export function OutcomesTab({
  huddleId,
  actionItems,
  decisions,
  canEdit,
  onActionsChange,
  onDecisionsChange,
}: OutcomesTabProps) {
  return (
    <div className="space-y-3">
      <ActionItemsSection
        huddleId={huddleId}
        items={actionItems}
        canEdit={canEdit}
        onChange={onActionsChange}
      />
      <DecisionsSection
        huddleId={huddleId}
        items={decisions}
        canEdit={canEdit}
        onChange={onDecisionsChange}
      />
      <SummaryPlaceholder />
    </div>
  );
}

function ActionItemsSection({
  huddleId,
  items,
  canEdit,
  onChange,
}: {
  huddleId: string;
  items: HuddleActionItem[];
  canEdit: boolean;
  onChange: (items: HuddleActionItem[]) => void;
}) {
  const [draft, setDraft] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function add() {
    const trimmed = draft.trim();
    if (!trimmed) return;
    startTransition(async () => {
      const res = await createActionItem(huddleId, trimmed);
      if (res.success && res.data) {
        onChange([...items, res.data]);
        setDraft("");
      } else if (!res.success) {
        setError(res.error);
        setTimeout(() => setError(null), 4000);
      }
    });
  }

  function promote(item: HuddleActionItem) {
    startTransition(async () => {
      const res = await promoteActionItemToTask(item.id);
      if (res.success && res.data) {
        onChange(
          items.map((i) =>
            i.id === item.id
              ? { ...i, task_id: res.data!.taskId, status: "accepted" }
              : i,
          ),
        );
        setError(null);
      } else if (!res.success) {
        // Surface the real error instead of silently doing nothing —
        // makes promote-to-task gaps (e.g., a missing source column)
        // visible at the click site instead of only in server logs.
        setError(res.error);
        setTimeout(() => setError(null), 6000);
      }
    });
  }

  function remove(item: HuddleActionItem) {
    onChange(items.filter((i) => i.id !== item.id));
    deleteActionItem(item.id);
  }

  return (
    <section className="bg-white border border-[#E5E7EB] rounded-2xl p-5">
      <header className="flex items-center justify-between mb-3">
        <h2
          className="text-[15px] text-[#0F172A]"
          style={{ fontFamily: "var(--font-poppins)", fontWeight: 700 }}
        >
          Action items
        </h2>
        <span
          className="text-[11px] text-[#6B7280]"
          style={{ fontFamily: "var(--font-source-sans)" }}
        >
          {items.filter((i) => i.task_id).length} of {items.length} promoted to tasks
        </span>
      </header>

      {error && (
        <div
          className="mb-3 px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-[12.5px] text-red-700"
          style={{ fontFamily: "var(--font-source-sans)" }}
          role="alert"
        >
          {error}
        </div>
      )}

      {items.length === 0 ? (
        <p
          className="text-[13px] text-[#9CA3AF] py-2"
          style={{ fontFamily: "var(--font-source-sans)" }}
        >
          No action items yet.
        </p>
      ) : (
        <ul className="space-y-2">
          {items.map((item) => (
            <li
              key={item.id}
              className="group flex items-start gap-2 px-3 py-2 rounded-xl bg-[#F8FAFC] border border-[#F1F5F9]"
            >
              <CheckCircle2
                className={`size-4 mt-0.5 shrink-0 ${
                  item.task_id ? "text-[#3B82F6]" : "text-[#CBD5E1]"
                }`}
              />
              <div className="flex-1 min-w-0">
                <p
                  className="text-[13.5px] text-[#2D333A]"
                  style={{ fontFamily: "var(--font-source-sans)" }}
                >
                  {item.description}
                </p>
                <div
                  className="flex items-center gap-2 mt-1 text-[11px] text-[#6B7280]"
                  style={{ fontFamily: "var(--font-source-sans)" }}
                >
                  {item.assignee && (
                    <span>→ {item.assignee.full_name}</span>
                  )}
                  {item.suggested_due_date && (
                    <span>due {new Date(item.suggested_due_date).toLocaleDateString()}</span>
                  )}
                  {item.task_id && item.task_status && (
                    <span
                      className="inline-flex h-4 px-1.5 rounded text-[10px] uppercase tracking-wider bg-[#3B82F6]/15 text-[#1D4ED8]"
                      style={{ fontFamily: "var(--font-poppins)", fontWeight: 700 }}
                    >
                      task · {item.task_status}
                    </span>
                  )}
                </div>
              </div>
              {item.task_id ? (
                <Link
                  href={`/workspace/tasks?taskId=${item.task_id}`}
                  className="h-7 px-2.5 rounded-md text-[11.5px] text-[#3B82F6] hover:bg-[#3B82F6]/10 inline-flex items-center gap-1"
                  style={{ fontFamily: "var(--font-poppins)", fontWeight: 600 }}
                >
                  <ExternalLink className="size-3" />
                  View task
                </Link>
              ) : (
                canEdit && (
                  <button
                    type="button"
                    onClick={() => promote(item)}
                    disabled={pending}
                    className="h-7 px-2.5 rounded-md bg-[#3B82F6] text-white text-[11.5px] font-semibold hover:bg-[#2563EB] disabled:opacity-50 inline-flex items-center gap-1"
                    style={{ fontFamily: "var(--font-poppins)" }}
                  >
                    Promote to task
                  </button>
                )
              )}
              {canEdit && !item.task_id && (
                <button
                  type="button"
                  onClick={() => remove(item)}
                  className="size-6 rounded-md flex items-center justify-center text-[#CBD5E1] hover:text-red-600 hover:bg-red-50 opacity-0 group-hover:opacity-100"
                  aria-label="Remove action item"
                >
                  <X className="size-3" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {canEdit && (
        <div className="mt-3 flex items-center gap-2">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                add();
              }
            }}
            placeholder="Add action item…"
            disabled={pending}
            className="flex-1 h-9 px-3 rounded-lg border border-[#E5E7EB] text-[13px] outline-none focus:border-[#3B82F6]"
            style={{ fontFamily: "var(--font-source-sans)" }}
          />
          <button
            type="button"
            onClick={add}
            disabled={!draft.trim() || pending}
            className="h-9 px-3 rounded-lg bg-[#F4F5F7] text-[#2D333A] text-[12px] font-semibold inline-flex items-center gap-1 hover:bg-[#E5E7EB] disabled:opacity-50"
            style={{ fontFamily: "var(--font-poppins)" }}
          >
            <Plus className="size-3.5" />
            Add
          </button>
        </div>
      )}
    </section>
  );
}

function DecisionsSection({
  huddleId,
  items,
  canEdit,
  onChange,
}: {
  huddleId: string;
  items: HuddleDecision[];
  canEdit: boolean;
  onChange: (items: HuddleDecision[]) => void;
}) {
  const [draft, setDraft] = useState("");
  const [pending, startTransition] = useTransition();

  function add() {
    const trimmed = draft.trim();
    if (!trimmed) return;
    startTransition(async () => {
      const res = await createDecision(huddleId, trimmed);
      if (res.success && res.data) {
        onChange([...items, res.data]);
        setDraft("");
      }
    });
  }

  function remove(item: HuddleDecision) {
    onChange(items.filter((i) => i.id !== item.id));
    deleteDecision(item.id);
  }

  return (
    <section className="bg-white border border-[#E5E7EB] rounded-2xl p-5">
      <header className="flex items-center gap-2 mb-3">
        <MessageSquare className="size-4 text-[#3B82F6]" />
        <h2
          className="text-[15px] text-[#0F172A]"
          style={{ fontFamily: "var(--font-poppins)", fontWeight: 700 }}
        >
          Decisions
        </h2>
      </header>

      {items.length === 0 ? (
        <p
          className="text-[13px] text-[#9CA3AF] py-2"
          style={{ fontFamily: "var(--font-source-sans)" }}
        >
          No decisions logged yet.
        </p>
      ) : (
        <ul className="space-y-2">
          {items.map((d) => (
            <li
              key={d.id}
              className="group flex items-start gap-2 px-3 py-2 rounded-xl bg-[#F8FAFC] border border-[#F1F5F9]"
            >
              <div className="flex-1 min-w-0">
                <p
                  className="text-[13.5px] text-[#2D333A]"
                  style={{ fontFamily: "var(--font-source-sans)" }}
                >
                  {d.decision}
                </p>
                {d.context && (
                  <p
                    className="text-[11.5px] text-[#6B7280] mt-1"
                    style={{ fontFamily: "var(--font-source-sans)" }}
                  >
                    {d.context}
                  </p>
                )}
                {d.decider && (
                  <p
                    className="text-[11px] text-[#9CA3AF] mt-1"
                    style={{ fontFamily: "var(--font-source-sans)" }}
                  >
                    — {d.decider.full_name}
                  </p>
                )}
              </div>
              {canEdit && (
                <button
                  type="button"
                  onClick={() => remove(d)}
                  className="size-6 rounded-md flex items-center justify-center text-[#CBD5E1] hover:text-red-600 hover:bg-red-50 opacity-0 group-hover:opacity-100"
                  aria-label="Remove decision"
                >
                  <X className="size-3" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {canEdit && (
        <div className="mt-3 flex items-center gap-2">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                add();
              }
            }}
            placeholder="Log a decision…"
            disabled={pending}
            className="flex-1 h-9 px-3 rounded-lg border border-[#E5E7EB] text-[13px] outline-none focus:border-[#3B82F6]"
            style={{ fontFamily: "var(--font-source-sans)" }}
          />
          <button
            type="button"
            onClick={add}
            disabled={!draft.trim() || pending}
            className="h-9 px-3 rounded-lg bg-[#F4F5F7] text-[#2D333A] text-[12px] font-semibold inline-flex items-center gap-1 hover:bg-[#E5E7EB] disabled:opacity-50"
            style={{ fontFamily: "var(--font-poppins)" }}
          >
            <Plus className="size-3.5" />
            Add
          </button>
        </div>
      )}
    </section>
  );
}

function SummaryPlaceholder() {
  return (
    <section className="bg-[#F8FAFC] border border-dashed border-[#E5E7EB] rounded-2xl p-5">
      <div className="flex items-start gap-2.5">
        <Sparkles className="size-4 text-[#8B5CF6] mt-0.5" />
        <div>
          <h2
            className="text-[14px] text-[#0F172A]"
            style={{ fontFamily: "var(--font-poppins)", fontWeight: 700 }}
          >
            Summary
          </h2>
          <p
            className="text-[12.5px] text-[#6B7280] mt-1 max-w-md"
            style={{ fontFamily: "var(--font-source-sans)" }}
          >
            Automatic summaries arrive in Phase 2 once recording and
            transcription land. For now, jot a quick recap in the notes
            tab if you need one.
          </p>
        </div>
      </div>
    </section>
  );
}
