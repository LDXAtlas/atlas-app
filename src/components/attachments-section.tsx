"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Paperclip, ChevronDown, Plus } from "lucide-react";
import {
  getAttachments,
  type Attachment,
  type AttachmentEntityType,
} from "@/app/actions/attachments";
import { createClient } from "@/lib/supabase/client";
import { FilePreview } from "./file-preview";
import { FileUploader } from "./file-uploader";
import { LightboxModal } from "./lightbox-modal";
import { PDFPreviewModal } from "./pdf-preview-modal";
import { TextPreviewModal } from "./text-preview-modal";

interface AttachmentsSectionProps {
  entityType: AttachmentEntityType;
  entityId: string;
  /** Override: true when the viewer can upload. Defaults to false. */
  canUpload?: boolean;
  /** Override: true when the viewer can delete every attachment. Per-row
   *  delete still falls back to "uploader OR admin" server-side. */
  canDeleteAny?: boolean;
  /** When true (default), the section can be collapsed/expanded. */
  collapsible?: boolean;
  /** Optional override on visual header — default "Attachments". */
  title?: string;
}

export function AttachmentsSection({
  entityType,
  entityId,
  canUpload = false,
  canDeleteAny = false,
  collapsible = true,
  title = "Attachments",
}: AttachmentsSectionProps) {
  // Resolved on mount so callers don't have to thread it through every
  // parent. Stays null until ready; FilePreview falls back to canDeleteAny.
  const [viewerId, setViewerId] = useState<string | null>(null);
  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;
    supabase.auth.getUser().then(({ data }) => {
      if (!cancelled) setViewerId(data.user?.id ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(true);
  const [uploaderOpen, setUploaderOpen] = useState(false);

  // Active preview modal — orchestrated here so the lightbox knows about
  // sibling images for prev/next.
  const [lightbox, setLightbox] = useState<{
    images: Attachment[];
    index: number;
  } | null>(null);
  const [pdfPreview, setPdfPreview] = useState<Attachment | null>(null);
  const [textPreview, setTextPreview] = useState<Attachment | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      const res = await getAttachments(entityType, entityId);
      if (cancelled) return;
      setAttachments(res.data);
      setLoading(false);
      // Auto-collapse when there are no files and collapsible is on, so
      // the section doesn't take vertical space on a fresh entity.
      if (collapsible && res.data.length === 0) setExpanded(false);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [entityType, entityId, collapsible]);

  const images = useMemo(
    () => attachments.filter((a) => a.file_type === "image"),
    [attachments],
  );

  function handleUploadComplete(att: Attachment) {
    setAttachments((prev) => [att, ...prev]);
    setUploaderOpen(false);
    setExpanded(true);
  }

  function handleDeleted(id: string) {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  }

  function openLightbox(att: Attachment) {
    const idx = images.findIndex((a) => a.id === att.id);
    if (idx < 0) return;
    setLightbox({ images, index: idx });
  }

  const empty = !loading && attachments.length === 0;

  return (
    <section className="bg-white border border-[#E5E7EB] rounded-2xl">
      {/* Header */}
      <header className="flex items-center gap-2 px-4 py-3 border-b border-[#F1F5F9]">
        <button
          type="button"
          onClick={() => collapsible && setExpanded((v) => !v)}
          disabled={!collapsible}
          className="flex items-center gap-2 flex-1 text-left disabled:cursor-default"
          aria-expanded={expanded}
        >
          <Paperclip className="size-4 text-[#6B7280]" />
          <span
            className="text-[14px] text-[#2D333A]"
            style={{ fontFamily: "var(--font-poppins)", fontWeight: 600 }}
          >
            {title}
          </span>
          {attachments.length > 0 && (
            <span
              className="text-[11px] text-[#6B7280] bg-[#F3F4F6] px-1.5 py-0.5 rounded-md tabular-nums"
              style={{ fontFamily: "var(--font-poppins)", fontWeight: 600 }}
            >
              {attachments.length}
            </span>
          )}
          {collapsible && (
            <ChevronDown
              className={`size-3.5 text-[#9CA3AF] ml-auto transition-transform ${
                expanded ? "" : "-rotate-90"
              }`}
            />
          )}
        </button>
        {canUpload && expanded && (
          <button
            type="button"
            onClick={() => setUploaderOpen((v) => !v)}
            className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md text-[12px] font-semibold text-[#5CE1A5] hover:bg-[#5CE1A5]/10 transition-colors"
            style={{ fontFamily: "var(--font-poppins)" }}
          >
            <Plus className="size-3.5" />
            Add files
          </button>
        )}
      </header>

      {/* Body */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 py-3 space-y-3">
              {/* Uploader — toggled by header button, or always shown when
                  there are no attachments yet. */}
              {canUpload && (uploaderOpen || empty) && (
                <FileUploader
                  entityType={entityType}
                  entityId={entityId}
                  compact={!empty}
                  onUploadComplete={handleUploadComplete}
                />
              )}

              {empty && !canUpload && (
                <p
                  className="text-[12px] text-[#9CA3AF] px-1 py-2"
                  style={{ fontFamily: "var(--font-source-sans)" }}
                >
                  No files attached yet.
                </p>
              )}

              {!empty && (
                <ul className="space-y-2">
                  <AnimatePresence initial={false}>
                    {attachments.map((a) => (
                      <FilePreview
                        key={a.id}
                        attachment={a}
                        canDelete={
                          canDeleteAny ||
                          (viewerId !== null && viewerId === a.uploaded_by)
                        }
                        onDeleted={handleDeleted}
                        onOpenLightbox={openLightbox}
                        onOpenPDF={setPdfPreview}
                        onOpenText={setTextPreview}
                      />
                    ))}
                  </AnimatePresence>
                </ul>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Preview modals — portal-style overlays, single instance at a time. */}
      {lightbox && (
        <LightboxModal
          images={lightbox.images}
          initialIndex={lightbox.index}
          onClose={() => setLightbox(null)}
        />
      )}
      {pdfPreview && (
        <PDFPreviewModal
          attachment={pdfPreview}
          onClose={() => setPdfPreview(null)}
        />
      )}
      {textPreview && (
        <TextPreviewModal
          attachment={textPreview}
          onClose={() => setTextPreview(null)}
        />
      )}
    </section>
  );
}
