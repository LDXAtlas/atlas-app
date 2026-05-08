"use client";

import Link from "next/link";
import { motion } from "motion/react";
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
    // Added ?action=new to trigger the popup on the target page
    href: "/workspace/tasks?action=new", 
  },
  {
    id: "new-event",
    label: "New Event",
    icon: Calendar,
    color: "#10B981",
    // Added ?action=new to trigger the popup on the target page
    href: "/workspace/events?action=new",
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

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
      delayChildren: 0.2,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, scale: 0.8 },
  show: { 
    opacity: 1, 
    scale: 1,
    transition: {
      type: "spring" as const,
      stiffness: 400,
      damping: 25,
    }
  },
};

export function QuickActions() {
  return (
    <div className="h-full flex flex-col w-full py-1">
      <motion.div 
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="flex justify-between items-stretch gap-4 sm:gap-5 flex-1"
      >
        {actions.map((action) => {
          const Icon = action.icon;
          return (
            <motion.div
              key={action.id}
              variants={itemVariants}
              whileHover={{ y: -4 }}
              whileTap={{ scale: 0.92, y: 0 }}
              className="flex-1 min-w-0"
            >
              <Link
                href={action.href}
                className="flex flex-col items-center justify-center gap-2 p-3 rounded-2xl transition-all group h-full no-underline relative overflow-hidden"
              >
                {/* Background active state */}
                <div 
                  className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                  style={{ backgroundColor: `${action.color}0C` }}
                />

                <div 
                  className="size-[46px] rounded-xl flex items-center justify-center relative z-10 transition-all duration-300 group-hover:shadow-md"
                  style={{ 
                    backgroundColor: `${action.color}15`,
                    border: `1px solid ${action.color}25`
                  }}
                >
                  <Icon
                    className="size-6 transition-transform duration-300 group-hover:scale-110"
                    style={{ color: action.color }}
                    strokeWidth={2}
                  />
                </div>
                <div className="text-center w-full relative z-10 mt-1">
                  <span
                    className="text-[13px] truncate w-full block transition-colors duration-300 font-medium"
                    style={{
                      fontFamily: "var(--font-source-sans)",
                      color: "#6B7280",
                    }}
                  >
                    <span className="group-hover:text-[#2D333A] transition-colors">{action.label}</span>
                  </span>
                </div>
              </Link>
            </motion.div>
          );
        })}
      </motion.div>
    </div>
  );
}