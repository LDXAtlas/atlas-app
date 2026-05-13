"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  FileText,
  FileSpreadsheet,
  Presentation,
  File as FileIcon,
  FileAudio,
  Download,
  Copy,
  Trash2,
  MoreHorizontal,
  Loader2,
  Image as ImageIcon,
} from "lucide-react";
import {
  deleteAttachment,
  getDownloadUrl,
  getInlineUrl,
  getThumbnailUrl,
  type Attachment,
} from "@/app/actions/attachments";
import { formatBytes, type FileCategory } from "@/lib/file-utils";

interface FilePreviewProps {
  attachment: Attachment;
  /** True when the viewer can delete this file (uploader or admin). */
  canDelete?: boolean;
  /** Callback after successful delete so parent can prune local state. */
  onDeleted?: (id: string) => void;
  /** Open in lightbox / pdf / text modal — handled by AttachmentsSection. */
  onOpenLightbox?: (attachment: Attachment) => void;
  onOpenPDF?: (attachment: Attachment) => void;
  onOpenText?: (attachment: Attachment) => void;
  compact?: boolean;
}

function initialsOf(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((n) => n[0])
      .join("")
      .toUpperCase() || "?"
  );
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function iconFor(category: FileCategory) {
  switch (category) {
    case "image":
      return { Icon: ImageIcon, color: "#10B981", bg: "#D1FAE5" };
    case "pdf":
      return { Icon: FileIcon, color: "#DC2626", bg: "#FEE2E2" };
    case "audio":
      return { Icon: FileAudio, color: "#8B5CF6", bg: "#EDE9FE" };
    case "office_word":
      return { Icon: FileText, color: "#2563EB", bg: "#DBEAFE" };
    case "office_excel":
      return { Icon: FileSpreadsheet, color: "#059669", bg: "#D1FAE5" };
    case "office_ppt":
      return { Icon: Presentation, color: "#D97706", bg: "#FEF3C7" };
    case "text":
      return { Icon: FileText, color: "#6B7280", bg: "#F3F4F6" };
    case "other":
    default:
      return { Icon: FileIcon, color: "#6B7280", bg: "#F3F4F6" };
  }
}

