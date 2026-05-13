"use client";

import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  ChevronRight,
  Filter,
  FolderPlus,
  Grid3x3,
  Library as LibraryIcon,
  List,
  Search,
  Upload,
  X,
} from "lucide-react";
import type {
  LibraryFilter,
  LibraryFolder,
  LibraryTag,
} from "@/app/actions/attachments";
import type { FileCategory } from "@/lib/file-utils";
import { fileCategoryLabel } from "./file-icon-helper";

type SortMode =
  | "date_newest"
  | "date_oldest"
  | "name_asc"
  | "name_desc"
  | "size_largest"
  | "size_smallest";

interface LibraryTopbarProps {
  filter: LibraryFilter;
  folderId: string | null | undefined;
  folders: LibraryFolder[];
  search: string;
  setSearch: (v: string) => void;
  sortBy: SortMode;
  setSortBy: (v: SortMode) => void;
  viewMode: "grid" | "list";
  setViewMode: (v: "grid" | "list") => void;
  fileTypeFilters: FileCategory[];
  setFileTypeFilters: (v: FileCategory[]) => void;
  uploaderFilter: string | null;
  setUploaderFilter: (v: string | null) => void;
  tagFilters: LibraryTag[];
  onClearTagFilter: (tagId: string) => void;
  onResetFilters: () => void;
  orgProfiles: { id: string; full_name: string }[];
  canUpload: boolean;
  onUpload: () => void;
  onCreateFolder: () => void;
}

const SORT_OPTIONS: { value: SortMode; label: string }[] = [
  { value: "date_newest", label: "Date — newest" },
  { value: "date_oldest", label: "Date — oldest" },
  { value: "name_asc", label: "Name A → Z" },
  { value: "name_desc", label: "Name Z → A" },
  { value: "size_largest", label: "Size — largest" },
  { value: "size_smallest", label: "Size — smallest" },
];

const FILE_TYPE_CHOICES: FileCategory[] = [
  "pdf",
  "image",
  "audio",
  "office_word",
  "office_excel",
  "office_ppt",
  "text",
  "other",
];

const FILTER_LABELS: Record<LibraryFilter, string> = {
  all: "All Files",
  recent: "Recently Uploaded",
  pinned: "Pinned",
  from_tasks: "From Tasks",
  from_announcements: "From Announcements",
  from_events: "From Events",
  from_boards: "From Projects",
};

