"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  horizontalListSortingStrategy,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { motion, AnimatePresence } from "motion/react";
import {
  createColumn,
  deleteColumn,
  moveCard,
  reorderCardsInColumn,
  reorderColumns,
  updateColumn,
  updateCard,
} from "@/app/actions/boards";
import { Calendar, ExternalLink, Pencil, Check } from "lucide-react";
import type {
  BoardCardWithMeta,
  BoardColumnWithCards,
  BoardDetail,
} from "@/app/actions/boards";
import type { Role } from "@/lib/permissions";
import { BoardDetailHeader } from "./board-detail-header";
import { KanbanColumn, StaticKanbanColumn } from "./kanban-column";
import { KanbanCard } from "./kanban-card";
import { QuickAddCardModal } from "./quick-add-card-modal";
import { EditCardModal } from "./edit-card-modal";
import { AddColumnInput } from "./add-column-input";

interface BoardViewProps {
  board: BoardDetail;
  viewerRole: Role;
  viewerId: string;
  orgProfiles: { id: string; full_name: string }[];
}

type ActiveDrag =
  | { type: "card"; card: BoardCardWithMeta }
  | { type: "column"; column: BoardColumnWithCards }
  | null;

export type SortOption = "manual" | "priority" | "due_nearest" | "due_furthest";

