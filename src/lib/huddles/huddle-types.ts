// Types for the huddles rail hooks. Lives outside src/app/actions/huddles.ts
// because that is a "use server" file, which may only export async
// functions (see src/lib/ai/ai-settings-constants.ts for the same split).
// The pre-existing huddle types still live in huddles.ts.

import type { ProfileLite } from "@/app/actions/huddles";

// A pending action item suggested to the current user (not yet promoted
// to a task or dismissed), for the "my action items" rail.
export type MyHuddleActionItem = {
  id: string;
  huddle_id: string;
  /** null when the caller can't see the parent huddle — the item is
   *  suggested to them, but the huddle's visibility doesn't include them. */
  huddle_title: string | null;
  /** Whether the caller may open the parent huddle. Don't link when false. */
  can_view_huddle: boolean;
  description: string;
  suggested_due_date: string | null;
  source: "manual" | "ai_extracted";
  created_at: string;
};

// A decision from a huddle the current user may see, for the "recent
// decisions" rail. Decisions from huddles the caller can't see are never
// returned, so huddle_title is always present.
export type RecentHuddleDecision = {
  id: string;
  huddle_id: string;
  huddle_title: string;
  decision: string;
  context: string | null;
  decided_by: string | null;
  source: "manual" | "ai_extracted";
  decided_at: string;
  decider: ProfileLite | null;
};

// getHuddles filter. "needs_attention" = ended (status 'completed') but
// not yet finalized, limited to huddles the caller can finalize
// (organizer = created_by, or an org admin) so nobody is nudged about a
// huddle they can't resolve.
export type HuddleListFilter = "upcoming" | "past" | "all" | "needs_attention";

// ─── Recording (Phase 2 part 1) ─────────────────────────────
// Shared by the server actions and the recorder component.

export const HUDDLE_RECORDING_BUCKET = "huddle-recordings";

/** Probe order for MediaRecorder.isTypeSupported; first hit wins.
 *  webm/opus everywhere, mp4 on Safari, ogg on Firefox. */
export const HUDDLE_RECORDING_MIME_CANDIDATES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/mp4",
  "audio/ogg;codecs=opus",
  "audio/ogg",
] as const;

/** Base MIME types the bucket accepts (no ;codecs= parameter). */
export const HUDDLE_RECORDING_ALLOWED_BASE_MIME = [
  "audio/webm",
  "audio/mp4",
  "audio/ogg",
] as const;

/** Bucket file_size_limit, and Whisper's per-file limit. */
export const HUDDLE_SEGMENT_MAX_BYTES = 26_214_400; // 25 MB
/** Roll a new segment at ~20 MB so a segment always fits the limit. */
export const HUDDLE_SEGMENT_ROLL_BYTES = 20 * 1024 * 1024;
/** ...and at 15 minutes, whichever comes first. */
export const HUDDLE_SEGMENT_ROLL_MS = 15 * 60 * 1000;
/** Requested bitrate; browsers may ignore it, so we store what was used. */
export const HUDDLE_RECORDING_AUDIO_BPS = 24_000;
/** Heartbeat cadence, and how long before a heartbeat is stale. */
export const HUDDLE_RECORDING_HEARTBEAT_MS = 30_000;
export const HUDDLE_RECORDING_STALE_MS = 90_000;
/** Refuse to start with less than ~10 minutes of transcription credit. */
export const HUDDLE_RECORDING_MIN_CREDITS = 10;

/** File extension for a recorded segment, from its MIME type. All three
 *  are formats Whisper accepts, and it sniffs by extension. */
export function huddleRecordingExtension(mimeType: string): "webm" | "mp4" | "ogg" {
  const base = mimeType.split(";")[0]?.trim().toLowerCase();
  if (base === "audio/mp4") return "mp4";
  if (base === "audio/ogg") return "ogg";
  return "webm";
}

export type HuddleRecordingLifecycleState = "idle" | "recording" | "paused";

/** Everything the browser needs to PUT one segment straight to storage. */
export type HuddleSegmentUploadTicket = {
  recordingId: string;
  bucket: string;
  path: string;
  token: string;
};

export type HuddleSegmentUploadInput = {
  huddleId: string;
  /** Wall-clock bounds of the segment, ISO strings. */
  startedAt: string;
  endedAt: string;
  durationSeconds: number;
  /** The full MIME type MediaRecorder reported, e.g. audio/webm;codecs=opus. */
  mimeType: string;
  sizeBytes: number;
  audioBitsPerSecond?: number | null;
};

/** One recorded segment, without any transcript text. */
export type HuddleRecordingSegmentView = {
  id: string;
  segment_index: number;
  started_at: string;
  ended_at: string;
  duration_seconds: number | null;
  size_bytes: number | null;
  file_type: string | null;
  upload_status: "pending_upload" | "uploaded" | "upload_failed";
  transcription_status:
    | "pending"
    | "processing"
    | "done"
    | "failed"
    | "awaiting_credits";
  transcription_error: string | null;
  retention_until: string | null;
};

/** Consent-indicator state. Safe for every huddle viewer: counts and
 *  timings only, never transcript text. */
export type HuddleRecordingState = {
  huddle_id: string;
  state: HuddleRecordingLifecycleState;
  /** state !== 'idle' AND the heartbeat is younger than 90s. */
  is_live: boolean;
  started_by: string | null;
  heartbeat_at: string | null;
  /** Whether the viewer may operate the recorder at all. */
  can_manage: boolean;
  segment_count: number;
  total_duration_seconds: number;
  total_size_bytes: number;
  /** Segments still to transcribe, or parked/failed and retryable. */
  pending_transcription_count: number;
  failed_transcription_count: number;
  awaiting_credits_count: number;
};

export type HuddleTranscriptSegmentView = HuddleRecordingSegmentView & {
  /** null until that segment's transcription succeeds. */
  text: string | null;
};

/** Organizer / org admin only. */
export type HuddleTranscriptView = {
  huddle_id: string;
  segments: HuddleTranscriptSegmentView[];
  /** Every finished segment's text, in order. */
  full_text: string;
};
