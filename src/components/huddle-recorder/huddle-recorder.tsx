"use client";

// Self-contained huddle recorder. Lives outside the huddles UI folder so
// it can be mounted wherever Ben wants it:
//
//   <HuddleRecorder huddleId={huddle.id} canManage={huddle.viewer_can_manage}
//                   huddleStatus={huddle.status} />
//
// Segment model: pause/resume ends a segment and starts a new one, and a
// segment also rolls at 15 minutes or ~20 MB. Each finished segment is
// uploaded straight to storage with a signed URL, then transcribed
// through the API route. Nothing here streams audio through a server
// action — their request bodies are far too small for it.

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  Loader2,
  Mic,
  Pause,
  Play,
  RefreshCw,
  Square,
  Trash2,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  completeRecordingSegmentUpload,
  createRecordingSegmentUpload,
  deleteHuddleRecording,
  getHuddleTranscript,
  heartbeatHuddleRecording,
  startHuddleRecording,
  stopHuddleRecording,
} from "@/app/actions/huddles";
import {
  HUDDLE_RECORDING_AUDIO_BPS,
  HUDDLE_RECORDING_HEARTBEAT_MS,
  HUDDLE_RECORDING_MIME_CANDIDATES,
  HUDDLE_SEGMENT_ROLL_BYTES,
  HUDDLE_SEGMENT_ROLL_MS,
  huddleRecordingExtension,
  type HuddleRecordingLifecycleState,
  type HuddleTranscriptSegmentView,
} from "@/lib/huddles/huddle-types";

const MINT = "#5CE1A5";
const UPLOAD_MAX_ATTEMPTS = 3;

export interface HuddleRecorderProps {
  huddleId: string;
  /** From HuddleDetail.viewer_can_manage. Controls render only — every
   *  action re-checks organizer/admin on the server. */
  canManage: boolean;
  /** Recording requires an in-progress huddle; when this says otherwise
   *  the panel explains that instead of offering a dead button. */
  huddleStatus?: string;
  /** Fires on every local state change, for a parent-level indicator. */
  onStateChange?: (state: HuddleRecordingLifecycleState) => void;
  className?: string;
}

type QueuedSegment = {
  key: string;
  blob: Blob;
  mimeType: string;
  startedAt: string;
  endedAt: string;
  durationSeconds: number;
  attempts: number;
  error: string | null;
};

function pickMimeType(): string | null {
  if (typeof MediaRecorder === "undefined") return null;
  for (const candidate of HUDDLE_RECORDING_MIME_CANDIDATES) {
    try {
      if (MediaRecorder.isTypeSupported(candidate)) return candidate;
    } catch {
      // Older browsers throw instead of returning false.
    }
  }
  return null;
}

