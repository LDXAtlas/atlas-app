"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Plus,
  MoreHorizontal,
  Pencil,
  Users,
  Tag,
  Archive,
  Trash2,
  Loader2,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import type { BoardDetail } from "@/app/actions/boards";
import { archiveBoard, deleteBoard } from "@/app/actions/boards";
import { getIconByName } from "@/lib/icons";

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

interface BoardDetailHeaderProps {
  board: BoardDetail;
  onAddColumn: () => void;
}

export function BoardDetailHeader({ board, onAddColumn }: BoardDetailHeaderProps) {
  const router = useRouter();
  const Icon = getIconByName(board.icon);
  const [menuOpen, setMenuOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    function onDoc(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setMenuOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  function handleArchive() {
    setMenuOpen(false);
    startTransition(async () => {
      const r = await archiveBoard(board.id);
      if (r.success) router.push("/workspace/projects");
    });
  }

  function handleDelete() {
    setMenuOpen(false);
    if (
      !window.confirm(
        `Delete "${board.name}"? This removes the board, columns, cards, and comments. This can't be undone.`,
      )
    )
      return;
    startTransition(async () => {
      const r = await deleteBoard(board.id);
      if (r.success) router.push("/workspace/projects");
    });
  }

  const visibleAvatars = board.members.slice(0, 4);
  const extra = Math.max(0, board.members.length - visibleAvatars.length);

  return (
    <header className="flex flex-col gap-3 mb-5">
      <Link
        href="/workspace/projects"
        className="inline-flex items-center gap-1.5 text-[13px] text-[#6B7280] hover:text-[#5CE1A5] transition-colors w-fit"
        style={{ fontFamily: "var(--font-source-sans)" }}
      >
        <ArrowLeft className="size-4" />
        Projects
      </Link>

      <div className="flex flex-col lg:flex-row lg:items-center gap-4">
        {/* Left: identity */}
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div
            className="size-11 rounded-xl flex items-center justify-center text-white shrink-0"
            style={{ backgroundColor: board.color }}
          >
            <Icon className="size-5" strokeWidth={1.7} />
          </div>
          <div className="min-w-0">
            <h1
              className="text-2xl text-[#2D333A] leading-tight truncate"
              style={{ fontFamily: "var(--font-poppins)", fontWeight: 700 }}
            >
              {board.name}
            </h1>
            {board.description && (
              <p
                className="text-[13px] text-[#6B7280] mt-0.5 truncate max-w-2xl"
                style={{ fontFamily: "var(--font-source-sans)" }}
              >
                {board.description}
              </p>
            )}
          </div>
        </div>

        {/* Right: members + actions */}
        <div className="flex items-center gap-3 shrink-0">
          {visibleAvatars.length > 0 && (
            <div className="flex items-center -space-x-2">
              {visibleAvatars.map((m) => (
                <Link
                  key={m.profile_id}
                  href={`/directory/profile/${m.profile_id}`}
                  title={`${m.full_name} · ${m.role}`}
                  className="size-7 rounded-full ring-2 ring-white flex items-center justify-center text-[10px] text-white shrink-0 hover:z-10"
                  style={{
                    backgroundColor: "#5CE1A5",
                    fontFamily: "var(--font-poppins)",
                    fontWeight: 600,
                  }}
                >
                  {initialsOf(m.full_name)}
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
          )}

          {board.viewer_can_edit && (
            <button
              type="button"
              onClick={onAddColumn}
              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-xl border border-[#E5E7EB] bg-white text-[13px] font-semibold text-[#2D333A] hover:bg-[#F4F5F7] transition-colors"
              style={{ fontFamily: "var(--font-poppins)" }}
            >
              <Plus className="size-3.5" />
              Add Column
            </button>
          )}

          {board.viewer_can_edit && (
            <div ref={menuRef} className="relative">
              <button
                type="button"
                onClick={() => setMenuOpen((v) => !v)}
                disabled={pending}
                className="size-9 rounded-xl border border-[#E5E7EB] bg-white flex items-center justify-center text-[#6B7280] hover:bg-[#F4F5F7] transition-colors disabled:opacity-50"
                aria-label="Board actions"
              >
                {pending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <MoreHorizontal className="size-4" />
                )}
              </button>
              <AnimatePresence>
                {menuOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -4, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -4, scale: 0.96 }}
                    transition={{ duration: 0.15 }}
                    className="absolute right-0 top-full mt-1.5 z-30 w-52 bg-white rounded-xl border border-[#E5E7EB] py-1.5"
                    style={{ boxShadow: "0 8px 30px rgba(0,0,0,0.12)" }}
                  >
                    <button
                      type="button"
                      disabled
                      className="w-full text-left flex items-center gap-2 px-3 py-2 text-[13px] text-[#9CA3AF]"
                      style={{ fontFamily: "var(--font-source-sans)" }}
                      title="Coming in Phase 3"
                    >
                      <Pencil className="size-3.5 text-[#9CA3AF]" />
                      Edit Board
                    </button>
                    <button
                      type="button"
                      disabled
                      className="w-full text-left flex items-center gap-2 px-3 py-2 text-[13px] text-[#9CA3AF]"
                      style={{ fontFamily: "var(--font-source-sans)" }}
                      title="Coming in Phase 3"
                    >
                      <Users className="size-3.5 text-[#9CA3AF]" />
                      Manage Members
                    </button>
                    <button
                      type="button"
                      disabled
                      className="w-full text-left flex items-center gap-2 px-3 py-2 text-[13px] text-[#9CA3AF]"
                      style={{ fontFamily: "var(--font-source-sans)" }}
                      title="Coming in Phase 3"
                    >
                      <Tag className="size-3.5 text-[#9CA3AF]" />
                      Manage Labels
                    </button>
                    <div className="h-px bg-[#F3F4F6] mx-2 my-1" />
                    <button
                      type="button"
                      onClick={handleArchive}
                      className="w-full text-left flex items-center gap-2 px-3 py-2 text-[13px] text-[#2D333A] hover:bg-[#F4F5F7]"
                      style={{ fontFamily: "var(--font-source-sans)" }}
                    >
                      <Archive className="size-3.5 text-[#9CA3AF]" />
                      Archive Board
                    </button>
                    {board.viewer_can_delete && (
                      <button
                        type="button"
                        onClick={handleDelete}
                        className="w-full text-left flex items-center gap-2 px-3 py-2 text-[13px] text-[#DC2626] hover:bg-[#FEF2F2]"
                        style={{ fontFamily: "var(--font-source-sans)" }}
                      >
                        <Trash2 className="size-3.5" />
                        Delete Board
                      </button>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>

      <div className="h-px w-full bg-[#E5E7EB]" />
    </header>
  );
}
