"use client";

import { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, ChevronLeft, ChevronRight, Download, Loader2 } from "lucide-react";
import {
  getDownloadUrl,
  getInlineUrl,
  type Attachment,
} from "@/app/actions/attachments";
import { formatBytes } from "@/lib/file-utils";

interface LightboxModalProps {
  /** All image attachments in the same parent context, for prev/next nav. */
  images: Attachment[];
  initialIndex: number;
  onClose: () => void;
}

export function LightboxModal({
  images,
  initialIndex,
  onClose,
}: LightboxModalProps) {
  const [index, setIndex] = useState(initialIndex);
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const current = images[index];

  // Resolve a signed URL each time the active image changes.
  useEffect(() => {
    let cancelled = false;
    if (!current) return;
    setLoading(true);
    setUrl(null);
    getInlineUrl(current.id).then((res) => {
      if (cancelled) return;
      setUrl(res.success && res.data ? res.data.url : null);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [current]);

  const prev = useCallback(() => {
    setIndex((i) => (i - 1 + images.length) % images.length);
  }, [images.length]);
  const next = useCallback(() => {
    setIndex((i) => (i + 1) % images.length);
  }, [images.length]);

  // Keyboard shortcuts: ←/→ navigate, Esc closes.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft") prev();
      else if (e.key === "ArrowRight") next();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, prev, next]);

  async function handleDownload() {
    if (!current) return;
    const res = await getDownloadUrl(current.id);
    if (res.success && res.data) {
      window.open(res.data.url, "_blank", "noopener");
    }
  }

  if (!current) return null;
  const hasMany = images.length > 1;

  return (
    <AnimatePresence>
      <motion.div
        key="lightbox-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
        className="fixed inset-0 z-[150] flex items-center justify-center bg-black/80 p-6"
        onClick={onClose}
      >
        {/* Top bar — name + actions */}
        <div
          className="absolute top-0 inset-x-0 px-5 py-3 flex items-center gap-3 text-white"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex-1 min-w-0">
            <p
              className="text-[14px] truncate"
              style={{ fontFamily: "var(--font-poppins)", fontWeight: 600 }}
            >
              {current.name}
            </p>
            <p
              className="text-[12px] text-white/70"
              style={{ fontFamily: "var(--font-source-sans)" }}
            >
              {formatBytes(current.size_bytes)}
              {hasMany && ` · ${index + 1} of ${images.length}`}
            </p>
          </div>
          <button
            type="button"
            onClick={handleDownload}
            className="size-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
            aria-label="Download"
            title="Download"
          >
            <Download className="size-4" />
          </button>
          <button
            type="button"
            onClick={onClose}
            className="size-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
            aria-label="Close"
            title="Close (Esc)"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Image */}
        <div
          className="relative max-w-[92vw] max-h-[80vh] flex items-center justify-center"
          onClick={(e) => e.stopPropagation()}
        >
          {loading ? (
            <div className="text-white/80 flex items-center gap-2">
              <Loader2 className="size-5 animate-spin" />
              <span style={{ fontFamily: "var(--font-source-sans)" }}>
                Loading...
              </span>
            </div>
          ) : url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <motion.img
              key={current.id}
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.18 }}
              src={url}
              alt={current.name}
              className="max-w-full max-h-[80vh] object-contain rounded-lg"
            />
          ) : (
            <p
              className="text-white/70 text-[13px]"
              style={{ fontFamily: "var(--font-source-sans)" }}
            >
              Couldn&apos;t load this image.
            </p>
          )}
        </div>

        {/* Prev / next */}
        {hasMany && (
          <>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                prev();
              }}
              className="absolute left-4 top-1/2 -translate-y-1/2 size-11 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
              aria-label="Previous (←)"
            >
              <ChevronLeft className="size-5" />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                next();
              }}
              className="absolute right-4 top-1/2 -translate-y-1/2 size-11 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
              aria-label="Next (→)"
            >
              <ChevronRight className="size-5" />
            </button>
          </>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
