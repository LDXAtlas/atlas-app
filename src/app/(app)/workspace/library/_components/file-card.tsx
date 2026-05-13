"use client";

import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { Bookmark, MoreHorizontal } from "lucide-react";
import {
  getThumbnailUrl,
  type LibraryFile,
} from "@/app/actions/attachments";
import { formatBytes } from "@/lib/file-utils";
import { fileIconFor } from "./file-icon-helper";

interface FileCardProps {
  file: LibraryFile;
  selected: boolean;
  onOpen: () => void;
  onToggleSelect: (next: boolean) => void;
  onOpenMenu: (event: React.MouseEvent) => void;
  /** When true, the checkbox is always visible (multi-select mode). */
  selectMode: boolean;
}

export function FileCard({
  file,
  selected,
  onOpen,
  onToggleSelect,
  onOpenMenu,
  selectMode,
}: FileCardProps) {
  const { Icon, color, bg } = fileIconFor(file.file_type);
  const [thumbUrl, setThumbUrl] = useState<string | null>(null);
  const [imgError, setImgError] = useState(false);

  // Resolve a thumbnail URL only when we actually have one — keeps the
  // signed-URL calls quiet for non-image rows.
  useEffect(() => {
    let cancelled = false;
    if (!file.thumbnail_path) return;
    getThumbnailUrl(file.id).then((res) => {
      if (cancelled) return;
      if (res.success && res.data?.url) setThumbUrl(res.data.url);
    });
    return () => {
      cancelled = true;
    };
  }, [file.id, file.thumbnail_path]);

  return (
    <motion.li
      layout
      whileHover={{ y: -2 }}
      transition={{ duration: 0.2 }}
      className={`group relative bg-white border rounded-2xl overflow-hidden cursor-pointer transition-shadow ${
        selected
          ? "border-[#5CE1A5] shadow-[0_0_0_2px_rgba(92,225,165,0.25)]"
          : "border-[#E5E7EB] hover:border-[#5CE1A5]/60 hover:shadow-[0_4px_16px_rgba(0,0,0,0.06)]"
      }`}
      onClick={onOpen}
    >
      {/* Checkbox — visible on hover, or always in select mode */}
      <div
        className={`absolute top-2 left-2 z-10 transition-opacity ${
          selectMode || selected ? "opacity-100" : "opacity-0 group-hover:opacity-100"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <label className="flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={selected}
            onChange={(e) => onToggleSelect(e.target.checked)}
            className="size-4 rounded text-[#5CE1A5] focus:ring-[#5CE1A5] border-[#E5E7EB] bg-white/95"
          />
        </label>
      </div>

      {/* Pin badge */}
      {file.is_pinned && (
        <div
          className="absolute top-2 right-2 z-10 size-6 rounded-full bg-white/95 flex items-center justify-center"
          title="Pinned"
        >
          <Bookmark
            className="size-3 text-[#5CE1A5]"
            fill="currentColor"
          />
        </div>
      )}

      {/* Three-dot menu — visible on hover */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onOpenMenu(e);
        }}
        className={`absolute top-1.5 right-1.5 z-10 size-7 rounded-md bg-white/95 hover:bg-white text-[#6B7280] hover:text-[#2D333A] flex items-center justify-center transition-opacity ${
          file.is_pinned ? "right-9" : ""
        } opacity-0 group-hover:opacity-100`}
        aria-label="File actions"
      >
        <MoreHorizontal className="size-3.5" />
      </button>

      {/* Thumbnail / icon area */}
      <div
        className="aspect-square w-full flex items-center justify-center overflow-hidden"
        style={{ backgroundColor: bg }}
      >
        {thumbUrl && !imgError ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={thumbUrl}
            alt=""
            className="w-full h-full object-cover"
            onError={() => setImgError(true)}
          />
        ) : (
          <Icon className="size-14" style={{ color }} />
        )}
      </div>

      {/* Body */}
      <div className="px-3 py-2.5">
        <p
          className="text-[13.5px] text-[#2D333A] truncate"
          style={{ fontFamily: "var(--font-poppins)", fontWeight: 600 }}
          title={file.name}
        >
          {file.name}
        </p>
        <p
          className="text-[11.5px] text-[#6B7280] mt-0.5 tabular-nums"
          style={{ fontFamily: "var(--font-source-sans)" }}
        >
          {formatBytes(file.size_bytes)}
        </p>
        {file.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1.5">
            {file.tags.slice(0, 2).map((t) => (
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
            {file.tags.length > 2 && (
              <span
                className="h-5 px-1.5 rounded text-[10px] text-[#6B7280] bg-[#F3F4F6] inline-flex items-center"
                style={{ fontFamily: "var(--font-poppins)", fontWeight: 600 }}
              >
                +{file.tags.length - 2}
              </span>
            )}
          </div>
        )}
      </div>
    </motion.li>
  );
}
