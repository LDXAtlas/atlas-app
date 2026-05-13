"use client";

import { useEffect, useId, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Upload, X, Check, AlertCircle, Loader2 } from "lucide-react";
import {
  getOrganizationStorageUsage,
  uploadAttachment,
  type Attachment,
  type AttachmentEntityType,
  type StorageUsage,
} from "@/app/actions/attachments";
import {
  ALLOWED_MIME_TYPES,
  MAX_FILE_BYTES,
  formatBytes,
} from "@/lib/file-utils";

interface FileUploaderProps {
  entityType: AttachmentEntityType;
  entityId: string;
  onUploadComplete?: (attachment: Attachment) => void;
  onUploadError?: (error: string) => void;
  /** Hard cap on how many files can sit in the in-flight tray at once. */
  maxFiles?: number;
  /** Compact mode: smaller drop zone for inline use. */
  compact?: boolean;
}

type QueuedFile = {
  // Local-only id, distinct from the eventual attachment id.
  localId: string;
  file: File;
  /** Status the row reports to the user. */
  status: "queued" | "uploading" | "success" | "error";
  errorMessage?: string;
  // We use an indeterminate progress bar (server actions can't expose
  // byte-level progress over the wire). TODO Phase 2: switch to a chunked
  // Route Handler to surface real upload progress.
};

// File input accept string built from the MIME allow-list — the browser
// uses these as hints in the OS picker.
const ACCEPT_ATTR = Array.from(ALLOWED_MIME_TYPES).join(",");

