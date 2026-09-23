"use client";

// The recorder card. A view only: the session itself (stream,
// MediaRecorder, segment queue, uploads, heartbeat) lives in
// <HuddleRecordingProvider>, mounted once at the huddle page level, so
// recording survives switching between the huddle's tabs — this card is
// inside the Overview tab, which unmounts when you leave it.
//
//   <HuddleRecorder huddleId={huddle.id} canManage={huddle.viewer_can_manage}
//                   huddleStatus={huddle.status} />
//
// Props are unchanged from the pre-provider version, so its mount point
// in the Overview tab stays as-is.

import { useEffect, useState } from "react";
import {
  AlertCircle,
  ChevronDown,
  ChevronRight,
  Loader2,
  Mic,
  Pause,
  Play,
  RefreshCw,
  Square,
  Trash2,
} from "lucide-react";
import {
  UPLOAD_MAX_ATTEMPTS,
  useHuddleRecording,
} from "./huddle-recording-provider";
import {
  huddleRecordingExtension,
  type HuddleRecordingLifecycleState,
} from "@/lib/huddles/huddle-types";

const MINT = "#5CE1A5";

export interface HuddleRecorderProps {
  huddleId: string;
  /** From HuddleDetail.viewer_can_manage. Controls render only — every
   *  action re-checks organizer/admin on the server. */
  canManage: boolean;
  /** Recording requires an in-progress huddle; when this says otherwise
   *  the panel explains that instead of offering a dead button. */
  huddleStatus?: string;
  /** Fires on every recording state change, for a parent-level indicator. */
  onStateChange?: (state: HuddleRecordingLifecycleState) => void;
  className?: string;
}