export function FilePreview({
  attachment,
  canDelete = false,
  onDeleted,
  onOpenLightbox,
  onOpenPDF,
  onOpenText,
  compact = false,
}: FilePreviewProps) {
  const { Icon, color, bg } = iconFor(attachment.file_type);
  const [menuOpen, setMenuOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [thumbUrl, setThumbUrl] = useState<string | null>(null);
  const [audioOpen, setAudioOpen] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Resolve a thumbnail URL for images. The server only generates one when
  // a sharp resize succeeded; if missing we fall back to the icon.
  useEffect(() => {
    let cancelled = false;
    if (attachment.file_type !== "image" || !attachment.thumbnail_path) return;
    getThumbnailUrl(attachment.id).then((res) => {
      if (cancelled) return;
      if (res.success && res.data) setThumbUrl(res.data.url);
    });
    return () => {
      cancelled = true;
    };
  }, [attachment.id, attachment.file_type, attachment.thumbnail_path]);

  // Close action menu on outside click / Esc.
  useEffect(() => {
    if (!menuOpen) return;
    function onDoc(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setMenuOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  function handleClick() {
    if (deleting) return;
    switch (attachment.file_type) {
      case "image":
        onOpenLightbox?.(attachment);
        return;
      case "pdf":
        onOpenPDF?.(attachment);
        return;
      case "text":
        onOpenText?.(attachment);
        return;
      case "audio":
        toggleAudio();
        return;
      default:
        // Office docs / unknown: download directly.
        handleDownload();
    }
  }

  async function toggleAudio() {
    if (audioOpen) {
      setAudioOpen(false);
      return;
    }
    if (!audioUrl) {
      const res = await getInlineUrl(attachment.id);
      if (res.success && res.data) setAudioUrl(res.data.url);
    }
    setAudioOpen(true);
  }

  async function handleDownload() {
    setMenuOpen(false);
    const res = await getDownloadUrl(attachment.id);
    if (res.success && res.data) {
      window.open(res.data.url, "_blank", "noopener");
    }
  }

  async function handleCopyLink() {
    setMenuOpen(false);
    const res = await getInlineUrl(attachment.id);
    if (res.success && res.data) {
      try {
        await navigator.clipboard.writeText(res.data.url);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      } catch {
        // Clipboard write can fail in some sandboxed contexts — fall back to
        // opening the URL so the user can copy it manually.
        window.prompt("Copy this link", res.data.url);
      }
    }
  }

  async function handleDelete() {
    setMenuOpen(false);
    if (
      !window.confirm(
        `Delete ${attachment.name}? This can't be undone in Phase 1.`,
      )
    )
      return;
    setDeleting(true);
    const res = await deleteAttachment(attachment.id);
    if (!res.success) {
      setDeleting(false);
      window.alert(res.error);
      return;
    }
    onDeleted?.(attachment.id);
  }

  const verticalPad = compact ? "py-2" : "py-2.5";

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: deleting ? 0.5 : 1, y: 0 }}
      exit={{ opacity: 0, x: -8 }}
      transition={{ duration: 0.18 }}
      className={`group relative bg-white border border-[#E5E7EB] rounded-xl px-3 ${verticalPad} flex items-center gap-3 hover:border-[#5CE1A5]/60 hover:shadow-[0_2px_8px_rgba(15,23,42,0.04)] transition-[border-color,box-shadow] duration-200`}
    >
      {/* Visual lead */}
      <button
        type="button"
        onClick={handleClick}
        disabled={deleting}
        className="shrink-0 flex items-center justify-center rounded-lg overflow-hidden text-left"
        style={{
          width: compact ? 36 : 44,
          height: compact ? 36 : 44,
          backgroundColor: thumbUrl ? "transparent" : bg,
        }}
        aria-label={`Open ${attachment.name}`}
      >
        {thumbUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={thumbUrl}
            alt=""
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <Icon className="size-5" style={{ color }} />
        )}
      </button>

      {/* Name + meta — also clickable. */}
      <button
        type="button"
        onClick={handleClick}
        disabled={deleting}
        className="flex-1 min-w-0 text-left"
        title={attachment.name}
      >
        <p
          className="text-[13px] text-[#2D333A] leading-snug truncate"
          style={{ fontFamily: "var(--font-poppins)", fontWeight: 600 }}
        >
          {attachment.name}
        </p>
        <p
          className="text-[11px] text-[#6B7280] mt-0.5 truncate"
          style={{ fontFamily: "var(--font-source-sans)" }}
        >
          {formatBytes(attachment.size_bytes)}
          {attachment.uploader ? ` · ${attachment.uploader.full_name}` : ""}
          {" · "}
          {relativeTime(attachment.uploaded_at)}
        </p>
      </button>

      {/* Hover-only inline metadata badge — keeps the row clean at rest. */}
      {attachment.uploader && (
        <span
          className="hidden md:flex shrink-0 size-7 rounded-full text-white text-[10px] items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
          style={{
            fontFamily: "var(--font-poppins)",
            fontWeight: 600,
            backgroundColor: attachment.uploader.avatar_color,
          }}
          title={attachment.uploader.full_name}
        >
          {initialsOf(attachment.uploader.full_name)}
        </span>
      )}

      {/* Action menu */}
      <div ref={menuRef} className="relative shrink-0">
        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          disabled={deleting}
          className="size-7 rounded-md flex items-center justify-center text-[#9CA3AF] hover:text-[#2D333A] hover:bg-[#F4F5F7] transition-colors"
          aria-label="File actions"
        >
          {deleting ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <MoreHorizontal className="size-3.5" />
          )}
        </button>
        <AnimatePresence>
          {menuOpen && (
            <motion.div
              initial={{ opacity: 0, y: -4, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -4, scale: 0.96 }}
              transition={{ duration: 0.15 }}
              className="absolute right-0 top-full mt-1.5 z-30 w-44 bg-white rounded-xl border border-[#E5E7EB] py-1.5"
              style={{ boxShadow: "0 8px 30px rgba(0,0,0,0.12)" }}
            >
              <MenuItem
                icon={<Download className="size-3.5 text-[#9CA3AF]" />}
                onClick={handleDownload}
              >
                Download
              </MenuItem>
              <MenuItem
                icon={<Copy className="size-3.5 text-[#9CA3AF]" />}
                onClick={handleCopyLink}
              >
                {copied ? "Copied!" : "Copy link"}
              </MenuItem>
              {canDelete && (
                <>
                  <div className="h-px bg-[#F3F4F6] mx-2 my-1" />
                  <MenuItem
                    icon={<Trash2 className="size-3.5" />}
                    onClick={handleDelete}
                    tone="danger"
                  >
                    Delete
                  </MenuItem>
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Inline audio player (audio attachments only). */}
      <AnimatePresence>
        {audioOpen && audioUrl && attachment.file_type === "audio" && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute left-0 right-0 top-full mt-2 bg-white border border-[#E5E7EB] rounded-xl p-3 shadow-sm z-10"
          >
            <audio
              controls
              autoPlay
              src={audioUrl}
              className="w-full"
            >
              Your browser doesn&apos;t support inline audio playback.
            </audio>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function MenuItem({
  icon,
  children,
  onClick,
  tone,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
  onClick: () => void;
  tone?: "danger";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left flex items-center gap-2 px-3 py-1.5 text-[13px] transition-colors hover:bg-[#F4F5F7]"
      style={{
        fontFamily: "var(--font-source-sans)",
        color: tone === "danger" ? "#DC2626" : "#2D333A",
      }}
    >
      {icon}
      {children}
    </button>
  );
}
