"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import {
  Check,
  ChevronDown,
  ChevronRight,
  Clock,
  GripVertical,
  Plus,
  StickyNote,
  X,
} from "lucide-react";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  createAgendaItem,
  deleteAgendaItem,
  reorderAgendaItems,
  updateAgendaItem,
  updateAgendaItemNotes,
  type HuddleAgendaItem,
} from "@/app/actions/huddles";

interface AgendaTabProps {
  huddleId: string;
  items: HuddleAgendaItem[];
  canEdit: boolean;
  onItemsChange: (items: HuddleAgendaItem[]) => void;
}

export function AgendaTab({
  huddleId,
  items,
  canEdit,
  onItemsChange,
}: AgendaTabProps) {
  const [draft, setDraft] = useState("");
  const [pending, startTransition] = useTransition();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const total = items.reduce(
    (sum, item) => sum + (item.estimated_minutes ?? 0),
    0,
  );
  const completed = items.filter((i) => i.is_completed).length;

  function add() {
    const trimmed = draft.trim();
    if (!trimmed) return;
    startTransition(async () => {
      const res = await createAgendaItem(huddleId, trimmed);
      if (res.success && res.data) {
        onItemsChange([...items, res.data]);
        setDraft("");
      }
    });
  }

  function toggle(item: HuddleAgendaItem) {
    const next = items.map((i) =>
      i.id === item.id ? { ...i, is_completed: !i.is_completed } : i,
    );
    onItemsChange(next);
    updateAgendaItem(item.id, { isCompleted: !item.is_completed });
  }

  function edit(item: HuddleAgendaItem, title: string) {
    const trimmed = title.trim();
    if (!trimmed || trimmed === item.title) return;
    onItemsChange(items.map((i) => (i.id === item.id ? { ...i, title: trimmed } : i)));
    updateAgendaItem(item.id, { title: trimmed });
  }

  function remove(item: HuddleAgendaItem) {
    onItemsChange(items.filter((i) => i.id !== item.id));
    deleteAgendaItem(item.id);
  }

  function dragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIdx = items.findIndex((i) => i.id === active.id);
    const newIdx = items.findIndex((i) => i.id === over.id);
    if (oldIdx < 0 || newIdx < 0) return;
    const next = arrayMove(items, oldIdx, newIdx);
    onItemsChange(next);
    reorderAgendaItems(huddleId, next.map((i) => i.id));
  }

  return (
    <section className="bg-white border border-[#E5E7EB] rounded-2xl p-5">
      <header className="flex items-center justify-between mb-4">
        <div>
          <h2
            className="text-[15px] text-[#0F172A]"
            style={{ fontFamily: "var(--font-poppins)", fontWeight: 700 }}
          >
            Agenda
          </h2>
          <p
            className="text-[12px] text-[#6B7280] mt-0.5"
            style={{ fontFamily: "var(--font-source-sans)" }}
          >
            {items.length === 0
              ? "No items yet"
              : `${completed} of ${items.length} done · ${total} min planned`}
          </p>
        </div>
      </header>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={dragEnd}
      >
        <SortableContext
          items={items.map((i) => i.id)}
          strategy={verticalListSortingStrategy}
        >
          <ul className="space-y-1.5">
            {items.map((i) => (
              <Row
                key={i.id}
                item={i}
                canEdit={canEdit}
                onToggle={() => toggle(i)}
                onEdit={(t) => edit(i, t)}
                onRemove={() => remove(i)}
              />
            ))}
          </ul>
        </SortableContext>
      </DndContext>

      {canEdit && (
        <div className="mt-3 flex items-center gap-2">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                add();
              }
            }}
            placeholder="Add agenda item…"
            disabled={pending}
            className="flex-1 h-9 px-3 rounded-lg border border-[#E5E7EB] text-[13px] outline-none focus:border-[#3B82F6]"
            style={{ fontFamily: "var(--font-source-sans)" }}
          />
          <button
            type="button"
            onClick={add}
            disabled={!draft.trim() || pending}
            className="h-9 px-3 rounded-lg bg-[#F4F5F7] text-[#2D333A] text-[12px] font-semibold inline-flex items-center gap-1 hover:bg-[#E5E7EB] disabled:opacity-50"
            style={{ fontFamily: "var(--font-poppins)" }}
          >
            <Plus className="size-3.5" />
            Add
          </button>
        </div>
      )}

      {items.length === 0 && !canEdit && (
        <p
          className="text-[13px] text-[#9CA3AF] text-center py-3"
          style={{ fontFamily: "var(--font-source-sans)" }}
        >
          No agenda items yet.
        </p>
      )}
    </section>
  );
}