// Priority score helper (0 is highest, 4 is lowest)
function getPriorityScore(card: BoardCardWithMeta): number {
  if (card.is_completed) return 4;
  if (!card.due_date) return 3;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const due = new Date(card.due_date);
  const dueDay = new Date(due.getFullYear(), due.getMonth(), due.getDate());
  const diff = Math.round((dueDay.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
  if (diff < 0) return 0; // Overdue / High
  if (diff <= 1) return 1; // Med
  return 3; // Low
}

export function BoardView({
  board,
  viewerRole,
  viewerId,
  orgProfiles,
}: BoardViewProps) {
  void viewerRole;

  const [columns, setColumns] = useState<BoardColumnWithCards[]>(
    () => sortByPosition(board.columns),
  );

  useEffect(() => {
    setColumns(sortByPosition(board.columns));
  }, [board.columns]);

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const [active, setActive] = useState<ActiveDrag>(null);
  const [adding, setAdding] = useState<{ columnId: string | null }>({ columnId: null });
  const [editingCardId, setEditingCardId] = useState<string | null>(null);
  const [showAddColumn, setShowAddColumn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const errorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // --- NEW: Filter & Sort State ---
  const [activeSort, setActiveSort] = useState<SortOption>("manual");
  const [activeAssigneeTop, setActiveAssigneeTop] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [activeTab, setActiveTab] = useState<"board" | "overview">("board");

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function showError(msg: string) {
    if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
    setError(msg);
    errorTimerRef.current = setTimeout(() => setError(null), 4000);
  }

  const findColumnByCardId = useCallback(
    (cardId: string): BoardColumnWithCards | undefined => {
      return columns.find((c) => c.cards.some((card) => card.id === cardId));
    },
    [columns],
  );

  function isColumnDragId(id: string) { return id.startsWith("column-"); }
  function columnIdFromDragId(id: string) { return id.startsWith("column-") ? id.slice("column-".length) : id; }

  // ─── Drag handlers (unchanged) ────────────────────────────────────────
  function handleDragStart(event: DragStartEvent) {
    const dragId = String(event.active.id);
    if (isColumnDragId(dragId)) {
      const colId = columnIdFromDragId(dragId);
      const col = columns.find((c) => c.id === colId);
      if (col) setActive({ type: "column", column: col });
    } else {
      const col = findColumnByCardId(dragId);
      const card = col?.cards.find((c) => c.id === dragId);
      if (card) setActive({ type: "card", card });
    }
  }

  function handleDragOver(event: DragOverEvent) {
    const { active, over } = event;
    if (!over) return;
    const activeId = String(active.id);
    const overId = String(over.id);
    if (activeId === overId) return;
    if (isColumnDragId(activeId)) return;

    const sourceCol = findColumnByCardId(activeId);
    if (!sourceCol) return;

    let targetColumnId: string | null = null;
    if (isColumnDragId(overId)) targetColumnId = columnIdFromDragId(overId);
    else if (overId.startsWith("column-drop-")) targetColumnId = overId.slice("column-drop-".length);
    else {
      const overCol = columns.find((c) => c.cards.some((card) => card.id === overId));
      targetColumnId = overCol?.id ?? null;
    }
    if (!targetColumnId || targetColumnId === sourceCol.id) return;

    setColumns((prev) => {
      const sourceIdx = prev.findIndex((c) => c.id === sourceCol.id);
      const targetIdx = prev.findIndex((c) => c.id === targetColumnId);
      if (sourceIdx < 0 || targetIdx < 0) return prev;

      const sourceCards = [...prev[sourceIdx].cards];
      const movingIdx = sourceCards.findIndex((c) => c.id === activeId);
      if (movingIdx < 0) return prev;
      const [moving] = sourceCards.splice(movingIdx, 1);

      const targetCards = [...prev[targetIdx].cards];
      let insertAt = targetCards.length;
      if (!isColumnDragId(overId) && !overId.startsWith("column-drop-")) {
        const overIdx = targetCards.findIndex((c) => c.id === overId);
        if (overIdx >= 0) insertAt = overIdx;
      }
      targetCards.splice(insertAt, 0, { ...moving, column_id: targetColumnId });

      const next = [...prev];
      next[sourceIdx] = { ...prev[sourceIdx], cards: sourceCards };
      next[targetIdx] = { ...prev[targetIdx], cards: targetCards };
      return next;
    });
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active: a, over } = event;
    setActive(null);
    if (!over) return;
    const activeId = String(a.id);
    const overId = String(over.id);

    if (isColumnDragId(activeId)) {
      const sourceColId = columnIdFromDragId(activeId);
      const targetColId = isColumnDragId(overId) ? columnIdFromDragId(overId) : null;
      if (!targetColId || sourceColId === targetColId) return;

      const oldOrder = columns.map((c) => c.id);
      const fromIdx = oldOrder.indexOf(sourceColId);
      const toIdx = oldOrder.indexOf(targetColId);
      if (fromIdx < 0 || toIdx < 0) return;

      const newOrder = [...oldOrder];
      newOrder.splice(fromIdx, 1);
      newOrder.splice(toIdx, 0, sourceColId);

      setColumns((prev) => {
        const byId = new Map(prev.map((c) => [c.id, c]));
        return newOrder.map((id, idx) => {
            const c = byId.get(id);
            return c ? { ...c, position: idx } : null;
          }).filter((x): x is BoardColumnWithCards => x !== null);
      });

      const result = await reorderColumns(board.id, newOrder);
      if (!result.success) {
        showError(`Couldn't save column order: ${result.error}`);
        setColumns((prev) => {
          const byId = new Map(prev.map((c) => [c.id, c]));
          return oldOrder.map((id, idx) => {
              const c = byId.get(id);
              return c ? { ...c, position: idx } : null;
            }).filter((x): x is BoardColumnWithCards => x !== null);
        });
      }
      return;
    }

    const targetCol = findColumnByCardId(activeId);
    if (!targetCol) return;

    const cardIdsInTarget = targetCol.cards.map((c) => c.id);
    const newPosition = cardIdsInTarget.indexOf(activeId);

    const move = await moveCard(activeId, targetCol.id, newPosition);
    if (!move.success) {
      showError(`Couldn't save card move: ${move.error}`);
      return;
    }
    for (const col of columns) {
      const ids = col.cards.map((c) => c.id);
      if (ids.length > 0) await reorderCardsInColumn(col.id, ids);
    }
  }

  // ─── Column & Card actions (unchanged) ───────────────────────────────────────
  async function handleAddColumn(name: string) {
    setShowAddColumn(false);
    const result = await createColumn(board.id, { name });
    if (!result.success) { showError(result.error); return; }
    if (result.data) setColumns((prev) => [...prev, result.data!]);
  }

  async function handleRenameColumn(columnId: string, name: string) {
    const previous = columns;
    setColumns((prev) => prev.map((c) => (c.id === columnId ? { ...c, name } : c)));
    const result = await updateColumn(columnId, { name });
    if (!result.success) { showError(result.error); setColumns(previous); }
  }

  async function handleChangeColumnColor(columnId: string, color: string) {
    const previous = columns;
    setColumns((prev) => prev.map((c) => (c.id === columnId ? { ...c, color } : c)));
    const result = await updateColumn(columnId, { color });
    if (!result.success) { showError(result.error); setColumns(previous); }
  }

  async function handleDeleteColumn(columnId: string) {
    const col = columns.find((c) => c.id === columnId);
    if (!col) return;
    if (col.cards.length > 0) {
      const ok = window.confirm(`"${col.name}" has ${col.cards.length} cards. Delete the column and all of its cards?`);
      if (!ok) return;
    }
    const previous = columns;
    setColumns((prev) => prev.filter((c) => c.id !== columnId));
    const result = await deleteColumn(columnId);
    if (!result.success) { showError(result.error); setColumns(previous); }
  }

  function handleCardCreated(columnId: string, card: BoardCardWithMeta) {
    setColumns((prev) => prev.map((c) => c.id === columnId ? { ...c, cards: [...c.cards, card] } : c));
  }

  function handleCardUpdated(updatedCard: BoardCardWithMeta) {
    setColumns((prev) => prev.map((col) => {
        if (col.id === updatedCard.column_id) {
          return { ...col, cards: col.cards.map((card) => card.id === updatedCard.id ? updatedCard : card) };
        }
        return col;
      })
    );
  }

  async function handleToggleComplete(cardId: string, isCompleted: boolean) {
    setColumns((prev) => prev.map((col) => ({ ...col, cards: col.cards.map((card) => card.id === cardId ? { ...card, is_completed: isCompleted } : card) })));
    const result = await updateCard(cardId, { is_completed: isCompleted });
    if (!result.success) showError(result.error);
  }

  // --- NEW: Visual sorting logic ---
  const displayColumns = useMemo(() => {
    if (activeSort === "manual" && !activeAssigneeTop) return columns;

    return columns.map((col) => {
      const sortedCards = [...col.cards].sort((a, b) => {
        // 1. Assignee override (bring chosen to top)
        if (activeAssigneeTop) {
          const aMatch = a.assigned_to === activeAssigneeTop;
          const bMatch = b.assigned_to === activeAssigneeTop;
          if (aMatch && !bMatch) return -1;
          if (!aMatch && bMatch) return 1;
        }

        // 2. Active Sort
        if (activeSort === "priority") {
          return getPriorityScore(a) - getPriorityScore(b);
        } else if (activeSort === "due_nearest") {
          if (!a.due_date && !b.due_date) return 0;
          if (!a.due_date) return 1; // No due date always pushed to bottom
          if (!b.due_date) return -1;
          return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
        } else if (activeSort === "due_furthest") {
          if (!a.due_date && !b.due_date) return 0;
          if (!a.due_date) return 1; // No due date always pushed to bottom
          if (!b.due_date) return -1;
          return new Date(b.due_date).getTime() - new Date(a.due_date).getTime();
        }
        return 0; // Fallback to manual order
      });
      return { ...col, cards: sortedCards };
    });
  }, [columns, activeSort, activeAssigneeTop]);

  const columnIdsForSortable = useMemo(() => displayColumns.map((c) => `column-${c.id}`), [displayColumns]);

  const editingCard = useMemo(() => {
    if (!editingCardId) return null;
    for (const col of columns) {
      const card = col.cards.find(c => c.id === editingCardId);
      if (card) return card;
    }
    return null;
  }, [editingCardId, columns]);

  return (
    <div className="flex flex-col h-full">
      <BoardDetailHeader
        board={{ ...board, columns: displayColumns }} // Pass the sorted columns
        activeSort={activeSort}
        setActiveSort={setActiveSort}
        activeAssigneeTop={activeAssigneeTop}
        setActiveAssigneeTop={setActiveAssigneeTop}
        viewMode={viewMode}
        setViewMode={setViewMode}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onAddColumn={() => setShowAddColumn(true)}
        onNewTask={() => {
          if (displayColumns.length === 0) {
            setShowAddColumn(true);
            return;
          }
          setAdding({ columnId: displayColumns[0].id });
        }}
      />

      <div className="block relative">
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.15 }}
              className="absolute left-0 right-0 -top-3 mx-auto max-w-md rounded-xl border border-red-200 bg-red-50 px-3 py-2 z-20 text-[12px] text-red-700"
              style={{ fontFamily: "var(--font-source-sans)" }}
              role="status"
            >
              {error}
            </motion.div>
          )}
        </AnimatePresence>

        {activeTab === "overview" ? (
          <BoardOverview board={board} />
        ) : displayColumns.length === 0 ? (
          <EmptyBoardState canEdit={board.viewer_can_edit} onAdd={() => setShowAddColumn(true)} />
        ) : !mounted ? (
          <div className={viewMode === "list" ? "flex flex-col pb-8 w-full max-w-6xl" : "flex items-start gap-4 overflow-x-auto pb-4 -mx-2 px-2"}>
            {viewMode === "list" && displayColumns.length > 0 && (
              <div className="hidden lg:flex items-center px-4 py-2 text-[10px] font-bold text-[#9CA3AF] uppercase tracking-[0.08em] border-b border-[#E5E7EB] mb-4">
                <div className="w-12 shrink-0"></div>
                <div className="w-[100px] shrink-0">Priority</div>
                <div className="flex-1 min-w-0">Task</div>
                <div className="w-[140px] shrink-0">Status</div>
                <div className="w-[120px] shrink-0">Assignees</div>
                <div className="w-[100px] shrink-0">Due</div>
                <div className="w-[100px] shrink-0">Activity</div>
              </div>
            )}
            {displayColumns.map((col) => (
              <div key={col.id} className={viewMode === "list" ? "w-full" : "shrink-0"}>
                <StaticKanbanColumn
                  column={col}
                  canEdit={board.viewer_can_edit}
                  onEditCard={board.viewer_can_edit ? setEditingCardId : undefined}
                  onToggleComplete={board.viewer_can_edit ? handleToggleComplete : undefined}
                  viewMode={viewMode}
                />
              </div>
            ))}
            {board.viewer_can_edit && (
              <div
                className={`shrink-0 h-12 self-start mt-1 inline-flex items-center justify-center gap-1.5 rounded-xl border border-dashed border-[#CBD5E1] text-[13px] text-[#64748B] ${viewMode === "list" ? "w-full" : "w-[320px]"}`}
                style={{ fontFamily: "var(--font-poppins)", fontWeight: 600 }}
              >
                {viewMode === "list" ? "+ Add group" : "+ Add column"}
              </div>
            )}
          </div>
        ) : (
          <DndContext
            id="board-dnd"
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
            onDragCancel={() => setActive(null)}
          >
            <SortableContext items={columnIdsForSortable} strategy={horizontalListSortingStrategy}>
              <div className={viewMode === "list" ? "flex flex-col pb-8 w-full max-w-6xl" : "flex items-start gap-4 overflow-x-auto pb-4 -mx-2 px-2"}>
                {viewMode === "list" && displayColumns.length > 0 && (
                  <div className="hidden lg:flex items-center px-4 py-2 text-[10px] font-bold text-[#9CA3AF] uppercase tracking-[0.08em] border-b border-[#E5E7EB] mb-2">
                    <div className="w-12 shrink-0"></div>
                    <div className="w-[100px] shrink-0">Priority</div>
                    <div className="flex-1 min-w-0">Task</div>
                    <div className="w-[140px] shrink-0">Status</div>
                    <div className="w-[120px] shrink-0">Assignees</div>
                    <div className="w-[100px] shrink-0">Due</div>
                    <div className="w-[100px] shrink-0">Activity</div>
                  </div>
                )}
                <AnimatePresence initial={false}>
                  {displayColumns.map((col) => (
                    <motion.div
                      key={col.id}
                      layout
                      className={viewMode === "list" ? "w-full" : "shrink-0"} // <-- THIS FIXES PROBLEM 3!
                      initial={{ opacity: 0, x: 16 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ duration: 0.22, ease: [0.23, 1, 0.32, 1] }}
                    >
                      <KanbanColumn
                        column={col}
                        canEdit={board.viewer_can_edit}
                        onAddCard={(id) => setAdding({ columnId: id })}
                        onRename={handleRenameColumn}
                        onChangeColor={handleChangeColumnColor}
                        onDelete={handleDeleteColumn}
                        onEditCard={board.viewer_can_edit ? setEditingCardId : undefined}
                        onToggleComplete={board.viewer_can_edit ? handleToggleComplete : undefined}
                        viewMode={viewMode}
                      />
                    </motion.div>
                  ))}
                </AnimatePresence>

                {board.viewer_can_edit && (
                  <AddColumnInput
                    active={showAddColumn}
                    onActivate={() => setShowAddColumn(true)}
                    onCancel={() => setShowAddColumn(false)}
                    onSubmit={handleAddColumn}
                    viewMode={viewMode}
                  />
                )}
              </div>
            </SortableContext>

            <DragOverlay>
              {active?.type === "card" && <KanbanCard card={active.card} isOverlay viewMode={viewMode} columnName="Dragging..." columnColor="#9CA3AF" />}
              {active?.type === "column" && (
                <KanbanColumn column={active.column} canEdit={false} onAddCard={() => {}} onRename={() => {}} onChangeColor={() => {}} onDelete={() => {}} isOverlay viewMode={viewMode} />
              )}
            </DragOverlay>
          </DndContext>
        )}
      </div>

      <QuickAddCardModal
        open={!!adding.columnId}
        onClose={() => setAdding({ columnId: null })}
        columnId={adding.columnId}
        columns={columns.map(c => ({ id: c.id, name: c.name }))}
        orgProfiles={orgProfiles}
        defaultAssigneeId={viewerId}
        onCreated={handleCardCreated}
      />

      <EditCardModal
        open={!!editingCardId}
        onClose={() => setEditingCardId(null)}
        card={editingCard}
        orgProfiles={orgProfiles}
        onUpdated={handleCardUpdated}
      />
    </div>
  );
}

