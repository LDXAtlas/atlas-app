"use client";

import { useState, useCallback, useTransition, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Plus,
  Search,
  Check,
  ChevronDown,
  Clock,
  MoreHorizontal,
  Target,
  Sun,
  Sunrise,
  CalendarDays,
  Inbox,
  Star,
  Pencil,
  Trash2,
  Copy,
  X,
  List,
  LayoutGrid,
} from "lucide-react";
import {
  toggleTaskComplete,
  deleteTask,
  createTask,
  updateTask,
} from "@/app/actions/tasks";
import { TaskModal } from "./task-modal";

// ─── Types ──────────────────────────────────────────────
export type Task = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  due_date: string | null;
  completed_at: string | null;
  assigned_to: string | null;
  assigned_by: string | null;
  department_id: string | null;
  position: number;
  created_at: string;
  assigned_to_name?: string | null;
  department_name?: string | null;
  department_color?: string | null;
};

export type TeamMember = {
  id: string;
  full_name: string;
};

export type Department = {
  id: string;
  name: string;
  color: string;
};

type GroupKey = "today" | "tomorrow" | "this-week" | "later";
type ViewFilter = "all" | "starred";
type ViewMode = "list" | "grid";
type Priority = "high" | "medium" | "low" | "urgent" | "none";

// ─── Config ─────────────────────────────────────────────
const PRIORITY_CONFIG: Record<
  string,
  { label: string; color: string; bg: string; dot: string }
> = {
  high: {
    label: "High",
    color: "text-red-500",
    bg: "bg-red-50",
    dot: "#EF4444",
  },
  urgent: {
    label: "Urgent",
    color: "text-red-600",
    bg: "bg-red-50",
    dot: "#DC2626",
  },
  medium: {
    label: "Med",
    color: "text-amber-500",
    bg: "bg-amber-50",
    dot: "#F59E0B",
  },
  low: {
    label: "Low",
    color: "text-blue-500",
    bg: "bg-blue-50",
    dot: "#3B82F6",
  },
  none: {
    label: "",
    color: "text-gray-300",
    bg: "",
    dot: "#E5E7EB",
  },
};

const GROUP_CONFIG: Record<
  GroupKey,
  {
    label: string;
    Icon: typeof Sun;
    accentColor: string;
    accentHex: string;
  }
> = {
  today: {
    label: "Focus Today",
    Icon: Sun,
    accentColor: "text-[#5CE1A5]",
    accentHex: "#5CE1A5",
  },
  tomorrow: {
    label: "Tomorrow",
    Icon: Sunrise,
    accentColor: "text-[#3B82F6]",
    accentHex: "#3B82F6",
  },
  "this-week": {
    label: "This Week",
    Icon: CalendarDays,
    accentColor: "text-[#8B5CF6]",
    accentHex: "#8B5CF6",
  },
  later: {
    label: "Later",
    Icon: Inbox,
    accentColor: "text-[#9CA3AF]",
    accentHex: "#9CA3AF",
  },
};

const GROUP_ORDER: GroupKey[] = ["today", "tomorrow", "this-week", "later"];

// ─── Helper: group tasks by due date ────────────────────
function groupTasks(tasks: Task[]): Record<GroupKey, Task[]> {
  const groups: Record<GroupKey, Task[]> = {
    today: [],
    tomorrow: [],
    "this-week": [],
    later: [],
  };

  const now = new Date();
  const todayStr = now.toISOString().split("T")[0];

  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split("T")[0];

  // End of this week (Sunday)
  const endOfWeek = new Date(now);
  const dayOfWeek = now.getDay();
  endOfWeek.setDate(now.getDate() + (7 - dayOfWeek));
  const endOfWeekStr = endOfWeek.toISOString().split("T")[0];

  tasks.forEach((task) => {
    if (!task.due_date) {
      groups.later.push(task);
      return;
    }
    const taskDate = new Date(task.due_date).toISOString().split("T")[0];

    if (taskDate <= todayStr) {
      groups.today.push(task);
    } else if (taskDate === tomorrowStr) {
      groups.tomorrow.push(task);
    } else if (taskDate <= endOfWeekStr) {
      groups["this-week"].push(task);
    } else {
      groups.later.push(task);
    }
  });

  // Sort within each group: high priority first, then by position
  const priorityOrder: Record<string, number> = {
    urgent: 0,
    high: 1,
    medium: 2,
    low: 3,
  };
  for (const key of GROUP_ORDER) {
    groups[key].sort((a, b) => {
      const pa = priorityOrder[a.priority] ?? 4;
      const pb = priorityOrder[b.priority] ?? 4;
      if (pa !== pb) return pa - pb;
      return a.position - b.position;
    });
  }

  return groups;
}

// ─── Helper: format due time ────────────────────────────
function formatDueTime(dateStr: string): string | null {
  const d = new Date(dateStr);
  const hours = d.getHours();
  const mins = d.getMinutes();
  if (hours === 0 && mins === 0) return null;
  const ampm = hours >= 12 ? "PM" : "AM";
  const h = hours % 12 || 12;
  const m = mins.toString().padStart(2, "0");
  return `${h}:${m} ${ampm}`;
}

// ─── Progress Ring ──────────────────────────────────────
function ProgressRing({
  completed,
  total,
}: {
  completed: number;
  total: number;
}) {
  const pct = total > 0 ? (completed / total) * 100 : 0;
  const radius = 28;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (pct / 100) * circumference;

  return (
    <div className="relative size-[72px] flex items-center justify-center">
      <svg className="size-full -rotate-90" viewBox="0 0 64 64">
        <circle
          cx="32"
          cy="32"
          r={radius}
          fill="none"
          stroke="#F4F5F7"
          strokeWidth="5"
        />
        <motion.circle
          cx="32"
          cy="32"
          r={radius}
          fill="none"
          stroke="#5CE1A5"
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1, ease: [0.23, 1, 0.32, 1] }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span
          className="text-[16px] text-[#2D333A] leading-none"
          style={{ fontFamily: "var(--font-poppins)", fontWeight: 600 }}
        >
          {completed}
        </span>
        <span
          className="text-[10px] text-[#9CA3AF] leading-none mt-0.5"
          style={{ fontFamily: "var(--font-source-sans)" }}
        >
          /{total}
        </span>
      </div>
    </div>
  );
}

