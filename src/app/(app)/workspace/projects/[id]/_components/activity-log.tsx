"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ChevronDown, History } from "lucide-react";
import type {
  CardActivityActionType,
  CardActivityEntry,
} from "@/app/actions/boards";

interface ActivityLogProps {
  entries: CardActivityEntry[];
  /** Collapsed by default per spec. */
  defaultExpanded?: boolean;
}

export function ActivityLog({
  entries,
  defaultExpanded = false,
}: ActivityLogProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <section className="bg-white border border-[#E5E7EB] rounded-2xl">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-2 px-4 py-3 text-left"
        aria-expanded={expanded}
      >
        <History className="size-4 text-[#6B7280]" />
        <span
          className="text-[14px] font-semibold text-[#2D333A]"
          style={{ fontFamily: "var(--font-poppins)" }}
        >
          Activity
        </span>
        {entries.length > 0 && (
          <span
            className="text-[11px] text-[#6B7280] bg-[#F3F4F6] px-1.5 py-0.5 rounded-md tabular-nums"
            style={{ fontFamily: "var(--font-poppins)", fontWeight: 600 }}
          >
            {entries.length}
          </span>
        )}
        <ChevronDown
          className={`size-3.5 text-[#9CA3AF] ml-auto transition-transform ${
            expanded ? "" : "-rotate-90"
          }`}
        />
      </button>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 pt-1 border-t border-[#F1F5F9]">
              {entries.length === 0 ? (
                <p
                  className="text-[12px] text-[#9CA3AF] py-3"
                  style={{ fontFamily: "var(--font-source-sans)" }}
                >
                  No activity yet.
                </p>
              ) : (
                <ul className="space-y-2.5 mt-2">
                  {entries.map((e) => (
                    <ActivityRow key={e.id} entry={e} />
                  ))}
                </ul>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

function ActivityRow({ entry }: { entry: CardActivityEntry }) {
  const actorName = entry.actor?.full_name || "Someone";
  return (
    <li className="flex items-start gap-2">
      <span
        className="size-6 rounded-full flex items-center justify-center text-[10px] font-semibold text-[#0F172A] shrink-0"
        style={{ backgroundColor: entry.actor?.avatar_color || "#5CE1A5" }}
      >
        {initials(actorName)}
      </span>
      <div className="flex-1 min-w-0">
        <p
          className="text-[12.5px] text-[#2D333A] leading-snug"
          style={{ fontFamily: "var(--font-source-sans)" }}
        >
          <span style={{ fontWeight: 600 }}>{actorName}</span>{" "}
          {actionPhrase(entry.action_type, entry.metadata)}
        </p>
        <p
          className="text-[11px] text-[#9CA3AF] mt-0.5"
          style={{ fontFamily: "var(--font-source-sans)" }}
        >
          {relativeTime(entry.created_at)}
        </p>
      </div>
    </li>
  );
}

function actionPhrase(
  type: CardActivityActionType,
  meta: Record<string, unknown>,
): React.ReactNode {
  const from = typeof meta.from === "string" ? meta.from : undefined;
  const to = typeof meta.to === "string" ? meta.to : undefined;
  const title = typeof meta.title === "string" ? meta.title : undefined;
  const labelName =
    typeof meta.label_name === "string" ? meta.label_name : undefined;
  const preview =
    typeof meta.preview === "string" ? meta.preview : undefined;

  switch (type) {
    case "created":
      return <>created this card.</>;
    case "title_changed":
      return (
        <>
          renamed the card
          {from && to ? (
            <>
              {" "}from <em>{from}</em> to <em>{to}</em>
            </>
          ) : (
            ""
          )}
          .
        </>
      );
    case "description_changed":
      return <>updated the description.</>;
    case "moved_column":
      return (
        <>
          moved this card
          {from && to ? (
            <>
              {" "}from <em>{from}</em> to <em>{to}</em>
            </>
          ) : (
            ""
          )}
          .
        </>
      );
    case "assigned":
      return <>assigned the card.</>;
    case "unassigned":
      return <>unassigned the card.</>;
    case "due_date_changed":
      if (!to && from) return <>cleared the due date.</>;
      if (to) return <>set the due date to {formatDate(to)}.</>;
      return <>changed the due date.</>;
    case "label_added":
      return <>added the <em>{labelName ?? "label"}</em> label.</>;
    case "label_removed":
      return <>removed the <em>{labelName ?? "label"}</em> label.</>;
    case "checklist_added":
      return <>added &ldquo;{title}&rdquo; to the checklist.</>;
    case "checklist_completed":
      return <>checked off &ldquo;{title}&rdquo;.</>;
    case "checklist_removed":
      return <>removed &ldquo;{title}&rdquo; from the checklist.</>;
    case "comment_added":
      return (
        <>
          commented{preview ? <>: <em>{preview}</em></> : ""}.
        </>
      );
    case "attachment_added":
      return <>attached a file.</>;
    case "attachment_removed":
      return <>removed an attachment.</>;
    case "completed":
      return <>marked this card complete.</>;
    case "reopened":
      return <>reopened this card.</>;
    default:
      return <>updated this card.</>;
  }
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
