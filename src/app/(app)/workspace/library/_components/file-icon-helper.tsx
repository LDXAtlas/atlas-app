"use client";

import {
  File as FileIcon,
  FileAudio,
  FileSpreadsheet,
  FileText,
  Image as ImageIcon,
  Presentation,
} from "lucide-react";
import type { FileCategory } from "@/lib/file-utils";

// Single source of truth for the file-type → icon + color mapping used
// across the Library page (grid cards, list rows, detail header, etc.).
// Keep in sync with src/components/file-preview.tsx's local copy.
export function fileIconFor(category: FileCategory) {
  switch (category) {
    case "image":
      return { Icon: ImageIcon, color: "#8B5CF6", bg: "#EDE9FE" };
    case "pdf":
      return { Icon: FileIcon, color: "#DC2626", bg: "#FEE2E2" };
    case "audio":
      return { Icon: FileAudio, color: "#5CE1A5", bg: "#D1FAE5" };
    case "office_word":
      return { Icon: FileText, color: "#2563EB", bg: "#DBEAFE" };
    case "office_excel":
      return { Icon: FileSpreadsheet, color: "#059669", bg: "#D1FAE5" };
    case "office_ppt":
      return { Icon: Presentation, color: "#F97316", bg: "#FEF3C7" };
    case "text":
      return { Icon: FileText, color: "#6B7280", bg: "#F3F4F6" };
    case "other":
    default:
      return { Icon: FileIcon, color: "#6B7280", bg: "#F3F4F6" };
  }
}

export function fileCategoryLabel(category: FileCategory): string {
  switch (category) {
    case "image":
      return "Image";
    case "pdf":
      return "PDF";
    case "audio":
      return "Audio";
    case "office_word":
      return "Word Document";
    case "office_excel":
      return "Spreadsheet";
    case "office_ppt":
      return "Presentation";
    case "text":
      return "Text File";
    case "other":
    default:
      return "File";
  }
}
