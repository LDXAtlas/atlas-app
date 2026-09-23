"use client";

// Owns a huddle's recording session: the microphone stream, the
// MediaRecorder, the segment queue, uploads, transcription kicks, the
// heartbeat and the status line.
//
// It lives here rather than in the recorder card because the card is
// rendered inside the Overview tab, and the huddle page unmounts a tab's
// subtree when you switch tabs — which killed the stream, dropped the
// in-progress segment's audio, and left the server thinking a recording
// was still running. Mounted once at the page level, recording survives
// tab switches. It does NOT survive leaving the page or reloading: the
// audio is in memory (see BACKEND_NOTES → PENDING, part 3).
//
// Mount:
//   <HuddleRecordingProvider huddleId={id}>…</HuddleRecordingProvider>
// Consume:
//   const rec = useHuddleRecording();

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
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
  type HuddleRecordingLifecycleState,
  type HuddleTranscriptSegmentView,
} from "@/lib/huddles/huddle-types";

export const UPLOAD_MAX_ATTEMPTS = 3;
const DEVICE_STORAGE_KEY = "atlas.huddleRecorder.inputDeviceId";
const LEVEL_FPS_MS = 60;
// Below this the input counts as silence. Deliberately low: a room mic
// picking up someone across a table sits well under a headset's level.
const SILENCE_LEVEL = 0.008;
// Only call it silence after this long, so the meter doesn't flicker
// between syllables.
const SILENCE_GRACE_MS = 2000;
// Meter decay per frame, so bars fall smoothly instead of strobing.
const LEVEL_DECAY = 0.85;

export type StatusTone = "info" | "working" | "error" | "success";
export type RecorderStatus = { text: string; tone: StatusTone };

export type QueuedSegment = {
  key: string;
  ordinal: number;
  blob: Blob;
  mimeType: string;
  startedAt: string;
  endedAt: string;
  durationSeconds: number;
  attempts: number;
  error: string | null;
};

export type HuddleRecordingContextValue = {
  huddleId: string;
  state: HuddleRecordingLifecycleState;
  status: RecorderStatus;
  busy: boolean;
  elapsed: number;
  queue: QueuedSegment[];
  segments: HuddleTranscriptSegmentView[];
  devices: MediaDeviceInfo[];
  deviceId: string | null;
  /** A stream is open (recording, paused, or just armed for a level check). */
  armed: boolean;
  level: number;
  silent: boolean;
  testMic: () => Promise<void>;
  stopTest: () => void;
  selectDevice: (deviceId: string) => Promise<void>;
  start: () => Promise<void>;
  pause: () => Promise<void>;
  resume: () => Promise<void>;
  stop: () => Promise<void>;
  removeRecording: () => Promise<void>;
  retryUploads: () => void;
  transcribeSegment: (recordingId: string, ordinal?: number) => Promise<void>;
  refreshSegments: () => Promise<void>;
};

const HuddleRecordingContext =
  createContext<HuddleRecordingContextValue | null>(null);

/** Null when no provider is mounted, so views can say so plainly. */
export function useHuddleRecording(): HuddleRecordingContextValue | null {
  return useContext(HuddleRecordingContext);
}

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

/** "opus", "aac", "vorbis" — for the status line. */
function codecLabel(mimeType: string): string {
  const lower = mimeType.toLowerCase();
  if (lower.includes("opus")) return "opus";
  if (lower.includes("mp4")) return "aac";
  if (lower.includes("vorbis")) return "vorbis";
  const base = lower.split(";")[0] ?? lower;
  return base.replace("audio/", "");
}

/** Says which microphone failure happened, instead of collapsing denied /
 *  missing / busy / insecure-origin into one sentence. */
function describeMicError(err: unknown): string {
  if (typeof navigator === "undefined" || !navigator.mediaDevices) {
    return "This page can't reach any microphone: navigator.mediaDevices is unavailable, which usually means the page isn't a secure context. Open it on localhost or over https.";
  }
  const name = (err as { name?: string })?.name ?? "";
  const message = (err as { message?: string })?.message ?? String(err);
  switch (name) {
    case "NotAllowedError":
    case "SecurityError":
      return `Microphone permission was denied (${name}). Allow it for this site in the browser's address-bar icon, then click Record again.`;
    case "NotFoundError":
    case "OverconstrainedError":
      return `No usable microphone was found (${name}). Check the input device below${name === "OverconstrainedError" ? " — the saved device may be unplugged" : ""}.`;
    case "NotReadableError":
      return `The microphone is already in use by another app (${name}). Close it and try again.`;
    case "TypeError":
      return `The browser refused the microphone request (TypeError: ${message}). If this page isn't on localhost or https, that's the cause.`;
    default:
      return name
        ? `Couldn't open the microphone (${name}: ${message}).`
        : `Couldn't open the microphone: ${message}`;
  }
}

