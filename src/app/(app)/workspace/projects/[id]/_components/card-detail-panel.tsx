"use client";

import {
  useCallback,
  useEffect,
  useState,
  useTransition,
} from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  ArrowLeft,
  Calendar,
  ChevronDown,
  MoreHorizontal,
  Palette,
  Trash2,
  User,
  X,
} from "lucide-react";
import {
  createCardComment,
  deleteCard,
  deleteCardComment,
  getCard,
  moveCard,
  updateCard,
  updateCardComment,
  type CardDetail,
  type CardLabel,
} from "@/app/actions/boards";
import { searchProfiles } from "@/app/actions/profiles";
import { AttachmentsSection } from "@/components/attachments-section";
import { ChecklistSection } from "./checklist-section";
import { CommentsSection, type CommentShape } from "./comments-section";
import { ActivityLog } from "./activity-log";
import { AssignedLabelsList, LabelsPicker } from "./labels-picker";
import { ManageLabelsModal } from "./manage-labels-modal";

const COVER_OPTIONS: { value: string | null; name: string }[] = [
  { value: null, name: "No color" },
  { value: "#5CE1A5", name: "Mint" },
  { value: "#3B82F6", name: "Blue" },
  { value: "#8B5CF6", name: "Purple" },
  { value: "#F59E0B", name: "Amber" },
  { value: "#F97316", name: "Orange" },
  { value: "#EF4444", name: "Red" },
  { value: "#9CA3AF", name: "Gray" },
];

interface CardDetailPanelProps {
  cardId: string | null;
  onClose: () => void;
  /** Called after a successful save so the parent kanban can patch its
   *  column state. The shape mirrors what the kanban already consumes. */
  onCardChanged?: (patch: {
    id: string;
    title?: string;
    description?: string | null;
    cover_color?: string | null;
    assigned_to?: string | null;
    assignee_full_name?: string | null;
    due_date?: string | null;
    is_completed?: boolean;
    column_id?: string;
    label_count?: number;
    comment_count?: number;
    checklist_completed?: number;
    checklist_total?: number;
  }) => void;
  onCardDeleted?: (cardId: string) => void;
  /** Columns on the board — used by the "Move to…" menu. */
  columns: { id: string; name: string; color: string }[];
  viewerId: string;
  viewerIsAdmin: boolean;
}

