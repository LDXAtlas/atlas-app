"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Bookmark,
  Download,
  Edit2,
  FolderInput,
  Loader2,
  Tag,
  Trash2,
  Upload, // Added Upload icon
} from "lucide-react";
import {
  addTagToAttachment,
  deleteAttachment,
  getFolderTree,
  getLibraryFiles,
  getLibraryTags,
  getOrganizationStorageUsage,
  moveAttachmentToFolder,
  pinAttachment,
  trackAttachmentDownload,
  uploadToLibrary,
  unpinAttachment,
  getDownloadUrl,
  type LibraryFile,
  type LibraryFilter,
  type LibraryFolder,
  type LibraryFolderWithCount,
  type LibraryTag,
  type LibraryTagWithUsage,
} from "@/app/actions/attachments";
import {
  ALLOWED_MIME_TYPES,
  MAX_FILE_BYTES,
  formatBytes,
  type FileCategory,
} from "@/lib/file-utils";
import { LibraryTopbar } from "./library-topbar";
import { FileGrid } from "./file-grid";
import { FileList } from "./file-list";
import { FileDetailPanel } from "./file-detail-panel";
import { CreateFolderModal } from "./create-folder-modal";
import { FolderPickerModal } from "./folder-picker-modal";
import { BulkActionsToolbar } from "./bulk-actions-toolbar";
import {
  EmptyFolderState,
  LibraryEmptyState,
  NoSearchResultsState,
} from "./empty-states";

interface LibraryViewProps {
  orgName: string;
  viewerRole: "admin" | "staff" | "leader" | "volunteer" | "member";
  initialFolders: LibraryFolderWithCount[];
  initialTags: LibraryTagWithUsage[];
  departments: { id: string; name: string; color: string }[];
  orgProfiles: { id: string; full_name: string }[];
}

type SortMode =
  | "date_newest" | "date_oldest"
  | "name_asc" | "name_desc"
  | "size_largest" | "size_smallest"
  | "type_asc" | "type_desc"
  | "uploader_asc" | "uploader_desc"
  | "tags_asc" | "tags_desc";

type UploadJob =
  | { id: string; name: string; status: "uploading" }
  | { id: string; name: string; status: "success" }
  | { id: string; name: string; status: "error"; error: string };