// ─── Context Menu ───────────────────────────────────────
function TaskContextMenu({
  task,
  onClose,
  onEdit,
  onSetPriority,
  onDuplicate,
  onDelete,
}: {
  task: Task;
  onClose: () => void;
  onEdit: () => void;
  onSetPriority: (p: string) => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  const MenuItem = ({
    icon,
    label,
    onClick,
    danger,
  }: {
    icon: React.ReactNode;
    label: string;
    onClick: () => void;
    danger?: boolean;
  }) => (
    <button
      onClick={() => {
        onClick();
        onClose();
      }}
      className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] transition-colors ${
        danger
          ? "text-red-500 hover:bg-red-50"
          : "text-[#2D333A] hover:bg-[#F4F5F7]"
      }`}
      style={{ fontFamily: "var(--font-source-sans)" }}
    >
      {icon}
      {label}
    </button>
  );

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, scale: 0.95, y: -4 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: -4 }}
      transition={{ duration: 0.12 }}
      className="absolute right-0 top-full mt-1 w-[200px] bg-white border border-[#E5E7EB] rounded-xl shadow-xl z-[50] py-1.5 px-1.5"
      style={{ boxShadow: "0 8px 30px rgba(0,0,0,0.12)" }}
    >
      <MenuItem
        icon={<Pencil className="size-3.5" />}
        label="Edit task"
        onClick={onEdit}
      />

      {/* Priority section */}
      <div className="mx-1.5 my-1.5 h-px bg-[#E5E7EB]" />
      <p
        className="px-3 py-1 text-[10px] text-[#9CA3AF] uppercase tracking-wider"
        style={{ fontFamily: "var(--font-poppins)", fontWeight: 600 }}
      >
        Priority
      </p>
      <div className="flex items-center gap-1 px-2 pb-1">
        {(["high", "medium", "low"] as const).map((p) => {
          const cfg = PRIORITY_CONFIG[p];
          const isActive = task.priority === p;
          return (
            <button
              key={p}
              onClick={() => {
                onSetPriority(p);
                onClose();
              }}
              className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-[11px] transition-all ${
                isActive
                  ? `${cfg.bg} ${cfg.color}`
                  : "text-[#9CA3AF] hover:bg-[#F4F5F7]"
              }`}
              style={{ fontFamily: "var(--font-poppins)", fontWeight: 600 }}
            >
              <span
                className="size-2 rounded-full"
                style={{
                  backgroundColor: isActive ? cfg.dot : "#E5E7EB",
                }}
              />
              {cfg.label}
            </button>
          );
        })}
      </div>

      <div className="mx-1.5 my-1.5 h-px bg-[#E5E7EB]" />
      <MenuItem
        icon={<Copy className="size-3.5" />}
        label="Duplicate"
        onClick={onDuplicate}
      />
      <MenuItem
        icon={<Trash2 className="size-3.5" />}
        label="Delete task"
        onClick={onDelete}
        danger
      />
    </motion.div>
  );
}