export function LibraryTopbar({
  filter,
  folderId,
  folders,
  search,
  setSearch,
  sortBy,
  setSortBy,
  viewMode,
  setViewMode,
  fileTypeFilters,
  setFileTypeFilters,
  uploaderFilter,
  setUploaderFilter,
  tagFilters,
  onClearTagFilter,
  onResetFilters,
  orgProfiles,
  canUpload,
  onUpload,
  onCreateFolder,
}: LibraryTopbarProps) {
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);

  // Build the breadcrumb chain for the current location.
  const breadcrumb = useMemo(() => {
    if (folderId === undefined) {
      // Virtual filter — no breadcrumb path needed.
      return [{ id: null, name: FILTER_LABELS[filter], leaf: true }];
    }
    if (folderId === null) {
      return [{ id: null, name: "Library Root", leaf: true }];
    }
    const byId = new Map(folders.map((f) => [f.id, f]));
    const chain: { id: string | null; name: string; leaf: boolean }[] = [];
    let cursor: string | null = folderId;
    const seen = new Set<string>();
    while (cursor) {
      if (seen.has(cursor)) break;
      seen.add(cursor);
      const f = byId.get(cursor);
      if (!f) break;
      chain.unshift({
        id: f.id,
        name: f.name,
        leaf: chain.length === 0,
      });
      cursor = f.parent_folder_id ?? null;
    }
    return [{ id: null, name: "Library", leaf: false }, ...chain];
  }, [filter, folderId, folders]);

  const activeFilterCount =
    fileTypeFilters.length +
    (uploaderFilter ? 1 : 0) +
    tagFilters.length;

  return (
    <header
      className="border-b border-[#E5E7EB] bg-white"
      style={{ minHeight: "auto" }}
    >
      {/* Row 1 — breadcrumb + actions */}
      <div className="px-5 py-3 flex items-center gap-2 flex-wrap">
        <nav className="flex items-center gap-1 min-w-0 flex-1">
          {breadcrumb.map((crumb, i) => (
            <span key={`${crumb.id}-${i}`} className="flex items-center gap-1 min-w-0">
              {i > 0 && (
                <ChevronRight className="size-3 text-[#CBD5E1] shrink-0" />
              )}
              {crumb.leaf ? (
                <span
                  className="inline-flex items-center gap-1.5 text-[15px] text-[#0F172A] truncate"
                  style={{
                    fontFamily: "var(--font-poppins)",
                    fontWeight: 600,
                  }}
                >
                  {i === 0 && folderId !== undefined && (
                    <LibraryIcon className="size-4 text-[#5CE1A5]" />
                  )}
                  {crumb.name}
                </span>
              ) : (
                <span
                  className="text-[13px] text-[#6B7280] truncate"
                  style={{ fontFamily: "var(--font-source-sans)" }}
                >
                  {crumb.name}
                </span>
              )}
            </span>
          ))}
        </nav>

        <div className="flex items-center gap-2 shrink-0">
          {canUpload && (
            <>
              <button
                type="button"
                onClick={onCreateFolder}
                className="h-9 px-3 rounded-xl border border-[#E5E7EB] text-[#2D333A] text-[12.5px] font-semibold hover:bg-[#F4F5F7] inline-flex items-center gap-1.5"
                style={{ fontFamily: "var(--font-poppins)" }}
              >
                <FolderPlus className="size-3.5" />
                New folder
              </button>
              <button
                type="button"
                onClick={onUpload}
                className="h-9 px-3.5 rounded-xl bg-[#5CE1A5] text-white text-[12.5px] font-semibold hover:bg-[#4DD395] inline-flex items-center gap-1.5"
                style={{ fontFamily: "var(--font-poppins)" }}
              >
                <Upload className="size-3.5" />
                Upload
              </button>
            </>
          )}
        </div>
      </div>

      {/* Row 2 — search + filters + view toggle + sort */}
      <div className="px-5 pb-3 flex items-center gap-2 flex-wrap">
        <div className="flex-1 min-w-[200px] h-9 px-3 rounded-xl bg-[#F4F5F7] flex items-center gap-2">
          <Search className="size-3.5 text-[#9CA3AF]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search files in this view"
            className="flex-1 bg-transparent text-[13px] outline-none"
            style={{ fontFamily: "var(--font-source-sans)" }}
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="text-[#9CA3AF] hover:text-[#2D333A]"
              aria-label="Clear"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>

        {/* Filters dropdown */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setFiltersOpen((v) => !v)}
            className="h-9 px-3 rounded-xl border border-[#E5E7EB] text-[#2D333A] text-[12.5px] font-semibold hover:bg-[#F4F5F7] inline-flex items-center gap-1.5"
            style={{ fontFamily: "var(--font-poppins)" }}
          >
            <Filter className="size-3.5" />
            Filters
            {activeFilterCount > 0 && (
              <span className="ml-1 h-4 min-w-4 px-1 rounded-full bg-[#5CE1A5] text-white text-[10px] tabular-nums inline-flex items-center justify-center">
                {activeFilterCount}
              </span>
            )}
          </button>
          {filtersOpen && (
            <>
              <button
                type="button"
                aria-hidden="true"
                className="fixed inset-0 z-30 cursor-default"
                onClick={() => setFiltersOpen(false)}
              />
              <motion.div
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                className="absolute right-0 top-full mt-2 w-80 bg-white border border-[#E5E7EB] rounded-xl shadow-xl z-40 overflow-hidden"
              >
                <div className="px-4 py-3 border-b border-[#F1F5F9]">
                  <p
                    className="text-[11px] uppercase tracking-wider text-[#9CA3AF] mb-2"
                    style={{
                      fontFamily: "var(--font-poppins)",
                      fontWeight: 600,
                    }}
                  >
                    File type
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {FILE_TYPE_CHOICES.map((c) => {
                      const active = fileTypeFilters.includes(c);
                      return (
                        <button
                          key={c}
                          type="button"
                          onClick={() => {
                            const next = active
                              ? fileTypeFilters.filter((x) => x !== c)
                              : [...fileTypeFilters, c];
                            setFileTypeFilters(next);
                          }}
                          className={`h-7 px-2.5 rounded-md text-[11.5px] font-semibold transition-colors ${
                            active
                              ? "bg-[#5CE1A5] text-white"
                              : "bg-[#F4F5F7] text-[#6B7280] hover:bg-[#E5E7EB]"
                          }`}
                          style={{ fontFamily: "var(--font-poppins)" }}
                        >
                          {fileCategoryLabel(c)}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="px-4 py-3 border-b border-[#F1F5F9]">
                  <p
                    className="text-[11px] uppercase tracking-wider text-[#9CA3AF] mb-2"
                    style={{
                      fontFamily: "var(--font-poppins)",
                      fontWeight: 600,
                    }}
                  >
                    Uploaded by
                  </p>
                  <select
                    value={uploaderFilter ?? ""}
                    onChange={(e) =>
                      setUploaderFilter(e.target.value || null)
                    }
                    className="w-full h-9 px-3 rounded-lg border border-[#E5E7EB] text-[13px] outline-none focus:border-[#5CE1A5]"
                    style={{ fontFamily: "var(--font-source-sans)" }}
                  >
                    <option value="">Anyone</option>
                    {orgProfiles.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.full_name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="px-4 py-3 flex items-center justify-between bg-[#F8FAFC]">
                  <button
                    type="button"
                    onClick={() => {
                      onResetFilters();
                      setFiltersOpen(false);
                    }}
                    className="text-[12px] text-[#6B7280] hover:text-[#2D333A]"
                    style={{
                      fontFamily: "var(--font-poppins)",
                      fontWeight: 600,
                    }}
                  >
                    Reset filters
                  </button>
                  <button
                    type="button"
                    onClick={() => setFiltersOpen(false)}
                    className="h-8 px-3 rounded-lg bg-[#5CE1A5] text-white text-[12px] font-semibold"
                    style={{ fontFamily: "var(--font-poppins)" }}
                  >
                    Done
                  </button>
                </div>
              </motion.div>
            </>
          )}
        </div>

        {/* Sort dropdown */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setSortOpen((v) => !v)}
            className="h-9 px-3 rounded-xl border border-[#E5E7EB] text-[#2D333A] text-[12.5px] font-semibold hover:bg-[#F4F5F7]"
            style={{ fontFamily: "var(--font-poppins)" }}
          >
            {SORT_OPTIONS.find((o) => o.value === sortBy)?.label ?? "Sort"}
          </button>
          {sortOpen && (
            <>
              <button
                type="button"
                aria-hidden="true"
                className="fixed inset-0 z-30 cursor-default"
                onClick={() => setSortOpen(false)}
              />
              <div className="absolute right-0 top-full mt-2 w-52 bg-white border border-[#E5E7EB] rounded-xl shadow-xl z-40 overflow-hidden">
                {SORT_OPTIONS.map((o) => (
                  <button
                    key={o.value}
                    type="button"
                    onClick={() => {
                      setSortBy(o.value);
                      setSortOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2 text-[13px] hover:bg-[#F4F5F7] ${
                      o.value === sortBy
                        ? "text-[#059669] font-semibold"
                        : "text-[#2D333A]"
                    }`}
                    style={{ fontFamily: "var(--font-source-sans)" }}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* View toggle */}
        <div className="h-9 inline-flex items-center rounded-xl bg-[#F4F5F7] p-0.5">
          <ViewBtn
            active={viewMode === "grid"}
            onClick={() => setViewMode("grid")}
            label="Grid"
          >
            <Grid3x3 className="size-3.5" />
          </ViewBtn>
          <ViewBtn
            active={viewMode === "list"}
            onClick={() => setViewMode("list")}
            label="List"
          >
            <List className="size-3.5" />
          </ViewBtn>
        </div>
      </div>

      {/* Active tag filter chips */}
      <AnimatePresence>
        {tagFilters.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="px-5 pb-3 flex items-center gap-1.5 flex-wrap"
          >
            <span
              className="text-[11px] uppercase tracking-wider text-[#9CA3AF]"
              style={{ fontFamily: "var(--font-poppins)", fontWeight: 600 }}
            >
              Tags:
            </span>
            {tagFilters.map((t) => (
              <button
                type="button"
                key={t.id}
                onClick={() => onClearTagFilter(t.id)}
                className="h-6 px-2 rounded-md text-[11px] font-semibold inline-flex items-center gap-1"
                style={{
                  backgroundColor: t.color,
                  color: "white",
                  fontFamily: "var(--font-poppins)",
                }}
              >
                {t.name}
                <X className="size-2.5" />
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}

function ViewBtn({
  active,
  onClick,
  label,
  children,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-8 px-2.5 rounded-lg text-[12px] font-semibold inline-flex items-center gap-1.5 transition-colors ${
        active ? "bg-white text-[#2D333A] shadow-sm" : "text-[#6B7280] hover:text-[#2D333A]"
      }`}
      aria-label={label}
      style={{ fontFamily: "var(--font-poppins)" }}
    >
      {children}
    </button>
  );
}
