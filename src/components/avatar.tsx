"use client";

import {
  deterministicAvatarColor,
  displayName as resolveDisplayName,
  initials,
} from "@/lib/avatar";

// Single shared avatar primitive for non-huddles code. Mirrors the
// pattern used in src/app/(app)/workspace/huddles/_components/attendee-avatar.tsx
// — Ben's polish lives there; non-huddles consumers import from here so
// both stay independently editable.
//
// Render rules:
//   - avatarUrl present  -> show the image
//   - otherwise           -> colored circle with initials, color
//                            derived deterministically from id

export interface AvatarProps {
  /** Stable identifier — usually the profile uuid. Drives the
   *  deterministic color when avatarUrl is null. */
  id: string | null | undefined;
  avatarUrl?: string | null;
  fullName?: string | null;
  email?: string | null;
  /** Fallback string when neither full_name nor email is available. */
  fallbackLabel?: string;
  /** Side length in pixels. Default 28. */
  size?: number;
  /** Adds the white ring used elsewhere in Atlas. Default true. */
  ring?: boolean;
  className?: string;
}

export function Avatar({
  id,
  avatarUrl,
  fullName,
  email,
  fallbackLabel = "Teammate",
  size = 28,
  ring = true,
  className,
}: AvatarProps) {
  const name = resolveDisplayName(fullName, email, fallbackLabel);
  if (avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={avatarUrl}
        alt={name}
        className={`rounded-full object-cover shrink-0 ${
          ring ? "ring-2 ring-white" : ""
        } ${className ?? ""}`}
        style={{ width: size, height: size }}
        title={name}
      />
    );
  }
  const color = deterministicAvatarColor(id);
  return (
    <span
      className={`rounded-full flex items-center justify-center text-white shrink-0 ${
        ring ? "ring-2 ring-white" : ""
      } ${className ?? ""}`}
      style={{
        width: size,
        height: size,
        backgroundColor: color,
        fontFamily: "var(--font-poppins)",
        fontWeight: 700,
        fontSize: Math.round(size * 0.36),
      }}
      title={name}
    >
      {initials(name)}
    </span>
  );
}
