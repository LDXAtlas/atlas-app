"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { motion, AnimatePresence } from "motion/react";
import { Megaphone, CheckSquare, Calendar, ArrowRight } from "lucide-react";
import type { MinistryTileData } from "@/app/actions/ministry-hub";
import { getIconByName } from "@/lib/icons";

// Popup is fixed-positioned so all coordinates are in viewport space — no
// scroll offset is added anywhere. The compute() function re-runs on scroll
// to keep the popup glued to its anchor card.
const POPUP_WIDTH = 340;
const POPUP_GUTTER = 10; // distance between card edge and popup
const POPUP_EST_HEIGHT = 320; // used only on the very first measurement
const VIEWPORT_PAD = 12; // safe distance from any viewport edge
const ARROW_SIZE = 12; // width/height of the rotated-square arrow
const ARROW_INSET = 18; // min distance of arrow tip from popup corners

type Side = "above" | "below";

interface Pos {
  /** Viewport-relative top in px (matches CSS `position: fixed`). */
  top: number;
  /** Viewport-relative left in px. */
  left: number;
  side: Side;
  /** Arrow tip's X offset in px, relative to the popup's left edge. */
  arrowX: number;
}

interface MinistryHoverPreviewProps {
  open: boolean;
  anchor: RefObject<HTMLDivElement | null>;
  tile: MinistryTileData;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}