function Row({
  item,
  canEdit,
  onToggle,
  onEdit,
  onRemove,
}: {
  item: HuddleAgendaItem;
  canEdit: boolean;
  onToggle: () => void;
  onEdit: (title: string) => void;
  onRemove: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(item.title);
  // Notes expansion is auto-open when notes already exist so the
  // reader sees them by default. Collapsed otherwise to keep the
  // agenda dense.
  const [notesOpen, setNotesOpen] = useState(!!item.notes);
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id, disabled: !canEdit });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  } as const;

  return (
    <li
      ref={setNodeRef}
      style={style}
      className="rounded-lg hover:bg-[#F8FAFC]"
    >
      <div className="group flex items-center gap-2 px-2 py-1.5">
      {canEdit && (
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="size-5 text-[#CBD5E1] hover:text-[#6B7280] cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity"
          aria-label="Drag to reorder"
        >
          <GripVertical className="size-4" />
        </button>
      )}
      <button
        type="button"
        onClick={onToggle}
        disabled={!canEdit}
        className={`size-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
          item.is_completed
            ? "bg-[#3B82F6] border-[#3B82F6]"
            : "border-[#CBD5E1] hover:border-[#3B82F6]"
        }`}
      >
        {item.is_completed && <Check className="size-3 text-white" />}
      </button>
      {editing ? (
        <input
          value={draft}
          autoFocus
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => {
            setEditing(false);
            if (draft.trim() && draft.trim() !== item.title) onEdit(draft);
            else setDraft(item.title);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            else if (e.key === "Escape") {
              setDraft(item.title);
              setEditing(false);
            }
          }}
          className="flex-1 h-7 px-2 rounded border border-[#3B82F6] text-[13px] outline-none"
          style={{ fontFamily: "var(--font-source-sans)" }}
        />
      ) : (
        <button
          type="button"
          disabled={!canEdit}
          onClick={() => canEdit && setEditing(true)}
          className={`flex-1 text-left text-[13px] truncate ${
            item.is_completed ? "text-[#9CA3AF] line-through" : "text-[#2D333A]"
          }`}
          style={{ fontFamily: "var(--font-source-sans)" }}
        >
          {item.title}
        </button>
      )}
      {item.estimated_minutes != null && (
        <span
          className="inline-flex items-center gap-1 text-[11px] text-[#6B7280] tabular-nums"
          style={{ fontFamily: "var(--font-source-sans)" }}
        >
          <Clock className="size-3" />
          {item.estimated_minutes}m
        </span>
      )}
      {item.presenter && (
        <span
          className="text-[11px] text-[#6B7280] truncate max-w-[120px]"
          style={{ fontFamily: "var(--font-source-sans)" }}
        >
          {item.presenter.full_name}
        </span>
      )}
      <button
        type="button"
        onClick={() => setNotesOpen((v) => !v)}
        className={`size-6 rounded-md flex items-center justify-center text-[#9CA3AF] hover:text-[#2D333A] hover:bg-[#F4F5F7] transition-colors ${
          item.notes ? "text-[#3B82F6]" : ""
        }`}
        aria-label={notesOpen ? "Hide notes" : "Show notes"}
        title="Per-item notes"
      >
        {notesOpen ? (
          <ChevronDown className="size-3.5" />
        ) : item.notes ? (
          <StickyNote className="size-3.5" />
        ) : (
          <ChevronRight className="size-3.5" />
        )}
      </button>
      {canEdit && (
        <button
          type="button"
          onClick={onRemove}
          className="size-6 rounded-md flex items-center justify-center text-[#CBD5E1] hover:text-red-600 hover:bg-red-50 opacity-0 group-hover:opacity-100"
          aria-label="Delete agenda item"
        >
          <X className="size-3" />
        </button>
      )}
      </div>
      {notesOpen && (
        <ItemNotes
          itemId={item.id}
          initialNotes={item.notes}
          canEdit={canEdit}
        />
      )}
    </li>
  );
}

// Per-item notes with debounced autosave. Gracefully degrades when
// the huddle_agenda_items.notes column hasn't been added yet — the
// server action returns SCHEMA_MISSING and the input flips to a
// disabled placeholder with the upgrade instruction.
function ItemNotes({
  itemId,
  initialNotes,
  canEdit,
}: {
  itemId: string;
  initialNotes: string | null;
  canEdit: boolean;
}) {
  const [value, setValue] = useState(initialNotes ?? "");
  const [savedHint, setSavedHint] = useState<string | null>(null);
  const [schemaMissing, setSchemaMissing] = useState(false);
  const dirtyRef = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Flush on unmount so a quick collapse-after-typing doesn't lose work.
  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
      if (dirtyRef.current) {
        updateAgendaItemNotes(itemId, value).catch(() => {});
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemId]);

  function handleChange(next: string) {
    if (schemaMissing) return;
    setValue(next);
    dirtyRef.current = true;
    setSavedHint(null);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      const res = await updateAgendaItemNotes(itemId, next);
      if (!res.success) {
        if (res.code === "SCHEMA_MISSING") {
          setSchemaMissing(true);
          setSavedHint(res.error);
        } else {
          setSavedHint(res.error);
        }
        return;
      }
      dirtyRef.current = false;
      setSavedHint("Saved");
      setTimeout(() => setSavedHint(null), 1500);
    }, 1800);
  }

  return (
    <div className="px-2 pb-2">
      <textarea
        value={schemaMissing ? "" : value}
        onChange={(e) => handleChange(e.target.value)}
        rows={3}
        disabled={!canEdit || schemaMissing}
        placeholder={
          schemaMissing
            ? "Per-item notes need the huddle_agenda_items.notes column. Run the agenda-notes ALTER in Supabase to enable."
            : canEdit
              ? "Notes for this topic — discussion, links, anything specific to this item."
              : "No notes for this topic yet."
        }
        className="w-full px-3 py-2 rounded-lg border border-[#E5E7EB] bg-white text-[13px] text-[#2D333A] placeholder-[#9CA3AF] outline-none focus:border-[#3B82F6] resize-vertical disabled:bg-[#F8FAFC] disabled:cursor-not-allowed"
        style={{
          fontFamily: "var(--font-source-sans)",
          minHeight: "72px",
        }}
      />
      {savedHint && (
        <p
          className={`text-[11px] mt-1 ${
            schemaMissing ? "text-amber-700" : "text-[#9CA3AF]"
          }`}
          style={{ fontFamily: "var(--font-source-sans)" }}
        >
          {savedHint}
        </p>
      )}
    </div>
  );
}
