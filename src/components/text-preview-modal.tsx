"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, Download, Loader2 } from "lucide-react";
import {
  getDownloadUrl,
  getInlineUrl,
  type Attachment,
} from "@/app/actions/attachments";
import { formatBytes } from "@/lib/file-utils";

interface TextPreviewModalProps {
  attachment: Attachment;
  onClose: () => void;
}

// Cap how much text we render to keep the modal responsive for very large
// CSVs etc. Anything beyond this gets truncated with a banner.
const MAX_INLINE_BYTES = 256_000; // ~256 KB

export function TextPreviewModal({
  attachment,
  onClose,
}: TextPreviewModalProps) {
  const [text, setText] = useState<string | null>(null);
  const [truncated, setTruncated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const res = await getInlineUrl(attachment.id);
      if (cancelled) return;
      if (!res.success || !res.data) {
        setError(res.success ? "No URL returned." : res.error);
        setLoading(false);
        return;
      }
      try {
        const r = await fetch(res.data.url);
        if (!r.ok) throw new Error(`Fetch failed (${r.status})`);
        const blob = await r.blob();
        // Cap how much we read — text-only files we display inline.
        const slice = blob.slice(0, MAX_INLINE_BYTES + 1);
        const raw = await slice.text();
        if (cancelled) return;
        if (raw.length > MAX_INLINE_BYTES) {
          setText(raw.slice(0, MAX_INLINE_BYTES));
          setTruncated(true);
        } else {
          setText(raw);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Couldn't load file.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [attachment.id]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function handleDownload() {
    const res = await getDownloadUrl(attachment.id);
    if (res.success && res.data) {
      window.open(res.data.url, "_blank", "noopener");
    }
  }

  return (
    <AnimatePresence>
      <motion.div
        key="text-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
        className="fixed inset-0 z-[150] flex items-center justify-center bg-black/60 p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 8 }}
          transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
          className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          <header className="flex items-center gap-3 px-5 py-3 border-b border-[#E5E7EB]">
            <div className="flex-1 min-w-0">
              <p
                className="text-[15px] text-[#2D333A] truncate"
                style={{ fontFamily: "var(--font-poppins)", fontWeight: 700 }}
              >
                {attachment.name}
              </p>
              <p
                className="text-[12px] text-[#6B7280]"
                style={{ fontFamily: "var(--font-source-sans)" }}
              >
                {formatBytes(attachment.size_bytes)}
                {truncated && " · showing first 256 KB"}
              </p>
            </div>
            <button
              type="button"
              onClick={handleDownload}
              className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-xl border border-[#E5E7EB] bg-white text-[13px] font-semibold text-[#2D333A] hover:bg-[#F4F5F7] transition-colors"
              style={{ fontFamily: "var(--font-poppins)" }}
            >
              <Download className="size-3.5" />
              Download
            </button>
            <button
              type="button"
              onClick={onClose}
              className="size-9 rounded-full hover:bg-[#F4F5F7] flex items-center justify-center text-[#6B7280] transition-colors"
              aria-label="Close (Esc)"
            >
              <X className="size-4" />
            </button>
          </header>
          <div className="flex-1 overflow-auto bg-[#F8FAFC] p-5">
            {loading ? (
              <div className="flex items-center justify-center gap-2 text-[#6B7280] py-10">
                <Loader2 className="size-5 animate-spin" />
                <span style={{ fontFamily: "var(--font-source-sans)" }}>
                  Loading...
                </span>
              </div>
            ) : error ? (
              <div
                className="text-center text-[13px] text-red-600 py-10"
                style={{ fontFamily: "var(--font-source-sans)" }}
              >
                {error}
              </div>
            ) : (
              <pre
                className="text-[13px] text-[#2D333A] whitespace-pre-wrap break-words font-mono leading-relaxed"
                style={{ tabSize: 2 }}
              >
                {text}
              </pre>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
