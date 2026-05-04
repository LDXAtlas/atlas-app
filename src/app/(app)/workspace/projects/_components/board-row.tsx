"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight, Lock, EyeOff, Building } from "lucide-react";
import type { BoardSummary } from "@/app/actions/boards";
import { getIconByName } from "@/lib/icons";

interface BoardRowProps {
  board: BoardSummary;
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

export function BoardRow({ board }: BoardRowProps) {
  const router = useRouter();
  const Icon = getIconByName(board.icon);
  const href = `/workspace/projects/${board.id}`;

  const total = board.card_count;
  const done = board.completed_count;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  // Visibility hint icon — only show for non-organization boards.
  let VisIcon: typeof Lock | null = null;
  let visLabel = "";
  if (board.visibility === "private") {
    VisIcon = Lock;
    visLabel = "Private";
  } else if (board.visibility === "invitees_only") {
    VisIcon = EyeOff;
    visLabel = "Invitees only";
  } else if (board.visibility === "department") {
    VisIcon = Building;
    visLabel = board.department_name ? `${board.department_name} only` : "Department only";
  }

  return (
    <div
      role="link"
      tabIndex={0}
      onClick={() => router.push(href)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          router.push(href);
        }
      }}
      className="group grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-4 px-4 py-3.5 bg-white rounded-2xl border border-[#E5E7EB] hover:border-[#D1D5DB] hover:bg-[#FAFBFC] transition-colors cursor-pointer"
    >
      {/* Color icon block */}
      <div
        className="size-11 rounded-xl flex items-center justify-center text-white shrink-0"
        style={{ backgroundColor: board.color }}
      >
        <Icon className="size-5" strokeWidth={1.7} />
      </div>

      {/* Name + description */}
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <h3
            className="text-[15px] text-[#2D333A] leading-tight truncate"
            style={{ fontFamily: "var(--font-poppins)", fontWeight: 600 }}
          >
            {board.name}
          </h3>
          {VisIcon && (
            <span
              className="inline-flex items-center gap-1 text-[#9CA3AF]"
              title={visLabel}
              aria-label={visLabel}
            >
              <VisIcon className="size-3" />
            </span>
          )}
        </div>
        {board.description && (
          <p
            className="text-[13px] text-[#6B7280] leading-snug mt-1 truncate"
            style={{ fontFamily: "var(--font-source-sans)" }}
          >
            {board.description}
          </p>
        )}
      </div>

      {/* Right cluster: progress + avatars + chevron */}
      <div className="flex items-center gap-5 shrink-0">
        <div className="flex flex-col items-end gap-1.5 min-w-[160px]">
          <div className="flex items-center gap-2">
            <span
              className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#9CA3AF] tabular-nums"
              style={{ fontFamily: "var(--font-poppins)" }}
            >
              {done}/{total} {total === 1 ? "task" : "tasks"}
            </span>
            <span
              className="text-[12px] font-semibold tabular-nums"
              style={{
                fontFamily: "var(--font-poppins)",
                color: total === 0 ? "#D1D5DB" : board.color,
              }}
            >
              {pct}%
            </span>
          </div>
          <div className="w-[160px] h-1.5 rounded-full bg-[#F3F4F6] overflow-hidden">
            <div
              className="h-full rounded-full transition-[width] duration-300"
              style={{
                width: `${pct}%`,
                backgroundColor: total === 0 ? "transparent" : board.color,
              }}
            />
          </div>
        </div>

        <AvatarStack avatars={board.member_avatars} extra={Math.max(0, board.member_count - board.member_avatars.length)} />

        <ChevronRight
          className="size-4 text-[#D1D5DB] group-hover:text-[#9CA3AF] transition-colors"
          aria-hidden
        />
      </div>
    </div>
  );
}

function AvatarStack({
  avatars,
  extra,
}: {
  avatars: BoardSummary["member_avatars"];
  extra: number;
}) {
  if (avatars.length === 0) return <div className="w-[68px]" />;
  const visible = avatars.slice(0, 4);
  return (
    <div className="flex items-center -space-x-2">
      {visible.map((p) => (
        <Link
          key={p.id}
          href={`/directory/profile/${p.id}`}
          onClick={(e) => e.stopPropagation()}
          title={p.full_name}
          className="size-7 rounded-full ring-2 ring-white flex items-center justify-center text-[10px] text-white shrink-0 hover:z-10"
          style={{
            backgroundColor: "#5CE1A5",
            fontFamily: "var(--font-poppins)",
            fontWeight: 600,
          }}
        >
          {initialsOf(p.full_name)}
        </Link>
      ))}
      {extra > 0 && (
        <span
          className="size-7 rounded-full ring-2 ring-white bg-[#F3F4F6] text-[#6B7280] flex items-center justify-center text-[10px] shrink-0"
          style={{ fontFamily: "var(--font-poppins)", fontWeight: 600 }}
        >
          +{extra}
        </span>
      )}
    </div>
  );
}
