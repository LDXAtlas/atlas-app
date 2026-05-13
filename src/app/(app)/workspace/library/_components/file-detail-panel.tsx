"use client";

import { useEffect, useState, useTransition } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  ArrowLeft,
  Bookmark,
  Check,
  Copy,
  Download,
  ExternalLink,
  Eye,
  FolderInput,
  Plus,
  Tag,
  Trash2,
  X,
} from "lucide-react";
import {
  deleteAttachment,
  getAttachmentDetail,
  getDownloadUrl,
  getInlineUrl,
  getLibraryTags,
  addTagToAttachment,
  removeTagFromAttachment,
  pinAttachment,
  renameAttachment,
  trackAttachmentDownload,
  trackAttachmentView,
  unpinAttachment,
  updateAttachmentDescription,
  type LibraryFile,
  type LibraryFileDetail,
  type LibraryTag,
} from "@/app/actions/attachments";
import { formatBytes } from "@/lib/file-utils";
import { LightboxModal } from "@/components/lightbox-modal";
import { fileCategoryLabel, fileIconFor } from "./file-icon-helper";

interface FileDetailPanelProps {
  fileId: string | null;
  onClose: () => void;
  onFileUpdated: (file: LibraryFile) => void;
  onFileDeleted: (fileId: string) => void;
  onMoveRequested: (file: LibraryFile) => void;
  /** Catalog of org tags — used for the "+ Add tag" popover. */
  tagCatalog: LibraryTag[];
  onTagsChanged?: () => void;
}

