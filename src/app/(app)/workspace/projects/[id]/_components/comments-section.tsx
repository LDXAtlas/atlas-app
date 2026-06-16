"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { motion, AnimatePresence } from "motion/react";
import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { Avatar } from "@/components/avatar";
import {
  MentionInput,
  MentionRenderer,
  type MentionInputHandle,
} from "./mention-autocomplete";

// Loose comment shape — both card and task comments converge on the same
// fields, so the section is fully reusable.
export type CommentShape = {
  id: string;
  author_id: string;
  content: string;
  created_at: string;
  updated_at: string;
  author: {
    id: string;
    full_name: string;
    avatar_color: string;
    avatar_url: string | null;
    role: string | null;
  } | null;
};

interface CommentsSectionProps {
  comments: CommentShape[];
  viewerId: string;
  viewerIsAdmin: boolean;
  onCreate: (content: string) => Promise<CommentShape | null>;
  onUpdate: (id: string, content: string) => Promise<CommentShape | null>;
  onDelete: (id: string) => Promise<boolean>;
  /** Optional header override. Default "Comments". */
  title?: string;
}

export function CommentsSection({
  comments: initial,
  viewerId,
  viewerIsAdmin,
  onCreate,
  onUpdate,
  onDelete,
  title = "Comments",
}: CommentsSectionProps) {
  const [comments, setComments] = useState<CommentShape[]>(initial);
  const [draft, setDraft] = useState("");
  const [posting, startPost] = useTransition();
  const [editingId, setEditingId] = useState<string | null>(null);
  const inputRef = useRef<MentionInputHandle | null>(null);

  // Keep local state in sync if a parent reloads.
  useEffect(() => {
    setComments(initial);
  }, [initial]);

  function handleSubmit() {
    const trimmed = draft.trim();
    if (!trimmed) return;
    startPost(async () => {
      const created = await onCreate(trimmed);
      if (created) {
        setComments((prev) => [...prev, created]);
        setDraft("");
        inputRef.current?.focus();
      }
    });
  }

  return (
    <section className="bg-white border border-[#E5E7EB] rounded-2xl p-4">
      <header className="flex items-center justify-between mb-3">
        <h3
          className="text-[14px] font-semibold text-[#2D333A]"
          style={{ fontFamily: "var(--font-poppins)" }}
        >
          {title}
          {comments.length > 0 && (
            <span
              className="ml-2 text-[11px] text-[#6B7280] bg-[#F3F4F6] px-1.5 py-0.5 rounded-md tabular-nums"
              style={{ fontWeight: 600 }}
            >
              {comments.length}
            </span>
          )}
        </h3>
      </header>

      <div className="space-y-2 mb-3">
        <MentionInput
          ref={inputRef}
          value={draft}
          onChange={setDraft}
          onSubmit={handleSubmit}
          placeholder="Write a comment…"
          rows={3}
          disabled={posting}
        />
        <div className="flex items-center justify-between">
          <span
            className="text-[11px] text-[#9CA3AF]"
            style={{ fontFamily: "var(--font-source-sans)" }}
          >
            ⌘+Enter to post · type @ to mention
          </span>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={posting || !draft.trim()}
            className="h-8 px-3 rounded-lg bg-[#5CE1A5] text-white text-[12px] font-semibold hover:bg-[#4DD395] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            style={{ fontFamily: "var(--font-poppins)" }}
          >
            {posting ? "Posting…" : "Post"}
          </button>
        </div>
      </div>

      <ul className="space-y-3">
        <AnimatePresence initial={false}>
          {comments.map((c) => (
            <CommentRow
              key={c.id}
              comment={c}
              isEditing={editingId === c.id}
              canEdit={c.author_id === viewerId}
              canDelete={c.author_id === viewerId || viewerIsAdmin}
              onEditStart={() => setEditingId(c.id)}
              onEditCancel={() => setEditingId(null)}
              onSaveEdit={async (next) => {
                const updated = await onUpdate(c.id, next);
                if (updated) {
                  setComments((prev) =>
                    prev.map((x) => (x.id === c.id ? updated : x)),
                  );
                  setEditingId(null);
                }
              }}
              onDelete={async () => {
                const ok = await onDelete(c.id);
                if (ok) {
                  setComments((prev) => prev.filter((x) => x.id !== c.id));
                }
              }}
            />
          ))}
        </AnimatePresence>
      </ul>

      {comments.length === 0 && (
        <p
          className="text-[13px] text-[#9CA3AF] text-center py-3"
          style={{ fontFamily: "var(--font-source-sans)" }}
        >
          Be the first to comment.
        </p>
      )}
    </section>
  );
}