function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const mm = String(Math.floor(s / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

export function HuddleRecorder({
  canManage,
  huddleStatus,
  onStateChange,
  className,
}: HuddleRecorderProps) {
  const rec = useHuddleRecording();
  const [confirmDelete, setConfirmDelete] = useState(false);
  // Segment ids whose transcript is expanded. Collapsed by default so a
  // long meeting doesn't bury the controls.
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const toggleExpanded = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const state = rec?.state;
  useEffect(() => {
    if (state) onStateChange?.(state);
  }, [onStateChange, state]);

  if (!canManage) return null;

  // Without a provider there is nowhere to keep the session, so say so
  // rather than silently rendering dead controls.
  if (!rec) {
    return (
      <section
        className={`bg-white border border-[#E5E7EB] rounded-2xl p-5 ${className ?? ""}`}
      >
        <p className="flex items-start gap-1.5 text-[12.5px] text-[#EF4444]">
          <AlertCircle className="size-3.5 mt-0.5 shrink-0" />
          Recorder unavailable: no &lt;HuddleRecordingProvider&gt; above this
          component.
        </p>
      </section>
    );
  }

  const notStarted = huddleStatus !== undefined && huddleStatus !== "in_progress";
  const pendingUploads = rec.queue.length;
  const stuckUpload = rec.queue.find((q) => q.attempts >= UPLOAD_MAX_ATTEMPTS);
  const statusColor =
    rec.status.tone === "error"
      ? "#EF4444"
      : rec.status.tone === "success"
        ? "#047857"
        : "#6B7280";
  const meterBars = 12;
  const litBars = Math.min(meterBars, Math.round(rec.level * meterBars * 1.6));

  return (
    <section
      className={`bg-white border border-[#E5E7EB] rounded-2xl p-5 ${className ?? ""}`}
    >
      <div className="flex items-center gap-3 flex-wrap">
        <h3
          className="text-[14px] text-[#0F172A] flex items-center gap-2"
          style={{ fontFamily: "var(--font-poppins)", fontWeight: 700 }}
        >
          <Mic className="size-4" style={{ color: MINT }} />
          Recording
        </h3>
        {rec.state !== "idle" && (
          <span className="flex items-center gap-1.5 text-[12.5px] text-[#6B7280]">
            <span
              className={`size-2 rounded-full ${rec.state === "recording" ? "animate-pulse" : ""}`}
              style={{
                background: rec.state === "recording" ? "#EF4444" : "#F59E0B",
              }}
            />
            {rec.state === "recording" ? "Recording" : "Paused"} ·{" "}
            <span className="tabular-nums">{formatClock(rec.elapsed)}</span>
          </span>
        )}
        <div className="ml-auto flex items-center gap-2">
          {rec.state === "idle" && !rec.armed && (
            <button
              type="button"
              onClick={() => void rec.testMic()}
              disabled={rec.busy}
              className="inline-flex items-center gap-1.5 rounded-full border border-[#E5E7EB] px-3.5 py-1.5 text-[13px] text-[#0F172A] disabled:opacity-50"
            >
              <Mic className="size-3.5" /> Test mic
            </button>
          )}
          {rec.state === "idle" && (
            <button
              type="button"
              onClick={() => void rec.start()}
              disabled={rec.busy || notStarted}
              className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[13px] text-[#0F172A] disabled:opacity-50"
              style={{ background: MINT, fontFamily: "var(--font-source-sans)" }}
            >
              {rec.busy ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Mic className="size-3.5" />
              )}
              Record
            </button>
          )}
          {rec.state === "recording" && (
            <button
              type="button"
              onClick={() => void rec.pause()}
              className="inline-flex items-center gap-1.5 rounded-full border border-[#E5E7EB] px-3.5 py-1.5 text-[13px] text-[#0F172A]"
            >
              <Pause className="size-3.5" /> Pause
            </button>
          )}
          {rec.state === "paused" && (
            <button
              type="button"
              onClick={() => void rec.resume()}
              className="inline-flex items-center gap-1.5 rounded-full border border-[#E5E7EB] px-3.5 py-1.5 text-[13px] text-[#0F172A]"
            >
              <Play className="size-3.5" /> Resume
            </button>
          )}
          {rec.state !== "idle" && (
            <button
              type="button"
              onClick={() => void rec.stop()}
              disabled={rec.busy}
              className="inline-flex items-center gap-1.5 rounded-full border border-[#E5E7EB] px-3.5 py-1.5 text-[13px] text-[#0F172A] disabled:opacity-50"
            >
              <Square className="size-3.5" /> Stop
            </button>
          )}
        </div>
      </div>

      {/* Always-on status line: what it's doing, or exactly what failed. */}
      <p
        className="mt-3 flex items-start gap-1.5 text-[12.5px]"
        style={{ color: statusColor, fontFamily: "var(--font-source-sans)" }}
        aria-live="polite"
      >
        {rec.status.tone === "error" ? (
          <AlertCircle className="size-3.5 mt-0.5 shrink-0" />
        ) : rec.status.tone === "working" ? (
          <Loader2 className="size-3.5 mt-0.5 shrink-0 animate-spin" />
        ) : null}
        <span>
          {notStarted ? "Start the huddle to record. " : ""}
          {rec.status.text}
        </span>
      </p>

      {/* Input device + live level. */}
      <div className="mt-3 flex items-center gap-3 flex-wrap">
        <label
          className="text-[12.5px] text-[#6B7280] flex items-center gap-2"
          style={{ fontFamily: "var(--font-source-sans)" }}
        >
          Input
          <select
            value={rec.deviceId ?? ""}
            onChange={(e) => void rec.selectDevice(e.target.value)}
            disabled={rec.state !== "idle"}
            className="rounded-lg border border-[#E5E7EB] px-2 py-1 text-[12.5px] text-[#0F172A] disabled:opacity-50 max-w-[16rem]"
          >
            <option value="">System default</option>
            {rec.devices.map((device, i) => (
              <option key={device.deviceId} value={device.deviceId}>
                {device.label || `Microphone ${i + 1}`}
              </option>
            ))}
          </select>
        </label>
        <span className="flex items-center gap-[3px]" title="Input level">
          {Array.from({ length: meterBars }).map((_, i) => (
            <span
              key={i}
              className="w-[3px] rounded-full transition-[height,background-color] duration-75"
              style={{
                height: `${6 + i}px`,
                background:
                  rec.armed && i < litBars
                    ? i > meterBars - 3
                      ? "#EF4444"
                      : MINT
                    : "#E5E7EB",
              }}
            />
          ))}
        </span>
        {rec.armed && rec.silent && (
          <span className="text-[12px] text-[#F59E0B]">No input detected</span>
        )}
        {rec.devices.length === 0 && (
          <span className="text-[12px] text-[#9CA3AF]">
            Device names appear after you allow the microphone.
          </span>
        )}
      </div>

      {pendingUploads > 0 && (
        <p className="mt-3 flex items-center gap-1.5 text-[12.5px] text-[#6B7280]">
          {stuckUpload ? (
            <>
              <AlertCircle className="size-3.5 text-[#F59E0B]" />
              {pendingUploads} segment{pendingUploads === 1 ? "" : "s"} couldn&apos;t
              upload. Keep this page open.
              <button
                type="button"
                onClick={rec.retryUploads}
                className="underline"
              >
                Retry
              </button>
            </>
          ) : (
            <>
              <Loader2 className="size-3.5 animate-spin" />
              Uploading {pendingUploads} segment{pendingUploads === 1 ? "" : "s"}…
            </>
          )}
        </p>
      )}

      {rec.segments.length > 0 && (
        <ul className="mt-4 space-y-1.5">
          {rec.segments.map((segment) => {
            const text = segment.text?.trim();
            const isOpen = expanded.has(segment.id);
            return (
              <li
                key={segment.id}
                className="text-[12.5px] text-[#6B7280]"
                style={{ fontFamily: "var(--font-source-sans)" }}
              >
                <div className="flex items-center gap-2">
                  <span className="text-[#0F172A]">
                    Segment {segment.segment_index + 1}
                  </span>
                  <span className="tabular-nums">
                    {formatClock(segment.duration_seconds ?? 0)}
                  </span>
                  <span className="ml-auto flex items-center gap-1.5">
                    {segment.transcription_status === "done" && "Transcribed"}
                    {segment.transcription_status === "processing" && (
                      <>
                        <Loader2 className="size-3 animate-spin" /> Transcribing…
                      </>
                    )}
                    {segment.transcription_status === "pending" && "Queued"}
                    {segment.transcription_status === "awaiting_credits" && (
                      <span className="text-[#F59E0B]">
                        Waiting for AI credits — audio saved
                      </span>
                    )}
                    {segment.transcription_status === "failed" && (
                      <>
                        <span className="text-[#EF4444]">
                          {segment.transcription_error
                            ? `Failed: ${segment.transcription_error}`
                            : "Failed"}
                        </span>
                        <button
                          type="button"
                          onClick={() => void rec.transcribeSegment(segment.id)}
                          className="inline-flex items-center gap-1 underline"
                        >
                          <RefreshCw className="size-3" /> Retry
                        </button>
                      </>
                    )}
                    {text && (
                      <button
                        type="button"
                        onClick={() => toggleExpanded(segment.id)}
                        aria-expanded={isOpen}
                        className="inline-flex items-center gap-1 underline hover:text-[#0F172A]"
                      >
                        {isOpen ? (
                          <ChevronDown className="size-3" />
                        ) : (
                          <ChevronRight className="size-3" />
                        )}
                        {isOpen ? "Hide" : "View"}
                      </button>
                    )}
                  </span>
                </div>
                {text && isOpen && (
                  // Read-only, selectable, scrolls rather than pushing the
                  // rest of the card off screen.
                  <p className="mt-1.5 mb-1 max-h-60 overflow-auto whitespace-pre-wrap rounded-lg bg-[#F4F5F7] px-3 py-2 text-[12.5px] leading-relaxed text-[#0F172A]">
                    {text}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {rec.segments.length > 0 && rec.state === "idle" && (
        <div className="mt-4 pt-3 border-t border-[#F1F5F9]">
          {confirmDelete ? (
            <div className="flex items-center gap-2 text-[12.5px]">
              <span className="text-[#0F172A]">
                Delete the audio and transcript for good?
              </span>
              <button
                type="button"
                onClick={() => {
                  setConfirmDelete(false);
                  void rec.removeRecording();
                }}
                disabled={rec.busy}
                className="rounded-full bg-[#EF4444] px-3 py-1 text-white disabled:opacity-50"
              >
                Delete
              </button>
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                className="underline text-[#6B7280]"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="inline-flex items-center gap-1.5 text-[12.5px] text-[#6B7280] hover:text-[#EF4444]"
            >
              <Trash2 className="size-3.5" /> Delete recording
            </button>
          )}
        </div>
      )}
    </section>
  );
}

export default HuddleRecorder;

// Re-exported for convenience; the extension helper is shared with the
// server so paths and filenames always agree.
export { huddleRecordingExtension };
