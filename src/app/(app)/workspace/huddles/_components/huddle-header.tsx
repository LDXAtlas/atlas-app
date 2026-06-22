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
  Settings,
  StopCircle,
} from "lucide-react";
import {
  endHuddle,
  finalizeHuddle,
  startHuddle,
  updateHuddle,
  type HuddleDetail,
  type HuddleStatus,
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
  scheduled: { bg: "#3B82F6", fg: "#FFFFFF" },
  in_progress: { bg: "#D1FAE5", fg: "#059669" },
  completed: { bg: "#DBEAFE", fg: "#2563EB" },
  processing: { bg: "#FEF3C7", fg: "#D97706" },
  ready: { bg: "#D1FAE5", fg: "#059669" },
  archived: { bg: "#F3F4F6", fg: "#9CA3AF" },
};

interface HuddleHeaderProps {
  huddle: HuddleDetail;
  onPatch: (patch: Partial<HuddleDetail>) => void;
  onOpenSettings?: () => void;
}

export function HuddleHeader({
  huddle,
  onPatch,
  onOpenSettings,
}: HuddleHeaderProps) {
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

  const [toast, setToast] = useState<string | null>(null);

  function lifecycle(
    nextStatus: HuddleStatus,
    timestampField: "actual_start" | "actual_end" | null,
    action: () => Promise<{ success: boolean; error?: string }>,
  ) {
    const previous = {
      status: huddle.status,
      actual_start: huddle.actual_start,
      actual_end: huddle.actual_end,
    };
    const nowIso = new Date().toISOString();
    onPatch({
      status: nextStatus,
      ...(timestampField === "actual_start" ? { actual_start: nowIso } : {}),
      ...(timestampField === "actual_end" ? { actual_end: nowIso } : {}),
    });
    startTransition(async () => {
      const res = await action();
      if (!res.success) {
        onPatch(previous);
        setToast(res.error || "Couldn't update the huddle.");
        setTimeout(() => setToast(null), 3500);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="w-full">
      {huddle.status === "in_progress" && (
        <div
          className="w-full px-5 md:px-10 lg:px-12 py-2 bg-[#5CE1A5]/10 border-b border-[#5CE1A5]/30 flex items-center gap-2"
          role="status"
          aria-live="polite"
        >
          <span className="relative inline-flex">
            <span className="size-2 rounded-full bg-[#10B981] animate-pulse" />
            <span className="absolute inset-0 size-2 rounded-full bg-[#10B981]/40 animate-ping" />
          </span>
          <span
            className="text-[12.5px] text-[#059669]"
            style={{
              fontFamily: "var(--font-poppins)",
              fontWeight: 700,
            }}
          >
            Meeting in progress
          </span>
        </div>
      )}

      {toast && (
        <div
          className="w-full px-5 md:px-10 lg:px-12 py-2 bg-red-50 border-b border-red-200"
          role="alert"
        >
          <p
            className="text-[12.5px] text-red-700"
            style={{ fontFamily: "var(--font-source-sans)" }}
          >
            {toast}
          </p>
        </div>
      )}

      <header className="w-full px-5 md:px-10 lg:px-12 pt-8 md:pt-12 pb-6">
        <div className="flex items-center gap-3 mb-3">
          <button
            type="button"
            onClick={() => router.push("/workspace/huddles")}
            className="size-9 rounded-xl flex items-center justify-center text-[#6B7280] hover:text-[#2D333A] hover:bg-[#E5E7EB]"
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
            className="inline-flex h-5 px-1.5 rounded-md text-[10px] uppercase tracking-wider items-center"
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
                className="w-full text-2xl md:text-3xl lg:text-4xl text-[#0F172A] bg-white border border-[#5CE1A5] rounded-xl px-3 py-1.5 outline-none"
                style={{ fontFamily: "var(--font-poppins)", fontWeight: 700 }}
              />
            ) : (
              <h1
                onClick={() => huddle.viewer_can_manage && setEditingTitle(true)}
                className={`text-2xl md:text-3xl lg:text-4xl text-[#0F172A] tracking-tight leading-tight ${
                  huddle.viewer_can_manage
                    ? "cursor-text hover:bg-black/5 rounded-xl -mx-2 px-2 py-1 transition-colors"
                    : ""
                }`}
                style={{ fontFamily: "var(--font-poppins)", fontWeight: 700 }}
              >
                {huddle.title}
              </h1>
            )}

            <div
              className="flex items-center gap-3 flex-wrap mt-3 text-[12.5px] md:text-[13px] text-[#6B7280]"
              style={{ fontFamily: "var(--font-source-sans)" }}
            >
              {huddle.scheduled_start && (
                <span className="inline-flex items-center gap-1.5">
                  <Calendar className="size-3.5 text-[#94A3B8]" />
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
                className="h-10 px-4 rounded-xl bg-[#3B82F6] text-white text-[13.5px] font-semibold inline-flex items-center gap-2 hover:bg-[#2563EB] shadow-sm hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200"
                style={{ fontFamily: "var(--font-poppins)" }}
              >
                <ExternalLink className="size-4" />
                Join Meeting
              </a>
            )}
            {huddle.viewer_can_manage && (
              <>
                {huddle.status === "scheduled" && (
                  <button
                    type="button"
                    onClick={() =>
                      lifecycle("in_progress", "actual_start", () =>
                        startHuddle(huddle.id),
                      )
                    }
                    disabled={pending}
                    className="h-10 px-4 rounded-xl bg-[#3B82F6] text-white text-[13.5px] font-semibold inline-flex items-center gap-2 hover:bg-[#2563EB] shadow-sm hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200 disabled:opacity-50"
                    style={{ fontFamily: "var(--font-poppins)" }}
                  >
                    <Play className="size-4" />
                    Start
                  </button>
                )}
                {huddle.status === "in_progress" && (
                  <button
                    type="button"
                    onClick={() =>
                      lifecycle("completed", "actual_end", () =>
                        endHuddle(huddle.id),
                      )
                    }
                    disabled={pending}
                    className="h-10 px-4 rounded-xl bg-[#F59E0B] text-white text-[13.5px] font-semibold inline-flex items-center gap-2 hover:bg-[#D97706] shadow-sm hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200 disabled:opacity-50"
                    style={{ fontFamily: "var(--font-poppins)" }}
                  >
                    <StopCircle className="size-4" />
                    End
                  </button>
                )}
                {(huddle.status === "completed" || huddle.status === "ready") && (
                  <button
                    type="button"
                    onClick={() =>
                      lifecycle("archived", null, () =>
                        finalizeHuddle(huddle.id),
                      )
                    }
                    disabled={pending}
                    className="h-10 px-4 rounded-xl bg-[#0F172A] text-white text-[13.5px] font-semibold inline-flex items-center gap-2 hover:bg-[#1E293B] shadow-sm hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200 disabled:opacity-50"
                    style={{ fontFamily: "var(--font-poppins)" }}
                  >
                    <Lock className="size-4" />
                    Finalize
                  </button>
                )}
                {huddle.status === "archived" && (
                  <span
                    className="h-10 px-3.5 rounded-xl bg-[#E2E8F0] text-[#475569] text-[13px] inline-flex items-center gap-2"
                    style={{ fontFamily: "var(--font-poppins)", fontWeight: 600 }}
                  >
                    <CheckCircle2 className="size-4" />
                    Archived
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => onOpenSettings?.()}
                  className="size-10 rounded-xl flex items-center justify-center text-[#9CA3AF] hover:text-[#2D333A] hover:bg-[#E5E7EB] transition-colors"
                  aria-label="Huddle settings"
                  title="Settings"
                >
                  <Settings className="size-4" />
                </button>
              </>
            )}
          </div>
        </div>
      </header>
    </div>
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