export function LibraryView({
  orgName,
  viewerRole,
  initialFolders,
  initialTags,
  departments,
  orgProfiles,
}: LibraryViewProps) {
  const canUpload = ["admin", "staff", "leader"].includes(viewerRole);

  const [folders, setFolders] = useState<LibraryFolderWithCount[]>(initialFolders);
  const [tags, setTags] = useState<LibraryTagWithUsage[]>(initialTags);
  const [files, setFiles] = useState<LibraryFile[]>([]);
  const [filesLoading, setFilesLoading] = useState(true);

  const [filter, setFilter] = useState<LibraryFilter>("all");
  const [folderId, setFolderId] = useState<string | null | undefined>(undefined);

  const [search, setSearch] = useState("");
  const [searchDebounced, setSearchDebounced] = useState("");
  const [sortBy, setSortBy] = useState<SortMode>("date_newest");
  const [viewMode, setViewMode] = useState<"grid" | "list">("list");
  const [fileTypeFilters, setFileTypeFilters] = useState<FileCategory[]>([]);
  const [uploaderFilter, setUploaderFilter] = useState<string | null>(null);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);

  const [selectedFileIds, setSelectedFileIds] = useState<Set<string>>(new Set());
  const selectMode = selectedFileIds.size > 0;

  const [detailFileId, setDetailFileId] = useState<string | null>(null);
  const [createFolderOpen, setCreateFolderOpen] = useState(false);
  const [editingFolder, setEditingFolder] = useState<LibraryFolder | null>(null);
  const [moveModal, setMoveModal] = useState<{
    files: string[];
  } | null>(null);
  const [bulkTagOpen, setBulkTagOpen] = useState(false);

  const [storage, setStorage] = useState<{
    used_bytes: number;
    limit_bytes: number;
    percentage_used: number;
    formatted: { used: string; limit: string };
  } | null>(null);

  const [uploads, setUploads] = useState<UploadJob[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [contextMenu, setContextMenu] = useState<{
    fileId: string;
    x: number;
    y: number;
  } | null>(null);

  // --- Drag and Drop State ---
  const [isDragging, setIsDragging] = useState(false);
  const dragCounter = useRef(0);

  useEffect(() => {
    const t = setTimeout(() => setSearchDebounced(search.trim()), 250);
    return () => clearTimeout(t);
  }, [search]);

  const refreshStorage = useCallback(() => {
    getOrganizationStorageUsage().then((r) => {
      if (r.success && r.data) setStorage(r.data);
    });
  }, []);
  useEffect(() => {
    refreshStorage();
  }, [refreshStorage]);

  const refreshFolders = useCallback(async () => {
    const r = await getFolderTree();
    if (r.success && r.data) setFolders(r.data);
  }, []);
  const refreshTags = useCallback(async () => {
    const r = await getLibraryTags();
    if (r.success && r.data) setTags(r.data);
  }, []);

  const reloadFiles = useCallback(() => {
    let cancelled = false;
    setFilesLoading(true);
    getLibraryFiles({
      folderId: folderId === undefined ? undefined : folderId,
      filter: folderId === undefined ? filter : undefined,
      tagIds: selectedTagIds.length > 0 ? selectedTagIds : undefined,
      fileTypes: fileTypeFilters.length > 0 ? fileTypeFilters : undefined,
      search: searchDebounced || undefined,
      uploadedBy: uploaderFilter || undefined,
      sortBy: sortBy as any, // Fixed TypeScript error
      limit: 120,
    }).then((res) => {
      if (cancelled) return;
      if (res.success && res.data) setFiles(res.data.files);
      setFilesLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [
    folderId,
    filter,
    selectedTagIds,
    fileTypeFilters,
    searchDebounced,
    uploaderFilter,
    sortBy,
  ]);
  useEffect(() => {
    const cancel = reloadFiles();
    return cancel;
  }, [reloadFiles]);

  // ─── File ops ──────────────────────────────────────────

  function patchFile(id: string, patch: Partial<LibraryFile>) {
    setFiles((prev) => prev.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  }

  function removeFile(id: string) {
    setFiles((prev) => prev.filter((f) => f.id !== id));
    setSelectedFileIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }

  function handleFileUpdated(file: LibraryFile) {
    patchFile(file.id, file);
  }

  function handleFileDeleted(id: string) {
    removeFile(id);
  }

  function handleToggleSelect(fileId: string, next: boolean) {
    setSelectedFileIds((prev) => {
      const out = new Set(prev);
      if (next) out.add(fileId);
      else out.delete(fileId);
      return out;
    });
  }

  function handleOpenFile(file: LibraryFile) {
    setDetailFileId(file.id);
  }

  function handleOpenMenu(file: LibraryFile, e: React.MouseEvent) {
    setContextMenu({ fileId: file.id, x: e.clientX, y: e.clientY });
  }

  function clearSelection() {
    setSelectedFileIds(new Set());
  }
  function selectedFileList(): LibraryFile[] {
    return files.filter((f) => selectedFileIds.has(f.id));
  }

  async function bulkPin() {
    const list = selectedFileList();
    const allPinned = list.every((f) => f.is_pinned);
    await Promise.all(
      list.map((f) =>
        allPinned ? unpinAttachment(f.id) : pinAttachment(f.id),
      ),
    );
    setFiles((prev) =>
      prev.map((f) =>
        selectedFileIds.has(f.id) ? { ...f, is_pinned: !allPinned } : f,
      ),
    );
    clearSelection();
  }

  async function bulkDelete() {
    const list = selectedFileList();
    if (!window.confirm(`Delete ${list.length} file(s)? This can't be undone.`))
      return;
    await Promise.all(list.map((f) => deleteAttachment(f.id)));
    setFiles((prev) => prev.filter((f) => !selectedFileIds.has(f.id)));
    clearSelection();
    refreshStorage();
  }

  async function bulkApplyTag(tagId: string) {
    const list = selectedFileList();
    await Promise.all(list.map((f) => addTagToAttachment(f.id, tagId)));
    setBulkTagOpen(false);
    clearSelection();
    refreshTags();
    reloadFiles();
  }

  // ─── Upload flow ──────────────────────────────────────

  function triggerFilePicker() {
    fileInputRef.current?.click();
  }

  async function handleFilesPicked(picked: FileList | null) {
    if (!picked || picked.length === 0) return;
    const targetFolderId =
      folderId !== undefined && typeof folderId === "string" ? folderId : null;

    for (const file of Array.from(picked)) {
      const jobId = crypto.randomUUID();
      if (file.size > MAX_FILE_BYTES) {
        setUploads((u) => [
          ...u,
          {
            id: jobId,
            name: file.name,
            status: "error",
            error: `Too large (max ${formatBytes(MAX_FILE_BYTES)})`,
          },
        ]);
        continue;
      }
      if (!ALLOWED_MIME_TYPES.has(file.type)) {
        setUploads((u) => [
          ...u,
          {
            id: jobId,
            name: file.name,
            status: "error",
            error: "Unsupported file type",
          },
        ]);
        continue;
      }
      setUploads((u) => [
        ...u,
        { id: jobId, name: file.name, status: "uploading" },
      ]);
      const fd = new FormData();
      fd.append("file", file);
      if (targetFolderId) fd.append("folder_id", targetFolderId);
      const res = await uploadToLibrary(fd);
      if (res.success) {
        setUploads((u) =>
          u.map((j) =>
            j.id === jobId ? { ...j, status: "success" as const } : j,
          ),
        );
        if (res.data) setFiles((prev) => [res.data!, ...prev]);
        refreshStorage();
      } else {
        const message = res.error;
        setUploads((u) =>
          u.map((j) =>
            j.id === jobId
              ? { ...j, status: "error" as const, error: message }
              : j,
          ),
        );
      }
      setTimeout(() => {
        setUploads((u) => u.filter((j) => j.id !== jobId));
      }, 5000);
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  // ─── Drag and Drop Handlers ───────────────────────────

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current += 1;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current -= 1;
    if (dragCounter.current === 0) {
      setIsDragging(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    dragCounter.current = 0;
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFilesPicked(e.dataTransfer.files);
    }
  };

  // ─── Render ───────────────────────────────────────────

  const visibleEmptyState = useMemo(() => {
    if (filesLoading) return null;
    if (files.length > 0) return null;
    const hasFilters =
      searchDebounced ||
      fileTypeFilters.length > 0 ||
      uploaderFilter ||
      selectedTagIds.length > 0;
    if (hasFilters)
      return (
        <NoSearchResultsState
          onReset={() => {
            setSearch("");
            setFileTypeFilters([]);
            setUploaderFilter(null);
            setSelectedTagIds([]);
          }}
        />
      );
    if (typeof folderId === "string")
      return (
        <EmptyFolderState onUpload={triggerFilePicker} canUpload={canUpload} />
      );
    return (
      <LibraryEmptyState onUpload={triggerFilePicker} canUpload={canUpload} />
    );
  }, [
    filesLoading,
    files.length,
    searchDebounced,
    fileTypeFilters.length,
    uploaderFilter,
    selectedTagIds.length,
    folderId,
    canUpload,
  ]);

  return (
    <div
      className="flex flex-col h-full overflow-hidden relative bg-transparent"
      onDragEnter={canUpload ? handleDragEnter : undefined}
      onDragLeave={canUpload ? handleDragLeave : undefined}
      onDragOver={canUpload ? handleDragOver : undefined}
      onDrop={canUpload ? handleDrop : undefined}
    >
      {/* Drag & Drop Full Screen Overlay */}
      <AnimatePresence>
        {isDragging && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-[300] bg-white/60 backdrop-blur-sm flex items-center justify-center p-8"
          >
            <div className="w-full h-full border-4 border-dashed border-[#5CE1A5] rounded-[32px] bg-[#5CE1A5]/5 flex flex-col items-center justify-center gap-4 pointer-events-none transition-all">
              <div className="size-20 rounded-full bg-white shadow-sm flex items-center justify-center">
                <Upload className="size-10 text-[#5CE1A5]" />
              </div>
              <h2 className="text-3xl font-bold text-[#0F172A]" style={{ fontFamily: "var(--font-poppins)" }}>
                Drop files to upload
              </h2>
              <p className="text-[#6B7280] text-[15px]" style={{ fontFamily: "var(--font-source-sans)" }}>
                {folderId ? "Adding to the selected folder" : "Adding to Library Root"}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <LibraryTopbar
        orgName={orgName}
        filter={filter}
        onSelectFilter={(f) => {
          setFilter(f);
          setFolderId(undefined);
          clearSelection();
        }}
        folderId={folderId}
        onSelectFolder={(id) => {
          setFolderId(id);
          clearSelection();
        }}
        folders={folders}
        tags={tags}
        selectedTagIds={selectedTagIds}
        onToggleTag={(id) =>
          setSelectedTagIds((prev) =>
            prev.includes(id)
              ? prev.filter((x) => x !== id)
              : [...prev, id],
          )
        }
        search={search}
        setSearch={setSearch}
        sortBy={sortBy}
        setSortBy={setSortBy}
        viewMode={viewMode}
        setViewMode={setViewMode}
        fileTypeFilters={fileTypeFilters}
        setFileTypeFilters={setFileTypeFilters}
        uploaderFilter={uploaderFilter}
        setUploaderFilter={setUploaderFilter}
        onResetFilters={() => {
          setFileTypeFilters([]);
          setUploaderFilter(null);
          setSelectedTagIds([]);
        }}
        orgProfiles={orgProfiles}
        canUpload={canUpload}
        onUpload={triggerFilePicker}
        onCreateFolder={() => {
          setEditingFolder(null);
          setCreateFolderOpen(true);
        }}
        storage={storage}
      />

      <main className="flex-1 overflow-y-auto px-8 pb-8 pt-2">
        <div className="w-full">
          {filesLoading ? (
            <div
              className="flex items-center justify-center py-16 text-[#9CA3AF] gap-2"
              style={{ fontFamily: "var(--font-source-sans)" }}
            >
              <Loader2 className="size-4 animate-spin" />
              Loading files…
            </div>
          ) : visibleEmptyState ? (
            visibleEmptyState
          ) : viewMode === "grid" ? (
            <FileGrid
              files={files}
              selectedIds={selectedFileIds}
              selectMode={selectMode}
              onOpenFile={handleOpenFile}
              onToggleSelect={handleToggleSelect}
              onOpenMenu={handleOpenMenu}
            />
          ) : (
            <FileList
              files={files}
              selectedIds={selectedFileIds}
              selectMode={selectMode}
              onOpenFile={handleOpenFile}
              onToggleSelect={handleToggleSelect}
              onOpenMenu={handleOpenMenu}
              sortBy={sortBy}
              setSortBy={setSortBy}
            />
          )}
        </div>
      </main>

      {/* Hidden file input for upload */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        accept={Array.from(ALLOWED_MIME_TYPES).join(",")}
        onChange={(e) => handleFilesPicked(e.target.files)}
      />

      {/* Detail panel */}
      <FileDetailPanel
        fileId={detailFileId}
        onClose={() => setDetailFileId(null)}
        onFileUpdated={handleFileUpdated}
        onFileDeleted={handleFileDeleted}
        onMoveRequested={(file) => setMoveModal({ files: [file.id] })}
        tagCatalog={tags}
        onTagsChanged={() => {
          refreshTags();
        }}
      />

      {/* Bulk actions */}
      <BulkActionsToolbar
        count={selectedFileIds.size}
        onClear={clearSelection}
        onMove={() => setMoveModal({ files: Array.from(selectedFileIds) })}
        onTag={() => setBulkTagOpen(true)}
        onPin={bulkPin}
        onDelete={bulkDelete}
      />

      {/* Bulk-tag popover */}
      <AnimatePresence>
        {bulkTagOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-end justify-center bg-black/30 pb-20"
            onClick={() => setBulkTagOpen(false)}
          >
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 20, opacity: 0 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-4 mx-4"
              onClick={(e) => e.stopPropagation()}
            >
              <p
                className="text-[13px] font-semibold text-[#2D333A] mb-3"
                style={{ fontFamily: "var(--font-poppins)" }}
              >
                Apply a tag to {selectedFileIds.size} file(s)
              </p>
              {tags.length === 0 ? (
                <p
                  className="text-[12px] text-[#9CA3AF]"
                  style={{ fontFamily: "var(--font-source-sans)" }}
                >
                  No tags yet. Create one from the sidebar.
                </p>
              ) : (
                <ul className="space-y-1 max-h-60 overflow-auto">
                  {tags.map((t) => (
                    <li key={t.id}>
                      <button
                        type="button"
                        onClick={() => bulkApplyTag(t.id)}
                        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-[#F4F5F7] text-left"
                      >
                        <span
                          className="h-5 px-2 rounded-md text-[11px] font-semibold inline-flex items-center"
                          style={{
                            backgroundColor: t.color,
                            color: "white",
                            fontFamily: "var(--font-poppins)",
                          }}
                        >
                          {t.name}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Folder modals */}
      <CreateFolderModal
        open={createFolderOpen}
        onClose={() => {
          setCreateFolderOpen(false);
          setEditingFolder(null);
        }}
        editing={editingFolder}
        parentFolderId={
          folderId !== undefined && typeof folderId === "string"
            ? folderId
            : null
        }
        departments={departments}
        onSaved={() => {
          refreshFolders();
        }}
      />

      {/* Move-to picker */}
      <FolderPickerModal
        open={!!moveModal}
        onClose={() => setMoveModal(null)}
        folders={folders}
        onPick={async (targetId) => {
          if (!moveModal) return;
          await Promise.all(
            moveModal.files.map((id) =>
              moveAttachmentToFolder(id, targetId),
            ),
          );
          // Apply optimistically.
          setFiles((prev) =>
            prev.map((f) =>
              moveModal.files.includes(f.id)
                ? { ...f, folder_id: targetId }
                : f,
            ),
          );
          refreshFolders();
          clearSelection();
        }}
        onCreateRequested={() => {
          setEditingFolder(null);
          setCreateFolderOpen(true);
        }}
      />

      {/* Per-file context menu (anchored absolute) */}
      <ContextMenu
        menu={contextMenu}
        files={files}
        onClose={() => setContextMenu(null)}
        onMove={(fileId) => setMoveModal({ files: [fileId] })}
        onPinToggle={async (fileId) => {
          const f = files.find((x) => x.id === fileId);
          if (!f) return;
          patchFile(fileId, { is_pinned: !f.is_pinned });
          const r = f.is_pinned
            ? await unpinAttachment(fileId)
            : await pinAttachment(fileId);
          if (!r.success) patchFile(fileId, { is_pinned: f.is_pinned });
        }}
        onDelete={async (fileId) => {
          if (!window.confirm("Delete this file? This can't be undone.")) return;
          const r = await deleteAttachment(fileId);
          if (r.success) {
            removeFile(fileId);
            refreshStorage();
          }
        }}
        onDownload={async (fileId) => {
          const r = await getDownloadUrl(fileId);
          if (r.success && r.data) {
            window.open(r.data.url, "_blank", "noopener");
            trackAttachmentDownload(fileId).catch(() => {});
          }
        }}
        onRename={(fileId) => setDetailFileId(fileId)}
      />

      {/* Upload toast list */}
      <UploadToasts uploads={uploads} />
    </div>
  );
}

// ─── Per-file context menu ──────────────────────────────

function ContextMenu({
  menu,
  files,
  onClose,
  onMove,
  onPinToggle,
  onDelete,
  onDownload,
  onRename,
}: {
  menu: { fileId: string; x: number; y: number } | null;
  files: LibraryFile[];
  onClose: () => void;
  onMove: (fileId: string) => void;
  onPinToggle: (fileId: string) => void;
  onDelete: (fileId: string) => void;
  onDownload: (fileId: string) => void;
  onRename: (fileId: string) => void;
}) {
  if (!menu) return null;
  const file = files.find((f) => f.id === menu.fileId);
  if (!file) return null;
  // Clamp the menu inside the viewport.
  const maxX = typeof window !== "undefined" ? window.innerWidth - 200 : menu.x;
  const maxY = typeof window !== "undefined" ? window.innerHeight - 220 : menu.y;
  const x = Math.min(menu.x, maxX);
  const y = Math.min(menu.y, maxY);
  return (
    <>
      <button
        type="button"
        aria-hidden="true"
        className="fixed inset-0 z-40 cursor-default"
        onClick={onClose}
      />
      <div
        className="fixed z-50 min-w-[180px] bg-white border border-[#E5E7EB] rounded-xl shadow-xl overflow-hidden"
        style={{ left: x, top: y }}
        onClick={(e) => e.stopPropagation()}
      >
        <CtxItem
          icon={<Download className="size-3.5" />}
          onClick={() => {
            onDownload(file.id);
            onClose();
          }}
        >
          Download
        </CtxItem>
        <CtxItem
          icon={<FolderInput className="size-3.5" />}
          onClick={() => {
            onMove(file.id);
            onClose();
          }}
        >
          Move to…
        </CtxItem>
        <CtxItem
          icon={
            <Bookmark
              className="size-3.5"
              fill={file.is_pinned ? "currentColor" : "none"}
            />
          }
          onClick={() => {
            onPinToggle(file.id);
            onClose();
          }}
        >
          {file.is_pinned ? "Unpin" : "Pin"}
        </CtxItem>
        <CtxItem
          icon={<Edit2 className="size-3.5" />}
          onClick={() => {
            onRename(file.id);
            onClose();
          }}
        >
          Rename
        </CtxItem>
        <CtxItem
          icon={<Tag className="size-3.5" />}
          onClick={() => {
            onRename(file.id);
            onClose();
          }}
        >
          Manage tags
        </CtxItem>
        <CtxItem
          icon={<Trash2 className="size-3.5" />}
          tone="danger"
          onClick={() => {
            onDelete(file.id);
            onClose();
          }}
        >
          Delete
        </CtxItem>
      </div>
    </>
  );
}

function CtxItem({
  icon,
  children,
  onClick,
  tone = "default",
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
  onClick: () => void;
  tone?: "default" | "danger";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full flex items-center gap-2 px-3 py-2 text-left text-[13px] hover:bg-[#F4F5F7] ${
        tone === "danger" ? "text-red-600 hover:bg-red-50" : "text-[#2D333A]"
      }`}
      style={{ fontFamily: "var(--font-source-sans)" }}
    >
      {icon}
      {children}
    </button>
  );
}

// ─── Upload toast list ───────────────────────────────────

function UploadToasts({ uploads }: { uploads: UploadJob[] }) {
  if (uploads.length === 0) return null;
  return (
    <div className="fixed bottom-4 right-4 z-[140] w-72 space-y-2">
      <AnimatePresence>
        {uploads.map((u) => (
          <motion.div
            key={u.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            className={`bg-white border rounded-xl shadow-lg px-3 py-2.5 flex items-center gap-2 ${
              u.status === "error"
                ? "border-red-200"
                : u.status === "success"
                  ? "border-[#5CE1A5]/40"
                  : "border-[#E5E7EB]"
            }`}
          >
            {u.status === "uploading" ? (
              <Loader2 className="size-4 animate-spin text-[#5CE1A5] shrink-0" />
            ) : u.status === "success" ? (
              <span className="size-4 rounded-full bg-[#5CE1A5] text-white text-[10px] flex items-center justify-center shrink-0">
                ✓
              </span>
            ) : (
              <span className="size-4 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center shrink-0">
                !
              </span>
            )}
            <div className="min-w-0 flex-1">
              <p
                className="text-[12.5px] text-[#2D333A] truncate"
                style={{
                  fontFamily: "var(--font-poppins)",
                  fontWeight: 600,
                }}
              >
                {u.name}
              </p>
              <p
                className={`text-[11px] truncate ${
                  u.status === "error" ? "text-red-600" : "text-[#6B7280]"
                }`}
                style={{ fontFamily: "var(--font-source-sans)" }}
              >
                {u.status === "uploading"
                  ? "Uploading…"
                  : u.status === "success"
                    ? "Uploaded"
                    : u.error}
              </p>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}