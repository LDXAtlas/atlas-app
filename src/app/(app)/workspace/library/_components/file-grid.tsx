"use client";

import { AnimatePresence } from "motion/react";
import type { LibraryFile } from "@/app/actions/attachments";
import { FileCard } from "./file-card";

interface FileGridProps {
  files: LibraryFile[];
  selectedIds: Set<string>;
  selectMode: boolean;
  onOpenFile: (file: LibraryFile) => void;
  onToggleSelect: (fileId: string, next: boolean) => void;
  onOpenMenu: (file: LibraryFile, e: React.MouseEvent) => void;
}

export function FileGrid({
  files,
  selectedIds,
  selectMode,
  onOpenFile,
  onToggleSelect,
  onOpenMenu,
}: FileGridProps) {
  return (
    <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
      <AnimatePresence initial={false}>
        {files.map((f) => (
          <FileCard
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
    </ul>
  );
}
