// Shared avatar helpers — pure JS, safe to import from server actions
// AND client components.
//
// Background: profiles.avatar_color was referenced in several action
// files but the column doesn't actually exist on the profiles table.
// Those queries silently failed and the rendered avatars fell back to
// a hardcoded uniform mint. The fix: derive a deterministic color
// from the user's id so every person gets a stable, distinguishable
// circle without storing a column.
//
// Huddles already does this correctly via a private helper inside its
// folder. Non-huddles code should import the same constants from
// here so the palette and hashing stay in lockstep across the app.

export const AVATAR_PALETTE = [
  "#5CE1A5",
  "#3B82F6",
  "#8B5CF6",
  "#F59E0B",
  "#F97316",
  "#EF4444",
  "#EC4899",
  "#10B981",
  "#06B6D4",
  "#14B8A6",
  "#A855F7",
  "#6366F1",
] as const;

/**
 * Returns a stable color for the given stable identifier (usually a
 * profile uuid). Same input always yields the same color. Hash is a
 * simple polynomial accumulator — collisions across the 12-color
 * palette are tolerable and the distribution is good enough for the
 * directory-scale lists we render.
 */
export function deterministicAvatarColor(id: string | null | undefined): string {
  if (!id) return AVATAR_PALETTE[0];
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  }
  return AVATAR_PALETTE[hash % AVATAR_PALETTE.length];
}

/**
 * Extracts up to 2 uppercase initials from a name. Empty / whitespace
 * names return "?" so callers don't need their own guard.
 */
export function initials(name: string | null | undefined): string {
  if (!name) return "?";
  const parts = name.split(/\s+/).filter(Boolean).slice(0, 2);
  if (parts.length === 0) return "?";
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";
}

/**
 * Best-available display string for a person — full_name first,
 * email username as a fallback (Lucas Dial → "Lucas Dial",
 * dial@example.com with no full_name → "dial"), then a caller-
 * supplied default.
 */
export function displayName(
  full_name: string | null | undefined,
  email: string | null | undefined,
  fallback = "Teammate",
): string {
  const trimmed = full_name?.trim();
  if (trimmed) return trimmed;
  if (email) return email.split("@")[0] || fallback;
  return fallback;
}
