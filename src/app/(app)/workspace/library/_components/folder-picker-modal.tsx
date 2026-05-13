"use client";

import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ChevronRight, FolderPlus, Library, Search, X } from "lucide-react";
import { getIconByName } from "@/lib/icons";
import type { LibraryFolder } from "@/app/actions/attachments";

interface FolderPickerModalProps {
  open: boolean;
  onClose: () => void;
  folders: LibraryFolder[];
  /** Folders that should be hidden from selection (e.g. self + descendants
   *  when moving a folder into another folder). */
  excludeIds?: Set<string>;
  /** Pre-selected folder id, or null for root. */
  initial?: string | null;
  onPick: (folderId: string | null) => void;
  onCreateRequested?: () => void;
  title?: string;
}

export function FolderPickerModal({
  open,
  onClose,
  folders,
  excludeIds,
  initial,
  onPick,
  onCreateRequested,
  title = "Move to folder",
}: FolderPickerModalProps) {
  const [query, setQuery] = useState("");
  const [pick, setPick] = useState<string | null>(initial ?? null);

  const tree = useMemo(() => buildTree(folders, excludeIds), [folders, excludeIds]);
  const filtered = useMemo(() => {
    if (!query.trim()) return tree;
    const q = query.trim().toLowerCase();
    // Flatten + filter; preserve hierarchy display by showing only matches.
    const flat: { node: TreeNode; depth: number }[] = [];
    function walk(nodes: TreeNode[], depth: number) {
      nodes.forEach((n) => {
        flat.push({ node: n, depth });
        walk(n.children, depth + 1);
      });
    }
    walk(tree, 0);
    return flat
      .filter(({ node }) => node.folder.name.toLowerCase().includes(q))
      .map(({ node, depth }) => ({ ...node, depth, children: [] as TreeNode[] }));
  }, [tree, query]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
            className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[85vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="px-5 py-4 border-b border-[#E5E7EB] flex items-center justify-between">
              <h2
                className="text-[16px] font-semibold text-[#2D333A]"
                style={{ fontFamily: "var(--font-poppins)" }}
              >
                {title}
              </h2>
              <button
                type="button"
                onClick={onClose}
                className="size-9 rounded-xl flex items-center justify-center text-[#9CA3AF] hover:text-[#2D333A] hover:bg-[#F4F5F7]"
                aria-label="Close"
              >
                <X className="size-4" />
              </button>
            </header>

            <div className="px-4 py-3 border-b border-[#F1F5F9]">
              <div className="flex items-center gap-2 h-9 px-3 rounded-lg bg-[#F4F5F7]">
                <Search className="size-3.5 text-[#9CA3AF]" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search folders"
                  className="flex-1 bg-transparent text-[13px] outline-none"
                  style={{ fontFamily: "var(--font-source-sans)" }}
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-2 py-2">
              <Row
                isRoot
                selected={pick === null}
                onClick={() => setPick(null)}
              />
              {query.trim() ? (
                <ul>
                  {filtered.length === 0 ? (
                    <p
                      className="px-3 py-3 text-[12px] text-[#9CA3AF]"
                      style={{ fontFamily: "var(--font-source-sans)" }}
                    >
                      No matches.
                    </p>
                  ) : (
                    filtered.map((n) => (
                      <FolderRow
                        key={n.folder.id}
                        node={n}
                        depth={n.depth ?? 0}
                        selected={pick === n.folder.id}
                        onPick={(id) => setPick(id)}
                      />
                    ))
                  )}
                </ul>
              ) : (
                <ul>
                  {tree.map((n) => (
                    <TreeRow
                      key={n.folder.id}
                      node={n}
                      depth={0}
                      pick={pick}
                      onPick={(id) => setPick(id)}
                    />
                  ))}
                </ul>
              )}
            </div>

            <footer className="px-5 py-3 border-t border-[#E5E7EB] flex items-center justify-between gap-2 bg-[#F8FAFC]">
              {onCreateRequested ? (
                <button
                  type="button"
                  onClick={() => {
                    onCreateRequested();
                    onClose();
                  }}
                  className="h-9 px-3 rounded-lg text-[13px] text-[#5CE1A5] hover:bg-[#5CE1A5]/10 inline-flex items-center gap-1.5"
                  style={{ fontFamily: "var(--font-poppins)", fontWeight: 600 }}
                >
                  <FolderPlus className="size-3.5" />
                  Create new folder
                </button>
              ) : (
                <span />
              )}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="h-9 px-3 rounded-lg text-[13px] text-[#6B7280] hover:bg-[#F4F5F7]"
                  style={{ fontFamily: "var(--font-poppins)", fontWeight: 600 }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onPick(pick);
                    onClose();
                  }}
                  className="h-9 px-4 rounded-lg bg-[#5CE1A5] text-white text-[13px] font-semibold hover:bg-[#4DD395]"
                  style={{ fontFamily: "var(--font-poppins)" }}
                >
                  Move
                </button>
              </div>
            </footer>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ─── Tree internals ───────────────────────────────────────

type TreeNode = {
  folder: LibraryFolder;
  children: TreeNode[];
  depth?: number;
};

function buildTree(
  folders: LibraryFolder[],
  excludeIds?: Set<string>,
): TreeNode[] {
  const filtered = excludeIds
    ? folders.filter((f) => !excludeIds.has(f.id))
    : folders;
  const byParent = new Map<string | null, LibraryFolder[]>();
  filtered.forEach((f) => {
    const key = f.parent_folder_id ?? null;
    const arr = byParent.get(key) ?? [];
    arr.push(f);
    byParent.set(key, arr);
  });
  byParent.forEach((arr) => arr.sort((a, b) => a.name.localeCompare(b.name)));
  function build(parent: string | null): TreeNode[] {
    return (byParent.get(parent) ?? []).map((folder) => ({
      folder,
      children: build(folder.id),
    }));
  }
  return build(null);
}

function Row({
  isRoot,
  selected,
  onClick,
}: {
  isRoot?: boolean;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-colors ${
        selected ? "bg-[#5CE1A5]/15" : "hover:bg-[#F4F5F7]"
      }`}
    >
      {isRoot && <Library className="size-3.5 text-[#5CE1A5]" />}
      <span
        className={`text-[13px] truncate ${
          selected ? "text-[#059669]" : "text-[#2D333A]"
        }`}
        style={{
          fontFamily: "var(--font-source-sans)",
          fontWeight: selected ? 600 : 500,
        }}
      >
        Library Root (no folder)
      </span>
    </button>
  );
}

function TreeRow({
  node,
  depth,
  pick,
  onPick,
}: {
  node: TreeNode;
  depth: number;
  pick: string | null;
  onPick: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const FolderIcon = getIconByName(node.folder.icon);
  const selected = pick === node.folder.id;
  return (
    <li>
      <div
        className={`flex items-center gap-1 px-2 py-1.5 rounded-lg ${
          selected ? "bg-[#5CE1A5]/15" : "hover:bg-[#F4F5F7]"
        }`}
        style={{ paddingLeft: `${8 + depth * 16}px` }}
      >
        {node.children.length > 0 ? (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="size-4 flex items-center justify-center text-[#9CA3AF]"
            aria-label={expanded ? "Collapse" : "Expand"}
          >
            <ChevronRight
              className={`size-3 transition-transform ${expanded ? "rotate-90" : ""}`}
            />
          </button>
        ) : (
          <span className="size-4" />
        )}
        <button
          type="button"
          onClick={() => onPick(node.folder.id)}
          className="flex items-center gap-2 min-w-0 flex-1 text-left"
        >
          <FolderIcon
            className="size-3.5 shrink-0"
            style={{ color: node.folder.color }}
          />
          <span
            className={`text-[13px] truncate ${
              selected ? "text-[#059669]" : "text-[#2D333A]"
            }`}
            style={{
              fontFamily: "var(--font-source-sans)",
              fontWeight: selected ? 600 : 500,
            }}
          >
            {node.folder.name}
          </span>
        </button>
      </div>
      {expanded && node.children.length > 0 && (
        <ul>
          {node.children.map((c) => (
            <TreeRow
              key={c.folder.id}
              node={c}
              depth={depth + 1}
              pick={pick}
              onPick={onPick}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

function FolderRow({
  node,
  depth,
  selected,
  onPick,
}: {
  node: TreeNode;
  depth: number;
  selected: boolean;
  onPick: (id: string) => void;
}) {
  const FolderIcon = getIconByName(node.folder.icon);
  return (
    <li
      className={`flex items-center gap-2 px-2 py-1.5 rounded-lg ${
        selected ? "bg-[#5CE1A5]/15" : "hover:bg-[#F4F5F7]"
      }`}
      style={{ paddingLeft: `${8 + depth * 16}px` }}
    >
      <button
        type="button"
        onClick={() => onPick(node.folder.id)}
        className="flex items-center gap-2 min-w-0 flex-1 text-left"
      >
        <FolderIcon
          className="size-3.5 shrink-0"
          style={{ color: node.folder.color }}
        />
        <span
          className={`text-[13px] truncate ${
            selected ? "text-[#059669]" : "text-[#2D333A]"
          }`}
          style={{
            fontFamily: "var(--font-source-sans)",
            fontWeight: selected ? 600 : 500,
          }}
        >
          {node.folder.name}
        </span>
      </button>
    </li>
  );
}
