"use client";

import { motion, AnimatePresence } from "motion/react";
import { Bookmark, MoreHorizontal, ArrowDown, ArrowUp } from "lucide-react";
import { formatBytes } from "@/lib/file-utils";
import type { LibraryFile } from "@/app/actions/attachments";
import { fileCategoryLabel, fileIconFor } from "./file-icon-helper";

type SortMode =
  | "date_newest" | "date_oldest"
  | "name_asc" | "name_desc"
  | "size_largest" | "size_smallest"
  | "type_asc" | "type_desc"
  | "uploader_asc" | "uploader_desc"
  | "tags_asc" | "tags_desc";

interface FileListProps {
  files: LibraryFile[];
  selectedIds: Set<string>;
  selectMode: boolean;
  onOpenFile: (file: LibraryFile) => void;
  onToggleSelect: (fileId: string, next: boolean) => void;
  onOpenMenu: (file: LibraryFile, e: React.MouseEvent) => void;
  sortBy: SortMode;
  setSortBy: (v: SortMode) => void;
}

export function FileList({
  files,
  selectedIds,
  selectMode,
  onOpenFile,
  onToggleSelect,
  onOpenMenu,
  sortBy,
  setSortBy,
}: FileListProps) {
  
  // Helper to toggle between ascending and descending for a given column
  const handleSort = (ascMode: SortMode, descMode: SortMode) => {
    if (sortBy === ascMode) {
      setSortBy(descMode);
    } else {
      setSortBy(ascMode);
    }
  };

  return (
    <div className="bg-white border border-[#E5E7EB] rounded-2xl overflow-hidden shadow-sm">
      <table className="w-full">
        <thead>
          <tr className="border-b border-[#F1F5F9] bg-[#FAFBFC]">
            <Th className="w-8" />
            <Th
              sortable
              active={sortBy.startsWith("name")}
              direction={sortBy === "name_desc" ? "desc" : "asc"}
              onClick={() => handleSort("name_asc", "name_desc")}
            >
              Name
            </Th>
            <Th
              sortable
              active={sortBy.startsWith("type")}
              direction={sortBy === "type_desc" ? "desc" : "asc"}
              onClick={() => handleSort("type_asc", "type_desc")}
            >
              Type
            </Th>
            <Th
              align="right"
              sortable
              active={sortBy.startsWith("size")}
              direction={sortBy === "size_smallest" ? "asc" : "desc"} // Default to largest first
              onClick={() => handleSort("size_largest", "size_smallest")}
            >
              Size
            </Th>
            <Th
              sortable
              active={sortBy.startsWith("uploader")}
              direction={sortBy === "uploader_desc" ? "desc" : "asc"}
              onClick={() => handleSort("uploader_asc", "uploader_desc")}
            >
              Uploaded by
            </Th>
            <Th
              sortable
              active={sortBy.startsWith("date")}
              direction={sortBy === "date_oldest" ? "asc" : "desc"} // Default to newest first
              onClick={() => handleSort("date_newest", "date_oldest")}
            >
              Modified
            </Th>
            <Th
              sortable
              active={sortBy.startsWith("tags")}
              direction={sortBy === "tags_desc" ? "desc" : "asc"}
              onClick={() => handleSort("tags_asc", "tags_desc")}
            >
              Tags
            </Th>
            <Th className="w-12" />
          </tr>
        </thead>
        <tbody>
          <AnimatePresence initial={false}>
            {files.map((f) => (
              <Row
                key={f.id}
                file={f}
                selected={selectedIds.has(f.id)}
                selectMode={selectMode}
                onOpen={() => onOpenFile(f)}
                onToggleSelect={(next) => onToggleSelect(f.id, next)}
                onOpenMenu={(e) => onOpenMenu(f, e)}
              />
            ))}
          </AnimatePresence>
        </tbody>
      </table>
    </div>
  );
}

function Th({
  children,
  className,
  align = "left",
  sortable,
  active,
  direction,
  onClick,
}: {
  children?: React.ReactNode;
  className?: string;
  align?: "left" | "right";
  sortable?: boolean;
  active?: boolean;
  direction?: "asc" | "desc";
  onClick?: () => void;
}) {
  return (
    <th
      className={`px-3 py-3 text-[11px] uppercase tracking-wider group ${
        active ? "text-[#0F172A]" : "text-[#9CA3AF]"
      } ${align === "right" ? "text-right" : "text-left"} ${
        className ?? ""
      } ${sortable ? "cursor-pointer hover:bg-[#F1F5F9] transition-colors select-none" : ""}`}
      style={{ fontFamily: "var(--font-poppins)", fontWeight: active ? 700 : 600 }}
      onClick={sortable ? onClick : undefined}
    >
      <div className={`flex items-center gap-1.5 ${align === "right" ? "justify-end" : "justify-start"}`}>
        {children}
        {sortable && (
          <span
            className={`transition-opacity flex items-center justify-center size-4 rounded-md ${
              active 
                ? "opacity-100 bg-[#5CE1A5]/15 text-[#059669]" 
                : "opacity-0 group-hover:opacity-100 text-[#9CA3AF]"
            }`}
          >
            {direction === "desc" ? <ArrowDown className="size-3" /> : <ArrowUp className="size-3" />}
          </span>
        )}
      </div>
    </th>
  );
}

