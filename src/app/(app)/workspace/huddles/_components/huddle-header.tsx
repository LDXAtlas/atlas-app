"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  ExternalLink,
  Lock,
  Play,
  StopCircle,
  Trash2,
} from "lucide-react";
import {
  deleteHuddle,
  endHuddle,
  finalizeHuddle,
  startHuddle,
  updateHuddle,
  type HuddleDetail,
} from "@/app/actions/huddles";
import { MeetingSourceBadge } from "./meeting-source-badge";

const STATUS_LABEL: Record<HuddleDetail["status"], string> = {
  scheduled: "Scheduled",
  in_progress: "In progress",
  completed: "Completed",
  processing: "Processing",
  ready: "Ready",
  archived: "Archived",
};
const STATUS_COLOR: Record<HuddleDetail["status"], { bg: string; fg: string }> = {
  scheduled: { bg: "#F3F4F6", fg: "#6B7280" },
  in_progress: { bg: "#D1FAE5", fg: "#059669" },
  completed: { bg: "#DBEAFE", fg: "#2563EB" },
  processing: { bg: "#FEF3C7", fg: "#D97706" },
  ready: { bg: "#D1FAE5", fg: "#059669" },
  archived: { bg: "#F3F4F6", fg: "#9CA3AF" },
};

interface HuddleHeaderProps {
  huddle: HuddleDetail;
  onPatch: (patch: Partial<HuddleDetail>) => void;
}

