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
} from "@/app/actions/boards";
import type {
  BoardCardWithMeta,
  BoardColumnWithCards,
  BoardDetail,
} from "@/app/actions/boards";
import type { Role } from "@/lib/permissions";
import { BoardDetailHeader } from "./board-detail-header";
import { KanbanColumn } from "./kanban-column";
import { KanbanCard } from "./kanban-card";
import { AddColumnInput } from "./add-column-input";
import { QuickAddCardModal } from "./quick-add-card-modal";

interface BoardViewProps {
  board: BoardDetail;
  viewerRole: Role;
  viewerId: string;
  orgProfiles: { id: string; full_name: string }[];
}

// Tracks what's being dragged so DragOverlay can render the right preview.
type ActiveDrag =
  | { type: "card"; card: BoardCardWithMeta }
  | { type: "column"; column: BoardColumnWithCards }
  | null;

export function BoardView({
  board,
  viewerRole,
  viewerId,
  orgProfiles,
}: BoardViewProps) {
  // We void unused params instead of dropping them — keeps the props stable
  // when Phase 3 wires per-card permissions / role-based UI.
  void viewerRole;

  const [columns, setColumns] = useState<BoardColumnWithCards[]>(
    () => sortByPosition(board.columns),
  );
  // Re-sync when the server props change (e.g. after revalidatePath on
  // navigation). Lets the page hydrate correctly without local state going
  // stale across route refreshes.
  useEffect(() => {
    setColumns(sortByPosition(board.columns));
  }, [board.columns]);

  const [active, setActive] = useState<ActiveDrag>(null);
  const [adding, setAdding] = useState<{ columnId: string | null }>({
    columnId: null,
  });
  const [showAddColumn, setShowAddColumn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const errorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 4 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  function showError(msg: string) {
    if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
    setError(msg);
    errorTimerRef.current = setTimeout(() => setError(null), 4000);
  }

  // ─── Helpers ──────────────────────────────────────────────
  const findColumnByCardId = useCallback(
    (cardId: string): BoardColumnWithCards | undefined => {
      return columns.find((c) => c.cards.some((card) => card.id === cardId));
    },
    [columns],
  );

  // The DnD ID space:
  //  - cards use their raw card.id (UUID — won't collide with column ids)
  //  - columns are wrapped as `column-${id}` to make their drag origin
  //    unambiguous to the resolver.
  function isColumnDragId(id: string) {
    return id.startsWith("column-");
  }
  function columnIdFromDragId(id: string) {
    return id.startsWith("column-") ? id.slice("column-".length) : id;
  }

  // ─── Drag handlers ────────────────────────────────────────
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
    if (isColumnDragId(activeId)) return; // column reorder is handled at end

    // Card drag — only act if it's hovering over a different column.
    const sourceCol = findColumnByCardId(activeId);
    if (!sourceCol) return;

    let targetColumnId: string | null = null;
    if (isColumnDragId(overId)) {
      targetColumnId = columnIdFromDragId(overId);
    } else if (overId.startsWith("column-drop-")) {
      targetColumnId = overId.slice("column-drop-".length);
    } else {
      // Hovering over another card — its column is the target.
      const overCol = columns.find((c) =>
        c.cards.some((card) => card.id === overId),
      );
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
      // Where in the target column to insert. If hovering over a specific
      // card, insert above it; otherwise append.
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

    // ── Column reorder ──
    if (isColumnDragId(activeId)) {
      const sourceColId = columnIdFromDragId(activeId);
      const targetColId = isColumnDragId(overId)
        ? columnIdFromDragId(overId)
        : null;
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
        return newOrder
          .map((id, idx) => {
            const c = byId.get(id);
            return c ? { ...c, position: idx } : null;
          })
          .filter((x): x is BoardColumnWithCards => x !== null);
      });

      const result = await reorderColumns(board.id, newOrder);
      if (!result.success) {
        showError(`Couldn't save column order: ${result.error}`);
        // Revert by reverting to the original order.
        setColumns((prev) => {
          const byId = new Map(prev.map((c) => [c.id, c]));
          return oldOrder
            .map((id, idx) => {
              const c = byId.get(id);
              return c ? { ...c, position: idx } : null;
            })
            .filter((x): x is BoardColumnWithCards => x !== null);
        });
      }
      return;
    }

    // ── Card drag ──
    // We've already optimistically updated state during dragOver. Now persist.
    const targetCol = findColumnByCardId(activeId);
    if (!targetCol) return;

    const cardIdsInTarget = targetCol.cards.map((c) => c.id);
    const newPosition = cardIdsInTarget.indexOf(activeId);

    // Persist the move + position. moveCard updates the card's column_id
    // and position. The follow-up reorderCardsInColumn calls below close any
    // gaps that drift in over time on either side of the move.
    const move = await moveCard(activeId, targetCol.id, newPosition);
    if (!move.success) {
      showError(`Couldn't save card move: ${move.error}`);
      return;
    }
    // Renumber positions in every affected column. Cheap and keeps things
    // consistent even when positions drift across many drags.
    for (const col of columns) {
      const ids = col.cards.map((c) => c.id);
      if (ids.length > 0) {
        await reorderCardsInColumn(col.id, ids);
      }
    }
  }

  // ─── Column actions ───────────────────────────────────────
  async function handleAddColumn(name: string) {
    setShowAddColumn(false);
    const result = await createColumn(board.id, { name });
    if (!result.success) {
      showError(result.error);
      return;
    }
    if (result.data) {
      setColumns((prev) => [...prev, result.data!]);
    }
  }

  async function handleRenameColumn(columnId: string, name: string) {
    const previous = columns;
    setColumns((prev) =>
      prev.map((c) => (c.id === columnId ? { ...c, name } : c)),
    );
    const result = await updateColumn(columnId, { name });
    if (!result.success) {
      showError(result.error);
      setColumns(previous);
    }
  }

  async function handleChangeColumnColor(columnId: string, color: string) {
    const previous = columns;
    setColumns((prev) =>
      prev.map((c) => (c.id === columnId ? { ...c, color } : c)),
    );
    const result = await updateColumn(columnId, { color });
    if (!result.success) {
      showError(result.error);
      setColumns(previous);
    }
  }

  async function handleDeleteColumn(columnId: string) {
    const col = columns.find((c) => c.id === columnId);
    if (!col) return;
    if (col.cards.length > 0) {
      const ok = window.confirm(
        `"${col.name}" has ${col.cards.length} card${col.cards.length === 1 ? "" : "s"}. Delete the column and all of its cards?`,
      );
      if (!ok) return;
    }
    const previous = columns;
    setColumns((prev) => prev.filter((c) => c.id !== columnId));
    const result = await deleteColumn(columnId);
    if (!result.success) {
      showError(result.error);
      setColumns(previous);
    }
  }

  // ─── Card actions ─────────────────────────────────────────
  function handleCardCreated(columnId: string, card: BoardCardWithMeta) {
    setColumns((prev) =>
      prev.map((c) =>
        c.id === columnId ? { ...c, cards: [...c.cards, card] } : c,
      ),
    );
  }

  // ─── Render ───────────────────────────────────────────────
  const columnIdsForSortable = useMemo(
    () => columns.map((c) => `column-${c.id}`),
    [columns],
  );

  const addingColumn = columns.find((c) => c.id === adding.columnId);

  return (
    <div className="flex flex-col h-full">
      <BoardDetailHeader
        board={{ ...board, columns }}
        onAddColumn={() => setShowAddColumn(true)}
      />

      {/* Mobile fallback */}
      <div className="lg:hidden">
        <MobileFallback />
      </div>

      {/* Kanban surface */}
      <div className="hidden lg:block relative">
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

        {columns.length === 0 ? (
          <EmptyBoardState
            canEdit={board.viewer_can_edit}
            onAdd={() => setShowAddColumn(true)}
          />
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
            onDragCancel={() => setActive(null)}
          >
            <SortableContext
              items={columnIdsForSortable}
              strategy={horizontalListSortingStrategy}
            >
              <div className="flex items-start gap-4 overflow-x-auto pb-4 -mx-2 px-2">
                <AnimatePresence initial={false}>
                  {columns.map((col) => (
                    <motion.div
                      key={col.id}
                      layout
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
                  />
                )}
              </div>
            </SortableContext>

            <DragOverlay>
              {active?.type === "card" && (
                <KanbanCard card={active.card} isOverlay />
              )}
              {active?.type === "column" && (
                <KanbanColumn
                  column={active.column}
                  canEdit={false}
                  onAddCard={() => {}}
                  onRename={() => {}}
                  onChangeColor={() => {}}
                  onDelete={() => {}}
                  isOverlay
                />
              )}
            </DragOverlay>
          </DndContext>
        )}
      </div>

      <QuickAddCardModal
        open={!!adding.columnId}
        onClose={() => setAdding({ columnId: null })}
        columnId={adding.columnId}
        columnName={addingColumn?.name ?? ""}
        orgProfiles={orgProfiles}
        defaultAssigneeId={viewerId}
        onCreated={handleCardCreated}
      />
    </div>
  );
}