function CommentRow({
  comment: c,
  isEditing,
  canEdit,
  canDelete,
  onEditStart,
  onEditCancel,
  onSaveEdit,
  onDelete,
}: {
  comment: CommentShape;
  isEditing: boolean;
  canEdit: boolean;
  canDelete: boolean;
  onEditStart: () => void;
  onEditCancel: () => void;
  onSaveEdit: (next: string) => void | Promise<void>;
  onDelete: () => void | Promise<void>;
}) {
  const [editDraft, setEditDraft] = useState(c.content);
  const [menuOpen, setMenuOpen] = useState(false);
  const wasEdited =
    new Date(c.updated_at).getTime() - new Date(c.created_at).getTime() > 2000;

  useEffect(() => {
    setEditDraft(c.content);
  }, [c.content]);

  return (
    <motion.li
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.18 }}
      className="flex gap-3"
    >
      <Avatar
        id={c.author?.id ?? c.author_id}
        avatarUrl={c.author?.avatar_url ?? null}
        fullName={c.author?.full_name ?? null}
        size={32}
        ring={false}
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 mb-1">
          <span
            className="text-[13px] text-[#2D333A]"
            style={{ fontFamily: "var(--font-poppins)", fontWeight: 600 }}
          >
            {c.author?.full_name || "Teammate"}
          </span>
          {c.author?.role && (
            <span
              className="text-[10px] uppercase tracking-wider text-[#6B7280] bg-[#F3F4F6] px-1.5 py-0.5 rounded"
              style={{ fontFamily: "var(--font-poppins)", fontWeight: 600 }}
            >
              {c.author.role}
            </span>
          )}
          <span
            className="text-[11px] text-[#9CA3AF]"
            style={{ fontFamily: "var(--font-source-sans)" }}
          >
            {relativeTime(c.created_at)}
            {wasEdited && " · edited"}
          </span>
          {(canEdit || canDelete) && !isEditing && (
            <div className="ml-auto relative">
              <button
                type="button"
                onClick={() => setMenuOpen((v) => !v)}
                className="size-6 rounded-md flex items-center justify-center text-[#9CA3AF] hover:text-[#2D333A] hover:bg-[#F3F4F6] transition-colors"
                aria-label="Comment actions"
              >
                <MoreHorizontal className="size-3.5" />
              </button>
              {menuOpen && (
                <>
                  <button
                    type="button"
                    aria-hidden="true"
                    className="fixed inset-0 z-10 cursor-default"
                    onClick={() => setMenuOpen(false)}
                  />
                  <div className="absolute right-0 top-7 z-20 min-w-[140px] bg-white border border-[#E5E7EB] rounded-xl shadow-lg overflow-hidden">
                    {canEdit && (
                      <button
                        type="button"
                        onClick={() => {
                          setMenuOpen(false);
                          onEditStart();
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-[13px] text-[#2D333A] hover:bg-[#F4F5F7] text-left"
                        style={{ fontFamily: "var(--font-source-sans)" }}
                      >
                        <Pencil className="size-3.5" />
                        Edit
                      </button>
                    )}
                    {canDelete && (
                      <button
                        type="button"
                        onClick={() => {
                          setMenuOpen(false);
                          onDelete();
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-[13px] text-[#EF4444] hover:bg-[#FEF2F2] text-left"
                        style={{ fontFamily: "var(--font-source-sans)" }}
                      >
                        <Trash2 className="size-3.5" />
                        Delete
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {isEditing ? (
          <div className="space-y-2">
            <MentionInput
              value={editDraft}
              onChange={setEditDraft}
              onSubmit={() => onSaveEdit(editDraft)}
              rows={3}
            />
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onSaveEdit(editDraft)}
                disabled={!editDraft.trim()}
                className="h-7 px-3 rounded-lg bg-[#5CE1A5] text-white text-[12px] font-semibold hover:bg-[#4DD395] disabled:opacity-50 transition-colors"
                style={{ fontFamily: "var(--font-poppins)" }}
              >
                Save
              </button>
              <button
                type="button"
                onClick={onEditCancel}
                className="h-7 px-3 rounded-lg text-[12px] text-[#6B7280] hover:bg-[#F4F5F7] transition-colors"
                style={{ fontFamily: "var(--font-poppins)" }}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <MentionRenderer content={c.content} />
        )}
      </div>
    </motion.li>
  );
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
