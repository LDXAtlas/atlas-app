"use client";

import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Bookmark,
  ChevronRight,
  Clock,
  FileText,
  FolderPlus,
  Library as LibraryIcon,
  Megaphone,
  Plus,
  Trello,
  Calendar,
} from "lucide-react";
import { getIconByName } from "@/lib/icons";
import type {
  LibraryFilter,
  LibraryFolderWithCount,
  LibraryTagWithUsage,
} from "@/app/actions/attachments";

export interface SidebarSelection {
  kind: "filter";
  filter: LibraryFilter;
  // Optional secondary filter — selected tags also live on the same state
  // so the topbar can render their pills, but the sidebar drives the toggle.
}

interface LibrarySidebarProps {
  orgName: string;
  filter: LibraryFilter;
  folderId: string | null | undefined; // undefined = filter mode, null = root, uuid = folder
  selectedTagIds: string[];
  folders: LibraryFolderWithCount[];
  tags: LibraryTagWithUsage[];
  canManage: boolean;
  onSelectFilter: (filter: LibraryFilter) => void;
  onSelectFolder: (folderId: string | null) => void;
  onToggleTag: (tagId: string) => void;
  onCreateFolder: () => void;
  onCreateTag: () => void;
  onContextMenuFolder?: (folder: LibraryFolderWithCount, event: React.MouseEvent) => void;
}

const QUICK_FILTERS: {
  filter: LibraryFilter;
  label: string;
  icon: (size: string) => React.ReactNode;
}[] = [
  {
    filter: "all",
    label: "All Files",
    icon: (s) => <FileText className={s} />,
  },
  {
    filter: "recent",
    label: "Recently Uploaded",
    icon: (s) => <Clock className={s} />,
  },
  {
    filter: "pinned",
    label: "Pinned",
    icon: (s) => <Bookmark className={s} />,
  },
];

const VIRTUAL_FILTERS: {
  filter: LibraryFilter;
  label: string;
  icon: (size: string) => React.ReactNode;
}[] = [
  {
    filter: "from_tasks",
    label: "From Tasks",
    icon: (s) => <FileText className={s} />,
  },
  {
    filter: "from_announcements",
    label: "From Announcements",
    icon: (s) => <Megaphone className={s} />,
  },
  {
    filter: "from_events",
    label: "From Events",
    icon: (s) => <Calendar className={s} />,
  },
  {
    filter: "from_boards",
    label: "From Projects",
    icon: (s) => <Trello className={s} />,
  },
];

