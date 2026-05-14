"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ChevronDown, Folder, FolderPlus, Grid3x3, List, Search, Upload, X, Clock, Bookmark, FileText } from "lucide-react";
import type { LibraryFilter, LibraryFolderWithCount, LibraryTagWithUsage } from "@/app/actions/attachments";
import type { FileCategory } from "@/lib/file-utils";

type SortMode =
  | "date_newest" | "date_oldest"
  | "name_asc" | "name_desc"
  | "size_largest" | "size_smallest"
  | "type_asc" | "type_desc"
  | "uploader_asc" | "uploader_desc"
  | "tags_asc" | "tags_desc";

interface LibraryTopbarProps {
  orgName: string;
  filter: LibraryFilter;
  onSelectFilter: (filter: LibraryFilter) => void;
  folderId: string | null | undefined;
  onSelectFolder: (folderId: string | null) => void;
  folders: LibraryFolderWithCount[];
  tags: LibraryTagWithUsage[];
  selectedTagIds: string[];
  onToggleTag: (tagId: string) => void;
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
  onResetFilters: () => void;
  orgProfiles: { id: string; full_name: string }[];
  canUpload: boolean;
  onUpload: () => void;
  onCreateFolder: () => void;
  storage: { used_bytes: number; limit_bytes: number; percentage_used: number; formatted: { used: string; limit: string } } | null;
}

const QUICK_FILTERS = [
  { value: "all" as LibraryFilter, label: "All Files", icon: Folder },
  { value: "pinned" as LibraryFilter, label: "Favorites", icon: Bookmark },
  { value: "recent" as LibraryFilter, label: "Recent", icon: Clock },
];

export function LibraryTopbar({
  orgName,
  filter,
  onSelectFilter,
  folderId,
  onSelectFolder,
  folders,
  search,
  setSearch,
  viewMode,
  setViewMode,
  canUpload,
  onUpload,
  onCreateFolder,
  storage,
}: LibraryTopbarProps) {
  
  return (
<header className="px-8 pt-8 pb-4 bg-transparent w-full z-10 shrink-0">      
      {/* Top Row: Title, Global Actions, and Storage */}
      <div className="flex items-start justify-between mb-8 gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl text-[#0F172A] flex items-center gap-2 mb-1" style={{ fontFamily: "var(--font-poppins)", fontWeight: 700 }}>
            Library
          </h1>
          <p className="text-[13px] text-[#6B7280]" style={{ fontFamily: "var(--font-source-sans)" }}>
            Your church's knowledge hub — files, training, templates, and reports.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {canUpload && (
            <>
              <ActionButton icon={<Upload className="size-4" />} label="Upload File" onClick={onUpload} primary />
              <ActionButton icon={<FolderPlus className="size-4" />} label="New Folder" onClick={onCreateFolder} />
            </>
          )}
          {/* Mock actions to match screenshot feel */}
          <ActionButton icon={<FileText className="size-4" />} label="New Template" onClick={() => {}} />

          {storage && (
            <div className="ml-4 flex items-center gap-3 bg-white px-4 py-2 rounded-full border border-[#E5E7EB] shadow-sm">
              <div className="flex flex-col justify-center min-w-[140px]">
                <div className="flex justify-between items-center mb-1.5">
                  <span className="text-[10px] uppercase font-semibold text-[#9CA3AF] tracking-wider">Storage</span>
                  <span className="text-[10px] font-semibold text-[#5CE1A5]">
                    {storage.formatted.used} / {storage.formatted.limit}
                  </span>
                </div>
                <div className="h-1.5 w-full bg-[#F4F5F7] rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-[#5CE1A5] rounded-full transition-all duration-500" 
                    style={{ width: `${Math.min(storage.percentage_used, 100)}%` }} 
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Secondary Row: Navigation Chips & Search */}
      <div className="flex items-center justify-between gap-4 bg-white px-2 py-2 rounded-2xl border border-[#E5E7EB] shadow-[0_2px_8px_rgba(0,0,0,0.02)]">
        
        <nav className="flex items-center gap-1 overflow-x-auto no-scrollbar">
          {QUICK_FILTERS.map((q) => {
            const active = folderId === undefined && filter === q.value;
            return (
              <button
                key={q.value}
                onClick={() => onSelectFilter(q.value)}
                className={`flex items-center gap-2 h-9 px-4 rounded-xl text-[13px] font-semibold transition-colors whitespace-nowrap ${
                  active ? "bg-[#5CE1A5]/10 text-[#059669]" : "text-[#6B7280] hover:bg-[#F4F5F7] hover:text-[#2D333A]"
                }`}
                style={{ fontFamily: "var(--font-poppins)" }}
              >
                <q.icon className="size-3.5" />
                {q.label}
              </button>
            );
          })}

          <div className="w-px h-5 bg-[#E5E7EB] mx-1" />

          {/* Folder Dropdown replacing the sidebar tree */}
          <FolderDropdown folders={folders} currentFolderId={folderId} onSelect={onSelectFolder} />
        </nav>

        <div className="flex items-center gap-2 shrink-0">
          <div className="w-[240px] h-9 px-3 rounded-xl bg-[#F4F5F7] flex items-center gap-2 border border-transparent focus-within:border-[#5CE1A5] focus-within:bg-white transition-colors">
            <Search className="size-3.5 text-[#9CA3AF]" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search files..."
              className="flex-1 bg-transparent text-[13px] outline-none placeholder:text-[#9CA3AF]"
              style={{ fontFamily: "var(--font-source-sans)" }}
            />
            {search && (
              <button onClick={() => setSearch("")} className="text-[#9CA3AF] hover:text-[#2D333A]">
                <X className="size-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center bg-[#F4F5F7] rounded-xl p-0.5">
             <button onClick={() => setViewMode("list")} className={`size-8 flex items-center justify-center rounded-lg transition-colors ${viewMode === "list" ? "bg-white shadow-sm text-[#2D333A]" : "text-[#9CA3AF] hover:text-[#2D333A]"}`}>
               <List className="size-4" />
             </button>
             <button onClick={() => setViewMode("grid")} className={`size-8 flex items-center justify-center rounded-lg transition-colors ${viewMode === "grid" ? "bg-white shadow-sm text-[#2D333A]" : "text-[#9CA3AF] hover:text-[#2D333A]"}`}>
               <Grid3x3 className="size-4" />
             </button>
          </div>
        </div>
      </div>
    </header>
  );
}

// Subcomponent: Unified Pill Button
function ActionButton({ icon, label, onClick, primary }: { icon: React.ReactNode, label: string, onClick: () => void, primary?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`h-10 px-4 rounded-full text-[13px] font-semibold inline-flex items-center gap-2 transition-all shadow-sm ${
        primary 
          ? "bg-[#5CE1A5] text-white hover:bg-[#4DD395] border border-transparent" 
          : "bg-white text-[#6B7280] hover:text-[#2D333A] border border-[#E5E7EB] hover:border-[#D1D5DB] hover:bg-[#FAFBFC]"
      }`}
      style={{ fontFamily: "var(--font-poppins)" }}
    >
      <span className={primary ? "text-white" : "text-[#9CA3AF]"}>{icon}</span>
      {label}
    </button>
  );
}