function readStoredDeviceId(): string | null {
  try {
    return window.localStorage.getItem(DEVICE_STORAGE_KEY);
  } catch {
    return null; // private mode / blocked storage
  }
}

function storeDeviceId(deviceId: string | null) {
  try {
    if (deviceId) window.localStorage.setItem(DEVICE_STORAGE_KEY, deviceId);
    else window.localStorage.removeItem(DEVICE_STORAGE_KEY);
  } catch {
    // Not worth surfacing; the picker still works for this session.
  }
}

export function HuddleRecordingProvider({
  huddleId,
  children,
}: {
  huddleId: string;
  children: React.ReactNode;
}) {
  const [state, setState] = useState<HuddleRecordingLifecycleState>("idle");
  const [status, setStatusState] = useState<RecorderStatus>({
    text: "Ready.",
    tone: "info",
  });
  const [busy, setBusy] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [queue, setQueue] = useState<QueuedSegment[]>([]);
  const [segments, setSegments] = useState<HuddleTranscriptSegmentView[]>([]);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [armed, setArmed] = useState(false);
  const [level, setLevel] = useState(0);
  const [silent, setSilent] = useState(false);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const bytesRef = useRef(0);
  const segmentStartRef = useRef<number>(0);
  const bankedSecondsRef = useRef(0);
  const segmentCountRef = useRef(0);
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
  const levelRef = useRef(0);
  const lastSoundAtRef = useRef(0);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number | null>(null);

  const setStatus = useCallback((text: string, tone: StatusTone = "info") => {
    setStatusState({ text, tone });
  }, []);

  const setLifecycle = useCallback(
    (next: HuddleRecordingLifecycleState) => {
      stateRef.current = next;
      setState(next);
    },
    [],
  );

  // Segment list drives the per-segment status rows (and retry). Only an
  // organizer/admin can read it; for anyone else it simply stays empty.
  const refreshSegments = useCallback(async () => {
    const res = await getHuddleTranscript(huddleId).catch((e: unknown) => ({
      success: false as const,
      error: e instanceof Error ? e.message : String(e),
    }));
    if (res.success && res.data) setSegments(res.data.segments);
  }, [huddleId]);

  // ─── Input level meter ─────────────────────────────────────
  const stopMeter = useCallback(() => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    analyserRef.current = null;
    void audioContextRef.current?.close().catch(() => undefined);
    audioContextRef.current = null;
    levelRef.current = 0;
    setLevel(0);
    setSilent(false);
  }, []);

  const startMeter = useCallback(
    (stream: MediaStream) => {
      stopMeter();
      try {
        const AudioCtor =
          window.AudioContext ??
          (window as unknown as { webkitAudioContext?: typeof AudioContext })
            .webkitAudioContext;
        if (!AudioCtor) return;
        const context = new AudioCtor();
        const source = context.createMediaStreamSource(stream);
        const analyser = context.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);
        audioContextRef.current = context;
        analyserRef.current = analyser;

        const buffer = new Uint8Array(analyser.frequencyBinCount);
        let lastPaint = 0;
        lastSoundAtRef.current = performance.now();
        const tick = (now: number) => {
          const node = analyserRef.current;
          if (!node) return;
          rafRef.current = requestAnimationFrame(tick);
          if (now - lastPaint < LEVEL_FPS_MS) return;
          lastPaint = now;
          node.getByteTimeDomainData(buffer);
          let peak = 0;
          for (let i = 0; i < buffer.length; i += 1) {
            peak = Math.max(peak, Math.abs((buffer[i] ?? 128) - 128) / 128);
          }
          if (peak > SILENCE_LEVEL) lastSoundAtRef.current = now;
          // Rise instantly, fall gently.
          levelRef.current = Math.max(peak, levelRef.current * LEVEL_DECAY);
          setLevel(levelRef.current);
          setSilent(now - lastSoundAtRef.current > SILENCE_GRACE_MS);
        };
        rafRef.current = requestAnimationFrame(tick);
      } catch {
        // A missing AudioContext costs us the meter, nothing else.
      }
    },
    [stopMeter],
  );

  // ─── Microphone ────────────────────────────────────────────
  const listDevices = useCallback(async () => {
    try {
      const all = await navigator.mediaDevices.enumerateDevices();
      setDevices(all.filter((d) => d.kind === "audioinput"));
    } catch {
      // Labels need permission; the picker just stays empty.
    }
  }, []);

  // Throws, so callers can report the specific failure.
  const acquireStream = useCallback(
    async (preferredDeviceId: string | null): Promise<MediaStream> => {
      if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
        throw new TypeError("navigator.mediaDevices.getUserMedia is unavailable");
      }
      // Room-mic profile, not a voice-call one. Noise suppression and
      // echo cancellation gate hard and duck anything they treat as
      // background, which makes someone across the table sound like
      // silence; auto gain brings a distant talker up instead. These are
      // requests, not guarantees — browsers may ignore them.
      const audio: MediaTrackConstraints = {
        channelCount: 1,
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: true,
      };
      if (preferredDeviceId) audio.deviceId = { exact: preferredDeviceId };
      return navigator.mediaDevices.getUserMedia({ audio });
    },
    [],
  );

  const releaseStream = useCallback(() => {
    stopMeter();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setArmed(false);
  }, [stopMeter]);

  // Opens the mic without recording, so the permission prompt, the device
  // list and the level meter all happen before anything is committed.
  const armMicrophone = useCallback(
    async (preferredDeviceId: string | null): Promise<MediaStream | null> => {
      setStatus("Requesting microphone…", "working");
      try {
        const stream = await acquireStream(preferredDeviceId);
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = stream;
        setArmed(true);
        startMeter(stream);
        await listDevices();
        const label =
          stream.getAudioTracks()[0]?.label || "the system default microphone";
        setStatus(`Microphone ready — ${label}. Speak to check the level.`, "success");
        return stream;
      } catch (err) {
        releaseStream();
        setStatus(describeMicError(err), "error");
        return null;
      }
    },
    [acquireStream, listDevices, releaseStream, setStatus, startMeter],
  );

  // Kicks the Route Handler and reports exactly what it said.
  const transcribeSegment = useCallback(
    async (recordingId: string, ordinal?: number) => {
      const label = ordinal ? `segment ${ordinal}` : "segment";
      setStatus(`Transcribing ${label}…`, "working");
      try {
        const response = await fetch(
          `/api/huddles/recordings/${recordingId}/transcribe`,
          { method: "POST" },
        );
        const body = (await response.json().catch(() => null)) as
          | { success?: boolean; error?: string; code?: string }
          | null;
        if (!response.ok || !body?.success) {
          setStatus(
            `Transcription failed for ${label} (${response.status}${body?.code ? ` ${body.code}` : ""}): ${body?.error ?? "no detail"}`,
            "error",
          );
        } else {
          setStatus(`Transcribed ${label}.`, "success");
        }
      } catch (e: unknown) {
        setStatus(
          `Transcription request failed for ${label}: ${e instanceof Error ? e.message : String(e)}`,
          "error",
        );
      }
      void refreshSegments();
    },
    [refreshSegments, setStatus],
  );

  // ─── Upload queue ──────────────────────────────────────────
  // Sequential, with backoff. A failed segment stays in the queue (and
  // in memory) so it can be retried rather than silently lost.
  const drainQueue = useCallback(async () => {
    if (drainingRef.current) return;
    drainingRef.current = true;
    try {
      while (queueRef.current.length > 0) {
        const job = queueRef.current[0]!;
        setStatus(`Uploading segment ${job.ordinal}…`, "working");
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
              void transcribeSegment(ticket.data.recordingId, job.ordinal);
            }
          }
        }

        if (failure) {
          job.attempts += 1;
          job.error = failure;
          setQueue([...queueRef.current]);
          setStatus(
            `Segment ${job.ordinal} upload failed (attempt ${job.attempts}/${UPLOAD_MAX_ATTEMPTS}): ${failure}`,
            "error",
          );
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
  }, [huddleId, refreshSegments, setStatus, transcribeSegment]);

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
      let recorder: MediaRecorder;
      try {
        recorder = new MediaRecorder(stream, {
          mimeType,
          audioBitsPerSecond: HUDDLE_RECORDING_AUDIO_BPS,
        });
      } catch (e: unknown) {
        setStatus(
          `This browser wouldn't start a recorder for ${mimeType}: ${e instanceof Error ? e.message : String(e)}`,
          "error",
        );
        return;
      }
      chunksRef.current = [];
      bytesRef.current = 0;
      segmentStartRef.current = Date.now();
      segmentCountRef.current += 1;
      const ordinal = segmentCountRef.current;

      const bitrate = recorder.audioBitsPerSecond || HUDDLE_RECORDING_AUDIO_BPS;
      setStatus(
        `Recording segment ${ordinal} (${codecLabel(recorder.mimeType || mimeType)}, ${Math.round(bitrate / 1000)} kbps).`,
        "working",
      );

      recorder.onerror = (event: Event) => {
        const err = (event as unknown as { error?: { name?: string; message?: string } })
          .error;
        setStatus(
          `Recorder error: ${err?.name ?? "unknown"}${err?.message ? ` — ${err.message}` : ""}`,
          "error",
        );
      };

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
            ordinal,
            blob,
            mimeType: recorder.mimeType || mimeType,
            startedAt: new Date(startedMs).toISOString(),
            endedAt: new Date(endedMs).toISOString(),
            durationSeconds,
            attempts: 0,
            error: null,
          });
        } else {
          setStatus(
            `Segment ${ordinal} captured no audio — check the input device and level.`,
            "error",
          );
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
    [enqueue, finishSegment, setStatus],
  );

  useEffect(() => {
    startSegmentRef.current = startSegment;
  }, [startSegment]);

  // ─── Controls ──────────────────────────────────────────────
  const testMic = useCallback(async () => {
    setBusy(true);
    try {
      await armMicrophone(deviceId);
    } finally {
      setBusy(false);
    }
  }, [armMicrophone, deviceId]);

  const stopTest = useCallback(() => {
    releaseStream();
    setStatus("Ready.", "info");
  }, [releaseStream, setStatus]);

  const selectDevice = useCallback(
    async (nextId: string) => {
      const value = nextId || null;
      setDeviceId(value);
      storeDeviceId(value);
      if (stateRef.current === "idle") {
        setBusy(true);
        try {
          await armMicrophone(value);
        } finally {
          setBusy(false);
        }
      }
    },
    [armMicrophone],
  );

  const start = useCallback(async () => {
    setBusy(true);
    try {
      const mimeType = pickMimeType();
      if (!mimeType) {
        setStatus(
          "This browser can't record audio in any supported format (tried webm/opus, webm, mp4, ogg).",
          "error",
        );
        return;
      }

      // Microphone first, before any server call, so the permission
      // prompt is the first thing a click produces and a refusal never
      // leaves the huddle marked as recording.
      const stream = streamRef.current ?? (await armMicrophone(deviceId));
      if (!stream) return; // armMicrophone already explained why

      setStatus("Starting recording…", "working");
      const started = await startHuddleRecording(huddleId).catch(
        (e: unknown) => ({
          success: false as const,
          error: e instanceof Error ? e.message : "Couldn't start recording.",
        }),
      );
      if (!started.success) {
        releaseStream();
        setStatus(started.error, "error");
        return;
      }

      bankedSecondsRef.current = 0;
      segmentCountRef.current = 0;
      setElapsed(0);
      setLifecycle("recording");
      startSegment(stream, mimeType);
    } finally {
      setBusy(false);
    }
  }, [
    armMicrophone,
    deviceId,
    huddleId,
    releaseStream,
    setLifecycle,
    setStatus,
    startSegment,
  ]);

  const pause = useCallback(async () => {
    // Never MediaRecorder.pause(): ending the segment means the audio so
    // far is uploaded and transcribable straight away. The stream stays
    // open, so the level meter keeps running while paused.
    setLifecycle("paused");
    finishSegment();
    setStatus("Paused — microphone still open.", "info");
    const res = await heartbeatHuddleRecording(huddleId, "paused").catch(
      (e: unknown) => ({
        success: false as const,
        error: e instanceof Error ? e.message : String(e),
      }),
    );
    if (!res.success)
      setStatus(`Paused, but the server wasn't told: ${res.error}`, "error");
  }, [finishSegment, huddleId, setLifecycle, setStatus]);

  const resume = useCallback(async () => {
    const mimeType = pickMimeType();
    const stream = streamRef.current ?? (await armMicrophone(deviceId));
    if (!stream || !mimeType) {
      if (mimeType) setStatus("Microphone is closed. Start again.", "error");
      return;
    }
    setLifecycle("recording");
    startSegment(stream, mimeType);
    const res = await heartbeatHuddleRecording(huddleId, "recording").catch(
      (e: unknown) => ({
        success: false as const,
        error: e instanceof Error ? e.message : String(e),
      }),
    );
    if (!res.success)
      setStatus(`Recording, but the server wasn't told: ${res.error}`, "error");
  }, [armMicrophone, deviceId, huddleId, setLifecycle, setStatus, startSegment]);

  const stop = useCallback(async () => {
    setBusy(true);
    try {
      setLifecycle("idle");
      finishSegment();
      releaseStream();
      setStatus("Stopped. Finishing uploads…", "working");
      const res = await stopHuddleRecording(huddleId).catch((e: unknown) => ({
        success: false as const,
        error: e instanceof Error ? e.message : String(e),
      }));
      if (!res.success)
        setStatus(`Stopped, but the server wasn't told: ${res.error}`, "error");
      void refreshSegments();
    } finally {
      setBusy(false);
    }
  }, [
    finishSegment,
    huddleId,
    refreshSegments,
    releaseStream,
    setLifecycle,
    setStatus,
  ]);

  const removeRecording = useCallback(async () => {
    setBusy(true);
    setStatus("Deleting recording…", "working");
    try {
      const res = await deleteHuddleRecording(huddleId).catch((e: unknown) => ({
        success: false as const,
        error: e instanceof Error ? e.message : "Delete failed.",
      }));
      if (!res.success) setStatus(res.error, "error");
      else setStatus("Recording deleted.", "success");
      void refreshSegments();
    } finally {
      setBusy(false);
    }
  }, [huddleId, refreshSegments, setStatus]);

  const retryUploads = useCallback(() => {
    void drainQueue();
  }, [drainQueue]);

  // ─── Effects ───────────────────────────────────────────────
  // Remembered input device. Read after mount (localStorage doesn't
  // exist during SSR) and applied from a timer, so the state update
  // lands in a callback rather than synchronously inside the effect.
  useEffect(() => {
    const id = setTimeout(() => {
      const stored = readStoredDeviceId();
      if (stored) setDeviceId(stored);
    }, 0);
    return () => clearTimeout(id);
  }, []);

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

  // Warn before leaving with audio still in memory. Navigating away or
  // reloading still loses it — surviving that is part 3 work.
  useEffect(() => {
    const risky = state !== "idle" || queue.length > 0;
    if (!risky) return;
    const handler = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [queue.length, state]);

  // Release the microphone if the whole page goes away.
  useEffect(() => releaseStream, [releaseStream]);

  // Initial segment list. Kicked off from a timer so the state update
  // lands in a callback rather than synchronously inside the effect.
  useEffect(() => {
    const id = setTimeout(() => void refreshSegments(), 0);
    return () => clearTimeout(id);
  }, [refreshSegments]);

  const value = useMemo<HuddleRecordingContextValue>(
    () => ({
      huddleId,
      state,
      status,
      busy,
      elapsed,
      queue,
      segments,
      devices,
      deviceId,
      armed,
      level,
      silent,
      testMic,
      stopTest,
      selectDevice,
      start,
      pause,
      resume,
      stop,
      removeRecording,
      retryUploads,
      transcribeSegment,
      refreshSegments,
    }),
    [
      armed,
      busy,
      deviceId,
      devices,
      elapsed,
      huddleId,
      level,
      pause,
      queue,
      refreshSegments,
      removeRecording,
      resume,
      retryUploads,
      segments,
      selectDevice,
      silent,
      start,
      state,
      status,
      stop,
      stopTest,
      testMic,
      transcribeSegment,
    ],
  );

  return (
    <HuddleRecordingContext.Provider value={value}>
      {children}
    </HuddleRecordingContext.Provider>
  );
}