function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const mm = String(Math.floor(s / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

export function HuddleRecorder({
  huddleId,
  canManage,
  huddleStatus,
  onStateChange,
  className,
}: HuddleRecorderProps) {
  const [state, setState] = useState<HuddleRecordingLifecycleState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [queue, setQueue] = useState<QueuedSegment[]>([]);
  const [segments, setSegments] = useState<HuddleTranscriptSegmentView[]>([]);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const bytesRef = useRef(0);
  const segmentStartRef = useRef<number>(0);
  const bankedSecondsRef = useRef(0);
  const rollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // A timed/size roll restarts recording from inside the previous
  // recorder's onstop, so startSegment has to reach itself — via a ref,
  // so the call always lands on the current closure.
  const startSegmentRef = useRef<
    ((stream: MediaStream, mimeType: string) => void) | null
  >(null);
  const queueRef = useRef<QueuedSegment[]>([]);
  const drainingRef = useRef(false);
  const stateRef = useRef<HuddleRecordingLifecycleState>("idle");

  const setLifecycle = useCallback(
    (next: HuddleRecordingLifecycleState) => {
      stateRef.current = next;
      setState(next);
      onStateChange?.(next);
    },
    [onStateChange],
  );

  // Segment list drives the per-segment status rows (and retry). The
  // recorder is organizer-only, so reading the transcript view is fine.
  const refreshSegments = useCallback(async () => {
    const res = await getHuddleTranscript(huddleId).catch(() => null);
    if (res?.success && res.data) setSegments(res.data.segments);
  }, [huddleId]);

  // ─── Upload queue ──────────────────────────────────────────
  // Sequential, with backoff. A failed segment stays in the queue (and
  // in memory) so it can be retried rather than silently lost.
  const drainQueue = useCallback(async () => {
    if (drainingRef.current) return;
    drainingRef.current = true;
    try {
      while (queueRef.current.length > 0) {
        const job = queueRef.current[0]!;
        const ticket = await createRecordingSegmentUpload({
          huddleId,
          startedAt: job.startedAt,
          endedAt: job.endedAt,
          durationSeconds: job.durationSeconds,
          mimeType: job.mimeType,
          sizeBytes: job.blob.size,
          audioBitsPerSecond: HUDDLE_RECORDING_AUDIO_BPS,
        }).catch((e: unknown) => ({
          success: false as const,
          error: e instanceof Error ? e.message : "Upload failed.",
        }));

        let failure: string | null = null;
        if (!ticket.success || !ticket.data) {
          failure = ticket.success ? "Upload failed." : ticket.error;
        } else {
          const supabase = createClient();
          // Base MIME only: the bucket's allowed types have no ;codecs=.
          const contentType = job.mimeType.split(";")[0]!.trim();
          const { error: uploadError } = await supabase.storage
            .from(ticket.data.bucket)
            .uploadToSignedUrl(ticket.data.path, ticket.data.token, job.blob, {
              contentType,
            });
          if (uploadError) {
            failure = uploadError.message;
          } else {
            const confirmed = await completeRecordingSegmentUpload(
              ticket.data.recordingId,
            ).catch((e: unknown) => ({
              success: false as const,
              error: e instanceof Error ? e.message : "Confirm failed.",
            }));
            if (!confirmed.success) {
              failure = confirmed.error;
            } else {
              // Fire-and-forget: the segment list shows the outcome, and
              // a failed transcription can be retried from the panel.
              void fetch(
                `/api/huddles/recordings/${ticket.data.recordingId}/transcribe`,
                { method: "POST" },
              )
                .catch(() => undefined)
                .then(() => refreshSegments());
            }
          }
        }

        if (failure) {
          job.attempts += 1;
          job.error = failure;
          setQueue([...queueRef.current]);
          if (job.attempts >= UPLOAD_MAX_ATTEMPTS) {
            // Leave it queued and stop draining; the Retry button picks
            // it up again.
            break;
          }
          await new Promise((r) => setTimeout(r, 1000 * job.attempts));
          continue;
        }

        queueRef.current = queueRef.current.slice(1);
        setQueue([...queueRef.current]);
        void refreshSegments();
      }
    } finally {
      drainingRef.current = false;
    }
  }, [huddleId, refreshSegments]);

  const enqueue = useCallback(
    (job: QueuedSegment) => {
      queueRef.current = [...queueRef.current, job];
      setQueue([...queueRef.current]);
      void drainQueue();
    },
    [drainQueue],
  );

  // ─── MediaRecorder plumbing ────────────────────────────────
  const finishSegment = useCallback(() => {
    const recorder = recorderRef.current;
    if (!recorder) return;
    recorderRef.current = null;
    if (rollTimerRef.current) {
      clearTimeout(rollTimerRef.current);
      rollTimerRef.current = null;
    }
    if (recorder.state !== "inactive") recorder.stop();
  }, []);

  const startSegment = useCallback(
    (stream: MediaStream, mimeType: string) => {
      const recorder = new MediaRecorder(stream, {
        mimeType,
        audioBitsPerSecond: HUDDLE_RECORDING_AUDIO_BPS,
      });
      chunksRef.current = [];
      bytesRef.current = 0;
      segmentStartRef.current = Date.now();

      recorder.ondataavailable = (event: BlobEvent) => {
        if (!event.data || event.data.size === 0) return;
        chunksRef.current.push(event.data);
        bytesRef.current += event.data.size;
        // Roll early if the segment is approaching Whisper's file limit.
        if (
          bytesRef.current >= HUDDLE_SEGMENT_ROLL_BYTES &&
          recorderRef.current === recorder &&
          stateRef.current === "recording"
        ) {
          finishSegment();
        }
      };

      recorder.onstop = () => {
        const startedMs = segmentStartRef.current;
        const endedMs = Date.now();
        const blob = new Blob(chunksRef.current, {
          type: recorder.mimeType || mimeType,
        });
        chunksRef.current = [];
        const durationSeconds = Math.max(
          1,
          Math.round((endedMs - startedMs) / 1000),
        );
        bankedSecondsRef.current += durationSeconds;
        if (blob.size > 0) {
          enqueue({
            key: `${startedMs}-${blob.size}`,
            blob,
            mimeType: recorder.mimeType || mimeType,
            startedAt: new Date(startedMs).toISOString(),
            endedAt: new Date(endedMs).toISOString(),
            durationSeconds,
            attempts: 0,
            error: null,
          });
        }
        // A timed/size roll continues straight into the next segment.
        if (stateRef.current === "recording" && streamRef.current) {
          startSegmentRef.current?.(streamRef.current, mimeType);
        }
      };

      recorder.start(10_000); // timeslice, so ondataavailable can measure size
      recorderRef.current = recorder;
      rollTimerRef.current = setTimeout(() => {
        if (recorderRef.current === recorder && stateRef.current === "recording") {
          finishSegment();
        }
      }, HUDDLE_SEGMENT_ROLL_MS);
    },
    [enqueue, finishSegment],
  );

  useEffect(() => {
    startSegmentRef.current = startSegment;
  }, [startSegment]);

  const releaseStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  // ─── Controls ──────────────────────────────────────────────
  const handleStart = useCallback(async () => {
    setError(null);
    setBusy(true);
    try {
      const mimeType = pickMimeType();
      if (!mimeType) {
        setError("This browser can't record audio in a supported format.");
        return;
      }
      // Ask for the microphone first: a denied prompt shouldn't leave the
      // huddle marked as recording.
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
        });
      } catch {
        setError("Microphone access was blocked. Allow it and try again.");
        return;
      }

      const started = await startHuddleRecording(huddleId).catch(
        (e: unknown) => ({
          success: false as const,
          error: e instanceof Error ? e.message : "Couldn't start recording.",
        }),
      );
      if (!started.success) {
        stream.getTracks().forEach((t) => t.stop());
        setError(started.error);
        return;
      }

      streamRef.current = stream;
      bankedSecondsRef.current = 0;
      setElapsed(0);
      setLifecycle("recording");
      startSegment(stream, mimeType);
    } finally {
      setBusy(false);
    }
  }, [huddleId, setLifecycle, startSegment]);

  const handlePause = useCallback(async () => {
    // Never MediaRecorder.pause(): ending the segment means the audio so
    // far is uploaded and transcribable straight away.
    setLifecycle("paused");
    finishSegment();
    await heartbeatHuddleRecording(huddleId, "paused").catch(() => undefined);
  }, [finishSegment, huddleId, setLifecycle]);

  const handleResume = useCallback(async () => {
    const mimeType = pickMimeType();
    if (!streamRef.current || !mimeType) {
      setError("Recording stopped. Start again to continue.");
      return;
    }
    setLifecycle("recording");
    startSegment(streamRef.current, mimeType);
    await heartbeatHuddleRecording(huddleId, "recording").catch(() => undefined);
  }, [huddleId, setLifecycle, startSegment]);

  const handleStop = useCallback(async () => {
    setBusy(true);
    try {
      setLifecycle("idle");
      finishSegment();
      releaseStream();
      await stopHuddleRecording(huddleId).catch(() => undefined);
      void refreshSegments();
    } finally {
      setBusy(false);
    }
  }, [finishSegment, huddleId, refreshSegments, releaseStream, setLifecycle]);

  const handleDelete = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await deleteHuddleRecording(huddleId).catch((e: unknown) => ({
        success: false as const,
        error: e instanceof Error ? e.message : "Delete failed.",
      }));
      if (!res.success) setError(res.error);
      setConfirmDelete(false);
      void refreshSegments();
    } finally {
      setBusy(false);
    }
  }, [huddleId, refreshSegments]);

  const retryTranscription = useCallback(
    async (recordingId: string) => {
      await fetch(`/api/huddles/recordings/${recordingId}/transcribe`, {
        method: "POST",
      }).catch(() => undefined);
      void refreshSegments();
    },
    [refreshSegments],
  );

  // ─── Effects ───────────────────────────────────────────────
  // Elapsed timer.
  useEffect(() => {
    if (state !== "recording") return;
    const id = setInterval(() => {
      setElapsed(
        bankedSecondsRef.current +
          Math.floor((Date.now() - segmentStartRef.current) / 1000),
      );
    }, 1000);
    return () => clearInterval(id);
  }, [state]);

  // Heartbeat, so the consent indicator stays live (and goes stale if
  // this tab dies).
  useEffect(() => {
    if (state === "idle") return;
    const id = setInterval(() => {
      void heartbeatHuddleRecording(huddleId, state).catch(() => undefined);
    }, HUDDLE_RECORDING_HEARTBEAT_MS);
    return () => clearInterval(id);
  }, [huddleId, state]);

  // Warn before leaving with audio still in memory.
  useEffect(() => {
    const risky = state !== "idle" || queue.length > 0;
    if (!risky) return;
    const handler = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [queue.length, state]);

  // Release the microphone if the panel unmounts mid-recording.
  useEffect(() => releaseStream, [releaseStream]);

  // Initial segment list. Kicked off from a timer so the state update
  // lands in a callback rather than synchronously inside the effect.
  useEffect(() => {
    const id = setTimeout(() => void refreshSegments(), 0);
    return () => clearTimeout(id);
  }, [refreshSegments]);

  if (!canManage) return null;

  const notStarted = huddleStatus !== undefined && huddleStatus !== "in_progress";
  const pendingUploads = queue.length;
  const stuckUpload = queue.find((q) => q.attempts >= UPLOAD_MAX_ATTEMPTS);

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
        {state !== "idle" && (
          <span className="flex items-center gap-1.5 text-[12.5px] text-[#6B7280]">
            <span
              className={`size-2 rounded-full ${state === "recording" ? "animate-pulse" : ""}`}
              style={{ background: state === "recording" ? "#EF4444" : "#F59E0B" }}
            />
            {state === "recording" ? "Recording" : "Paused"} ·{" "}
            <span className="tabular-nums">{formatClock(elapsed)}</span>
          </span>
        )}
        <div className="ml-auto flex items-center gap-2">
          {state === "idle" && (
            <button
              type="button"
              onClick={handleStart}
              disabled={busy || notStarted}
              className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[13px] text-[#0F172A] disabled:opacity-50"
              style={{ background: MINT, fontFamily: "var(--font-source-sans)" }}
            >
              {busy ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Mic className="size-3.5" />
              )}
              Record
            </button>
          )}
          {state === "recording" && (
            <button
              type="button"
              onClick={handlePause}
              className="inline-flex items-center gap-1.5 rounded-full border border-[#E5E7EB] px-3.5 py-1.5 text-[13px] text-[#0F172A]"
            >
              <Pause className="size-3.5" /> Pause
            </button>
          )}
          {state === "paused" && (
            <button
              type="button"
              onClick={handleResume}
              className="inline-flex items-center gap-1.5 rounded-full border border-[#E5E7EB] px-3.5 py-1.5 text-[13px] text-[#0F172A]"
            >
              <Play className="size-3.5" /> Resume
            </button>
          )}
          {state !== "idle" && (
            <button
              type="button"
              onClick={handleStop}
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-full border border-[#E5E7EB] px-3.5 py-1.5 text-[13px] text-[#0F172A] disabled:opacity-50"
            >
              <Square className="size-3.5" /> Stop
            </button>
          )}
        </div>
      </div>

      {notStarted && (
        <p
          className="mt-3 text-[12.5px] text-[#6B7280]"
          style={{ fontFamily: "var(--font-source-sans)" }}
        >
          Start the huddle to record.
        </p>
      )}

      {error && (
        <p className="mt-3 flex items-start gap-1.5 text-[12.5px] text-[#EF4444]">
          <AlertCircle className="size-3.5 mt-0.5 shrink-0" />
          {error}
        </p>
      )}

      {pendingUploads > 0 && (
        <p className="mt-3 flex items-center gap-1.5 text-[12.5px] text-[#6B7280]">
          {stuckUpload ? (
            <>
              <AlertCircle className="size-3.5 text-[#F59E0B]" />
              {pendingUploads} segment{pendingUploads === 1 ? "" : "s"} couldn&apos;t
              upload. Keep this tab open.
              <button
                type="button"
                onClick={() => void drainQueue()}
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

      {segments.length > 0 && (
        <ul className="mt-4 space-y-1.5">
          {segments.map((segment) => (
            <li
              key={segment.id}
              className="flex items-center gap-2 text-[12.5px] text-[#6B7280]"
              style={{ fontFamily: "var(--font-source-sans)" }}
            >
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
                      onClick={() => void retryTranscription(segment.id)}
                      className="inline-flex items-center gap-1 underline"
                    >
                      <RefreshCw className="size-3" /> Retry
                    </button>
                  </>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}

      {segments.length > 0 && state === "idle" && (
        <div className="mt-4 pt-3 border-t border-[#F1F5F9]">
          {confirmDelete ? (
            <div className="flex items-center gap-2 text-[12.5px]">
              <span className="text-[#0F172A]">
                Delete the audio and transcript for good?
              </span>
              <button
                type="button"
                onClick={handleDelete}
                disabled={busy}
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