// Subcomponent: Folder Dropdown
function FolderDropdown({ folders, currentFolderId, onSelect }: { folders: LibraryFolderWithCount[], currentFolderId: string | null | undefined, onSelect: (id: string | null) => void }) {
  const [open, setOpen] = useState(false);
  const currentFolder = folders.find(f => f.id === currentFolderId);
  const label = currentFolderId === null ? "Library Root" : currentFolder ? currentFolder.name : "Folders";

  return (
    <div className="relative">
      <button 
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-2 h-9 px-4 rounded-xl text-[13px] font-semibold transition-colors ${
          currentFolderId !== undefined ? "bg-[#5CE1A5]/10 text-[#059669]" : "text-[#6B7280] hover:bg-[#F4F5F7] hover:text-[#2D333A]"
        }`}
        style={{ fontFamily: "var(--font-poppins)" }}
      >
        <Folder className="size-3.5" />
        {label}
        <ChevronDown className={`size-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <motion.div 
              initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 4 }}
              className="absolute top-full left-0 mt-2 w-56 bg-white border border-[#E5E7EB] rounded-2xl shadow-xl z-50 overflow-hidden py-1"
            >
              <button 
                onClick={() => { onSelect(null); setOpen(false); }}
                className={`w-full text-left px-4 py-2.5 text-[13px] hover:bg-[#F4F5F7] ${currentFolderId === null ? "text-[#059669] font-semibold bg-[#5CE1A5]/5" : "text-[#2D333A]"}`}
                style={{ fontFamily: "var(--font-poppins)" }}
              >
                Library Root
              </button>
              {folders.map(f => (
                <button 
                  key={f.id}
                  onClick={() => { onSelect(f.id); setOpen(false); }}
                  className={`w-full text-left px-4 py-2.5 text-[13px] hover:bg-[#F4F5F7] flex items-center justify-between ${currentFolderId === f.id ? "text-[#059669] font-semibold bg-[#5CE1A5]/5" : "text-[#2D333A]"}`}
                  style={{ fontFamily: "var(--font-poppins)" }}
                >
                  <span className="truncate">{f.name}</span>
                  {f.file_count > 0 && <span className="text-[10px] text-[#9CA3AF] bg-[#F4F5F7] px-1.5 rounded">{f.file_count}</span>}
                </button>
              ))}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}