export function CardDetailPanel({
  cardId,
  onClose,
  onCardChanged,
  onCardDeleted,
  columns,
  viewerId,
  viewerIsAdmin,
}: CardDetailPanelProps) {
  const [detail, setDetail] = useState<CardDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Inline edit state
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const [editingDescription, setEditingDescription] = useState(false);
  const [descDraft, setDescDraft] = useState("");

  // Sidebar popovers
  const [labelsOpen, setLabelsOpen] = useState(false);
  const [manageLabelsOpen, setManageLabelsOpen] = useState(false);
  const [assigneePickerOpen, setAssigneePickerOpen] = useState(false);
  const [moveMenuOpen, setMoveMenuOpen] = useState(false);
  const [cardMenuOpen, setCardMenuOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [coverOpen, setCoverOpen] = useState(false);

  const [pending, startTransition] = useTransition();

  // Load card whenever cardId changes.
  useEffect(() => {
    if (!cardId) {
      setDetail(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    getCard(cardId).then((res) => {
      if (cancelled) return;
      if (res.success && res.data) {
        setDetail(res.data);
        setTitleDraft(res.data.title);
        setDescDraft(res.data.description ?? "");
      } else {
        setError(res.success ? "Card not found." : res.error);
      }
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [cardId]);

  // Esc closes the panel (when no nested modal/popover is open).
  useEffect(() => {
    if (!cardId) return;
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      if (
        labelsOpen ||
        manageLabelsOpen ||
        assigneePickerOpen ||
        moveMenuOpen ||
        cardMenuOpen ||
        coverOpen ||
        editingTitle ||
        editingDescription
      )
        return;
      onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    cardId,
    onClose,
    labelsOpen,
    manageLabelsOpen,
    assigneePickerOpen,
    moveMenuOpen,
    cardMenuOpen,
    coverOpen,
    editingTitle,
    editingDescription,
  ]);

  const canEdit = !!detail?.viewer_can_edit;

  // Helper that re-emits the changes to the kanban so list rows stay live.
  const emitPatch = useCallback(
    (patch: Parameters<NonNullable<typeof onCardChanged>>[0]) => {
      onCardChanged?.(patch);
    },
    [onCardChanged],
  );

  // ─── Save handlers ──────────────────────────────────────
  function saveTitle() {
    if (!detail) return;
    const trimmed = titleDraft.trim();
    if (!trimmed || trimmed === detail.title) {
      setTitleDraft(detail.title);
      setEditingTitle(false);
      return;
    }
    setDetail({ ...detail, title: trimmed });
    setEditingTitle(false);
    emitPatch({ id: detail.id, title: trimmed });
    startTransition(async () => {
      const res = await updateCard(detail.id, { title: trimmed });
      if (!res.success) {
        console.error("[card-panel] saveTitle:", res.error);
      }
    });
  }

  function saveDescription() {
    if (!detail) return;
    const next = descDraft.trim();
    if ((detail.description ?? "") === next) {
      setEditingDescription(false);
      return;
    }
    setDetail({ ...detail, description: next || null });
    setEditingDescription(false);
    emitPatch({ id: detail.id, description: next || null });
    startTransition(async () => {
      const res = await updateCard(detail.id, { description: next });
      if (!res.success) console.error("[card-panel] saveDescription:", res.error);
    });
  }

  function setAssignee(profileId: string | null, fullName: string | null) {
    if (!detail) return;
    if ((detail.assigned_to ?? null) === profileId) {
      setAssigneePickerOpen(false);
      return;
    }
    setDetail({
      ...detail,
      assigned_to: profileId,
      assignee: profileId
        ? {
            id: profileId,
            full_name: fullName || "Teammate",
            avatar_color: "#5CE1A5",
            avatar_url: null,
            role: null,
          }
        : null,
    });
    setAssigneePickerOpen(false);
    emitPatch({
      id: detail.id,
      assigned_to: profileId,
      assignee_full_name: fullName,
    });
    startTransition(async () => {
      const res = await updateCard(detail.id, { assigned_to: profileId });
      if (!res.success) console.error("[card-panel] setAssignee:", res.error);
    });
  }

  function setDueDate(value: string | null) {
    if (!detail) return;
    const next = value || null;
    if ((detail.due_date ?? null) === next) return;
    setDetail({ ...detail, due_date: next });
    emitPatch({ id: detail.id, due_date: next });
    startTransition(async () => {
      const res = await updateCard(detail.id, { due_date: next });
      if (!res.success) console.error("[card-panel] setDueDate:", res.error);
    });
  }

  function setCover(color: string | null) {
    if (!detail) return;
    setDetail({ ...detail, cover_color: color });
    setCoverOpen(false);
    emitPatch({ id: detail.id, cover_color: color });
    startTransition(async () => {
      const res = await updateCard(detail.id, { cover_color: color });
      if (!res.success) console.error("[card-panel] setCover:", res.error);
    });
  }

  function toggleCompleted() {
    if (!detail) return;
    const next = !detail.is_completed;
    setDetail({ ...detail, is_completed: next });
    emitPatch({ id: detail.id, is_completed: next });
    startTransition(async () => {
      const res = await updateCard(detail.id, { is_completed: next });
      if (!res.success) console.error("[card-panel] toggleCompleted:", res.error);
    });
  }

  function moveToColumn(targetColumnId: string) {
    if (!detail || targetColumnId === detail.column_id) {
      setMoveMenuOpen(false);
      return;
    }
    const target = columns.find((c) => c.id === targetColumnId);
    if (!target) return;
    setDetail({
      ...detail,
      column_id: targetColumnId,
      column: target,
    });
    setMoveMenuOpen(false);
    emitPatch({ id: detail.id, column_id: targetColumnId });
    startTransition(async () => {
      const res = await moveCard(detail.id, targetColumnId, 0);
      if (!res.success) console.error("[card-panel] moveToColumn:", res.error);
    });
  }

  function handleDelete() {
    if (!detail) return;
    startTransition(async () => {
      const res = await deleteCard(detail.id);
      if (!res.success) {
        console.error("[card-panel] delete:", res.error);
        setError(res.error);
        return;
      }
      onCardDeleted?.(detail.id);
      onClose();
    });
  }

  const labelsChange = (next: CardLabel[]) => {
    if (!detail) return;
    setDetail({ ...detail, labels: next });
    emitPatch({ id: detail.id, label_count: next.length });
  };

  const checklistChange = (
    items: { id: string; is_completed: boolean }[],
  ) => {
    if (!detail) return;
    emitPatch({
      id: detail.id,
      checklist_total: items.length,
      checklist_completed: items.filter((i) => i.is_completed).length,
    });
  };

  return (
    <AnimatePresence>
      {cardId && (
        <motion.div
          key="card-panel-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[120] bg-black/30"
          onClick={onClose}
        >
          <motion.aside
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
            className="absolute right-0 top-0 bottom-0 w-full sm:w-[720px] bg-[#F4F5F7] flex flex-col overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Cover bar — animates color */}
            <motion.div
              className="h-1 w-full shrink-0"
              animate={{ backgroundColor: detail?.cover_color ?? "#E5E7EB" }}
              transition={{ duration: 0.25 }}
            />

            {/* Sticky header */}
            <header className="bg-white border-b border-[#E5E7EB] px-4 sm:px-6 py-3 flex items-center gap-3 shrink-0">
              <button
                type="button"
                onClick={onClose}
                className="size-9 rounded-xl flex items-center justify-center text-[#6B7280] hover:text-[#2D333A] hover:bg-[#F4F5F7] transition-colors"
                aria-label="Close (Esc)"
              >
                <ArrowLeft className="size-4" />
              </button>
              <div className="min-w-0 flex-1">
                {detail && (
                  <p
                    className="text-[11px] text-[#9CA3AF] truncate"
                    style={{ fontFamily: "var(--font-source-sans)" }}
                  >
                    {detail.board.name}
                    <span className="mx-1.5 text-[#CBD5E1]">/</span>
                    <span
                      className="inline-flex items-center gap-1.5"
                      style={{ color: detail.column.color }}
                    >
                      <span
                        className="size-1.5 rounded-full"
                        style={{ backgroundColor: detail.column.color }}
                      />
                      {detail.column.name}
                    </span>
                  </p>
                )}
              </div>
              {canEdit && (
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setCardMenuOpen((v) => !v)}
                    className="size-9 rounded-xl flex items-center justify-center text-[#6B7280] hover:text-[#2D333A] hover:bg-[#F4F5F7] transition-colors"
                    aria-label="Card actions"
                  >
                    <MoreHorizontal className="size-4" />
                  </button>
                  {cardMenuOpen && (
                    <>
                      <button
                        type="button"
                        aria-hidden="true"
                        className="fixed inset-0 z-30 cursor-default"
                        onClick={() => setCardMenuOpen(false)}
                      />
                      <div className="absolute right-0 top-10 z-40 min-w-[180px] bg-white border border-[#E5E7EB] rounded-xl shadow-xl overflow-hidden">
                        <button
                          type="button"
                          onClick={() => {
                            setCardMenuOpen(false);
                            setMoveMenuOpen(true);
                          }}
                          className="w-full px-3 py-2 text-left text-[13px] text-[#2D333A] hover:bg-[#F4F5F7] flex items-center gap-2"
                          style={{ fontFamily: "var(--font-source-sans)" }}
                        >
                          <ChevronDown className="size-3.5 -rotate-90" />
                          Move to…
                        </button>
                        <button
                          type="button"
                          disabled
                          className="w-full px-3 py-2 text-left text-[13px] text-[#9CA3AF] cursor-not-allowed flex items-center gap-2"
                          style={{ fontFamily: "var(--font-source-sans)" }}
                          title="Duplicate is coming soon"
                        >
                          Duplicate
                          <span className="ml-auto text-[10px] tracking-wider uppercase">
                            Soon
                          </span>
                        </button>
                        {detail?.viewer_can_delete && (
                          <button
                            type="button"
                            onClick={() => {
                              setCardMenuOpen(false);
                              setConfirmDelete(true);
                            }}
                            className="w-full px-3 py-2 text-left text-[13px] text-[#EF4444] hover:bg-[#FEF2F2] flex items-center gap-2"
                            style={{ fontFamily: "var(--font-source-sans)" }}
                          >
                            <Trash2 className="size-3.5" />
                            Delete card
                          </button>
                        )}
                      </div>
                    </>
                  )}
                  {moveMenuOpen && (
                    <>
                      <button
                        type="button"
                        aria-hidden="true"
                        className="fixed inset-0 z-30 cursor-default"
                        onClick={() => setMoveMenuOpen(false)}
                      />
                      <div className="absolute right-0 top-10 z-40 min-w-[200px] bg-white border border-[#E5E7EB] rounded-xl shadow-xl overflow-hidden">
                        <p
                          className="px-3 py-2 text-[10px] uppercase tracking-wider text-[#9CA3AF] border-b border-[#F1F5F9]"
                          style={{
                            fontFamily: "var(--font-poppins)",
                            fontWeight: 600,
                          }}
                        >
                          Move to
                        </p>
                        {columns.map((c) => (
                          <button
                            key={c.id}
                            type="button"
                            disabled={c.id === detail?.column_id}
                            onClick={() => moveToColumn(c.id)}
                            className="w-full flex items-center gap-2 px-3 py-2 text-left text-[13px] text-[#2D333A] hover:bg-[#F4F5F7] disabled:opacity-50 disabled:cursor-not-allowed"
                            style={{ fontFamily: "var(--font-source-sans)" }}
                          >
                            <span
                              className="size-2 rounded-full"
                              style={{ backgroundColor: c.color }}
                            />
                            {c.name}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}
              <button
                type="button"
                onClick={onClose}
                className="size-9 rounded-xl flex items-center justify-center text-[#9CA3AF] hover:text-[#2D333A] hover:bg-[#F4F5F7] transition-colors"
                aria-label="Close"
              >
                <X className="size-4" />
              </button>
            </header>

            {/* Body */}
            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <div
                  className="p-8 text-center text-[#9CA3AF] text-[14px]"
                  style={{ fontFamily: "var(--font-source-sans)" }}
                >
                  Loading…
                </div>
              ) : error ? (
                <div
                  className="m-6 p-4 rounded-xl bg-red-50 text-red-600 text-[13px]"
                  style={{ fontFamily: "var(--font-source-sans)" }}
                >
                  {error}
                </div>
              ) : detail ? (
                <div className="px-4 sm:px-6 py-5 space-y-5">
                  {/* Title */}
                  {editingTitle ? (
                    <textarea
                      value={titleDraft}
                      autoFocus
                      onChange={(e) => setTitleDraft(e.target.value)}
                      onBlur={saveTitle}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          (e.target as HTMLTextAreaElement).blur();
                        } else if (e.key === "Escape") {
                          setTitleDraft(detail.title);
                          setEditingTitle(false);
                        }
                      }}
                      rows={2}
                      className="w-full text-2xl text-[#0F172A] bg-white border border-[#5CE1A5] rounded-xl px-3 py-2 outline-none resize-none"
                      style={{
                        fontFamily: "var(--font-poppins)",
                        fontWeight: 700,
                      }}
                    />
                  ) : (
                    <h1
                      onClick={() => canEdit && setEditingTitle(true)}
                      className={`text-2xl text-[#0F172A] leading-tight ${
                        canEdit
                          ? "cursor-text hover:bg-white rounded-xl -mx-2 px-2 py-1 transition-colors"
                          : ""
                      }`}
                      style={{
                        fontFamily: "var(--font-poppins)",
                        fontWeight: 700,
                      }}
                    >
                      {detail.title}
                    </h1>
                  )}

                  <div className="grid grid-cols-1 lg:grid-cols-[1fr_240px] gap-5">
                    {/* Main column */}
                    <div className="space-y-4 min-w-0">
                      {/* Description */}
                      <section className="bg-white border border-[#E5E7EB] rounded-2xl p-4">
                        <h3
                          className="text-[11px] uppercase tracking-wider text-[#6B7280] mb-2"
                          style={{
                            fontFamily: "var(--font-poppins)",
                            fontWeight: 600,
                          }}
                        >
                          Description
                        </h3>
                        {editingDescription ? (
                          <div className="space-y-2">
                            <textarea
                              value={descDraft}
                              autoFocus
                              onChange={(e) => setDescDraft(e.target.value)}
                              rows={6}
                              placeholder="Add a description…"
                              className="w-full px-3 py-2 rounded-lg border border-[#E5E7EB] text-[14px] text-[#2D333A] placeholder-[#9CA3AF] outline-none focus:border-[#5CE1A5] resize-none"
                              style={{ fontFamily: "var(--font-source-sans)" }}
                            />
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={saveDescription}
                                className="h-8 px-3 rounded-lg bg-[#5CE1A5] text-white text-[12px] font-semibold hover:bg-[#4DD395] transition-colors"
                                style={{ fontFamily: "var(--font-poppins)" }}
                              >
                                Save
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setDescDraft(detail.description ?? "");
                                  setEditingDescription(false);
                                }}
                                className="h-8 px-3 rounded-lg text-[12px] text-[#6B7280] hover:bg-[#F4F5F7] transition-colors"
                                style={{ fontFamily: "var(--font-poppins)" }}
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button
                            type="button"
                            disabled={!canEdit}
                            onClick={() => canEdit && setEditingDescription(true)}
                            className={`w-full text-left text-[14px] leading-relaxed whitespace-pre-wrap ${
                              detail.description
                                ? "text-[#2D333A]"
                                : "text-[#9CA3AF]"
                            } ${
                              canEdit
                                ? "hover:bg-[#F8FAFC] rounded-lg -mx-2 px-2 py-1 transition-colors"
                                : ""
                            }`}
                            style={{ fontFamily: "var(--font-source-sans)" }}
                          >
                            {detail.description || "Add a description…"}
                          </button>
                        )}
                      </section>

                      <ChecklistSection
                        cardId={detail.id}
                        items={detail.checklist_items}
                        canEdit={canEdit}
                        onItemsChange={checklistChange}
                      />

                      <AttachmentsSection
                        entityType="board_card"
                        entityId={detail.id}
                        canUpload={canEdit}
                      />

                      <ActivityLog entries={detail.activity} />

                      <CommentsSection
                        comments={detail.comments as CommentShape[]}
                        viewerId={viewerId}
                        viewerIsAdmin={viewerIsAdmin}
                        onCreate={async (content) => {
                          const res = await createCardComment(
                            detail.id,
                            content,
                          );
                          return res.success && res.data
                            ? (res.data as CommentShape)
                            : null;
                        }}
                        onUpdate={async (id, content) => {
                          const res = await updateCardComment(id, content);
                          return res.success && res.data
                            ? (res.data as CommentShape)
                            : null;
                        }}
                        onDelete={async (id) => {
                          const res = await deleteCardComment(id);
                          return res.success;
                        }}
                      />
                    </div>

                    {/* Sidebar */}
                    <aside className="space-y-3 min-w-0">
                      <SidebarBlock label="Status">
                        <button
                          type="button"
                          onClick={toggleCompleted}
                          disabled={!canEdit}
                          className={`w-full h-9 px-3 rounded-lg flex items-center gap-2 text-[13px] font-semibold ${
                            detail.is_completed
                              ? "bg-[#D1FAE5] text-[#059669]"
                              : "bg-[#F4F5F7] text-[#2D333A] hover:bg-[#E5E7EB]"
                          } transition-colors disabled:opacity-60`}
                          style={{ fontFamily: "var(--font-poppins)" }}
                        >
                          <span
                            className="size-2 rounded-full"
                            style={{
                              backgroundColor: detail.is_completed
                                ? "#059669"
                                : detail.column.color,
                            }}
                          />
                          {detail.is_completed ? "Completed" : detail.column.name}
                        </button>
                      </SidebarBlock>

                      <SidebarBlock label="Assignee">
                        <div className="relative">
                          <button
                            type="button"
                            disabled={!canEdit}
                            onClick={() => setAssigneePickerOpen((v) => !v)}
                            className="w-full h-9 px-2 rounded-lg flex items-center gap-2 bg-[#F4F5F7] hover:bg-[#E5E7EB] disabled:opacity-60 transition-colors"
                          >
                            {detail.assignee ? (
                              <>
                                <span
                                  className="size-5 rounded-full flex items-center justify-center text-[9px] font-semibold text-[#0F172A] shrink-0"
                                  style={{
                                    backgroundColor:
                                      detail.assignee.avatar_color,
                                  }}
                                >
                                  {initials(detail.assignee.full_name)}
                                </span>
                                <span
                                  className="text-[12.5px] text-[#2D333A] truncate"
                                  style={{
                                    fontFamily: "var(--font-source-sans)",
                                  }}
                                >
                                  {detail.assignee.full_name}
                                </span>
                              </>
                            ) : (
                              <span
                                className="text-[12.5px] text-[#9CA3AF]"
                                style={{
                                  fontFamily: "var(--font-source-sans)",
                                }}
                              >
                                Unassigned
                              </span>
                            )}
                            <User className="size-3.5 text-[#9CA3AF] ml-auto shrink-0" />
                          </button>
                          {assigneePickerOpen && (
                            <AssigneePicker
                              currentId={detail.assigned_to}
                              onPick={(id, name) => setAssignee(id, name)}
                              onClose={() => setAssigneePickerOpen(false)}
                            />
                          )}
                        </div>
                      </SidebarBlock>

                      <SidebarBlock label="Due date">
                        <div className="flex items-center gap-2">
                          <input
                            type="date"
                            value={
                              detail.due_date
                                ? detail.due_date.split("T")[0]
                                : ""
                            }
                            disabled={!canEdit}
                            onChange={(e) =>
                              setDueDate(
                                e.target.value
                                  ? new Date(e.target.value).toISOString()
                                  : null,
                              )
                            }
                            className="flex-1 h-9 px-2 rounded-lg border border-[#E5E7EB] bg-white text-[13px] text-[#2D333A] outline-none focus:border-[#5CE1A5] disabled:opacity-60"
                            style={{ fontFamily: "var(--font-source-sans)" }}
                          />
                          {detail.due_date && canEdit && (
                            <button
                              type="button"
                              onClick={() => setDueDate(null)}
                              className="size-9 rounded-lg flex items-center justify-center text-[#9CA3AF] hover:text-[#EF4444] hover:bg-[#FEF2F2] transition-colors"
                              aria-label="Clear due date"
                            >
                              <X className="size-3.5" />
                            </button>
                          )}
                        </div>
                        {detail.due_date && (
                          <p
                            className={`text-[11px] mt-1.5 ${dueColor(detail.due_date)}`}
                            style={{ fontFamily: "var(--font-source-sans)" }}
                          >
                            <Calendar className="size-3 inline mr-1" />
                            {dueText(detail.due_date)}
                          </p>
                        )}
                      </SidebarBlock>

                      <SidebarBlock label="Labels">
                        <div className="relative">
                          <AssignedLabelsList
                            labels={detail.labels}
                            canEdit={canEdit}
                            onClick={() => setLabelsOpen((v) => !v)}
                          />
                          {labelsOpen && (
                            <LabelsPicker
                              boardId={detail.board_id}
                              cardId={detail.id}
                              assignedLabels={detail.labels}
                              canEdit={canEdit}
                              onChange={labelsChange}
                              onOpenManage={() => setManageLabelsOpen(true)}
                              onClose={() => setLabelsOpen(false)}
                            />
                          )}
                        </div>
                      </SidebarBlock>

                      <SidebarBlock label="Cover color">
                        <div className="relative">
                          <button
                            type="button"
                            disabled={!canEdit}
                            onClick={() => setCoverOpen((v) => !v)}
                            className="w-full h-9 px-2 rounded-lg flex items-center gap-2 bg-[#F4F5F7] hover:bg-[#E5E7EB] disabled:opacity-60 transition-colors"
                          >
                            <span
                              className="size-5 rounded-md"
                              style={{
                                backgroundColor:
                                  detail.cover_color ?? "#F3F4F6",
                                border: detail.cover_color
                                  ? undefined
                                  : "1px dashed #CBD5E1",
                              }}
                            />
                            <span
                              className="text-[12.5px] text-[#2D333A]"
                              style={{
                                fontFamily: "var(--font-source-sans)",
                              }}
                            >
                              {detail.cover_color
                                ? COVER_OPTIONS.find(
                                    (o) => o.value === detail.cover_color,
                                  )?.name ?? "Custom"
                                : "None"}
                            </span>
                            <Palette className="size-3.5 text-[#9CA3AF] ml-auto" />
                          </button>
                          {coverOpen && (
                            <>
                              <button
                                type="button"
                                aria-hidden="true"
                                className="fixed inset-0 z-30 cursor-default"
                                onClick={() => setCoverOpen(false)}
                              />
                              <div className="absolute left-0 right-0 top-full mt-2 z-40 p-2 bg-white border border-[#E5E7EB] rounded-xl shadow-lg flex flex-wrap gap-1.5">
                                {COVER_OPTIONS.map((opt) => {
                                  const selected =
                                    detail.cover_color === opt.value;
                                  return (
                                    <button
                                      key={opt.name}
                                      type="button"
                                      onClick={() => setCover(opt.value)}
                                      className="size-7 rounded-md flex items-center justify-center transition-transform hover:scale-110"
                                      style={{
                                        backgroundColor:
                                          opt.value ?? "transparent",
                                        border:
                                          opt.value === null
                                            ? "1px dashed #CBD5E1"
                                            : undefined,
                                        boxShadow: selected
                                          ? "0 0 0 2px white, 0 0 0 4px #5CE1A5"
                                          : undefined,
                                      }}
                                      aria-label={opt.name}
                                    />
                                  );
                                })}
                              </div>
                            </>
                          )}
                        </div>
                      </SidebarBlock>

                      {detail.creator && (
                        <SidebarBlock label="Created by">
                          <div className="flex items-center gap-2 px-1 py-1.5">
                            <span
                              className="size-5 rounded-full flex items-center justify-center text-[9px] font-semibold text-[#0F172A] shrink-0"
                              style={{
                                backgroundColor: detail.creator.avatar_color,
                              }}
                            >
                              {initials(detail.creator.full_name)}
                            </span>
                            <span
                              className="text-[12.5px] text-[#2D333A] truncate"
                              style={{
                                fontFamily: "var(--font-source-sans)",
                              }}
                            >
                              {detail.creator.full_name}
                            </span>
                            <span
                              className="text-[11px] text-[#9CA3AF] ml-auto"
                              style={{
                                fontFamily: "var(--font-source-sans)",
                              }}
                            >
                              {formatDateShort(detail.created_at)}
                            </span>
                          </div>
                        </SidebarBlock>
                      )}
                    </aside>
                  </div>

                  {/* Delete confirm bar */}
                  <AnimatePresence>
                    {confirmDelete && (
                      <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 8 }}
                        className="fixed bottom-4 right-4 sm:right-6 z-[130] bg-white border border-[#EF4444]/30 rounded-2xl shadow-2xl px-4 py-3 flex items-center gap-3"
                      >
                        <p
                          className="text-[13px] text-[#2D333A]"
                          style={{ fontFamily: "var(--font-source-sans)" }}
                        >
                          Delete this card? This can&rsquo;t be undone.
                        </p>
                        <button
                          type="button"
                          onClick={handleDelete}
                          disabled={pending}
                          className="h-8 px-3 rounded-lg bg-[#EF4444] text-white text-[12px] font-semibold hover:bg-[#DC2626] disabled:opacity-50"
                          style={{ fontFamily: "var(--font-poppins)" }}
                        >
                          {pending ? "Deleting…" : "Delete"}
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDelete(false)}
                          className="h-8 px-3 rounded-lg text-[12px] text-[#6B7280] hover:bg-[#F4F5F7]"
                          style={{ fontFamily: "var(--font-poppins)" }}
                        >
                          Cancel
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ) : null}
            </div>

            <ManageLabelsModal
              open={manageLabelsOpen}
              onClose={() => setManageLabelsOpen(false)}
              boardId={detail?.board_id || ""}
              boardName={detail?.board.name || ""}
              onMutated={() => {
                // Re-fetch the card so assigned labels reflect renames /
                // recolors / removals from the manage modal.
                if (!detail) return;
                getCard(detail.id).then((res) => {
                  if (res.success && res.data) setDetail(res.data);
                });
              }}
            />
          </motion.aside>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ─── Sidebar pieces ───────────────────────────────────────

function SidebarBlock({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p
        className="text-[10px] uppercase tracking-wider text-[#9CA3AF] mb-1.5"
        style={{ fontFamily: "var(--font-poppins)", fontWeight: 600 }}
      >
        {label}
      </p>
      {children}
    </div>
  );
}

// ─── Assignee picker (search dropdown) ─────────────────────

function AssigneePicker({
  currentId,
  onPick,
  onClose,
}: {
  currentId: string | null;
  onPick: (id: string | null, fullName: string | null) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<
    { id: string; full_name: string; email: string | null }[]
  >([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const handle = setTimeout(async () => {
      const res = await searchProfiles(query);
      if (cancelled) return;
      setResults(
        (res.data || []).map((p) => ({
          id: p.id,
          full_name:
            p.full_name || p.email?.split("@")[0] || "Teammate",
          email: p.email,
        })),
      );
      setLoading(false);
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [query]);

  return (
    <>
      <button
        type="button"
        aria-hidden="true"
        className="fixed inset-0 z-30 cursor-default"
        onClick={onClose}
      />
      <div className="absolute right-0 top-full mt-2 z-40 w-64 bg-white border border-[#E5E7EB] rounded-xl shadow-xl overflow-hidden">
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search teammates"
          className="w-full h-9 px-3 border-b border-[#F1F5F9] text-[13px] outline-none"
          style={{ fontFamily: "var(--font-source-sans)" }}
        />
        <div className="max-h-60 overflow-auto py-1">
          <button
            type="button"
            onClick={() => onPick(null, null)}
            className={`w-full flex items-center gap-2 px-3 py-2 text-left text-[13px] hover:bg-[#F4F5F7] ${
              !currentId ? "bg-[#F4F5F7]" : ""
            }`}
            style={{ fontFamily: "var(--font-source-sans)" }}
          >
            <span className="size-5 rounded-full bg-[#F3F4F6] border border-dashed border-[#CBD5E1]" />
            Unassign
          </button>
          {loading ? (
            <p
              className="px-3 py-2 text-[12px] text-[#9CA3AF]"
              style={{ fontFamily: "var(--font-source-sans)" }}
            >
              Searching…
            </p>
          ) : (
            results.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => onPick(r.id, r.full_name)}
                className={`w-full flex items-center gap-2 px-3 py-2 text-left text-[13px] hover:bg-[#F4F5F7] ${
                  r.id === currentId ? "bg-[#F4F5F7]" : ""
                }`}
                style={{ fontFamily: "var(--font-source-sans)" }}
              >
                <span
                  className="size-5 rounded-full flex items-center justify-center text-[9px] font-semibold text-[#0F172A]"
                  style={{ backgroundColor: "#5CE1A5" }}
                >
                  {initials(r.full_name)}
                </span>
                <span className="truncate">{r.full_name}</span>
              </button>
            ))
          )}
        </div>
      </div>
    </>
  );
}

// ─── Tiny utilities ──────────────────────────────────────

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

function dueColor(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(d);
  due.setHours(0, 0, 0, 0);
  if (due < today) return "text-[#EF4444]";
  if (due.getTime() === today.getTime()) return "text-[#F59E0B]";
  return "text-[#6B7280]";
}

function dueText(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(d);
  due.setHours(0, 0, 0, 0);
  if (due < today) return `Overdue — ${formatDateShort(iso)}`;
  if (due.getTime() === today.getTime()) return "Due today";
  return formatDateShort(iso);
}

function formatDateShort(iso: string): string {
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