export function MinistryHoverPreview({
  open,
  anchor,
  tile,
  onMouseEnter,
  onMouseLeave,
}: MinistryHoverPreviewProps) {
  const [mounted, setMounted] = useState(false);
  const [pos, setPos] = useState<Pos | null>(null);
  const popupRef = useRef<HTMLDivElement>(null);

  useEffect(() => setMounted(true), []);

  const compute = useCallback(() => {
    const card = anchor.current;
    if (!card) return;
    const rect = card.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const popupHeight =
      popupRef.current?.offsetHeight ?? POPUP_EST_HEIGHT;

    const cardCenterX = rect.left + rect.width / 2;

    // Default placement: above the card.
    let side: Side = "above";
    let top = rect.top - POPUP_GUTTER - popupHeight;

    // Flip to below only if there's not enough room above.
    if (top < VIEWPORT_PAD) {
      const belowTop = rect.bottom + POPUP_GUTTER;
      // If neither side fits cleanly, prefer whichever has more space and
      // clamp into the viewport (popup body's own scroll keeps content
      // accessible if it's tall).
      const spaceAbove = rect.top - VIEWPORT_PAD;
      const spaceBelow = vh - rect.bottom - VIEWPORT_PAD;
      if (spaceBelow >= popupHeight + POPUP_GUTTER || spaceBelow > spaceAbove) {
        side = "below";
        top = belowTop;
      }
    }

    // Clamp top into the viewport so the popup never spills off-screen, even
    // for very small viewports (the user's reported case: half-size window
    // where the bottom card was clipped entirely).
    const minTop = VIEWPORT_PAD;
    const maxTop = vh - popupHeight - VIEWPORT_PAD;
    if (maxTop >= minTop) {
      top = Math.max(minTop, Math.min(top, maxTop));
    } else {
      // Viewport shorter than popup — pin to top with safe padding.
      top = VIEWPORT_PAD;
    }

    // Center horizontally on the card, then clamp into the viewport.
    const idealLeft = cardCenterX - POPUP_WIDTH / 2;
    const minLeft = VIEWPORT_PAD;
    const maxLeft = vw - POPUP_WIDTH - VIEWPORT_PAD;
    const left = Math.max(minLeft, Math.min(idealLeft, maxLeft));

    // Arrow tip should follow the card's center, but stay within the popup's
    // interior so it doesn't sit on a rounded corner.
    const arrowIdeal = cardCenterX - left;
    const arrowMin = ARROW_INSET;
    const arrowMax = POPUP_WIDTH - ARROW_INSET;
    const arrowX = Math.max(arrowMin, Math.min(arrowIdeal, arrowMax));

    setPos({ top, left, side, arrowX });
  }, [anchor]);

  // Recompute whenever the popup is open. Defer first compute via rAF so the
  // initial render doesn't synchronously call setState inside an effect.
  useEffect(() => {
    if (!open) return;
    const id = window.requestAnimationFrame(compute);
    window.addEventListener("resize", compute);
    window.addEventListener("scroll", compute, true);

    // Re-measure once the popup itself paints (its real height may differ
    // from POPUP_EST_HEIGHT, e.g., when activity is empty).
    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined" && popupRef.current) {
      ro = new ResizeObserver(() => compute());
      ro.observe(popupRef.current);
    }

    return () => {
      window.cancelAnimationFrame(id);
      window.removeEventListener("resize", compute);
      window.removeEventListener("scroll", compute, true);
      ro?.disconnect();
    };
  }, [open, compute]);

  // Clear cached position when popup closes (separate effect to avoid
  // synchronous setState inside the compute effect).
  useEffect(() => {
    if (!open) setPos(null);
  }, [open]);

  if (!mounted || typeof document === "undefined") return null;
  return createPortal(
    <AnimatePresence>
      {open && pos && (
        <motion.div
          ref={popupRef}
          role="dialog"
          aria-label={`${tile.name} preview`}
          initial={{ opacity: 0, y: pos.side === "above" ? 4 : -4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: pos.side === "above" ? 4 : -4 }}
          transition={{ duration: 0.15, ease: [0.23, 1, 0.32, 1] }}
          onMouseEnter={onMouseEnter}
          onMouseLeave={onMouseLeave}
          className="fixed z-[120] bg-white rounded-xl border border-[#E5E7EB]"
          style={{
            top: pos.top,
            left: pos.left,
            width: POPUP_WIDTH,
            boxShadow: "0 12px 32px rgba(15, 23, 42, 0.12)",
          }}
        >
          {/* Arrow pointing at the anchor card. Rotated-square trick: only
              the two outward-facing borders are visible so it blends with
              the popup's border + shadow. */}
          <Arrow side={pos.side} x={pos.arrowX} />
          <div className="rounded-xl overflow-hidden">
            <PreviewContent tile={tile} />
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

// ─── Arrow ─────────────────────────────────────────────────
// 12×12 white square rotated 45°, half-clipped behind the popup body so only
// the outward corner — and the two borders meeting at it — show as the tip.
function Arrow({ side, x }: { side: Side; x: number }) {
  // When the popup is ABOVE the card, the arrow lives at the popup's bottom
  // and the border-right + border-bottom form the visible "down" tip.
  // When BELOW, mirror to top with border-top + border-left.
  const isAbove = side === "above";
  return (
    <span
      aria-hidden
      className="absolute bg-white border-[#E5E7EB] pointer-events-none"
      style={{
        width: ARROW_SIZE,
        height: ARROW_SIZE,
        left: x - ARROW_SIZE / 2,
        [isAbove ? "bottom" : "top"]: -ARROW_SIZE / 2,
        transform: "rotate(45deg)",
        borderRightWidth: isAbove ? 1 : 0,
        borderBottomWidth: isAbove ? 1 : 0,
        borderTopWidth: isAbove ? 0 : 1,
        borderLeftWidth: isAbove ? 0 : 1,
        // A faint shadow on the outward corner picks up the popup's drop
        // shadow so the arrow doesn't read as a separate floating element.
        boxShadow: isAbove
          ? "2px 2px 4px rgba(15, 23, 42, 0.04)"
          : "-2px -2px 4px rgba(15, 23, 42, 0.04)",
      }}
    />
  );
}

// ─── Content ──────────────────────────────────────────────
//
// Visual goal: this should NOT look like a smaller copy of the card.
// The card leads with a saturated color block; the brief leads with white space,
// dark editorial type, a KPI row, and a quiet timeline. The ministry color
// shows up only as a 3px left-edge accent and a single icon dot.
function PreviewContent({ tile }: { tile: MinistryTileData }) {
  const Icon = getIconByName(tile.icon);
  const memberLabel = `${tile.member_count} ${
    tile.member_count === 1 ? "person" : "people"
  }`;
  const hasActivity = tile.recent_activity.length > 0;

  return (
    <div className="relative">
      {/* Left edge color accent — the only place the ministry color appears */}
      <div
        className="absolute inset-y-0 left-0 w-[3px]"
        style={{ backgroundColor: tile.color }}
      />

      {/* Header — dark text on white, with a small color-tinted icon */}
      <div className="pl-5 pr-4 pt-4 pb-3">
        <div className="flex items-center gap-2.5 mb-3">
          <span
            className="size-7 rounded-lg flex items-center justify-center shrink-0"
            style={{ backgroundColor: `${tile.color}1F`, color: tile.color }}
          >
            <Icon className="size-3.5" strokeWidth={2} />
          </span>
          <p
            className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[#9CA3AF]"
            style={{ fontFamily: "var(--font-poppins)" }}
          >
            Ministry brief
          </p>
        </div>
        <p
          className="text-[#2D333A] text-[16px] leading-tight"
          style={{ fontFamily: "var(--font-poppins)", fontWeight: 700 }}
        >
          {tile.name}
        </p>
        <p
          className="text-[12px] text-[#6B7280] mt-1"
          style={{ fontFamily: "var(--font-source-sans)" }}
        >
          {memberLabel}
        </p>
      </div>

      {/* KPI row — three big numbers with explicit labels (different from
         the small chips the card shows) */}
      <div className="grid grid-cols-3 border-y border-[#F3F4F6]">
        <Kpi value={tile.unread_announcements} label="Unread" sublabel="posts" />
        <Kpi value={tile.open_tasks} label="Open" sublabel="tasks" divider />
        <Kpi value={tile.upcoming_events} label="Upcoming" sublabel="events" divider />
      </div>

      {/* Activity timeline — quiet, no colored backgrounds */}
      <div className="pl-5 pr-4 pt-3.5 pb-3">
        <p
          className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[#9CA3AF] mb-2"
          style={{ fontFamily: "var(--font-poppins)" }}
        >
          Latest
        </p>
        {!hasActivity ? (
          <p
            className="text-[12px] text-[#9CA3AF]"
            style={{ fontFamily: "var(--font-source-sans)" }}
          >
            No activity yet.
          </p>
        ) : (
          <ul className="space-y-2">
            {tile.recent_activity.map((item, i) => (
              <li key={i} className="flex items-start gap-2.5">
                <ActivityDot kind={item.kind} />
                <div className="min-w-0 flex-1 flex items-baseline justify-between gap-3">
                  <p
                    className="text-[12px] text-[#2D333A] leading-snug truncate"
                    style={{ fontFamily: "var(--font-source-sans)" }}
                  >
                    {renderActivityText(item)}
                  </p>
                  <span
                    className="text-[11px] text-[#9CA3AF] shrink-0 tabular-nums"
                    style={{ fontFamily: "var(--font-source-sans)" }}
                  >
                    {renderActivityWhen(item)}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Footer — Open Hub button (more prominent than a plain link) */}
      <div className="border-t border-[#F3F4F6] px-4 py-3">
        <Link
          href={`/ministry-hub/${tile.id}`}
          className="w-full inline-flex items-center justify-center gap-1.5 h-9 rounded-xl bg-[#5CE1A5] text-[#060C09] text-[13px] font-semibold hover:shadow-md transition-all"
          style={{ fontFamily: "var(--font-poppins)" }}
        >
          Open Hub
          <ArrowRight className="size-3.5" />
        </Link>
      </div>
    </div>
  );
}

// ─── KPI cell ──────────────────────────────────────────────
function Kpi({
  value,
  label,
  sublabel,
  divider,
}: {
  value: number;
  label: string;
  sublabel: string;
  divider?: boolean;
}) {
  const empty = value === 0;
  return (
    <div
      className={`px-4 py-3 ${divider ? "border-l border-[#F3F4F6]" : ""}`}
      style={{ opacity: empty ? 0.55 : 1 }}
    >
      <p
        className="text-[20px] text-[#2D333A] leading-none tabular-nums"
        style={{ fontFamily: "var(--font-poppins)", fontWeight: 700 }}
      >
        {value}
      </p>
      <p
        className="text-[10px] uppercase tracking-[0.06em] text-[#9CA3AF] mt-1.5"
        style={{ fontFamily: "var(--font-poppins)", fontWeight: 600 }}
      >
        {label}{" "}
        <span className="font-normal normal-case tracking-normal text-[#9CA3AF]">
          {sublabel}
        </span>
      </p>
    </div>
  );
}

// ─── Activity dot ──────────────────────────────────────────
// Quiet monochrome — just the icon at gray, no colored background pill.
function ActivityDot({ kind }: { kind: "announcement" | "task" | "event" }) {
  const map = {
    announcement: { Icon: Megaphone },
    task: { Icon: CheckSquare },
    event: { Icon: Calendar },
  } as const;
  const { Icon } = map[kind];
  return (
    <span className="text-[#9CA3AF] shrink-0 mt-[3px]">
      <Icon className="size-3" />
    </span>
  );
}

function renderActivityText(
  item: MinistryTileData["recent_activity"][number],
): React.ReactNode {
  if (item.kind === "announcement") {
    return (
      <>
        <span className="font-semibold">{item.actor}</span>{" "}
        <span className="text-[#6B7280]">posted</span>{" "}
        &ldquo;{item.title}&rdquo;
      </>
    );
  }
  if (item.kind === "task") {
    return (
      <>
        <span className="text-[#6B7280]">Task</span>{" "}
        <span className="font-semibold">&ldquo;{item.title}&rdquo;</span>
      </>
    );
  }
  return (
    <>
      <span className="text-[#6B7280]">Event</span>{" "}
      <span className="font-semibold">&ldquo;{item.title}&rdquo;</span>
    </>
  );
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function renderActivityWhen(
  item: MinistryTileData["recent_activity"][number],
): string {
  if (item.kind === "announcement") return relativeTime(item.at);
  if (item.kind === "task") {
    if (item.due_date) {
      const d = new Date(item.due_date);
      const today = new Date();
      const startToday = new Date(
        today.getFullYear(),
        today.getMonth(),
        today.getDate(),
      );
      const startDue = new Date(d.getFullYear(), d.getMonth(), d.getDate());
      const days = Math.round(
        (startDue.getTime() - startToday.getTime()) / 86400000,
      );
      if (days < 0) return `${Math.abs(days)}d overdue`;
      if (days === 0) return "Due today";
      if (days === 1) return "Due tomorrow";
      if (days < 7) return `Due ${d.toLocaleDateString("en-US", { weekday: "long" })}`;
      return `Due ${d.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
    }
    return `Created ${relativeTime(item.at)}`;
  }
  // event
  const d = new Date(item.starts_at);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: item.is_all_day ? undefined : "numeric",
    minute: item.is_all_day ? undefined : "2-digit",
  });
}
