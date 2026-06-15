"use client";

import type { ProfileLite } from "@/app/actions/huddles";

// Single source of truth for rendering an attendee / presenter / assignee
// avatar inside a huddle UI. Matches the rest of Atlas (boards / tasks)
// — colored circle with initials, optional photo when avatar_url is set.

interface AttendeeAvatarProps {
  profile: ProfileLite | null;
  /** Fallback label to use when profile is null (rare — e.g., a deleted
   *  account). Defaults to "Guest". */
  fallbackLabel?: string;
  size?: number;
}

export function AttendeeAvatar({
  profile,
  fallbackLabel = "Guest",
  size = 28,
}: AttendeeAvatarProps) {
  if (profile?.avatar_url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={profile.avatar_url}
        alt={profile.full_name}
        className="rounded-full object-cover shrink-0"
        style={{ width: size, height: size }}
      />
    );
  }
  const name = profile?.full_name || fallbackLabel;
  return (
    <span
      className="rounded-full flex items-center justify-center text-white shrink-0 ring-2 ring-white"
      style={{
        width: size,
        height: size,
        backgroundColor: profile?.avatar_color || "#5CE1A5",
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

export function initials(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? "")
      .join("") || "?"
  );
}

export function displayName(
  profile: ProfileLite | null,
  fallbackLabel = "Guest",
): string {
  return profile?.full_name || fallbackLabel;
}