export function LibrarySidebar({
  orgName,
  filter,
  folderId,
  selectedTagIds,
  folders,
  tags,
  canManage,
  onSelectFilter,
  onSelectFolder,
  onToggleTag,
  onCreateFolder,
  onCreateTag,
  onContextMenuFolder,
}: LibrarySidebarProps) {
  // Build the folder tree from the flat list.
  const tree = useMemo(() => buildFolderTree(folders), [folders]);

  return (
    <aside
      className="w-[280px] h-full border-r border-[#E5E7EB] flex flex-col overflow-hidden"
      style={{ backgroundColor: "#FAFBFC" }}
    >
      {/* Header */}
      <header className="px-5 py-4 border-b border-[#E5E7EB] shrink-0">
        <h1
          className="text-xl text-[#0F172A] flex items-center gap-2"
          style={{ fontFamily: "var(--font-poppins)", fontWeight: 700 }}
        >
          <LibraryIcon className="size-5 text-[#5CE1A5]" />
          Library
        </h1>
        <p
          className="text-[12px] text-[#9CA3AF] mt-0.5 truncate"
          style={{ fontFamily: "var(--font-source-sans)" }}
        >
          {orgName}
        </p>
      </header>

      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-4">
        {/* Quick filters */}
        <ul className="space-y-0.5">
          {QUICK_FILTERS.map((q) => (
            <SidebarItem
              key={q.filter}
              icon={q.icon}
              label={q.label}
              active={folderId === undefined && filter === q.filter}
              onClick={() => onSelectFilter(q.filter)}
            />
          ))}
        </ul>

        <Divider />

        <ul className="space-y-0.5">
          {VIRTUAL_FILTERS.map((q) => (
            <SidebarItem
              key={q.filter}
              icon={q.icon}
              label={q.label}
              active={folderId === undefined && filter === q.filter}
              onClick={() => onSelectFilter(q.filter)}
            />
          ))}
        </ul>

        <Divider />

        {/* Folders */}
        <div>
          <SectionHeader
            title="Folders"
            action={
              canManage ? (
                <button
                  type="button"
                  onClick={onCreateFolder}
                  className="size-6 rounded-md flex items-center justify-center text-[#5CE1A5] hover:bg-[#5CE1A5]/10 transition-colors"
                  aria-label="New folder"
                  title="New folder"
                >
                  <FolderPlus className="size-3.5" />
                </button>
              ) : null
            }
          />
          {/* Library root (direct uploads, no folder) */}
          <SidebarItem
            icon={(s) => <LibraryIcon className={s} />}
            label="Library Root"
            active={folderId === null}
            onClick={() => onSelectFolder(null)}
          />
          {tree.length === 0 ? (
            <p
              className="px-3 py-2 text-[11px] text-[#9CA3AF]"
              style={{ fontFamily: "var(--font-source-sans)" }}
            >
              No folders yet.
            </p>
          ) : (
            <ul>
              {tree.map((node) => (
                <FolderNode
                  key={node.folder.id}
                  node={node}
                  depth={0}
                  activeFolderId={folderId}
                  onSelectFolder={onSelectFolder}
                  onContextMenu={onContextMenuFolder}
                />
              ))}
            </ul>
          )}
        </div>

        <Divider />

        {/* Tags */}
        <div>
          <SectionHeader
            title="Tags"
            action={
              canManage ? (
                <button
                  type="button"
                  onClick={onCreateTag}
                  className="size-6 rounded-md flex items-center justify-center text-[#5CE1A5] hover:bg-[#5CE1A5]/10 transition-colors"
                  aria-label="New tag"
                  title="New tag"
                >
                  <Plus className="size-3.5" />
                </button>
              ) : null
            }
          />
          {tags.length === 0 ? (
            <p
              className="px-3 py-2 text-[11px] text-[#9CA3AF]"
              style={{ fontFamily: "var(--font-source-sans)" }}
            >
              No tags yet.
            </p>
          ) : (
            <ul className="flex flex-wrap gap-1.5 px-2 py-1">
              {tags.map((t) => {
                const active = selectedTagIds.includes(t.id);
                return (
                  <li key={t.id}>
                    <button
                      type="button"
                      onClick={() => onToggleTag(t.id)}
                      className={`inline-flex items-center gap-1 h-6 px-2 rounded-md text-[11px] font-semibold transition-transform hover:scale-[1.02] ${
                        active ? "ring-2 ring-offset-1" : ""
                      }`}
                      style={{
                        backgroundColor: active ? t.color : `${t.color}1A`,
                        color: active ? "white" : t.color,
                        fontFamily: "var(--font-poppins)",
                        boxShadow: active
                          ? `0 0 0 2px white, 0 0 0 4px ${t.color}`
                          : undefined,
                      }}
                    >
                      {t.name}
                      <span
                        className={`text-[10px] tabular-nums ${
                          active ? "text-white/80" : ""
                        }`}
                        style={{ opacity: 0.7 }}
                      >
                        {t.usage_count}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </aside>
  );
}

// ─── Building blocks ───────────────────────────────────────

function SidebarItem({
  icon,
  label,
  active,
  onClick,
}: {
  icon: (sizeClass: string) => React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className={`w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-left transition-colors ${
          active
            ? "bg-[#5CE1A5]/15 text-[#059669]"
            : "text-[#2D333A] hover:bg-[#F4F5F7]"
        }`}
        style={{
          fontFamily: "var(--font-source-sans)",
          fontWeight: active ? 600 : 500,
        }}
      >
        {icon("size-3.5 shrink-0")}
        <span className="text-[13px] truncate flex-1">{label}</span>
      </button>
    </li>
  );
}

function SectionHeader({
  title,
  action,
}: {
  title: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between px-3 mb-1">
      <h3
        className="text-[10px] uppercase tracking-wider text-[#9CA3AF]"
        style={{ fontFamily: "var(--font-poppins)", fontWeight: 600 }}
      >
        {title}
      </h3>
      {action}
    </div>
  );
}

function Divider() {
  return <hr className="border-[#E5E7EB] mx-3" />;
}

// ─── Folder tree ──────────────────────────────────────────

type FolderNodeData = {
  folder: LibraryFolderWithCount;
  children: FolderNodeData[];
};

function buildFolderTree(
  folders: LibraryFolderWithCount[],
): FolderNodeData[] {
  const byParent = new Map<string | null, LibraryFolderWithCount[]>();
  folders.forEach((f) => {
    const key = f.parent_folder_id ?? null;
    const arr = byParent.get(key) ?? [];
    arr.push(f);
    byParent.set(key, arr);
  });
  byParent.forEach((arr) =>
    arr.sort((a, b) => a.name.localeCompare(b.name)),
  );
  function build(parent: string | null): FolderNodeData[] {
    return (byParent.get(parent) ?? []).map((folder) => ({
      folder,
      children: build(folder.id),
    }));
  }
  return build(null);
}

function FolderNode({
  node,
  depth,
  activeFolderId,
  onSelectFolder,
  onContextMenu,
}: {
  node: FolderNodeData;
  depth: number;
  activeFolderId: string | null | undefined;
  onSelectFolder: (id: string) => void;
  onContextMenu?: (folder: LibraryFolderWithCount, e: React.MouseEvent) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const FolderIcon = getIconByName(node.folder.icon);
  const active = activeFolderId === node.folder.id;
  return (
    <li>
      <div
        className={`group flex items-center gap-1 px-3 py-1.5 rounded-lg transition-colors ${
          active ? "bg-[#5CE1A5]/15" : "hover:bg-[#F4F5F7]"
        }`}
        style={{ paddingLeft: `${12 + depth * 16}px` }}
        onContextMenu={
          onContextMenu
            ? (e) => {
                e.preventDefault();
                onContextMenu(node.folder, e);
              }
            : undefined
        }
      >
        {node.children.length > 0 ? (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="size-4 rounded flex items-center justify-center text-[#9CA3AF] hover:text-[#2D333A] shrink-0"
            aria-label={expanded ? "Collapse" : "Expand"}
          >
            <ChevronRight
              className={`size-3 transition-transform ${
                expanded ? "rotate-90" : ""
              }`}
            />
          </button>
        ) : (
          <span className="size-4 shrink-0" />
        )}
        <button
          type="button"
          onClick={() => onSelectFolder(node.folder.id)}
          className="flex items-center gap-2 min-w-0 flex-1 text-left"
        >
          <FolderIcon
            className="size-3.5 shrink-0"
            style={{ color: node.folder.color }}
          />
          <span
            className={`text-[13px] truncate ${
              active ? "text-[#059669]" : "text-[#2D333A]"
            }`}
            style={{
              fontFamily: "var(--font-source-sans)",
              fontWeight: active ? 600 : 500,
            }}
          >
            {node.folder.name}
          </span>
          {node.folder.file_count > 0 && (
            <span
              className="ml-auto text-[10px] text-[#9CA3AF] bg-[#F3F4F6] px-1.5 py-0.5 rounded tabular-nums"
              style={{ fontFamily: "var(--font-poppins)", fontWeight: 600 }}
            >
              {node.folder.file_count}
            </span>
          )}
        </button>
      </div>
      <AnimatePresence initial={false}>
        {expanded && node.children.length > 0 && (
          <motion.ul
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="overflow-hidden"
          >
            {node.children.map((child) => (
              <FolderNode
                key={child.folder.id}
                node={child}
                depth={depth + 1}
                activeFolderId={activeFolderId}
                onSelectFolder={onSelectFolder}
                onContextMenu={onContextMenu}
              />
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </li>
  );
}