export function FileUploader({
  entityType,
  entityId,
  onUploadComplete,
  onUploadError,
  maxFiles = 10,
  compact = false,
}: FileUploaderProps) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [queue, setQueue] = useState<QueuedFile[]>([]);
  const [usage, setUsage] = useState<StorageUsage | null>(null);
  const [usageLoading, setUsageLoading] = useState(true);

  // Pull current storage usage on mount so we can show the right banner.
  useEffect(() => {
    let cancelled = false;
    getOrganizationStorageUsage().then((res) => {
      if (cancelled) return;
      if (res.success && res.data) setUsage(res.data);
      setUsageLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const atLimit = !!usage && usage.percentage_used >= 100;
  const nearLimit = !!usage && usage.percentage_used >= 80 && !atLimit;

  function clientSideError(file: File): string | null {
    if (file.size <= 0) return "File is empty.";
    if (file.size > MAX_FILE_BYTES)
      return `Too large (${formatBytes(file.size)}). Max is 25 MB.`;
    if (!ALLOWED_MIME_TYPES.has(file.type))
      return `Unsupported type${file.type ? ` (${file.type})` : ""}.`;
    if (usage && usage.used_bytes + file.size > usage.limit_bytes) {
      return `Would exceed your church's ${formatBytes(usage.limit_bytes)} plan.`;
    }
    return null;
  }

  function acceptFiles(fileList: FileList | File[]) {
    if (atLimit) return;
    const filesArray = Array.from(fileList);
    // Reject everything if the batch alone would blow the limit.
    if (usage) {
      const totalNew = filesArray.reduce((sum, f) => sum + f.size, 0);
      if (usage.used_bytes + totalNew > usage.limit_bytes) {
        onUploadError?.(
          `Selecting these files would exceed your church's ${formatBytes(usage.limit_bytes)} plan.`,
        );
      }
    }
    const queued = filesArray.slice(0, maxFiles).map<QueuedFile>((file) => {
      const err = clientSideError(file);
      return {
        localId: crypto.randomUUID(),
        file,
        status: err ? "error" : "queued",
        errorMessage: err ?? undefined,
      };
    });
    setQueue((prev) => [...prev, ...queued].slice(-maxFiles));
    // Kick off uploads for the valid rows.
    queued
      .filter((q) => q.status === "queued")
      .forEach((q) => void runUpload(q.localId, q.file));
  }

  async function runUpload(localId: string, file: File) {
    setQueue((prev) =>
      prev.map((row) =>
        row.localId === localId ? { ...row, status: "uploading" } : row,
      ),
    );

    const formData = new FormData();
    formData.append("file", file);
    formData.append("entity_type", entityType);
    formData.append("entity_id", entityId);

    const res = await uploadAttachment(formData);
    if (!res.success) {
      setQueue((prev) =>
        prev.map((row) =>
          row.localId === localId
            ? { ...row, status: "error", errorMessage: res.error }
            : row,
        ),
      );
      onUploadError?.(res.error);
      // Refresh usage in case the error is informative (limit exceeded).
      const refreshed = await getOrganizationStorageUsage();
      if (refreshed.success && refreshed.data) setUsage(refreshed.data);
      return;
    }

    setQueue((prev) =>
      prev.map((row) =>
        row.localId === localId ? { ...row, status: "success" } : row,
      ),
    );
    if (res.data) {
      onUploadComplete?.(res.data);
      // Bump local usage so subsequent client-side checks are accurate.
      setUsage((prev) =>
        prev
          ? {
              ...prev,
              used_bytes: prev.used_bytes + res.data!.size_bytes,
              percentage_used:
                prev.limit_bytes > 0
                  ? Math.min(
                      100,
                      ((prev.used_bytes + res.data!.size_bytes) /
                        prev.limit_bytes) *
                        100,
                    )
                  : 0,
              formatted: {
                used: formatBytes(prev.used_bytes + res.data!.size_bytes),
                limit: prev.formatted.limit,
              },
            }
          : prev,
      );
    }
    // Auto-clear successful rows after a short delay so the tray doesn't
    // grow forever during a long session.
    setTimeout(() => {
      setQueue((prev) => prev.filter((row) => row.localId !== localId));
    }, 1500);
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!atLimit) setIsDragOver(true);
  }
  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }
  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    if (atLimit) return;
    if (e.dataTransfer.files?.length) acceptFiles(e.dataTransfer.files);
  }

  function handlePicked(e: React.ChangeEvent<HTMLInputElement>) {
    if (!e.target.files?.length) return;
    acceptFiles(e.target.files);
    // Reset so the same file can be picked again immediately.
    e.target.value = "";
  }

  function dismissRow(localId: string) {
    setQueue((prev) => prev.filter((r) => r.localId !== localId));
  }

  const dropPadding = compact ? "p-3" : "p-6";

  return (
    <div className="space-y-3">
      {/* Storage warnings. */}
      {!usageLoading && (nearLimit || atLimit) && (
        <div
          role="status"
          className={`flex items-start gap-2 px-3.5 py-2.5 rounded-xl border text-[12px] ${
            atLimit
              ? "bg-red-50 border-red-100 text-red-700"
              : "bg-amber-50 border-amber-100 text-amber-800"
          }`}
          style={{ fontFamily: "var(--font-source-sans)" }}
        >
          <AlertCircle className="size-4 mt-0.5 shrink-0" />
          <p>
            {atLimit ? (
              <>
                <span style={{ fontWeight: 700 }}>Storage full.</span> Delete
                some files or contact your admin about upgrading.
              </>
            ) : usage ? (
              <>
                You&apos;ve used{" "}
                <span style={{ fontWeight: 700 }}>
                  {usage.formatted.used}
                </span>{" "}
                of{" "}
                <span style={{ fontWeight: 700 }}>
                  {usage.formatted.limit}
                </span>
                . Approaching storage limit.
              </>
            ) : null}
          </p>
        </div>
      )}

      {/* Drop zone */}
      <label
        htmlFor={inputId}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`flex flex-col items-center justify-center text-center rounded-2xl border-2 border-dashed transition-colors ${dropPadding} ${
          atLimit
            ? "cursor-not-allowed border-[#E5E7EB] bg-[#FAFBFC]"
            : isDragOver
              ? "border-[#5CE1A5] bg-[#5CE1A5]/8 cursor-pointer"
              : "border-[#E5E7EB] hover:border-[#5CE1A5]/60 hover:bg-[#FAFBFC] cursor-pointer"
        }`}
      >
        <input
          ref={inputRef}
          id={inputId}
          type="file"
          multiple
          accept={ACCEPT_ATTR}
          className="hidden"
          onChange={handlePicked}
          disabled={atLimit}
        />
        <div
          className="size-9 rounded-xl flex items-center justify-center mb-2"
          style={{ backgroundColor: "rgba(92, 225, 165, 0.10)" }}
        >
          <Upload className="size-4 text-[#5CE1A5]" />
        </div>
        <p
          className="text-[13px] text-[#2D333A]"
          style={{ fontFamily: "var(--font-poppins)", fontWeight: 600 }}
        >
          {compact ? "Add files" : "Drop files here or click to upload"}
        </p>
        {!compact && (
          <p
            className="text-[11px] text-[#9CA3AF] mt-1 max-w-sm"
            style={{ fontFamily: "var(--font-source-sans)" }}
          >
            PDFs, images, audio, Word / Excel / PowerPoint, and text files —
            up to {formatBytes(MAX_FILE_BYTES)} each.
          </p>
        )}
      </label>

      {/* Queue */}
      <AnimatePresence initial={false}>
        {queue.length > 0 && (
          <motion.ul
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="space-y-1.5"
          >
            <AnimatePresence initial={false}>
              {queue.map((row) => (
                <motion.li
                  key={row.localId}
                  layout
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.18 }}
                  className="bg-white border border-[#E5E7EB] rounded-xl px-3 py-2 flex items-center gap-3"
                >
                  <StatusIcon status={row.status} />
                  <div className="flex-1 min-w-0">
                    <p
                      className="text-[12px] text-[#2D333A] truncate"
                      style={{
                        fontFamily: "var(--font-poppins)",
                        fontWeight: 600,
                      }}
                    >
                      {row.file.name}
                    </p>
                    <p
                      className="text-[11px] text-[#6B7280]"
                      style={{ fontFamily: "var(--font-source-sans)" }}
                    >
                      {formatBytes(row.file.size)}
                      {row.status === "error" && row.errorMessage
                        ? ` · ${row.errorMessage}`
                        : ""}
                      {row.status === "uploading" ? " · Uploading..." : ""}
                      {row.status === "success" ? " · Uploaded" : ""}
                    </p>
                    {row.status === "uploading" && (
                      <IndeterminateBar />
                    )}
                  </div>
                  {row.status !== "uploading" && (
                    <button
                      type="button"
                      onClick={() => dismissRow(row.localId)}
                      className="size-6 rounded-md flex items-center justify-center text-[#9CA3AF] hover:text-[#2D333A] hover:bg-[#F4F5F7] transition-colors"
                      aria-label="Dismiss"
                    >
                      <X className="size-3" />
                    </button>
                  )}
                </motion.li>
              ))}
            </AnimatePresence>
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}

function StatusIcon({
  status,
}: {
  status: QueuedFile["status"];
}) {
  if (status === "uploading") {
    return <Loader2 className="size-4 text-[#5CE1A5] animate-spin shrink-0" />;
  }
  if (status === "success") {
    return (
      <span className="size-5 rounded-full bg-[#5CE1A5] flex items-center justify-center shrink-0">
        <Check className="size-3 text-white" strokeWidth={3} />
      </span>
    );
  }
  if (status === "error") {
    return (
      <span className="size-5 rounded-full bg-red-100 flex items-center justify-center shrink-0">
        <AlertCircle className="size-3 text-red-600" />
      </span>
    );
  }
  return <Upload className="size-4 text-[#9CA3AF] shrink-0" />;
}

function IndeterminateBar() {
  // Indeterminate progress — server actions don't expose true byte progress.
  return (
    <div className="h-1 mt-1.5 w-full rounded-full bg-[#F1F5F9] overflow-hidden">
      <motion.div
        className="h-full bg-[#5CE1A5]"
        initial={{ x: "-30%", width: "30%" }}
        animate={{ x: "100%" }}
        transition={{
          repeat: Infinity,
          duration: 1.4,
          ease: "easeInOut",
        }}
      />
    </div>
  );
}