export function HuddleHeader({ huddle, onPatch }: HuddleHeaderProps) {
  const router = useRouter();
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(huddle.title);
  const [pending, startTransition] = useTransition();
  const status = STATUS_COLOR[huddle.status];

  function saveTitle() {
    const next = titleDraft.trim();
    if (!next || next === huddle.title) {
      setTitleDraft(huddle.title);
      setEditingTitle(false);
      return;
    }
    setEditingTitle(false);
    onPatch({ title: next });
    startTransition(async () => {
      await updateHuddle(huddle.id, { title: next });
    });
  }

  function fire(action: () => Promise<unknown>) {
    startTransition(async () => {
      await action();
      router.refresh();
    });
  }

  return (
    <header className="bg-white border-b border-[#E5E7EB] px-5 py-4">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center gap-3 mb-3">
          <button
            type="button"
            onClick={() => router.push("/workspace/huddles")}
            className="size-9 rounded-xl flex items-center justify-center text-[#6B7280] hover:text-[#2D333A] hover:bg-[#F4F5F7]"
            aria-label="Back to huddles"
          >
            <ArrowLeft className="size-4" />
          </button>
          <span
            className="text-[11px] uppercase tracking-wider text-[#9CA3AF]"
            style={{ fontFamily: "var(--font-poppins)", fontWeight: 600 }}
          >
            Huddles
          </span>
          <span
            className="inline-flex h-5 px-1.5 rounded-md text-[10px] uppercase tracking-wider"
            style={{
              backgroundColor: status.bg,
              color: status.fg,
              fontFamily: "var(--font-poppins)",
              fontWeight: 700,
            }}
          >
            {STATUS_LABEL[huddle.status]}
          </span>
        </div>

        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex-1 min-w-0">
            {editingTitle ? (
              <input
                autoFocus
                value={titleDraft}
                onChange={(e) => setTitleDraft(e.target.value)}
                onBlur={saveTitle}
                onKeyDown={(e) => {
                  if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                  else if (e.key === "Escape") {
                    setTitleDraft(huddle.title);
                    setEditingTitle(false);
                  }
                }}
                className="w-full text-2xl text-[#0F172A] bg-white border border-[#5CE1A5] rounded-xl px-3 py-1.5 outline-none"
                style={{ fontFamily: "var(--font-poppins)", fontWeight: 700 }}
              />
            ) : (
              <h1
                onClick={() => huddle.viewer_can_manage && setEditingTitle(true)}
                className={`text-2xl text-[#0F172A] leading-tight ${
                  huddle.viewer_can_manage
                    ? "cursor-text hover:bg-[#F8FAFC] rounded-xl -mx-2 px-2 py-1"
                    : ""
                }`}
                style={{ fontFamily: "var(--font-poppins)", fontWeight: 700 }}
              >
                {huddle.title}
              </h1>
            )}

            <div
              className="flex items-center gap-3 flex-wrap mt-2 text-[12.5px] text-[#6B7280]"
              style={{ fontFamily: "var(--font-source-sans)" }}
            >
              {huddle.scheduled_start && (
                <span className="inline-flex items-center gap-1">
                  <Calendar className="size-3.5" />
                  {formatWhen(huddle.scheduled_start, huddle.scheduled_end)}
                </span>
              )}
              <MeetingSourceBadge
                source={huddle.meeting_source}
                detail={
                  huddle.meeting_source === "in_person"
                    ? huddle.location
                    : huddle.meeting_source === "external_video_link"
                      ? "External video"
                      : null
                }
                size="md"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {huddle.external_meeting_url && (
              <a
                href={huddle.external_meeting_url}
                target="_blank"
                rel="noopener noreferrer"
                className="h-9 px-3.5 rounded-xl bg-[#3B82F6] text-white text-[13px] font-semibold inline-flex items-center gap-1.5 hover:bg-[#2563EB]"
                style={{ fontFamily: "var(--font-poppins)" }}
              >
                <ExternalLink className="size-3.5" />
                Join Meeting
              </a>
            )}
            {huddle.viewer_can_manage && (
              <>
                {huddle.status === "scheduled" && (
                  <button
                    type="button"
                    onClick={() => fire(() => startHuddle(huddle.id))}
                    disabled={pending}
                    className="h-9 px-3.5 rounded-xl bg-[#5CE1A5] text-white text-[13px] font-semibold inline-flex items-center gap-1.5 hover:bg-[#4DD395] disabled:opacity-50"
                    style={{ fontFamily: "var(--font-poppins)" }}
                  >
                    <Play className="size-3.5" />
                    Start
                  </button>
                )}
                {huddle.status === "in_progress" && (
                  <button
                    type="button"
                    onClick={() => fire(() => endHuddle(huddle.id))}
                    disabled={pending}
                    className="h-9 px-3.5 rounded-xl bg-[#F59E0B] text-white text-[13px] font-semibold inline-flex items-center gap-1.5 hover:bg-[#D97706] disabled:opacity-50"
                    style={{ fontFamily: "var(--font-poppins)" }}
                  >
                    <StopCircle className="size-3.5" />
                    End
                  </button>
                )}
                {(huddle.status === "completed" || huddle.status === "ready") && (
                  <button
                    type="button"
                    onClick={() => fire(() => finalizeHuddle(huddle.id))}
                    disabled={pending}
                    className="h-9 px-3.5 rounded-xl bg-[#0F172A] text-white text-[13px] font-semibold inline-flex items-center gap-1.5 hover:bg-[#1E293B] disabled:opacity-50"
                    style={{ fontFamily: "var(--font-poppins)" }}
                  >
                    <Lock className="size-3.5" />
                    Finalize
                  </button>
                )}
                {huddle.status === "archived" && (
                  <span
                    className="h-9 px-3 rounded-xl bg-[#F3F4F6] text-[#6B7280] text-[12px] inline-flex items-center gap-1.5"
                    style={{ fontFamily: "var(--font-poppins)", fontWeight: 600 }}
                  >
                    <CheckCircle2 className="size-3.5" />
                    Archived
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => {
                    if (!window.confirm("Delete this huddle? This can't be undone.")) return;
                    fire(async () => {
                      await deleteHuddle(huddle.id);
                      router.push("/workspace/huddles");
                    });
                  }}
                  disabled={pending}
                  className="size-9 rounded-xl flex items-center justify-center text-[#9CA3AF] hover:text-red-600 hover:bg-red-50"
                  aria-label="Delete huddle"
                  title="Delete huddle"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

function formatWhen(start: string, end: string | null): string {
  try {
    const s = new Date(start);
    const date = s.toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
    const sT = s.toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
    });
    if (!end) return `${date}, ${sT}`;
    const e = new Date(end);
    const eT = e.toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
    });
    return `${date}, ${sT} – ${eT}`;
  } catch {
    return start;
  }
}