// ─── Task Row ───────────────────────────────────────────
function TaskRow({
  task,
  isStarred,
  onToggleStar,
  onToggleComplete,
  onEdit,
  onSetPriority,
  onDuplicate,
  onDelete,
  menuOpenId,
  onMenuToggle,
}: {
  task: Task;
  isStarred: boolean;
  onToggleStar: () => void;
  onToggleComplete: () => void;
  onEdit: () => void;
  onSetPriority: (p: string) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  menuOpenId: string | null;
  onMenuToggle: (id: string | null) => void;
}) {
  const isDone = task.status === "done";
  const pri = PRIORITY_CONFIG[task.priority] || PRIORITY_CONFIG.low;
  const dueTime = task.due_date ? formatDueTime(task.due_date) : null;
  const isMenuOpen = menuOpenId === task.id;

  return (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              layout
              className="group relative"
              style={{ zIndex: isMenuOpen ? 50 : 1 }}
            >
              <div
                className={`flex items-start gap-3 px-4 py-3 rounded-xl transition-all ${
          isDone ? "bg-[#FAFBFC]" : "hover:bg-[#F4F5F7]/60"
        } border border-transparent hover:border-[#E5E7EB]/50`}
      >
        {/* Checkbox */}
        <button
          onClick={onToggleComplete}
          className={`mt-0.5 size-[22px] rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${
            isDone
              ? "bg-[#5CE1A5] border-[#5CE1A5]"
              : "border-[#E5E7EB] hover:border-[#5CE1A5] group-hover:border-[#5CE1A5]/50"
          }`}
        >
          <AnimatePresence>
            {isDone && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
                transition={{
                  type: "spring",
                  bounce: 0.5,
                  duration: 0.3,
                }}
              >
                <Check className="size-3 text-white" strokeWidth={3} />
              </motion.div>
            )}
          </AnimatePresence>
        </button>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <p
            className={`text-[14px] leading-snug transition-all ${
              isDone
                ? "line-through text-[#9CA3AF]"
                : "text-[#2D333A]"
            }`}
            style={{
              fontFamily: "var(--font-poppins)",
              fontWeight: 600,
            }}
          >
            {task.title}
          </p>

          {task.description && (
            <p
              className="text-[13px] text-[#6B7280] mt-0.5 whitespace-pre-wrap"
              style={{ fontFamily: "var(--font-source-sans)" }}
            >
              {task.description}
            </p>
          )}

          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            {task.priority !== "low" && (
              <span
                className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] uppercase tracking-wider ${pri.color} ${pri.bg}`}
                style={{
                  fontFamily: "var(--font-poppins)",
                  fontWeight: 600,
                }}
              >
                <span
                  className="size-1.5 rounded-full"
                  style={{ backgroundColor: pri.dot }}
                />
                {pri.label}
              </span>
            )}
            {dueTime && (
              <span
                className="inline-flex items-center gap-1 text-[11px] text-[#6B7280]"
                style={{ fontFamily: "var(--font-source-sans)" }}
              >
                <Clock className="size-3" />
                {dueTime}
              </span>
            )}
            {task.department_name && (
              <span
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px]"
                style={{
                  fontFamily: "var(--font-poppins)",
                  fontWeight: 600,
                  color: task.department_color || "#8B5CF6",
                  backgroundColor: `${task.department_color || "#8B5CF6"}15`,
                }}
              >
                <span
                  className="size-1.5 rounded-full"
                  style={{
                    backgroundColor:
                      task.department_color || "#8B5CF6",
                  }}
                />
                {task.department_name}
              </span>
            )}
          </div>
        </div>

        {/* Right actions */}
        <div className="flex items-center gap-0.5 flex-shrink-0 mt-0.5">
          <button
            onClick={onToggleStar}
            className={`p-1.5 rounded-lg transition-all ${
              isStarred
                ? "text-amber-400"
                : "text-transparent group-hover:text-gray-300 hover:!text-amber-400"
            }`}
          >
            <Star
              className="size-4"
              fill={isStarred ? "currentColor" : "none"}
            />
          </button>
          <div className="relative">
            <button
              onClick={() =>
                onMenuToggle(isMenuOpen ? null : task.id)
              }
              className={`p-1.5 rounded-lg transition-all ${
                isMenuOpen
                  ? "text-[#2D333A] bg-[#F4F5F7]"
                  : "text-transparent group-hover:text-gray-400 hover:!text-[#2D333A]"
              }`}
            >
              <MoreHorizontal className="size-4" />
            </button>
            <AnimatePresence>
              {isMenuOpen && (
                <TaskContextMenu
                  task={task}
                  onClose={() => onMenuToggle(null)}
                  onEdit={onEdit}
                  onSetPriority={onSetPriority}
                  onDuplicate={onDuplicate}
                  onDelete={onDelete}
                />
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Task Group ─────────────────────────────────────────
function TaskGroup({
  groupKey,
  tasks,
  starredIds,
  onToggleStar,
  onToggleComplete,
  onEdit,
  onSetPriority,
  onDuplicate,
  onDelete,
  menuOpenId,
  onMenuToggle,
  onAddNewTask,
}: {
  groupKey: GroupKey;
  tasks: Task[];
  starredIds: Set<string>;
  onToggleStar: (id: string) => void;
  onToggleComplete: (id: string) => void;
  onEdit: (task: Task) => void;
  onSetPriority: (id: string, p: string) => void;
  onDuplicate: (task: Task) => void;
  onDelete: (id: string) => void;
  menuOpenId: string | null;
  onMenuToggle: (id: string | null) => void;
  onAddNewTask: () => void;
}) {
  const config = GROUP_CONFIG[groupKey];
  const Icon = config.Icon;
  const [collapsed, setCollapsed] = useState(false);

  const completedCount = tasks.filter((t) => t.status === "done").length;
  const pending = tasks.filter((t) => t.status !== "done");
  const completed = tasks.filter((t) => t.status === "done");

  if (tasks.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
      className="mb-2 rounded-xl"
    >
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="w-full flex items-center gap-2.5 px-4 py-2.5"
      >
        <ChevronDown
          className={`size-3.5 text-[#9CA3AF] transition-transform ${
            collapsed ? "-rotate-90" : ""
          }`}
        />
        <Icon className={`size-4 ${config.accentColor}`} />
        <h3
          className="text-[14px] text-[#2D333A]"
          style={{ fontFamily: "var(--font-poppins)", fontWeight: 600 }}
        >
          {config.label}
        </h3>
        <span
          className="text-[12px] text-[#9CA3AF]"
          style={{ fontFamily: "var(--font-source-sans)" }}
        >
          {completedCount > 0
            ? `${completedCount} of ${tasks.length} done`
            : `${tasks.length} task${tasks.length !== 1 ? "s" : ""}`}
        </span>
        {groupKey === "today" && pending.length > 0 && (
          <div className="ml-auto flex items-center gap-1.5">
            <div className="h-1 w-16 bg-[#F4F5F7] rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-[#5CE1A5] rounded-full"
                initial={{ width: 0 }}
                animate={{
                  width: `${(completedCount / tasks.length) * 100}%`,
                }}
                transition={{
                  duration: 0.8,
                  ease: [0.23, 1, 0.32, 1],
                }}
              />
            </div>
          </div>
        )}
      </button>

      <AnimatePresence>
        {!collapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0, overflow: "hidden" }}
            animate={{ height: "auto", opacity: 1, overflow: "visible" }}
            exit={{ height: 0, opacity: 0, overflow: "hidden" }}
            transition={{ duration: 0.2 }}
          >
            <div className="space-y-0.5 pb-2">
              {[...pending, ...completed].map((task) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  isStarred={starredIds.has(task.id)}
                  onToggleStar={() => onToggleStar(task.id)}
                  onToggleComplete={() => onToggleComplete(task.id)}
                  onEdit={() => onEdit(task)}
                  onSetPriority={(p) => onSetPriority(task.id, p)}
                  onDuplicate={() => onDuplicate(task)}
                  onDelete={() => onDelete(task.id)}
                  menuOpenId={menuOpenId}
                  onMenuToggle={onMenuToggle}
                />
              ))}

              {/* Add Task Button (Opens Modal) */}
              <button
                onClick={onAddNewTask}
                className="w-full flex items-center gap-2 px-4 py-2 mt-0.5 rounded-xl text-[#9CA3AF] hover:text-[#5CE1A5] transition-colors group/add"
              >
                <div className="size-[22px] rounded-full border-2 border-dashed border-[#E5E7EB] group-hover/add:border-[#5CE1A5]/40 flex items-center justify-center flex-shrink-0 transition-colors">
                  <Plus className="size-3" />
                </div>
                <span
                  className="text-[13px]"
                  style={{ fontFamily: "var(--font-source-sans)" }}
                >
                  Add task
                </span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── Grid Card ─────────────────────────────────────────
function TaskGridCard({
  task,
  isStarred,
  onToggleStar,
  onToggleComplete,
  onEdit,
  onSetPriority,
  onDuplicate,
  onDelete,
  menuOpenId,
  onMenuToggle,
}: {
  task: Task;
  isStarred: boolean;
  onToggleStar: () => void;
  onToggleComplete: () => void;
  onEdit: () => void;
  onSetPriority: (p: string) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  menuOpenId: string | null;
  onMenuToggle: (id: string | null) => void;
}) {
  const isDone = task.status === "done";
  const pri = PRIORITY_CONFIG[task.priority] || PRIORITY_CONFIG.none;
  const dueTime = task.due_date ? formatDueTime(task.due_date) : null;
  const isMenuOpen = menuOpenId === task.id;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.97 }}
      layout
      className="group relative"
      style={{ zIndex: isMenuOpen ? 50 : 1 }}
    >
      <div
        className={`relative bg-white rounded-[20px] transition-all duration-300 ${
          isMenuOpen ? "overflow-visible" : "overflow-hidden"
        } ${
          isDone
            ? "opacity-55"
            : "hover:-translate-y-1 hover:shadow-[0_12px_30px_-8px_rgba(0,0,0,0.08)]"
        } ${isStarred && !isDone ? "ring-1 ring-amber-200/50" : ""}`}
        style={{
          boxShadow: isDone
            ? "none"
            : "0 4px 20px -2px rgba(0,0,0,0.03), 0 1px 4px -1px rgba(0,0,0,0.03)",
          border: "1px solid rgba(229,231,235,0.6)",
        }}
      >
        {/* Top accent bar for priority */}
        {task.priority !== "none" &&
          task.priority !== "low" &&
          !isDone && (
            <div
              className="h-[3px] w-full rounded-t-[20px]"
              style={{
                background: `linear-gradient(90deg, ${pri.dot}, ${pri.dot}00)`,
              }}
            />
          )}

        {/* Card body */}
        <div className="p-5 flex flex-col gap-3">
          {/* Header: checkbox + title + star/menu */}
          <div className="flex items-start gap-3">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggleComplete();
              }}
              className={`mt-0.5 size-[20px] rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all duration-200 ${
                isDone
                  ? "bg-[#5CE1A5] border-[#5CE1A5]"
                  : "border-[#E5E7EB] hover:border-[#5CE1A5] group-hover:border-[#5CE1A5]/40"
              }`}
            >
              <AnimatePresence>
                {isDone && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    exit={{ scale: 0 }}
                    transition={{
                      type: "spring",
                      bounce: 0.5,
                      duration: 0.3,
                    }}
                  >
                    <Check
                      className="size-2.5 text-white"
                      strokeWidth={3}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </button>
            <h4
              className={`flex-1 text-[14px] leading-[1.45] ${
                isDone
                  ? "line-through text-[#9CA3AF]"
                  : "text-[#2D333A]"
              }`}
              style={{
                fontFamily: "var(--font-poppins)",
                fontWeight: 600,
              }}
            >
              {task.title}
            </h4>
            <div className="flex items-center gap-0.5 ml-auto flex-shrink-0">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleStar();
                }}
                className={`p-1.5 rounded-lg transition-all flex-shrink-0 ${
                  isStarred
                    ? "text-amber-400"
                    : "text-transparent group-hover:text-gray-300 hover:!text-amber-400"
                }`}
              >
                <Star
                  className="size-4"
                  fill={isStarred ? "currentColor" : "none"}
                />
              </button>
              <div className="relative">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onMenuToggle(isMenuOpen ? null : task.id);
                  }}
                  className={`p-1.5 rounded-lg transition-all ${
                    isMenuOpen
                      ? "text-[#2D333A] bg-[#F4F5F7]"
                      : "text-transparent group-hover:text-gray-400 hover:!text-[#2D333A]"
                  }`}
                >
                  <MoreHorizontal className="size-4" />
                </button>
                <AnimatePresence>
                  {isMenuOpen && (
                    <TaskContextMenu
                      task={task}
                      onClose={() => onMenuToggle(null)}
                      onEdit={onEdit}
                      onSetPriority={onSetPriority}
                      onDuplicate={onDuplicate}
                      onDelete={onDelete}
                    />
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>

          {/* Description */}
          {task.description && !isDone && (
            <p
              className="text-[13px] text-[#9CA3AF] leading-relaxed -mt-0.5 whitespace-pre-wrap"
              style={{ fontFamily: "var(--font-source-sans)" }}
            >
              {task.description}
            </p>
          )}

          {/* Footer: metadata pills */}
          <div className="flex items-center gap-1.5 flex-wrap mt-auto pt-1">
            {task.priority !== "none" &&
              task.priority !== "low" &&
              !isDone && (
                <span
                  className={`inline-flex items-center gap-1 px-2 py-[3px] rounded-full text-[10px] uppercase tracking-wider ${pri.color}`}
                  style={{
                    fontFamily: "var(--font-poppins)",
                    fontWeight: 600,
                    backgroundColor: `${pri.dot}10`,
                  }}
                >
                  <span
                    className="size-[5px] rounded-full"
                    style={{ backgroundColor: pri.dot }}
                  />
                  {pri.label}
                </span>
              )}
            {dueTime && (
              <span
                className="inline-flex items-center gap-1 px-2 py-[3px] rounded-full bg-[#F4F5F7] text-[10px] text-[#6B7280]"
                style={{
                  fontFamily: "var(--font-poppins)",
                  fontWeight: 600,
                }}
              >
                <Clock className="size-2.5" />
                {dueTime}
              </span>
            )}
            {task.department_name && (
              <span
                className="inline-flex items-center gap-1 px-2 py-[3px] rounded-full text-[10px] truncate max-w-[120px]"
                style={{
                  fontFamily: "var(--font-poppins)",
                  fontWeight: 600,
                  backgroundColor: `${task.department_color || "#8B5CF6"}10`,
                  color: task.department_color || "#8B5CF6",
                }}
              >
                <span
                  className="size-[5px] rounded-full flex-shrink-0"
                  style={{
                    backgroundColor: task.department_color || "#8B5CF6",
                  }}
                />
                {task.department_name}
              </span>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Grid Group ────────────────────────────────────────
function TaskGridGroup({
  groupKey,
  tasks,
  starredIds,
  onToggleStar,
  onToggleComplete,
  onEdit,
  onSetPriority,
  onDuplicate,
  onDelete,
  menuOpenId,
  onMenuToggle,
  onAddNewTask,
}: {
  groupKey: GroupKey;
  tasks: Task[];
  starredIds: Set<string>;
  onToggleStar: (id: string) => void;
  onToggleComplete: (id: string) => void;
  onEdit: (task: Task) => void;
  onSetPriority: (id: string, p: string) => void;
  onDuplicate: (task: Task) => void;
  onDelete: (id: string) => void;
  menuOpenId: string | null;
  onMenuToggle: (id: string | null) => void;
  onAddNewTask: () => void;
}) {
  const config = GROUP_CONFIG[groupKey];
  const Icon = config.Icon;
  const completedCount = tasks.filter((t) => t.status === "done").length;
  const pending = tasks.filter((t) => t.status !== "done");
  const completed = tasks.filter((t) => t.status === "done");

  if (tasks.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.23, 1, 0.32, 1] }}
      className="mb-8"
    >
      <div className="flex items-center gap-2.5 mb-4 px-1">
        <Icon className={`size-4 ${config.accentColor}`} />
        <h3
          className="text-[15px] text-[#2D333A]"
          style={{ fontFamily: "var(--font-poppins)", fontWeight: 600 }}
        >
          {config.label}
        </h3>
        <span
          className="text-[12px] text-[#9CA3AF]"
          style={{ fontFamily: "var(--font-source-sans)" }}
        >
          {completedCount > 0
            ? `${completedCount} of ${tasks.length} done`
            : `${tasks.length} task${tasks.length !== 1 ? "s" : ""}`}
        </span>
        {groupKey === "today" && pending.length > 0 && (
          <div className="ml-2 flex items-center gap-1.5">
            <div className="h-1 w-16 bg-[#F4F5F7] rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-[#5CE1A5] rounded-full"
                initial={{ width: 0 }}
                animate={{
                  width: `${(completedCount / tasks.length) * 100}%`,
                }}
                transition={{
                  duration: 0.8,
                  ease: [0.23, 1, 0.32, 1],
                }}
              />
            </div>
          </div>
        )}
        <div className="flex-1 h-px bg-[#E5E7EB]/60 ml-3" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {[...pending, ...completed].map((task) => (
          <TaskGridCard
            key={task.id}
            task={task}
            isStarred={starredIds.has(task.id)}
            onToggleStar={() => onToggleStar(task.id)}
            onToggleComplete={() => onToggleComplete(task.id)}
            onEdit={() => onEdit(task)}
            onSetPriority={(p) => onSetPriority(task.id, p)}
            onDuplicate={() => onDuplicate(task)}
            onDelete={() => onDelete(task.id)}
            menuOpenId={menuOpenId}
            onMenuToggle={onMenuToggle}
          />
        ))}

        {/* Add Task Card (Opens Modal) */}
        <button
          onClick={onAddNewTask}
          className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-[#E5E7EB] hover:border-[#5CE1A5]/40 py-10 text-[#9CA3AF] hover:text-[#5CE1A5] transition-all group/add cursor-pointer min-h-[120px]"
        >
          <div className="size-9 rounded-xl border-2 border-dashed border-[#E5E7EB] group-hover/add:border-[#5CE1A5]/40 flex items-center justify-center transition-colors">
            <Plus className="size-4" />
          </div>
          <span
            className="text-[13px]"
            style={{ fontFamily: "var(--font-poppins)", fontWeight: 600 }}
          >
            Add task
          </span>
        </button>
      </div>
    </motion.div>
  );
}

// ─── Insights Panel ────────────────────────────────────
function InsightsPanel({
  tasks,
  departments,
  activePriorityFilter,
  activeDepartmentFilter,
  onFilterPriority,
  onFilterDepartment,
}: {
  tasks: Task[];
  departments: Department[];
  activePriorityFilter: string | null;
  activeDepartmentFilter: string | null;
  onFilterPriority: (p: string | null) => void;
  onFilterDepartment: (id: string | null) => void;
}) {
  // Priority breakdown (pending only)
  const pendingTasks = tasks.filter((t) => t.status !== "done");
  const highCount = pendingTasks.filter((t) => t.priority === "high" || t.priority === "urgent").length;
  const mediumCount = pendingTasks.filter((t) => t.priority === "medium").length;
  const lowCount = pendingTasks.filter((t) => t.priority === "low").length;

  // Department breakdown (using the actual departments from the database!)
  const deptMap = new Map<string, { name: string; color: string; total: number; done: number }>();
  departments.forEach((d) => {
    deptMap.set(d.id, { name: d.name, color: d.color || "#8B5CF6", total: 0, done: 0 });
  });

  for (const t of tasks) {
    if (t.department_id && deptMap.has(t.department_id)) {
      const entry = deptMap.get(t.department_id)!;
      entry.total++;
      if (t.status === "done") entry.done++;
    }
  }
  const deptBreakdown = Array.from(deptMap.entries());

  return (
    <div className="space-y-6">
      {/* Active Filters Clear Button */}
      {(activePriorityFilter || activeDepartmentFilter) && (
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] text-[#5CE1A5] uppercase tracking-wider" style={{ fontFamily: "var(--font-poppins)", fontWeight: 700 }}>Active Filters</span>
          <button 
            onClick={() => { onFilterPriority(null); onFilterDepartment(null); }}
            className="text-[11px] text-[#9CA3AF] hover:text-[#DC2626] transition-colors"
            style={{ fontFamily: "var(--font-poppins)", fontWeight: 600 }}
          >
            Clear all
          </button>
        </div>
      )}

      {/* By Priority */}
      <div>
        <h4
          className="text-[13px] text-[#2D333A] uppercase tracking-wider mb-3 px-1"
          style={{ fontFamily: "var(--font-poppins)", fontWeight: 600 }}
        >
          By Priority
        </h4>
        <div className="space-y-1">
          {[
            { key: "high", label: "High", dot: "#EF4444", count: highCount },
            { key: "medium", label: "Medium", dot: "#F59E0B", count: mediumCount },
            { key: "low", label: "Low", dot: "#3B82F6", count: lowCount },
          ].map((item) => {
            const isActive = activePriorityFilter === item.key;
            return (
              <button
                key={item.key}
                onClick={() => onFilterPriority(isActive ? null : item.key)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-left border ${
                  isActive 
                    ? "bg-[#5CE1A5]/10 border-[#5CE1A5]/30 shadow-sm" 
                    : "hover:bg-[#F4F5F7] border-transparent"
                }`}
              >
                <span
                  className="size-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: item.dot }}
                />
                <span
                  className={`flex-1 text-[13px] ${isActive ? "text-[#059669] font-semibold" : "text-[#2D333A]"}`}
                  style={{ fontFamily: "var(--font-source-sans)" }}
                >
                  {item.label}
                </span>
                <span
                  className={`text-[12px] tabular-nums px-2 py-0.5 rounded-lg ${isActive ? "bg-white text-[#059669]" : "bg-[#F4F5F7] text-[#9CA3AF]"}`}
                  style={{ fontFamily: "var(--font-poppins)", fontWeight: 600 }}
                >
                  {item.count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* By Department */}
      {deptBreakdown.length > 0 && (
        <div>
          <h4
            className="text-[13px] text-[#2D333A] uppercase tracking-wider mb-3 px-1"
            style={{ fontFamily: "var(--font-poppins)", fontWeight: 600 }}
          >
            By Department
          </h4>
          <div className="space-y-2">
            {deptBreakdown.map(([id, dept]) => {
              const isActive = activeDepartmentFilter === id;
              return (
                <button
                  key={id}
                  onClick={() => onFilterDepartment(isActive ? null : id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-left border ${
                    isActive 
                      ? "bg-[#5CE1A5]/10 border-[#5CE1A5]/30 shadow-sm" 
                      : "hover:bg-[#F4F5F7] border-transparent"
                  }`}
                >
                  <span
                    className="size-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: dept.color }}
                  />
                  <div className="flex-1 min-w-0">
                    <p
                      className={`text-[13px] truncate ${isActive ? "text-[#059669] font-semibold" : "text-[#2D333A]"}`}
                      style={{ fontFamily: "var(--font-source-sans)" }}
                    >
                      {dept.name}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <div className="flex-1 h-1 bg-[#E5E7EB] rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            backgroundColor: dept.color,
                            width: `${dept.total > 0 ? (dept.done / dept.total) * 100 : 0}%`,
                          }}
                        />
                      </div>
                      <span
                        className={`text-[10px] ${isActive ? "text-[#059669]" : "text-[#9CA3AF]"}`}
                        style={{ fontFamily: "var(--font-source-sans)" }}
                      >
                        {dept.done}/{dept.total}
                      </span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Filter Tabs ────────────────────────────────────────
const FILTER_TABS: { id: ViewFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "starred", label: "Starred" },
];

// ─── Main View ──────────────────────────────────────────
export function TasksView({
  tasks: initialTasks,
  teamMembers,
  departments,
}: {
  tasks: Task[];
  teamMembers: TeamMember[];
  departments: Department[];
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [viewFilter, setViewFilter] = useState<ViewFilter>("all");
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [activePriorityFilter, setActivePriorityFilter] = useState<string | null>(null);
  const [activeDepartmentFilter, setActiveDepartmentFilter] = useState<string | null>(null);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [, startTransition] = useTransition();

  // TODO: Stars are not persisted to the database (no 'starred' column).
  // This is local state only. Add a starred column to the tasks table
  // and a toggleTaskStar server action to persist this.
  const [starredIds, setStarredIds] = useState<Set<string>>(new Set());

  const toggleStar = useCallback((id: string) => {
    setStarredIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const handleToggleComplete = useCallback(
    (id: string) => {
      startTransition(async () => {
        await toggleTaskComplete(id);
      });
    },
    [startTransition],
  );

  const handleDelete = useCallback(
    (id: string) => {
      startTransition(async () => {
        await deleteTask(id);
      });
    },
    [startTransition],
  );

  const handleSetPriority = useCallback(
    (id: string, priority: string) => {
      startTransition(async () => {
        await updateTask(id, {
          priority: priority as "low" | "medium" | "high" | "urgent",
        });
      });
    },
    [startTransition],
  );

  const handleDuplicate = useCallback(
    (task: Task) => {
      startTransition(async () => {
        await createTask({
          title: `${task.title} (copy)`,
          description: task.description || undefined,
          priority: task.priority as "low" | "medium" | "high" | "urgent",
          due_date: task.due_date,
          assigned_to: task.assigned_to,
          department_id: task.department_id,
        });
      });
    },
    [startTransition],
  );

  const handleEdit = useCallback((task: Task) => {
    setEditingTask(task);
    setShowModal(true);
    setMenuOpenId(null);
  }, []);

  const handleAddInline = useCallback(
    (title: string, groupKey: GroupKey) => {
      // Calculate due date based on group
      const now = new Date();
      let dueDate: string | null = null;

      if (groupKey === "today") {
        dueDate = now.toISOString();
      } else if (groupKey === "tomorrow") {
        const tmr = new Date(now);
        tmr.setDate(tmr.getDate() + 1);
        dueDate = tmr.toISOString();
      } else if (groupKey === "this-week") {
        const endOfWeek = new Date(now);
        endOfWeek.setDate(now.getDate() + (5 - now.getDay()));
        dueDate = endOfWeek.toISOString();
      }
      // "later" = null due date

      startTransition(async () => {
        await createTask({
          title: title.trim(),
          due_date: dueDate,
        });
      });
    },
    [startTransition],
  );

  // Filter
  let filtered = initialTasks;
  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    filtered = filtered.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        t.description?.toLowerCase().includes(q),
    );
  }
  if (viewFilter === "starred") {
    filtered = filtered.filter((t) => starredIds.has(t.id));
  }

  // Apply new Sidebar Priority Filter
  if (activePriorityFilter) {
    if (activePriorityFilter === "high") {
      filtered = filtered.filter((t) => t.priority === "high" || t.priority === "urgent");
    } else {
      filtered = filtered.filter((t) => t.priority === activePriorityFilter);
    }
  }

  // Apply new Sidebar Department Filter
  if (activeDepartmentFilter) {
    filtered = filtered.filter((t) => t.department_id === activeDepartmentFilter);
  }
  const grouped = groupTasks(filtered);
  const completedCount = initialTasks.filter(
    (t) => t.status === "done",
  ).length;
  const totalCount = initialTasks.length;

  return (
    <div className="h-full flex flex-col overflow-y-auto bg-white">
      {/* Header */}
      <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-6 mb-8 px-4 sm:px-6 pt-4 sm:pt-6">
        <div className="flex flex-col md:flex-row md:items-center gap-6">
          <div>
            <h1
              className="text-[24px] text-[#2D333A] leading-tight"
              style={{
                fontFamily: "var(--font-poppins)",
                fontWeight: 700,
              }}
            >
              My Tasks
            </h1>
            <p
              className="text-[16px] text-[#6B7280] mt-1"
              style={{ fontFamily: "var(--font-source-sans)" }}
            >
              Your personal tasks and to-dos.
            </p>
          </div>
          
          {totalCount > 0 && (
            <div className="hidden sm:flex items-center gap-3">
              <ProgressRing completed={completedCount} total={totalCount} />
              <div>
                <p
                  className="text-[13px] text-[#2D333A] leading-tight"
                  style={{ fontFamily: "var(--font-poppins)", fontWeight: 600 }}
                >
                  Total Progress
                </p>
                <p
                  className="text-[11px] text-[#6B7280] mt-0.5"
                  style={{ fontFamily: "var(--font-source-sans)" }}
                >
                  {completedCount} of {totalCount} completed
                </p>
              </div>
            </div>
          )}
        </div>
        <div className="mb-1 shrink-0">
          <button
            onClick={() => {
              setEditingTask(null);
              setShowModal(true);
            }}
            className="flex items-center gap-2 px-6 py-3 bg-[#5CE1A5] text-white rounded-xl text-[14px] hover:bg-[#4CD99A] active:scale-[0.98] transition-all shadow-lg shadow-[#5CE1A5]/20"
            style={{ fontWeight: 600 }}
          >
            <Plus className="size-4" />
            Add Task
          </button>
        </div>
      </div>

      {/* Filter bar + View Toggle */}
      <div className="flex items-center gap-3 mb-6 px-4 sm:px-6 flex-wrap">
        <div className="bg-[#F4F5F7] p-1 rounded-2xl flex items-center gap-1">
          {FILTER_TABS.map((tab) => {
            const isActive = viewFilter === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setViewFilter(tab.id)}
                className={`relative flex items-center gap-1.5 px-4 py-2 rounded-xl text-[13px] transition-all whitespace-nowrap ${
                  isActive
                    ? "text-[#2D333A]"
                    : "text-[#6B7280] hover:text-[#2D333A]"
                }`}
                style={{ fontWeight: 600 }}
              >
                {isActive && (
                  <motion.div
                    layoutId="tasksFilterTab"
                    className="absolute inset-0 bg-white rounded-xl shadow-sm"
                    transition={{
                      type: "spring",
                      bounce: 0.2,
                      duration: 0.6,
                    }}
                  />
                )}
                <span className="relative z-10">{tab.label}</span>
              </button>
            );
          })}
        </div>

        <div className="relative flex-1 min-w-[200px] max-w-[320px]">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-[#9CA3AF]" />
          <input
            type="text"
            placeholder="Search tasks..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-[#F4F5F7] border border-transparent rounded-xl text-[14px] text-[#2D333A] placeholder:text-[#9CA3AF] focus:border-[#5CE1A5] focus:ring-2 focus:ring-[#5CE1A5]/10 focus:outline-none transition-all"
            style={{ fontFamily: "var(--font-source-sans)" }}
          />
        </div>

        {/* View Mode Toggle */}
        <div className="flex items-center bg-[#F4F5F7] p-1 rounded-xl border border-[#E5E7EB]/50 ml-auto">
          <button
            onClick={() => setViewMode("list")}
            className={`relative p-2 rounded-lg transition-all ${
              viewMode === "list"
                ? "text-[#2D333A]"
                : "text-[#9CA3AF] hover:text-[#6B7280]"
            }`}
            title="List view"
          >
            {viewMode === "list" && (
              <motion.div
                layoutId="tasksViewMode"
                className="absolute inset-0 bg-white rounded-lg shadow-sm border border-gray-100/80"
                transition={{
                  type: "spring",
                  bounce: 0.15,
                  duration: 0.4,
                }}
              />
            )}
            <List className="size-4 relative z-10" />
          </button>
          <button
            onClick={() => setViewMode("grid")}
            className={`relative p-2 rounded-lg transition-all ${
              viewMode === "grid"
                ? "text-[#2D333A]"
                : "text-[#9CA3AF] hover:text-[#6B7280]"
            }`}
            title="Card view"
          >
            {viewMode === "grid" && (
              <motion.div
                layoutId="tasksViewMode"
                className="absolute inset-0 bg-white rounded-lg shadow-sm border border-gray-100/80"
                transition={{
                  type: "spring",
                  bounce: 0.15,
                  duration: 0.4,
                }}
              />
            )}
            <LayoutGrid className="size-4 relative z-10" />
          </button>
        </div>
      </div>

      {/* Main content + Insights sidebar */}
      <div className="flex gap-8 px-4 sm:px-6 flex-1 pb-8">
        {/* Left: Task content */}
        <div className="flex-1 min-w-0">
          {totalCount === 0 ? (
            /* Empty state */
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="size-20 rounded-full bg-[#F4F5F7] flex items-center justify-center mb-5">
                <Target
                  className="size-9 text-[#9CA3AF]"
                  strokeWidth={1.5}
                />
              </div>
              <h3
                className="text-[20px] text-[#2D333A] mb-2"
                style={{
                  fontFamily: "var(--font-poppins)",
                  fontWeight: 600,
                }}
              >
                No tasks yet
              </h3>
              <p
                className="text-[15px] text-[#6B7280] max-w-[320px] leading-relaxed"
                style={{ fontFamily: "var(--font-source-sans)" }}
              >
                Stay organized by creating your first task. Assign
                deadlines, set priorities, and track your progress.
              </p>
              <button
                onClick={() => {
                  setEditingTask(null);
                  setShowModal(true);
                }}
                className="mt-6 flex items-center gap-2 px-5 py-2.5 bg-[#5CE1A5] text-white rounded-xl text-[14px] hover:bg-[#4CD99A] transition-all"
                style={{ fontWeight: 600 }}
              >
                <Plus className="size-4" />
                Add your first task
              </button>
            </div>
          ) : filtered.length === 0 ? (
            /* No results state */
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="size-16 rounded-full bg-[#F4F5F7] flex items-center justify-center mb-4">
                <Search
                  className="size-7 text-[#9CA3AF]"
                  strokeWidth={1.5}
                />
              </div>
              <h3
                className="text-[18px] text-[#2D333A] mb-2"
                style={{
                  fontFamily: "var(--font-poppins)",
                  fontWeight: 600,
                }}
              >
                No matching tasks
              </h3>
              <p
                className="text-[14px] text-[#6B7280]"
                style={{ fontFamily: "var(--font-source-sans)" }}
              >
                Try adjusting your search or filter.
              </p>
            </div>
          ) : (
            <AnimatePresence mode="wait">
              {viewMode === "list" ? (
                <motion.div
                  key="list-view"
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -12 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-1"
                >
                  {GROUP_ORDER.map((key) => (
                    <TaskGroup
                      key={key}
                      groupKey={key}
                      tasks={grouped[key]}
                      starredIds={starredIds}
                      onToggleStar={toggleStar}
                      onToggleComplete={handleToggleComplete}
                      onEdit={handleEdit}
                      onSetPriority={handleSetPriority}
                      onDuplicate={handleDuplicate}
                      onDelete={handleDelete}
                      menuOpenId={menuOpenId}
                      onMenuToggle={setMenuOpenId}
                      onAddNewTask={() => {
                        setEditingTask(null);
                        setShowModal(true);
                      }}
                    />
                  ))}
                </motion.div>
              ) : (
                <motion.div
                  key="grid-view"
                  initial={{ opacity: 0, x: 12 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 12 }}
                  transition={{ duration: 0.2 }}
                >
                  {GROUP_ORDER.map((key) => (
                    <TaskGridGroup
                      key={key}
                      groupKey={key}
                      tasks={grouped[key]}
                      starredIds={starredIds}
                      onToggleStar={toggleStar}
                      onToggleComplete={handleToggleComplete}
                      onEdit={handleEdit}
                      onSetPriority={handleSetPriority}
                      onDuplicate={handleDuplicate}
                      onDelete={handleDelete}
                      menuOpenId={menuOpenId}
                      onMenuToggle={setMenuOpenId}
                      onAddNewTask={() => {
                        setEditingTask(null);
                        setShowModal(true);
                      }}
                    />
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          )}
        </div>

        {/* Right: Insights Panel */}
        <div className="w-[260px] shrink-0 hidden xl:block">
          <InsightsPanel
            tasks={initialTasks}
            departments={departments}
            activePriorityFilter={activePriorityFilter}
            activeDepartmentFilter={activeDepartmentFilter}
            onFilterPriority={setActivePriorityFilter}
            onFilterDepartment={setActiveDepartmentFilter}
          />
        </div>
      </div>

      {/* Task Modal */}
      <TaskModal
        open={showModal}
        onClose={() => {
          setShowModal(false);
          setEditingTask(null);
        }}
        task={editingTask}
        teamMembers={teamMembers}
        departments={departments}
      />
    </div>
  );
}