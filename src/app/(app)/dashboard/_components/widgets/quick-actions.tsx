"use client";

import Link from "next/link";
import {
  Target,
  Calendar,
  MessageSquare,
  Heart,
  Video,
  Users,
} from "lucide-react";

const actions = [
  {
    id: "new-task",
    label: "New Task",
    icon: Target,
    color: "#3B82F6",
    href: "/workspace/tasks",
  },
  {
    id: "new-event",
    label: "New Event",
    icon: Calendar,
    color: "#10B981",
    href: "/workspace/events",
  },
  {
    id: "send-message",
    label: "Message",
    icon: MessageSquare,
    color: "#8B5CF6",
    href: "/workspace/announcements",
  },
  {
    id: "follow-ups",
    label: "Follow-Ups",
    icon: Heart,
    color: "#EC4899",
    href: "/care/follow-ups",
  },
  {
    id: "schedule-huddle",
    label: "Huddle",
    icon: Video,
    color: "#F59E0B",
    href: "/workspace/team-huddles",
  },
  {
    id: "directory",
    label: "Directory",
    icon: Users,
    color: "#5CE1A5",
    href: "/directory",
  },
];

export function QuickActions() {
  return (
    <div
      className="bg-white rounded-3xl p-2.5 h-full flex flex-col border border-[#E5E7EB]/50 transition-all duration-300 hover:border-[#D1D5DB] hover:shadow-[0_12px_30px_-8px_rgba(0,0,0,0.08)]"
      style={{
        boxShadow:
          "0 4px 20px -2px rgba(0,0,0,0.02), 0 1px 4px -1px rgba(0,0,0,0.02)",
      }}
    >
      <div className="flex justify-between items-center gap-1.5 flex-1">
        {actions.map((action) => {
          const Icon = action.icon;
          return (
            <Link
              key={action.id}
              href={action.href}
              className="flex-1 flex flex-col items-center justify-center gap-1 p-2 rounded-xl transition-all group h-full no-underline"
              style={{ backgroundColor: `${action.color}15` }}
            >
              <div className="size-[50px] rounded-md flex items-center justify-center transition-all group-hover:-translate-y-1 group-hover:shadow-md">
                <Icon
                  className="size-8"
                  style={{ color: action.color }}
                  strokeWidth={2.5}
                />
              </div>
              <span
                className="text-[15px] truncate max-w-full px-1 text-center"
                style={{
                  fontFamily: "var(--font-poppins)",
                  fontWeight: 500,
                  color: action.color,
                }}
              >
                {action.label}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
