"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  Megaphone,
  CheckSquare,
  Calendar,
  ArrowRight,
} from "lucide-react";
import { motion } from "motion/react";
import type {
  MinistryTileData,
  MinistryLeadLine,
} from "@/app/actions/ministry-hub";
import { getIconByName } from "@/lib/icons";
import { MinistryHoverPreview } from "./ministry-hover-preview";

// ─── Color helpers ────────────────────────────────────────
function darkenHex(hex: string, amount = 0.08): string {
  const m = hex.replace("#", "").match(/.{1,2}/g);
  if (!m || m.length !== 3) return hex;
  const [r, g, b] = m.map((p) => parseInt(p, 16));
  const adj = (c: number) =>
    Math.max(0, Math.min(255, Math.round(c * (1 - amount))));
  const toHex = (c: number) => c.toString(16).padStart(2, "0");
  return `#${toHex(adj(r))}${toHex(adj(g))}${toHex(adj(b))}`;
}

// ─── Time helpers ─────────────────────────────────────────
function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} minute${m === 1 ? "" : "s"} ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} hour${h === 1 ? "" : "s"} ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d} day${d === 1 ? "" : "s"} ago`;
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function formatDueDay(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const startOfDue = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diffDays = Math.round(
    (startOfDue.getTime() - startOfToday.getTime()) / (24 * 60 * 60 * 1000),
  );
  if (diffDays === 0) return "today";
  if (diffDays === 1) return "tomorrow";
  if (diffDays > 1 && diffDays < 7) {
    return d.toLocaleDateString("en-US", { weekday: "long" });
  }
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatEventWhen(iso: string, isAllDay: boolean): string {
  const d = new Date(iso);
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diffDays = Math.round(
    (startOfDay.getTime() - startOfToday.getTime()) / (24 * 60 * 60 * 1000),
  );

  let dayPart: string;
  if (diffDays === 0) dayPart = "Today";
  else if (diffDays === 1) dayPart = "Tomorrow";
  else if (diffDays > 1 && diffDays < 7) {
    dayPart = d.toLocaleDateString("en-US", { weekday: "long" });
  } else {
    dayPart = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }

  if (isAllDay) return dayPart;

  let timePart = d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
  timePart = timePart
    .replace(/:00\s/, " ")
    .replace(/\s?AM/i, "am")
    .replace(/\s?PM/i, "pm");
  return `${dayPart} ${timePart}`;
}

function initialsOf(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((n) => n[0])
      .join("")
      .toUpperCase() || "?"
  );
}

// ─── Component ────────────────────────────────────────────
type TileSize = "large" | "medium" | "small";

interface MinistryTileProps {
  tile: MinistryTileData;
  size: TileSize;
}

export function MinistryTile({ tile, size }: MinistryTileProps) {
  const router = useRouter();
  const Icon = getIconByName(tile.icon);
  const href = `/ministry-hub/${tile.id}`;
  const memberLabel = `${tile.member_count} ${
    tile.member_count === 1 ? "person" : "people"
  }`;

  const baseColor = tile.color;
  const hoverColor = darkenHex(tile.color, 0.08);
  const isMy = size !== "small";

  // ── Hover preview state (only used for size="small")
  const cardRef = useRef<HTMLDivElement>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const showTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function clearShowTimer() {
    if (showTimerRef.current) {
      clearTimeout(showTimerRef.current);
      showTimerRef.current = null;
    }
  }
  function clearHideTimer() {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  }

  function handlePointerEnter(e: React.PointerEvent) {
    if (size !== "small") return;
    if (e.pointerType === "touch") return; // skip on touch — tap navigates
    clearHideTimer();
    clearShowTimer();
    showTimerRef.current = setTimeout(() => setPreviewOpen(true), 300);
  }

  function handlePointerLeave() {
    if (size !== "small") return;
    clearShowTimer();
    clearHideTimer();
    hideTimerRef.current = setTimeout(() => setPreviewOpen(false), 80);
  }

  useEffect(() => {
    return () => {
      clearShowTimer();
      clearHideTimer();
    };
  }, []);

  function handleClick(e: React.MouseEvent) {
    // Don't navigate if user clicked an interactive child
    const target = e.target as HTMLElement;
    if (target.closest("a, button")) return;
    router.push(href);
  }

  return (
    <>
      <motion.div
        ref={cardRef}
        role="link"
        tabIndex={0}
        onClick={handleClick}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            router.push(href);
          }
        }}
        onPointerEnter={handlePointerEnter}
        onPointerLeave={handlePointerLeave}
        whileHover="hover"
        initial="rest"
        animate="rest"
        className="group relative bg-white rounded-2xl border border-[#E5E7EB] overflow-hidden cursor-pointer"
        variants={{
          rest: { y: 0, boxShadow: "0 0 0 rgba(0,0,0,0)" },
          hover: {
            y: -2,
            boxShadow: "0 4px 16px rgba(0,0,0,0.06)",
          },
        }}
        transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
      >
        {isMy ? (
          <MyTileBody
            tile={tile}
            href={href}
            Icon={Icon}
            memberLabel={memberLabel}
            baseColor={baseColor}
            hoverColor={hoverColor}
          />
        ) : (
          <SmallTileBody
            tile={tile}
            Icon={Icon}
            memberLabel={memberLabel}
            baseColor={baseColor}
            hoverColor={hoverColor}
          />
        )}
      </motion.div>

      {/* Hover preview portal — only for small tiles */}
      {size === "small" && (
        <MinistryHoverPreview
          open={previewOpen}
          anchor={cardRef}
          tile={tile}
          onMouseEnter={() => {
            clearHideTimer();
          }}
          onMouseLeave={() => {
            hideTimerRef.current = setTimeout(() => setPreviewOpen(false), 80);
          }}
        />
      )}
    </>
  );
}

// ─── My Ministry tile body (large/medium) ─────────────────
function MyTileBody({
  tile,
  href,
  Icon,
  memberLabel,
  baseColor,
  hoverColor,
}: {
  tile: MinistryTileData;
  href: string;
  Icon: ReturnType<typeof getIconByName>;
  memberLabel: string;
  baseColor: string;
  hoverColor: string;
}) {
  const roleLabel =
    tile.user_role_in_ministry === "primary"
      ? "PRIMARY"
      : tile.user_role_in_ministry === "secondary"
        ? "SECONDARY"
        : null;
  return (
    <>
      {/* Color block */}
      <motion.div
        className="relative px-6 py-6 min-h-[140px]"
        variants={{
          rest: { backgroundColor: baseColor, filter: "brightness(1)" },
          hover: { backgroundColor: hoverColor, filter: "brightness(0.95)" },
        }}
        transition={{ duration: 0.2, ease: "easeOut" }}
      >
        {roleLabel && (
          <span
            className="absolute top-4 right-4 px-2 py-0.5 rounded-md text-white text-[10px] font-semibold tracking-wider"
            style={{
              fontFamily: "var(--font-poppins)",
              backgroundColor: "rgba(255,255,255,0.20)",
            }}
          >
            {roleLabel}
          </span>
        )}
        <Icon className="size-10 text-white mb-3" strokeWidth={1.6} />
        <h2
          className="text-white text-2xl leading-tight"
          style={{ fontFamily: "var(--font-poppins)", fontWeight: 700 }}
        >
          {tile.name}
        </h2>
        <p
          className="text-white/80 text-[13px] mt-1"
          style={{ fontFamily: "var(--font-source-sans)" }}
        >
          {memberLabel}
        </p>
      </motion.div>

      {/* Content */}
      <div className="px-6 py-5 flex flex-col gap-3 min-h-[180px]">
        <LeadLine line={tile.lead_line} />
        <ChipRow
          announcements={tile.unread_announcements}
          tasks={tile.open_tasks}
          events={tile.upcoming_events}
          size="my"
        />
        <div className="flex items-center gap-2 mt-auto pt-1">
          <Link
            href={href}
            onClick={(e) => e.stopPropagation()}
            className="basis-[60%] h-9 px-3 rounded-xl bg-[#5CE1A5] text-[#060C09] text-[13px] font-semibold flex items-center justify-center gap-1 hover:shadow-md transition-all"
            style={{ fontFamily: "var(--font-poppins)" }}
          >
            Open Hub
            <ArrowRight className="size-3.5" />
          </Link>
          <Link
            href={`/workspace/announcements?ministry=${tile.id}&compose=1`}
            onClick={(e) => e.stopPropagation()}
            className="basis-[40%] h-9 px-3 rounded-xl border border-[#E5E7EB] bg-white text-[13px] font-semibold text-[#2D333A] hover:bg-[#F4F5F7] transition-colors flex items-center justify-center gap-1"
            style={{ fontFamily: "var(--font-poppins)" }}
          >
            <Megaphone className="size-3.5" />
            Quick Post
          </Link>
        </div>
      </div>
    </>
  );
}

// ─── Small tile body (All Ministries) ─────────────────────
function SmallTileBody({
  tile,
  Icon,
  memberLabel,
  baseColor,
  hoverColor,
}: {
  tile: MinistryTileData;
  Icon: ReturnType<typeof getIconByName>;
  memberLabel: string;
  baseColor: string;
  hoverColor: string;
}) {
  return (
    <>
      <motion.div
        className="px-5 py-4 min-h-[80px]"
        variants={{
          rest: { backgroundColor: baseColor, filter: "brightness(1)" },
          hover: { backgroundColor: hoverColor, filter: "brightness(0.95)" },
        }}
        transition={{ duration: 0.2, ease: "easeOut" }}
      >
        <div className="flex items-center gap-2.5">
          <Icon className="size-7 text-white shrink-0" strokeWidth={1.6} />
          <h3
            className="text-white text-lg leading-tight truncate"
            style={{ fontFamily: "var(--font-poppins)", fontWeight: 700 }}
          >
            {tile.name}
          </h3>
        </div>
        <p
          className="text-white/70 text-[12px] mt-1"
          style={{ fontFamily: "var(--font-source-sans)" }}
        >
          {memberLabel}
        </p>
      </motion.div>
      <div className="px-5 py-3.5 flex flex-col gap-2 min-h-[100px]">
        <LeadLine line={tile.lead_line} compact />
        <ChipRow
          announcements={tile.unread_announcements}
          tasks={tile.open_tasks}
          events={tile.upcoming_events}
          size="all"
        />
      </div>
    </>
  );
}

// ─── Lead Line ────────────────────────────────────────────
function LeadLine({
  line,
  compact = false,
}: {
  line: MinistryLeadLine;
  compact?: boolean;
}) {
  const sizeClass = compact ? "text-[13px]" : "text-[14px]";

  if (line.kind === "announcement") {
    if (compact) {
      return (
        <p
          className={`${sizeClass} text-[#2D333A] leading-snug truncate`}
          style={{ fontFamily: "var(--font-source-sans)" }}
        >
          <span className="text-[#9CA3AF]">Latest: </span>
          <span className="font-semibold">{line.actor}</span>{" "}
          <span className="text-[#9CA3AF]">posted</span>{" "}
          <span>&ldquo;{line.title}&rdquo;</span>
        </p>
      );
    }
    return (
      <div className="flex items-start gap-2.5">
        <div
          className="size-7 rounded-full bg-[#5CE1A5] text-white flex items-center justify-center text-[10px] shrink-0 mt-0.5"
          style={{ fontFamily: "var(--font-poppins)", fontWeight: 600 }}
          aria-hidden
        >
          {initialsOf(line.actor)}
        </div>
        <p
          className={`${sizeClass} text-[#2D333A] leading-snug`}
          style={{ fontFamily: "var(--font-source-sans)" }}
        >
          <span className="text-[#9CA3AF]">Latest: </span>
          <span className="font-semibold">{line.actor}</span> posted{" "}
          <span>&ldquo;{line.title}&rdquo;</span>{" "}
          <span className="text-[#9CA3AF]">{relativeTime(line.at)}</span>
        </p>
      </div>
    );
  }

  if (line.kind === "task") {
    return (
      <p
        className={`${sizeClass} text-[#2D333A] leading-snug ${compact ? "truncate" : ""}`}
        style={{ fontFamily: "var(--font-source-sans)" }}
      >
        <span className="text-[#9CA3AF]">Next up: </span>
        <span>&ldquo;{line.title}&rdquo;</span>{" "}
        <span className="text-[#9CA3AF]">due {formatDueDay(line.due_date)}</span>
      </p>
    );
  }

  if (line.kind === "event") {
    return (
      <p
        className={`${sizeClass} text-[#2D333A] leading-snug ${compact ? "truncate" : ""}`}
        style={{ fontFamily: "var(--font-source-sans)" }}
      >
        <span className="text-[#9CA3AF]">Coming up: </span>
        <span className="font-semibold">{line.title}</span>{" "}
        <span className="text-[#9CA3AF]">·</span>{" "}
        <span className="text-[#9CA3AF]">
          {formatEventWhen(line.starts_at, line.is_all_day)}
        </span>
      </p>
    );
  }

  if (line.kind === "leader") {
    return (
      <p
        className={`${sizeClass} text-[#2D333A] leading-snug ${compact ? "truncate" : ""}`}
        style={{ fontFamily: "var(--font-source-sans)" }}
      >
        Quietly led by <span className="font-semibold">{line.name}</span>
      </p>
    );
  }

  return (
    <p
      className={`${sizeClass} text-[#9CA3AF] leading-snug italic ${compact ? "truncate" : ""}`}
      style={{ fontFamily: "var(--font-source-sans)" }}
    >
      New ministry — get started by posting an announcement.
    </p>
  );
}