export function FileDetailPanel({
  fileId,
  onClose,
  onFileUpdated,
  onFileDeleted,
  onMoveRequested,
  tagCatalog,
  onTagsChanged,
}: FileDetailPanelProps) {
  const [detail, setDetail] = useState<LibraryFileDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inlineUrl, setInlineUrl] = useState<string | null>(null);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [editingDesc, setEditingDesc] = useState(false);
  const [descDraft, setDescDraft] = useState("");
  const [tagPickerOpen, setTagPickerOpen] = useState(false);
  const [tagFilter, setTagFilter] = useState("");
  const [copied, setCopied] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [localTags, setLocalTags] = useState<LibraryTag[]>([]);
  const [orgTags, setOrgTags] = useState<LibraryTag[]>(tagCatalog);

  // Reset state and load detail whenever the panel opens for a new file.
  useEffect(() => {
    if (!fileId) {
      setDetail(null);
      setInlineUrl(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    setEditingName(false);
    setEditingDesc(false);
    setTagPickerOpen(false);
    setConfirmDelete(false);
    getAttachmentDetail(fileId).then((res) => {
      if (cancelled) return;
      if (res.success && res.data) {
        setDetail(res.data);
        setNameDraft(res.data.name);
        setDescDraft(res.data.description ?? "");
        setLocalTags(res.data.tags);
        // Best-effort view tracking — fire-and-forget.
        trackAttachmentView(res.data.id).catch(() => {});
        // Resolve inline URL for previewable types.
        if (
          res.data.file_type === "image" ||
          res.data.file_type === "pdf" ||
          res.data.file_type === "audio"
        ) {
          getInlineUrl(res.data.id).then((u) => {
            if (cancelled) return;
            if (u.success && u.data?.url) setInlineUrl(u.data.url);
          });
        }
      } else {
        setError(res.success ? "File not found." : res.error);
      }
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [fileId]);

  // Refresh org tag catalog when the picker opens — keeps freshly created
  // tags visible without a parent re-render.
  useEffect(() => {
    if (!tagPickerOpen) return;
    getLibraryTags().then((r) => {
      if (r.success && r.data) setOrgTags(r.data);
    });
  }, [tagPickerOpen]);

  function emitFileUpdate(patch: Partial<LibraryFile>) {
    if (!detail) return;
    const updated = { ...detail, ...patch };
    setDetail(updated);
    onFileUpdated(updated);
  }

  function saveName() {
    if (!detail) return;
    const next = nameDraft.trim();
    if (!next || next === detail.name) {
      setNameDraft(detail.name);
      setEditingName(false);
      return;
    }
    setEditingName(false);
    emitFileUpdate({ name: next });
    startTransition(async () => {
      const r = await renameAttachment(detail.id, next);
      if (!r.success) console.error("[detail] rename:", r.error);
    });
  }

  function saveDescription() {
    if (!detail) return;
    const next = descDraft.trim();
    if (next === (detail.description ?? "")) {
      setEditingDesc(false);
      return;
    }
    setEditingDesc(false);
    emitFileUpdate({ description: next || null });
    startTransition(async () => {
      const r = await updateAttachmentDescription(detail.id, next);
      if (!r.success) console.error("[detail] description:", r.error);
    });
  }

  function togglePin() {
    if (!detail) return;
    const next = !detail.is_pinned;
    emitFileUpdate({ is_pinned: next });
    startTransition(async () => {
      const r = next
        ? await pinAttachment(detail.id)
        : await unpinAttachment(detail.id);
      if (!r.success) console.error("[detail] pin:", r.error);
    });
  }

  async function handleDownload() {
    if (!detail) return;
    const r = await getDownloadUrl(detail.id);
    if (r.success && r.data) {
      window.open(r.data.url, "_blank", "noopener");
      trackAttachmentDownload(detail.id).catch(() => {});
      emitFileUpdate({ download_count: detail.download_count + 1 });
    }
  }

  async function handleCopyLink() {
    if (!detail) return;
    const r = await getDownloadUrl(detail.id);
    if (r.success && r.data) {
      try {
        await navigator.clipboard.writeText(r.data.url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch {
        // Fallback for browsers that block clipboard.
        window.prompt("Copy this link", r.data.url);
      }
    }
  }

  function handleDelete() {
    if (!detail) return;
    startTransition(async () => {
      const r = await deleteAttachment(detail.id);
      if (!r.success) {
        console.error("[detail] delete:", r.error);
        return;
      }
      onFileDeleted(detail.id);
      onClose();
    });
  }

  function toggleTag(tag: LibraryTag) {
    if (!detail) return;
    const has = localTags.some((t) => t.id === tag.id);
    const next = has
      ? localTags.filter((t) => t.id !== tag.id)
      : [...localTags, tag];
    setLocalTags(next);
    emitFileUpdate({ tags: next });
    startTransition(async () => {
      const r = has
        ? await removeTagFromAttachment(detail.id, tag.id)
        : await addTagToAttachment(detail.id, tag.id);
      if (!r.success) console.error("[detail] tag toggle:", r.error);
      onTagsChanged?.();
    });
  }

  const filteredCatalog = orgTags.filter((t) =>
    t.name.toLowerCase().includes(tagFilter.trim().toLowerCase()),
  );

  return (
    <AnimatePresence>
      {fileId && (
        <motion.div
          key="library-detail-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[120] bg-black/30"
          onClick={onClose}
        >
          <motion.aside
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
            className="absolute right-0 top-0 bottom-0 w-full sm:w-[640px] bg-white flex flex-col overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="px-5 py-3 border-b border-[#E5E7EB] flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={onClose}
                className="size-9 rounded-xl flex items-center justify-center text-[#6B7280] hover:text-[#2D333A] hover:bg-[#F4F5F7]"
                aria-label="Close"
              >
                <ArrowLeft className="size-4" />
              </button>
              <div className="flex-1 min-w-0">
                {detail && (
                  <p
                    className="text-[11px] text-[#9CA3AF] truncate"
                    style={{ fontFamily: "var(--font-source-sans)" }}
                  >
                    {fileCategoryLabel(detail.file_type)} · {formatBytes(detail.size_bytes)}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={onClose}
                className="size-9 rounded-xl flex items-center justify-center text-[#9CA3AF] hover:text-[#2D333A] hover:bg-[#F4F5F7]"
                aria-label="Close"
              >
                <X className="size-4" />
              </button>
            </header>

            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <p
                  className="p-8 text-center text-[#9CA3AF]"
                  style={{ fontFamily: "var(--font-source-sans)" }}
                >
                  Loading…
                </p>
              ) : error ? (
                <p
                  className="m-5 p-4 rounded-xl bg-red-50 text-red-600 text-[13px]"
                  style={{ fontFamily: "var(--font-source-sans)" }}
                >
                  {error}
                </p>
              ) : detail ? (
                <div className="px-5 py-5 space-y-5">
                  {/* Name + type */}
                  <div>
                    {editingName ? (
                      <input
                        autoFocus
                        value={nameDraft}
                        onChange={(e) => setNameDraft(e.target.value)}
                        onBlur={saveName}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                          else if (e.key === "Escape") {
                            setNameDraft(detail.name);
                            setEditingName(false);
                          }
                        }}
                        className="w-full text-2xl text-[#0F172A] bg-white border border-[#5CE1A5] rounded-xl px-3 py-2 outline-none"
                        style={{ fontFamily: "var(--font-poppins)", fontWeight: 700 }}
                      />
                    ) : (
                      <h2
                        onClick={() => setEditingName(true)}
                        className="text-2xl text-[#0F172A] leading-tight cursor-text hover:bg-[#F8FAFC] rounded-xl -mx-2 px-2 py-1 transition-colors break-all"
                        style={{ fontFamily: "var(--font-poppins)", fontWeight: 700 }}
                      >
                        {detail.name}
                      </h2>
                    )}
                    <Pill category={detail.file_type} />
                  </div>

                  {/* Preview */}
                  <Preview
                    detail={detail}
                    inlineUrl={inlineUrl}
                    onOpenLightbox={() => setLightboxOpen(true)}
                    onDownload={handleDownload}
                  />

                  {/* Metadata */}
                  <Section title="Details">
                    <dl className="grid grid-cols-2 gap-3">
                      <Meta label="Uploaded by" value={detail.uploader?.full_name || "Unknown"} />
                      <Meta label="When" value={formatDate(detail.uploaded_at)} />
                      <Meta
                        label="Views"
                        value={
                          <span className="inline-flex items-center gap-1 tabular-nums">
                            <Eye className="size-3" />
                            {detail.view_count}
                          </span>
                        }
                      />
                      <Meta
                        label="Downloads"
                        value={
                          <span className="inline-flex items-center gap-1 tabular-nums">
                            <Download className="size-3" />
                            {detail.download_count}
                          </span>
                        }
                      />
                    </dl>
                  </Section>

                  {/* Tags */}
                  <Section title="Tags">
                    <div className="relative">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {localTags.map((t) => (
                          <button
                            type="button"
                            key={t.id}
                            onClick={() => toggleTag(t)}
                            className="h-6 px-2 rounded-md text-[11px] font-semibold inline-flex items-center gap-1 hover:opacity-80 transition-opacity"
                            style={{
                              backgroundColor: t.color,
                              color: "white",
                              fontFamily: "var(--font-poppins)",
                            }}
                            title="Remove tag"
                          >
                            {t.name}
                            <X className="size-2.5" />
                          </button>
                        ))}
                        <button
                          type="button"
                          onClick={() => setTagPickerOpen((v) => !v)}
                          className="h-6 px-2 rounded-md text-[11px] text-[#6B7280] bg-[#F4F5F7] hover:bg-[#E5E7EB] inline-flex items-center gap-1"
                          style={{ fontFamily: "var(--font-poppins)", fontWeight: 600 }}
                        >
                          <Plus className="size-3" />
                          {localTags.length === 0 ? "Add tag" : "Edit"}
                        </button>
                      </div>
                      {tagPickerOpen && (
                        <>
                          <button
                            type="button"
                            aria-hidden="true"
                            className="fixed inset-0 z-30 cursor-default"
                            onClick={() => setTagPickerOpen(false)}
                          />
                          <div className="absolute left-0 top-full mt-2 z-40 w-64 bg-white border border-[#E5E7EB] rounded-xl shadow-xl overflow-hidden">
                            <input
                              autoFocus
                              value={tagFilter}
                              onChange={(e) => setTagFilter(e.target.value)}
                              placeholder="Find tags…"
                              className="w-full h-9 px-3 border-b border-[#F1F5F9] text-[13px] outline-none"
                              style={{ fontFamily: "var(--font-source-sans)" }}
                            />
                            <div className="max-h-56 overflow-auto py-1">
                              {filteredCatalog.length === 0 ? (
                                <p
                                  className="px-3 py-2 text-[12px] text-[#9CA3AF]"
                                  style={{ fontFamily: "var(--font-source-sans)" }}
                                >
                                  No tags match.
                                </p>
                              ) : (
                                filteredCatalog.map((t) => {
                                  const has = localTags.some(
                                    (x) => x.id === t.id,
                                  );
                                  return (
                                    <button
                                      key={t.id}
                                      type="button"
                                      onClick={() => toggleTag(t)}
                                      className="w-full flex items-center gap-2 px-3 py-1.5 text-left hover:bg-[#F4F5F7]"
                                    >
                                      <span
                                        className="h-5 px-1.5 rounded text-[10px] font-semibold inline-flex items-center"
                                        style={{
                                          backgroundColor: t.color,
                                          color: "white",
                                          fontFamily: "var(--font-poppins)",
                                        }}
                                      >
                                        {t.name}
                                      </span>
                                      {has && (
                                        <Check className="size-3.5 text-[#5CE1A5] ml-auto" />
                                      )}
                                    </button>
                                  );
                                })
                              )}
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  </Section>

                  {/* Where it lives */}
                  <Section title="Where this file is used">
                    <ParentLink detail={detail} />
                    {detail.folder && (
                      <p
                        className="text-[12px] text-[#6B7280] mt-1.5"
                        style={{ fontFamily: "var(--font-source-sans)" }}
                      >
                        Also in folder:{" "}
                        <span
                          className="inline-flex items-center gap-1"
                          style={{ color: detail.folder.color }}
                        >
                          <Tag className="size-3" />
                          {detail.folder.name}
                        </span>
                      </p>
                    )}
                  </Section>

                  {/* Description */}
                  <Section title="Description">
                    {editingDesc ? (
                      <div className="space-y-2">
                        <textarea
                          value={descDraft}
                          autoFocus
                          onChange={(e) => setDescDraft(e.target.value)}
                          rows={4}
                          className="w-full px-3 py-2 rounded-lg border border-[#E5E7EB] text-[13px] outline-none focus:border-[#5CE1A5] resize-none"
                          style={{ fontFamily: "var(--font-source-sans)" }}
                        />
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={saveDescription}
                            className="h-7 px-3 rounded-lg bg-[#5CE1A5] text-white text-[12px] font-semibold"
                            style={{ fontFamily: "var(--font-poppins)" }}
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setDescDraft(detail.description ?? "");
                              setEditingDesc(false);
                            }}
                            className="h-7 px-3 rounded-lg text-[12px] text-[#6B7280] hover:bg-[#F4F5F7]"
                            style={{ fontFamily: "var(--font-poppins)" }}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setEditingDesc(true)}
                        className={`w-full text-left text-[13px] leading-relaxed rounded-lg -mx-2 px-2 py-1 hover:bg-[#F8FAFC] transition-colors ${
                          detail.description ? "text-[#2D333A]" : "text-[#9CA3AF]"
                        }`}
                        style={{ fontFamily: "var(--font-source-sans)" }}
                      >
                        {detail.description || "Add a description…"}
                      </button>
                    )}
                  </Section>
                </div>
              ) : null}
            </div>

            {/* Sticky action bar */}
            {detail && (
              <footer className="px-5 py-3 border-t border-[#E5E7EB] bg-white flex items-center gap-2 shrink-0 overflow-x-auto">
                <Action onClick={handleDownload} icon={<Download className="size-3.5" />}>
                  Download
                </Action>
                <Action onClick={handleCopyLink} icon={<Copy className="size-3.5" />}>
                  {copied ? "Copied!" : "Copy link"}
                </Action>
                <Action
                  onClick={() => onMoveRequested(detail)}
                  icon={<FolderInput className="size-3.5" />}
                >
                  Move to…
                </Action>
                <Action
                  onClick={togglePin}
                  icon={
                    <Bookmark
                      className="size-3.5"
                      fill={detail.is_pinned ? "currentColor" : "none"}
                    />
                  }
                >
                  {detail.is_pinned ? "Unpin" : "Pin"}
                </Action>
                <div className="ml-auto">
                  {confirmDelete ? (
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={handleDelete}
                        disabled={pending}
                        className="h-8 px-3 rounded-lg bg-[#EF4444] text-white text-[12px] font-semibold hover:bg-[#DC2626] disabled:opacity-50"
                        style={{ fontFamily: "var(--font-poppins)" }}
                      >
                        {pending ? "Deleting…" : "Confirm"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDelete(false)}
                        className="h-8 px-3 rounded-lg text-[12px] text-[#6B7280] hover:bg-[#F4F5F7]"
                        style={{ fontFamily: "var(--font-poppins)" }}
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(true)}
                      className="h-8 px-3 rounded-lg text-[12px] text-[#EF4444] hover:bg-[#FEF2F2] inline-flex items-center gap-1.5"
                      style={{ fontFamily: "var(--font-poppins)", fontWeight: 600 }}
                    >
                      <Trash2 className="size-3.5" />
                      Delete
                    </button>
                  )}
                </div>
              </footer>
            )}
          </motion.aside>
          {/* Lightbox sits on top of the panel for image previews */}
          {detail && lightboxOpen && (
            <LightboxModal
              images={[
                {
                  id: detail.id,
                  organization_id: detail.organization_id,
                  entity_type: detail.entity_type,
                  entity_id: detail.entity_id ?? "",
                  name: detail.name,
                  description: detail.description,
                  file_type: detail.file_type,
                  file_extension: detail.file_extension,
                  size_bytes: detail.size_bytes,
                  storage_path: detail.storage_path,
                  thumbnail_path: detail.thumbnail_path,
                  mime_type: detail.mime_type,
                  uploaded_by: detail.uploaded_by,
                  uploaded_at: detail.uploaded_at,
                  uploader: detail.uploader,
                },
              ]}
              initialIndex={0}
              onClose={() => setLightboxOpen(false)}
            />
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ─── Building blocks ───────────────────────────────────────

function Pill({ category }: { category: LibraryFile["file_type"] }) {
  const { color, bg } = fileIconFor(category);
  return (
    <span
      className="inline-flex h-5 px-2 rounded-md text-[10px] uppercase tracking-wider mt-1.5"
      style={{
        backgroundColor: bg,
        color,
        fontFamily: "var(--font-poppins)",
        fontWeight: 600,
      }}
    >
      {fileCategoryLabel(category)}
    </span>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h3
        className="text-[11px] uppercase tracking-wider text-[#9CA3AF] mb-2"
        style={{ fontFamily: "var(--font-poppins)", fontWeight: 600 }}
      >
        {title}
      </h3>
      {children}
    </section>
  );
}

function Meta({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="bg-[#F4F5F7] rounded-xl px-3 py-2">
      <dt
        className="text-[10px] uppercase tracking-wider text-[#9CA3AF]"
        style={{ fontFamily: "var(--font-poppins)", fontWeight: 600 }}
      >
        {label}
      </dt>
      <dd
        className="text-[13px] text-[#2D333A] mt-0.5"
        style={{ fontFamily: "var(--font-source-sans)", fontWeight: 600 }}
      >
        {value}
      </dd>
    </div>
  );
}

function Preview({
  detail,
  inlineUrl,
  onOpenLightbox,
  onDownload,
}: {
  detail: LibraryFileDetail;
  inlineUrl: string | null;
  onOpenLightbox: () => void;
  onDownload: () => void;
}) {
  const { Icon, color, bg } = fileIconFor(detail.file_type);
  if (detail.file_type === "image" && inlineUrl) {
    return (
      <button
        type="button"
        onClick={onOpenLightbox}
        className="block w-full rounded-2xl overflow-hidden bg-[#F4F5F7] aspect-video group relative"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={inlineUrl}
          alt={detail.name}
          className="w-full h-full object-contain"
        />
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
          <span
            className="opacity-0 group-hover:opacity-100 text-white text-[12px] bg-black/60 rounded-md px-2 py-1 transition-opacity"
            style={{ fontFamily: "var(--font-poppins)", fontWeight: 600 }}
          >
            Click to enlarge
          </span>
        </div>
      </button>
    );
  }
  if (detail.file_type === "pdf" && inlineUrl) {
    return (
      <div className="w-full rounded-2xl overflow-hidden border border-[#E5E7EB] bg-[#F4F5F7]">
        <iframe
          src={inlineUrl}
          title={detail.name}
          className="w-full h-[420px]"
        />
      </div>
    );
  }
  if (detail.file_type === "audio" && inlineUrl) {
    return (
      <div className="w-full rounded-2xl bg-[#F4F5F7] p-4">
        <audio controls src={inlineUrl} className="w-full" />
      </div>
    );
  }
  return (
    <div
      className="w-full rounded-2xl flex flex-col items-center justify-center py-10 gap-3"
      style={{ backgroundColor: bg }}
    >
      <Icon className="size-16" style={{ color }} />
      <button
        type="button"
        onClick={onDownload}
        className="h-9 px-4 rounded-xl bg-[#5CE1A5] text-white text-[13px] font-semibold inline-flex items-center gap-2 hover:bg-[#4DD395] transition-colors"
        style={{ fontFamily: "var(--font-poppins)" }}
      >
        <Download className="size-3.5" />
        Open / Download
      </button>
    </div>
  );
}

function ParentLink({ detail }: { detail: LibraryFileDetail }) {
  const { parent } = detail;
  if (parent.kind === "library") {
    return (
      <p
        className="text-[13px] text-[#6B7280]"
        style={{ fontFamily: "var(--font-source-sans)" }}
      >
        Uploaded directly to the Library
        {parent.folder ? ` · in ${parent.folder.name}` : ""}.
      </p>
    );
  }
  const labelByKind: Record<typeof parent.kind, string> = {
    task: "View in Tasks",
    announcement: "View in Announcements",
    event: "View on Calendar",
    board_card: "View on Project Board",
  };
  return (
    <a
      href={parent.kind === "board_card" ? parent.href : parent.href}
      className="inline-flex items-center gap-1.5 text-[13px] text-[#5CE1A5] hover:text-[#059669] font-semibold"
      style={{ fontFamily: "var(--font-poppins)" }}
    >
      <ExternalLink className="size-3.5" />
      {labelByKind[parent.kind]} —{" "}
      <span className="text-[#2D333A] font-normal" style={{ fontFamily: "var(--font-source-sans)" }}>
        {parent.kind === "board_card"
          ? `${parent.title} · ${parent.board_name}`
          : parent.title}
      </span>
    </a>
  );
}

function Action({
  onClick,
  icon,
  children,
}: {
  onClick: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="h-8 px-3 rounded-lg text-[12px] text-[#2D333A] hover:bg-[#F4F5F7] inline-flex items-center gap-1.5 shrink-0 transition-colors"
      style={{ fontFamily: "var(--font-poppins)", fontWeight: 600 }}
    >
      {icon}
      {children}
    </button>
  );
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}