// ... Keep existing Row, Td, initials, and relativeTime functions unchanged below this line.
function Row({
  file,
  selected,
  selectMode,
  onOpen,
  onToggleSelect,
  onOpenMenu,
}: {
  file: LibraryFile;
  selected: boolean;
  selectMode: boolean;
  onOpen: () => void;
  onToggleSelect: (next: boolean) => void;
  onOpenMenu: (e: React.MouseEvent) => void;
}) {
  const { Icon, color, bg } = fileIconFor(file.file_type);
  return (
    <motion.tr
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      onClick={onOpen}
      className={`border-b border-[#F1F5F9] cursor-pointer group transition-colors ${
        selected ? "bg-[#5CE1A5]/8" : "hover:bg-[#F8FAFC]"
      }`}
    >
      <Td className="w-8" onClick={(e) => e.stopPropagation()}>
        <input
          type="checkbox"
          checked={selected}
          onChange={(e) => onToggleSelect(e.target.checked)}
          className={`size-4 rounded text-[#5CE1A5] focus:ring-[#5CE1A5] border-[#E5E7EB] transition-opacity ${
            selectMode || selected
              ? "opacity-100"
              : "opacity-0 group-hover:opacity-100"
          }`}
        />
      </Td>
      <Td>
        <div className="flex items-center gap-2 min-w-0">
          <span
            className="size-7 rounded-md flex items-center justify-center shrink-0"
            style={{ backgroundColor: bg }}
          >
            <Icon className="size-3.5" style={{ color }} />
          </span>
          <span
            className="text-[13px] text-[#2D333A] truncate"
            style={{
              fontFamily: "var(--font-poppins)",
              fontWeight: 600,
            }}
          >
            {file.name}
          </span>
          {file.is_pinned && (
            <Bookmark
              className="size-3 text-[#5CE1A5] shrink-0"
              fill="currentColor"
            />
          )}
        </div>
      </Td>
      <Td>
        <span
          className="text-[12px] text-[#6B7280]"
          style={{ fontFamily: "var(--font-source-sans)" }}
        >
          {fileCategoryLabel(file.file_type)}
        </span>
      </Td>
      <Td align="right">
        <span
          className="text-[12px] text-[#6B7280] tabular-nums"
          style={{ fontFamily: "var(--font-source-sans)" }}
        >
          {formatBytes(file.size_bytes)}
        </span>
      </Td>
      <Td>
        <div className="flex items-center gap-1.5">
          <span
            className="size-5 rounded-full flex items-center justify-center text-[9px] font-semibold text-[#0F172A]"
            style={{ backgroundColor: file.uploader?.avatar_color ?? "#5CE1A5" }}
          >
            {initials(file.uploader?.full_name || "·")}
          </span>
          <span
            className="text-[12px] text-[#6B7280] truncate"
            style={{ fontFamily: "var(--font-source-sans)" }}
          >
            {file.uploader?.full_name || "Unknown"}
          </span>
        </div>
      </Td>
      <Td>
        <span
          className="text-[12px] text-[#6B7280]"
          style={{ fontFamily: "var(--font-source-sans)" }}
        >
          {relativeTime(file.uploaded_at)}
        </span>
      </Td>
      <Td>
        <div className="flex flex-wrap gap-1">
          {file.tags.slice(0, 3).map((t) => (
            <span
              key={t.id}
              className="h-5 px-1.5 rounded text-[10px] font-semibold inline-flex items-center"
              style={{
                backgroundColor: `${t.color}1A`,
                color: t.color,
                fontFamily: "var(--font-poppins)",
              }}
            >
              {t.name}
            </span>
          ))}
          {file.tags.length > 3 && (
            <span
              className="text-[10px] text-[#9CA3AF]"
              style={{ fontFamily: "var(--font-source-sans)" }}
            >
              +{file.tags.length - 3}
            </span>
          )}
        </div>
      </Td>
      <Td className="w-12" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          onClick={onOpenMenu}
          className="size-7 rounded-md flex items-center justify-center text-[#9CA3AF] hover:text-[#2D333A] hover:bg-[#F4F5F7]"
          aria-label="File actions"
        >
          <MoreHorizontal className="size-3.5" />
        </button>
      </Td>
    </motion.tr>
  );
}

function Td({
  children,
  className,
  align = "left",
  onClick,
}: {
  children?: React.ReactNode;
  className?: string;
  align?: "left" | "right";
  onClick?: (e: React.MouseEvent) => void;
}) {
  return (
    <td
      className={`px-3 py-2 ${align === "right" ? "text-right" : "text-left"} ${
        className ?? ""
      }`}
      onClick={onClick}
    >
      {children}
    </td>
  );
}

function initials(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? "")
      .join("") || "·"
  );
}

function relativeTime(iso: string): string {
  const t = new Date(iso).getTime();
  const diff = Date.now() - t;
  const m = Math.round(diff / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}