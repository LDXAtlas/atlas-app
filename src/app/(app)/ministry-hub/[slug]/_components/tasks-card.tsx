"use client";

import Link from "next/link";
import { CheckSquare, ChevronRight, Circle, Loader2, Ban } from "lucide-react";
import type { MinistryDetailTask } from "@/app/actions/ministry-hub";

const PRIORITY_COLORS: Record<MinistryDetailTask["priority"], string> = {
  low: "#9CA3AF",
  medium: "#3B82F6",
  high: "#F59E0B",
  urgent: "#EF4444",
};

const STATUS_LABEL: Record<MinistryDetailTask["status"], string> = {
  todo: "To do",
  in_progress: "In progress",
  done: "Done",
  blocked: "Blocked",
};

function formatDue(due: string | null): { label: string; tone: "muted" | "warn" | "overdue" } {
  if (!due) return { label: "No due date", tone: "muted" };
  const d = new Date(due);
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diffDays = Math.floor((d.getTime() - startOfToday.getTime()) / (24 * 60 * 60 * 1000));
  if (diffDays < 0) return { label: `${Math.abs(diffDays)}d overdue`, tone: "overdue" };
  if (diffDays === 0) return { label: "Today", tone: "warn" };
  if (diffDays === 1) return { label: "Tomorrow", tone: "warn" };
  if (diffDays < 7) return { label: `In ${diffDays}d`, tone: "muted" };
  return {
    label: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    tone: "muted",
  };
}

function initials(name: string | null): string {
  if (!name) return "?";
  return name
    .split(" ")
    .map((n) => n[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

interface TasksCardProps {
  tasks: MinistryDetailTask[];
  counts: { todo: number; in_progress: number; blocked: number; done: number };
  departmentId: string;
}

export function TasksCard({ tasks, counts, departmentId }: TasksCardProps) {
  return (
    <section className="bg-white rounded-2xl border border-[#E5E7EB] overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4">
        <div className="flex items-center gap-2">
          <div className="size-7 rounded-lg bg-[#EDE9FE] flex items-center justify-center">
            <CheckSquare className="size-4 text-[#7C3AED]" />
          </div>
          <h3
            className="text-[14px] text-[#2D333A]"
            style={{ fontFamily: "var(--font-poppins)", fontWeight: 600 }}
          >
            Open Tasks
          </h3>
          <span
            className="text-[11px] font-semibold text-[#6B7280] bg-[#F3F4F6] px-1.5 py-0.5 rounded-md"
            style={{ fontFamily: "var(--font-poppins)" }}
          >
            {counts.todo + counts.in_progress + counts.blocked}
          </span>
        </div>
        <Link
          href={`/workspace/tasks?ministry=${departmentId}`}
          className="text-[12px] font-semibold text-[#5CE1A5] hover:text-[#3DB882] flex items-center gap-0.5 transition-colors"
          style={{ fontFamily: "var(--font-poppins)" }}
        >
          View all
          <ChevronRight className="size-3" />
        </Link>
      </div>

      <div className="px-5 pb-3 grid grid-cols-3 gap-2">
        <MiniStat
          label="To Do"
          value={counts.todo}
          icon={<Circle className="size-3 text-[#9CA3AF]" />}
        />
        <MiniStat
          label="In Progress"
          value={counts.in_progress}
          icon={<Loader2 className="size-3 text-[#3B82F6]" />}
        />
        <MiniStat
          label="Blocked"
          value={counts.blocked}
          icon={<Ban className="size-3 text-[#EF4444]" />}
        />
      </div>

      {tasks.length === 0 ? (
        <div className="border-t border-[#F3F4F6] px-5 py-10 text-center">
          <p
            className="text-[13px] text-[#9CA3AF]"
            style={{ fontFamily: "var(--font-source-sans)" }}
          >
            No tasks yet
          </p>
        </div>
      ) : (
        <ul className="border-t border-[#F3F4F6]">
          {tasks.map((t) => {
            const due = formatDue(t.due_date);
            return (
              <li
                key={t.id}
                className="px-5 py-3 border-b border-[#F3F4F6] last:border-b-0 hover:bg-[#FAFBFC] transition-colors"
              >
                <Link
                  href={`/workspace/tasks?ministry=${departmentId}#t-${t.id}`}
                  className="flex items-center gap-3 min-w-0"
                >
                  <span
                    className="w-1 h-6 rounded-full shrink-0"
                    style={{ backgroundColor: PRIORITY_COLORS[t.priority] }}
                    title={`${t.priority} priority`}
                  />
                  <span
                    className="text-[13px] text-[#2D333A] flex-1 truncate"
                    style={{ fontFamily: "var(--font-poppins)", fontWeight: 500 }}
                  >
                    {t.title}
                  </span>
                  {t.status !== "todo" && (
                    <span
                      className="hidden sm:inline-flex items-center text-[10px] font-semibold uppercase tracking-wide text-[#6B7280] bg-[#F3F4F6] px-1.5 py-0.5 rounded-md shrink-0"
                      style={{ fontFamily: "var(--font-poppins)" }}
                    >
                      {STATUS_LABEL[t.status]}
                    </span>
                  )}
                  {t.assigned_to_name && (
                    <span
                      className="size-6 rounded-full bg-[#5CE1A5] text-white text-[10px] font-semibold flex items-center justify-center shrink-0"
                      style={{ fontFamily: "var(--font-poppins)" }}
                      title={t.assigned_to_name}
                    >
                      {initials(t.assigned_to_name)}
                    </span>
                  )}
                  <span
                    className={`text-[11px] shrink-0 ${
                      due.tone === "overdue"
                        ? "text-[#DC2626] font-semibold"
                        : due.tone === "warn"
                          ? "text-[#F59E0B] font-semibold"
                          : "text-[#9CA3AF]"
                    }`}
                    style={{ fontFamily: "var(--font-poppins)" }}
                  >
                    {due.label}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function MiniStat({
  label,
  value,
  icon,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-xl bg-[#F9FAFB] border border-[#F3F4F6] px-3 py-2">
      <div className="flex items-center gap-1.5">
        {icon}
        <span
          className="text-[10px] font-semibold uppercase tracking-wider text-[#9CA3AF]"
          style={{ fontFamily: "var(--font-poppins)" }}
        >
          {label}
        </span>
      </div>
      <p
        className="text-[18px] text-[#2D333A] leading-none mt-1"
        style={{ fontFamily: "var(--font-poppins)", fontWeight: 700 }}
      >
        {value}
      </p>
    </div>
  );
}
