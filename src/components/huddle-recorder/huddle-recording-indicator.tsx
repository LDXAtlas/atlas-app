"use client";

// Consent indicator: shows everyone in a huddle when it's being
// recorded, not just the organizer. Mount it anywhere in the huddle
// view:
//
//   <HuddleRecordingIndicator huddleId={huddle.id} />
//
// It renders nothing at all when no recording is running, so it's safe
// to leave mounted. State comes from getHuddleRecordingState, which any
// huddle viewer may call and which never returns transcript text.

import { useCallback, useEffect, useState } from "react";
import { getHuddleRecordingState } from "@/app/actions/huddles";
import { useHuddleRecording } from "./huddle-recording-provider";
import type { HuddleRecordingState } from "@/lib/huddles/huddle-types";

const DEFAULT_POLL_MS = 15_000;

export interface HuddleRecordingIndicatorProps {
  huddleId: string;
  /** How often to re-check. Default 15s. */
  pollMs?: number;
  className?: string;
}

export function HuddleRecordingIndicator({
  huddleId,
  pollMs = DEFAULT_POLL_MS,
  className,
}: HuddleRecordingIndicatorProps) {
  const [state, setState] = useState<HuddleRecordingState | null>(null);
  // When this viewer is the one recording, the provider knows before the
  // server poll does — no up-to-15s lag on your own indicator.
  const rec = useHuddleRecording();

  const refresh = useCallback(async () => {
    const res = await getHuddleRecordingState(huddleId).catch(() => null);
    if (res?.success && res.data) setState(res.data);
  }, [huddleId]);

  useEffect(() => {
    // The first read goes through a timer too, so every state update
    // happens in a callback rather than synchronously in the effect.
    const first = setTimeout(() => void refresh(), 0);
    const id = setInterval(() => void refresh(), Math.max(5_000, pollMs));
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, [pollMs, refresh]);

  // is_live already accounts for a stale heartbeat, so a crashed
  // recorder tab clears this within ~90s instead of showing "recording"
  // forever.
  const localLive = rec && rec.state !== "idle";
  if (!localLive && !state?.is_live) return null;

  const recording = localLive
    ? rec.state === "recording"
    : state?.state === "recording";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border border-[#E5E7EB] px-2.5 py-1 text-[12px] text-[#0F172A] ${className ?? ""}`}
      style={{ fontFamily: "var(--font-source-sans)" }}
      title={
        recording
          ? "This huddle is being recorded for transcription."
          : "Recording is paused."
      }
    >
      <span
        className={`size-2 rounded-full ${recording ? "animate-pulse" : ""}`}
        style={{ background: recording ? "#EF4444" : "#F59E0B" }}
      />
      {recording ? "Recording" : "Recording paused"}
    </span>
  );
}

export default HuddleRecordingIndicator;