// ─── Inline metric chips ──────────────────────────────────
function ChipRow({
  announcements,
  tasks,
  events,
  size,
}: {
  announcements: number;
  tasks: number;
  events: number;
  size: "my" | "all";
}) {
  return (
    <div className="flex items-center flex-wrap gap-1.5">
      <Chip
        icon={<Megaphone className="size-3" />}
        count={announcements}
        label={announcements === 1 ? "announcement" : "announcements"}
        size={size}
      />
      <Chip
        icon={<CheckSquare className="size-3" />}
        count={tasks}
        label={tasks === 1 ? "task" : "tasks"}
        size={size}
      />
      <Chip
        icon={<Calendar className="size-3" />}
        count={events}
        label={events === 1 ? "event" : "events"}
        size={size}
      />
    </div>
  );
}

function Chip({
  icon,
  count,
  label,
  size,
}: {
  icon: React.ReactNode;
  count: number;
  label: string;
  size: "my" | "all";
}) {
  const dim = count === 0;
  const text = size === "my" ? "text-[12px]" : "text-[11px]";
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#F3F4F6] text-[#6B7280] ${text}`}
      style={{
        fontFamily: "var(--font-source-sans)",
        opacity: dim ? 0.3 : 1,
      }}
    >
      {icon}
      <span className="tabular-nums font-semibold text-[#2D333A]">{count}</span>
      <span className="text-[#9CA3AF]">{label}</span>
    </span>
  );
}