function sortByPosition(
  columns: BoardColumnWithCards[],
): BoardColumnWithCards[] {
  return [...columns]
    .sort((a, b) => a.position - b.position)
    .map((c) => ({
      ...c,
      cards: [...c.cards].sort((a, b) => a.position - b.position),
    }));
}

// ─── Mobile fallback ────────────────────────────────────────
function MobileFallback() {
  return (
    <div className="flex flex-col items-center text-center py-12 px-6 bg-white rounded-2xl border border-[#E5E7EB]">
      <div
        className="size-14 rounded-2xl flex items-center justify-center mb-4"
        style={{ backgroundColor: "rgba(92, 225, 165, 0.12)" }}
      >
        <span className="text-[24px]" aria-hidden>
          🖥️
        </span>
      </div>
      <h2
        className="text-[16px] text-[#2D333A] mb-1"
        style={{ fontFamily: "var(--font-poppins)", fontWeight: 700 }}
      >
        Best on desktop
      </h2>
      <p
        className="text-[13px] text-[#6B7280] max-w-sm"
        style={{ fontFamily: "var(--font-source-sans)" }}
      >
        Project Boards work best on a larger screen. Open this on your computer
        for the full kanban view with drag-and-drop.
      </p>
    </div>
  );
}

// ─── Empty board ───────────────────────────────────────────
function EmptyBoardState({
  canEdit,
  onAdd,
}: {
  canEdit: boolean;
  onAdd: () => void;
}) {
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
