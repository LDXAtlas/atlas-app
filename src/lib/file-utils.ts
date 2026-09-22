// File handling helpers shared by upload validation, preview rendering,
// and storage display. Pure functions only — safe to import from both
// server and client code.

// Upload cap for every server-action upload (Library files, avatars, org
// logos). Temporarily 4 MB: server actions carry the file in the request
// body, and Vercel caps function request bodies at 4.5 MB, so
// next.config.ts sets serverActions.bodySizeLimit just above this.
// Restore the 25 MB Library limit (the DB CHECK) once uploads move to
// signed upload URLs — see BACKEND_NOTES → PENDING.
export const MAX_FILE_BYTES = 4 * 1024 * 1024; // 4 MB

// "This file is 6.2 MB. The limit is 4 MB for now." — shown when a file
// is chosen, before anything is sent.
export function fileTooLargeMessage(sizeBytes: number): string {
  return `This file is ${formatBytes(sizeBytes)}. The limit is ${formatBytes(MAX_FILE_BYTES)} for now.`;
}

// Shown when the upload request itself fails (e.g. the server rejects
// an oversized body) instead of leaving the UI stuck on "uploading".
export const UPLOAD_REQUEST_FAILED_MESSAGE = `Upload failed. Check your connection and try again — files must be ${formatBytes(MAX_FILE_BYTES)} or smaller for now.`;

export const TIER_STORAGE_LIMITS = {
  workspace: 2_147_483_648, // 2 GB
  suite: 10_737_418_240, // 10 GB
  ultimate: 53_687_091_200, // 50 GB
} as const;

export type TierName = keyof typeof TIER_STORAGE_LIMITS;

export type FileCategory =
  | "image"
  | "pdf"
  | "audio"
  | "office_word"
  | "office_excel"
  | "office_ppt"
  | "text"
  | "other";

// Allow-list. Mirrors the spec; the DB has no MIME restriction so this
// is the only place where the policy lives.
export const ALLOWED_MIME_TYPES: ReadonlySet<string> = new Set([
  // PDFs
  "application/pdf",
  // Images
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  // Audio
  "audio/mpeg",
  "audio/mp4",
  "audio/wav",
  "audio/x-wav",
  "audio/x-m4a",
  // Office
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  // Text
  "text/plain",
  "text/markdown",
  "text/csv",
]);

export function isAllowedMimeType(mime: string): boolean {
  return ALLOWED_MIME_TYPES.has(mime);
}

/** High-level category used for icon selection and preview routing. */
export function categorizeFile(
  mime: string | null | undefined,
  extension?: string | null,
): FileCategory {
  const m = (mime || "").toLowerCase();
  const ext = (extension || "").toLowerCase().replace(/^\./, "");

  if (m === "application/pdf" || ext === "pdf") return "pdf";
  if (m.startsWith("image/")) return "image";
  if (m.startsWith("audio/")) return "audio";
  if (
    m === "application/msword" ||
    m ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    ext === "doc" ||
    ext === "docx"
  ) {
    return "office_word";
  }
  if (
    m === "application/vnd.ms-excel" ||
    m ===
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
    ext === "xls" ||
    ext === "xlsx"
  ) {
    return "office_excel";
  }
  if (
    m === "application/vnd.ms-powerpoint" ||
    m ===
      "application/vnd.openxmlformats-officedocument.presentationml.presentation" ||
    ext === "ppt" ||
    ext === "pptx"
  ) {
    return "office_ppt";
  }
  if (
    m === "text/plain" ||
    m === "text/markdown" ||
    m === "text/csv" ||
    ext === "txt" ||
    ext === "md" ||
    ext === "csv"
  ) {
    return "text";
  }
  return "other";
}

export function formatBytes(bytes: number, fractionDigits = 1): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let value = bytes / 1024;
  let unitIdx = 0;
  while (value >= 1024 && unitIdx < units.length - 1) {
    value /= 1024;
    unitIdx += 1;
  }
  // Whole numbers don't need decimals.
  const rounded =
    Math.abs(value - Math.round(value)) < 0.05
      ? Math.round(value).toString()
      : value.toFixed(fractionDigits);
  return `${rounded} ${units[unitIdx]}`;
}

/**
 * Strip filename of anything that could break a storage path or RLS-checked
 * URL. We preserve the extension so categorization downstream works.
 */
export function sanitizeFilename(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "file";
  const lastDot = trimmed.lastIndexOf(".");
  const base = lastDot > 0 ? trimmed.slice(0, lastDot) : trimmed;
  const ext = lastDot > 0 ? trimmed.slice(lastDot + 1) : "";
  // Allow letters, numbers, dash, underscore, period; collapse everything
  // else (spaces, slashes, unicode, etc.) into a single dash.
  const safeBase =
    base
      .replace(/[^a-zA-Z0-9._-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 80) || "file";
  const safeExt = ext.replace(/[^a-zA-Z0-9]/g, "").slice(0, 10);
  return safeExt ? `${safeBase}.${safeExt}` : safeBase;
}

export function getFileExtension(name: string): string | null {
  const lastDot = name.lastIndexOf(".");
  if (lastDot < 0 || lastDot === name.length - 1) return null;
  return name.slice(lastDot + 1).toLowerCase();
}

/** True when we generate a sharp thumbnail for this file. */
export function shouldGenerateThumbnail(mime: string): boolean {
  return ["image/jpeg", "image/png", "image/webp", "image/gif"].includes(mime);
}
