"use client";

import {
  ExternalLink,
  MapPin,
  Mic,
  Monitor,
  Video,
} from "lucide-react";
import type { HuddleMeetingSource } from "@/app/actions/huddles";

interface MeetingSourceBadgeProps {
  source: HuddleMeetingSource;
  /** Optional location / URL the badge can show. */
  detail?: string | null;
  size?: "sm" | "md";
}

const CONFIG: Record<HuddleMeetingSource, { label: string; Icon: typeof MapPin; color: string }> = {
  in_person: { label: "In person", Icon: MapPin, color: "#6B7280" },
  external_video_link: { label: "External video", Icon: ExternalLink, color: "#3B82F6" },
  uploaded_recording: { label: "Uploaded recording", Icon: Mic, color: "#8B5CF6" },
  zoom_native: { label: "Zoom", Icon: Video, color: "#2563EB" },
  meet_native: { label: "Google Meet", Icon: Video, color: "#10B981" },
  teams_native: { label: "Teams", Icon: Video, color: "#6366F1" },
  atlas_video: { label: "Atlas video", Icon: Monitor, color: "#5CE1A5" },
};

export function MeetingSourceBadge({
  source,
  detail,
  size = "sm",
}: MeetingSourceBadgeProps) {
  const cfg = CONFIG[source] ?? CONFIG.in_person;
  const { Icon } = cfg;
  const isSm = size === "sm";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md ${
        isSm ? "h-5 px-1.5 text-[11px]" : "h-7 px-2.5 text-[12.5px]"
      }`}
      style={{
        backgroundColor: `${cfg.color}1A`,
        color: cfg.color,
        fontFamily: "var(--font-poppins)",
        fontWeight: 600,
      }}
    >
      <Icon className={isSm ? "size-3" : "size-3.5"} />
      <span className="truncate max-w-[180px]">
        {detail || cfg.label}
      </span>
    </span>
  );
}
