"use client";

// Shared org-logo primitive. Renders the uploaded logo when present,
// otherwise a gradient mint circle with the org's first letter —
// matches the visual treatment used for the user-avatar circle in
// shell.tsx so the two feel like siblings.

interface OrgLogoProps {
  /** Organization display name — drives the first-letter fallback and
   *  the accessible label. */
  name: string;
  logoUrl?: string | null;
  /** Side length in pixels. Default 36 (matches the user-avatar circle
   *  in the sidebar). */
  size?: number;
  /** Adds the white ring used elsewhere in Atlas. Default false — the
   *  greeting / settings header don't want a ring. */
  ring?: boolean;
  className?: string;
}

export function OrgLogo({
  name,
  logoUrl,
  size = 36,
  ring = false,
  className,
}: OrgLogoProps) {
  if (logoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={logoUrl}
        alt={name}
        className={`rounded-full object-cover shrink-0 bg-white ${
          ring ? "ring-2 ring-white" : ""
        } ${className ?? ""}`}
        style={{ width: size, height: size }}
        title={name}
      />
    );
  }
  const initial = (name?.trim()?.[0] ?? "A").toUpperCase();
  return (
    <span
      className={`rounded-full bg-gradient-to-br from-[#5CE1A5] to-[#3DB882] flex items-center justify-center text-white shrink-0 ${
        ring ? "ring-2 ring-white" : ""
      } ${className ?? ""}`}
      style={{
        width: size,
        height: size,
        fontFamily: "var(--font-poppins)",
        fontWeight: 700,
        fontSize: Math.round(size * 0.42),
        letterSpacing: "-0.5px",
      }}
      title={name}
      aria-label={name}
    >
      {initial}
    </span>
  );
}