function sortByPosition(columns: BoardColumnWithCards[]): BoardColumnWithCards[] {
  return [...columns]
    .sort((a, b) => a.position - b.position)
    .map((c) => ({
      ...c,
      cards: [...c.cards].sort((a, b) => a.position - b.position),
    }));
}

function EmptyBoardState({ canEdit, onAdd }: { canEdit: boolean; onAdd: () => void }) {
  return (
    <div className="flex flex-col items-center text-center py-16 bg-white rounded-2xl border border-[#E5E7EB]">
      <p
        className="text-[10px] uppercase tracking-[0.1em] text-[#9CA3AF] mb-2"
        style={{ fontFamily: "var(--font-poppins)", fontWeight: 600 }}
      >
        Empty board
      </p>
      <h2
        className="text-[#2D333A] text-xl mb-2"
        style={{ fontFamily: "var(--font-poppins)", fontWeight: 700 }}
      >
        No columns yet
      </h2>
      <p
        className="text-[14px] text-[#6B7280] max-w-md mb-6"
        style={{ fontFamily: "var(--font-source-sans)" }}
      >
        Add your first column to get this board moving — like &ldquo;To Do&rdquo;,
        &ldquo;In Progress&rdquo;, and &ldquo;Done&rdquo;.
      </p>
      {canEdit && (
        <button
          type="button"
          onClick={onAdd}
          className="inline-flex items-center gap-1.5 h-10 px-4 rounded-xl bg-[#5CE1A5] text-[#060C09] text-[13px] font-semibold hover:shadow-md transition-all"
          style={{ fontFamily: "var(--font-poppins)" }}
        >
          Add Column
        </button>
      )}
    </div>
  );
}
// ─── Overview Tab Component ─────────────────────────────
function BoardOverview({ board }: { board: BoardDetail }) {
  // Local UI state for inline editing
  const [isEditing, setIsEditing] = useState(false);
  const [description, setDescription] = useState(board.description || "");
  const [draft, setDraft] = useState(description);

  const handleSave = () => {
    setDescription(draft);
    setIsEditing(false);
    // (Backend Dev will add the save-to-database function here in Phase 3)
  };

  const handleCancel = () => {
    setDraft(description);
    setIsEditing(false);
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="flex flex-col lg:flex-row gap-8 w-full max-w-6xl pb-12"
    >
      {/* Left Column: Project Brief */}
      <div className="w-full lg:w-3/4 min-w-0 space-y-6">
        <section className="bg-white rounded-2xl border border-[#E5E7EB] p-8 shadow-sm transition-all">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[18px] text-[#0F172A]" style={{ fontFamily: "var(--font-poppins)", fontWeight: 700 }}>Project Brief</h2>
            
            {/* The Edit Button */}
            {board.viewer_can_edit && !isEditing && (
              <button
                onClick={() => setIsEditing(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold text-[#6B7280] hover:bg-[#F4F5F7] hover:text-[#0F172A] transition-colors"
                style={{ fontFamily: "var(--font-poppins)" }}
              >
                <Pencil className="size-3.5" /> Edit
              </button>
            )}
          </div>

          {/* Conditional Rendering: Edit Mode vs View Mode */}
          {isEditing ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
              <textarea
                autoFocus
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="What is the vision and goals for this project?"
                rows={5}
                className="w-full p-3.5 rounded-xl border border-[#5CE1A5] bg-white text-[14px] text-[#2D333A] placeholder-[#9CA3AF] outline-none shadow-[0_0_0_4px_rgba(92,225,165,0.1)] transition-all resize-y"
                style={{ fontFamily: "var(--font-source-sans)" }}
              />
              <div className="flex items-center justify-end gap-2">
                <button
                  onClick={handleCancel}
                  className="h-8 px-4 rounded-lg text-[12px] font-semibold text-[#6B7280] hover:bg-[#F4F5F7] hover:text-[#2D333A] transition-colors"
                  style={{ fontFamily: "var(--font-poppins)" }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  className="inline-flex items-center gap-1.5 h-8 px-4 rounded-lg bg-[#5CE1A5] text-[#060C09] text-[12px] font-semibold hover:shadow-md transition-all"
                  style={{ fontFamily: "var(--font-poppins)" }}
                >
                  <Check className="size-3.5" /> Save
                </button>
              </div>
            </motion.div>
          ) : (
            <div className="text-[14px] text-[#475569] leading-relaxed space-y-4" style={{ fontFamily: "var(--font-source-sans)" }}>
              {description ? (
                <p className="whitespace-pre-wrap">{description}</p>
              ) : (
                <p className="text-[#9CA3AF] italic">No description provided for this project yet.</p>
              )}
              
              {/* Keeping the placeholder formatting just so it still looks rich */}
              <h3 className="text-[#2D333A] font-semibold mt-6 mb-2 text-[15px]">Project Goals</h3>
              <ul className="list-disc pl-5 space-y-1.5 marker:text-[#5CE1A5]">
                <li>Coordinate all volunteer teams efficiently.</li>
                <li>Deliver final graphics 2 weeks before the main event.</li>
                <li>Ensure the service flow is reviewed and approved by stakeholders.</li>
              </ul>
            </div>
          )}
        </section>

        <section className="bg-white rounded-2xl border border-[#E5E7EB] p-8 shadow-sm">
          <h2 className="text-[18px] text-[#0F172A] mb-4" style={{ fontFamily: "var(--font-poppins)", fontWeight: 700 }}>Recent Activity</h2>
          <div className="flex flex-col items-center justify-center py-10 border-2 border-dashed border-[#E5E7EB] rounded-xl bg-[#F8FAFC]">
            <p className="text-[13px] text-[#9CA3AF] font-medium" style={{ fontFamily: "var(--font-poppins)" }}>Activity feed coming in Phase 3</p>
          </div>
        </section>
      </div>

      {/* Right Sidebar: Meta Data */}
      <div className="w-full lg:w-1/4 shrink-0 space-y-6">
        <section className="bg-white rounded-2xl border border-[#E5E7EB] p-6 shadow-sm">
          <h3 className="text-[11px] uppercase tracking-[0.1em] text-[#9CA3AF] mb-5" style={{ fontFamily: "var(--font-poppins)", fontWeight: 700 }}>Project Details</h3>
          
          <div className="space-y-6">
            <div>
              <p className="text-[11px] uppercase tracking-[0.06em] text-[#9CA3AF] mb-2" style={{ fontFamily: "var(--font-poppins)", fontWeight: 600 }}>Team Members</p>
              <div className="flex items-center gap-2 flex-wrap">
                 {board.members.length > 0 ? board.members.map(m => (
                   <div key={m.profile_id} className="flex items-center gap-2 bg-[#F8FAFC] border border-[#E5E7EB] rounded-full px-2 py-1 shadow-sm transition-colors hover:border-[#5CE1A5] cursor-pointer">
                      <span className="size-5 rounded-full text-white flex items-center justify-center text-[9px]" style={{ fontFamily: "var(--font-poppins)", fontWeight: 600, backgroundColor: "#5CE1A5" }}>
                        {m.full_name.slice(0,2).toUpperCase()}
                      </span>
                      <span className="text-[12px] text-[#475569] pr-1" style={{ fontFamily: "var(--font-source-sans)", fontWeight: 600 }}>{m.full_name.split(' ')[0]}</span>
                   </div>
                 )) : <span className="text-[13px] text-[#9CA3AF]" style={{ fontFamily: "var(--font-source-sans)" }}>No members yet</span>}
              </div>
            </div>

            <div className="border-t border-[#F1F5F9] pt-5">
               <p className="text-[11px] uppercase tracking-[0.06em] text-[#9CA3AF] mb-2" style={{ fontFamily: "var(--font-poppins)", fontWeight: 600 }}>Key Dates</p>
               <div className="flex items-center gap-2 text-[13px] text-[#2D333A] bg-[#F8FAFC] p-2.5 rounded-lg border border-[#E5E7EB]" style={{ fontFamily: "var(--font-source-sans)", fontWeight: 600 }}>
                 <Calendar className="size-4 text-[#5CE1A5]" /> Target Launch: TBD
               </div>
            </div>

            <div className="border-t border-[#F1F5F9] pt-5">
               <p className="text-[11px] uppercase tracking-[0.06em] text-[#9CA3AF] mb-2" style={{ fontFamily: "var(--font-poppins)", fontWeight: 600 }}>Quick Links</p>
               <div className="flex flex-col gap-2">
                  <button className="flex items-center gap-2 text-[13px] text-[#475569] hover:text-[#5CE1A5] transition-colors p-2 rounded-lg hover:bg-[#F0FDF4] border border-transparent hover:border-[#5CE1A5]/30 group" style={{ fontFamily: "var(--font-source-sans)", fontWeight: 600 }}>
                    <ExternalLink className="size-3.5 text-[#9CA3AF] group-hover:text-[#5CE1A5]" /> Google Drive Assets
                  </button>
                  <button className="flex items-center gap-2 text-[13px] text-[#475569] hover:text-[#5CE1A5] transition-colors p-2 rounded-lg hover:bg-[#F0FDF4] border border-transparent hover:border-[#5CE1A5]/30 group" style={{ fontFamily: "var(--font-source-sans)", fontWeight: 600 }}>
                    <ExternalLink className="size-3.5 text-[#9CA3AF] group-hover:text-[#5CE1A5]" /> Planning Center Event
                  </button>
               </div>
            </div>
          </div>
        </section>
      </div>
    </motion.div>
  );
}