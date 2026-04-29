"use client";

import { motion, AnimatePresence } from "motion/react";
import {
  X,
  Check,
  Users,
  UserCheck,
  Folder,
  Armchair,
  Target,
  Calendar,
  MessageSquare,
  Heart,
  Video,
  Megaphone,
  CheckSquare,
  Building2,
  BarChart3,
  Sparkles,
} from "lucide-react";
import type { WidgetId } from "./dashboard-client";

// ─── Widget Catalog ─────────────────────────────────────

interface WidgetCatalogEntry {
  id: WidgetId;
  label: string;
  description: string;
  module: "overview" | "workspace" | "serve" | "care";
  moduleColor: string;
  icon: React.ElementType;
}

// "quick-actions" was removed from this catalog array so users don't 
// accidentally add a second, draggable version since it is now permanently pinned!
const WIDGET_CATALOG: WidgetCatalogEntry[] = [
  {
    id: "stats-overview",
    label: "Quick Stats",
    description: "Key metrics at a glance",
    module: "overview",
    moduleColor: "#5CE1A5",
    icon: BarChart3,
  },
  {
    id: "recent-members",
    label: "Recent Members",
    description: "Newest members in your organization",
    module: "overview",
    moduleColor: "#5CE1A5",
    icon: Users,
  },
  {
    id: "subscription-overview",
    label: "Subscription Overview",
    description: "Plan usage and limits",
    module: "overview",
    moduleColor: "#5CE1A5",
    icon: Armchair,
  },
  {
    id: "my-tasks",
    label: "My Tasks",
    description: "Your upcoming tasks and action items",
    module: "workspace",
    moduleColor: "#3B82F6",
    icon: CheckSquare,
  },
  {
    id: "announcements-feed",
    label: "Announcements",
    description: "Latest team updates and news",
    module: "workspace",
    moduleColor: "#3B82F6",
    icon: Megaphone,
  },
  {
    id: "upcoming-events",
    label: "Upcoming Events",
    description: "Events and services coming up",
    module: "serve",
    moduleColor: "#10B981",
    icon: Calendar,
  },
  {
    id: "recent-departments",
    label: "Departments",
    description: "Your team structure overview",
    module: "care",
    moduleColor: "#EC4899",
    icon: Building2,
  },
];

export { WIDGET_CATALOG };

// ─── Modal Component ────────────────────────────────────

interface WidgetLibraryProps {
  open: boolean;
  onClose: () => void;
  activeWidgetIds: WidgetId[];
  onToggleWidget: (id: WidgetId) => void;
}

const MODULE_LABELS: Record<string, string> = {
  overview: "Overview",
  workspace: "Workspace",
  serve: "Serve",
  care: "Care",
};

export function WidgetLibrary({
  open,
  onClose,
  activeWidgetIds,
  onToggleWidget,
}: WidgetLibraryProps) {
  const groups = (["overview", "workspace", "serve", "care"] as const);

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[150]"
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.25, ease: [0.23, 1, 0.32, 1] }}
            className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] max-w-[90vw] max-h-[80vh] bg-white rounded-3xl border border-[#E5E7EB]/50 overflow-hidden z-[151] flex flex-col"
            style={{
              boxShadow:
                "0 25px 50px -12px rgba(0,0,0,0.25), 0 0 0 1px rgba(0,0,0,0.05)",
            }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-8 py-6 border-b border-[#E5E7EB]">
              <div>
                <h3
                  className="text-[20px] text-[#2D333A]"
                  style={{
                    fontFamily: "var(--font-poppins)",
                    fontWeight: 600,
                  }}
                >
                  Widget Library
                </h3>
                <p
                  className="text-[14px] text-[#9CA3AF] mt-1"
                  style={{ fontFamily: "var(--font-source-sans)" }}
                >
                  Customize your dashboard experience
                </p>
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-[#F4F5F7] rounded-full transition-colors"
              >
                <X className="size-5 text-[#6B7280]" />
              </button>
            </div>

            {/* Widget list */}
            <div className="flex-1 overflow-y-auto p-6 space-y-8">
              {groups.map((mod) => {
                const widgets = WIDGET_CATALOG.filter(
                  (w) => w.module === mod
                );
                if (widgets.length === 0) return null;

                return (
                  <div key={mod}>
                    <p
                      className="text-[11px] uppercase tracking-[0.12em] text-[#9CA3AF] px-2 mb-3"
                      style={{
                        fontFamily: "var(--font-poppins)",
                        fontWeight: 700,
                      }}
                    >
                      {MODULE_LABELS[mod]}
                    </p>
                    <div className="grid grid-cols-1 gap-2">
                      {widgets.map((ww) => {
                        const isActive = activeWidgetIds.includes(ww.id);
                        const Icon = ww.icon;
                        return (
                          <button
                            key={ww.id}
                            onClick={() => onToggleWidget(ww.id)}
                            className={`w-full flex items-center gap-4 px-4 py-3 rounded-2xl transition-all text-left group ${
                              isActive
                                ? "bg-[#5CE1A5]/5 ring-1 ring-[#5CE1A5]"
                                : "hover:bg-[#F4F5F7] border border-transparent"
                            }`}
                          >
                            <div
                              className={`size-12 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                                isActive
                                  ? "bg-white shadow-sm"
                                  : "bg-[#F4F5F7] group-hover:bg-white group-hover:shadow-sm"
                              }`}
                            >
                              <Icon
                                className="size-6"
                                style={{ color: ww.moduleColor }}
                              />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p
                                className="text-[15px] text-[#2D333A]"
                                style={{
                                  fontFamily: "var(--font-poppins)",
                                  fontWeight: 600,
                                }}
                              >
                                {ww.label}
                              </p>
                              <p
                                className="text-[13px] text-[#9CA3AF] mt-0.5"
                                style={{
                                  fontFamily: "var(--font-source-sans)",
                                }}
                              >
                                {ww.description}
                              </p>
                            </div>
                            <div
                              className={`size-6 rounded-full flex items-center justify-center shrink-0 transition-all ${
                                isActive
                                  ? "bg-[#5CE1A5]"
                                  : "bg-[#E5E7EB] group-hover:bg-[#D1D5DB]"
                              }`}
                            >
                              {isActive && (
                                <Check
                                  className="size-3.5 text-white"
                                  strokeWidth={3}
                                />
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}