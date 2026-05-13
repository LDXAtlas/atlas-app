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

interface PDFPreviewModalProps {
  attachment: Attachment;
  onClose: () => void;
}

export function PDFPreviewModal({ attachment, onClose }: PDFPreviewModalProps) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    getInlineUrl(attachment.id).then((res) => {
      if (cancelled) return;
      setUrl(res.success && res.data ? res.data.url : null);
      setLoading(false);
    });
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
        key="pdf-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
        className="fixed inset-0 z-[150] flex items-center justify-center bg-black/70 p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 8 }}
          transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
          className="bg-white rounded-2xl shadow-2xl w-[90vw] h-[90vh] flex flex-col overflow-hidden"
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

          <div className="flex-1 bg-[#F4F5F7]">
            {loading ? (
              <div className="h-full flex items-center justify-center gap-2 text-[#6B7280]">
                <Loader2 className="size-5 animate-spin" />
                <span style={{ fontFamily: "var(--font-source-sans)" }}>
                  Loading PDF...
                </span>
              </div>
            ) : url ? (
              <iframe
                title={attachment.name}
                src={url}
                className="w-full h-full border-0 bg-white"
              />
            ) : (
              <div
                className="h-full flex items-center justify-center text-[13px] text-[#6B7280]"
                style={{ fontFamily: "var(--font-source-sans)" }}
              >
                Couldn&apos;t load this PDF.
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
