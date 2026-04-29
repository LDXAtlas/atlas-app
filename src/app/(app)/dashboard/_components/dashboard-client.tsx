"use client";

import { useState, useEffect, useCallback } from "react";
import { AnimatePresence, motion, Reorder, useDragControls } from "motion/react";
import {
  Settings,
  GripVertical,
  X,
  Plus,
  ChevronUp,
  ChevronDown,
} from "lucide-react";

import { StatsOverview } from "./widgets/stats-overview";
import { QuickActions } from "./widgets/quick-actions";
import { RecentMembers } from "./widgets/recent-members";
import { SubscriptionOverview } from "./widgets/subscription-overview";
import { AnnouncementsFeed } from "./widgets/announcements-feed";
import { UpcomingEvents, type UpcomingEventData } from "./widgets/upcoming-events";
import { MyTasks } from "./widgets/my-tasks";
import { RecentDepartments } from "./widgets/recent-departments";
import { WidgetLibrary } from "./widget-library";

// ─── Types ──────────────────────────────────────────────

// Removed "quick-actions" since it is now permanently pinned
export type WidgetId =
  | "stats-overview"
  | "recent-members"
  | "subscription-overview"
  | "announcements-feed"
  | "upcoming-events"
  | "my-tasks"
  | "recent-departments";

export interface DashboardProps {
  userName: string;
  orgName: string;
  subscriptionTier: string;
  seatLimit: number;
  aiCreditsLimit: number;
  totalMembers: number;
  activeMembers: number;
  departmentCount: number;
  departments: {
    id: string;
    name: string;
    color: string;
    member_count: number;
  }[];
  recentMembers: {
    id: string;
    first_name: string;
    last_name: string;
    email: string | null;
    membership_status: string;
    created_at: string;
  }[];
  recentAnnouncements: {
    id: string;
    title: string;
    content: string;
    category: string;
    is_pinned: boolean;
    published_at: string;
    author_name: string;
    is_read: boolean;
    target_department_name: string | null;
    target_department_color: string | null;
  }[];
  upcomingEvents?: UpcomingEventData[];
}

// ─── Widget Layout Config ───────────────────────────────

export interface WidgetLayoutItem {
  id: WidgetId;
  colSpan: number; // out of 12
}

const DEFAULT_LAYOUT: WidgetLayoutItem[] = [
  { id: "stats-overview", colSpan: 6 },
  { id: "recent-members", colSpan: 8 },
  { id: "subscription-overview", colSpan: 4 },
  { id: "announcements-feed", colSpan: 6 },
  { id: "upcoming-events", colSpan: 6 },
  { id: "my-tasks", colSpan: 6 },
  { id: "recent-departments", colSpan: 6 },
];

const STORAGE_KEY = "atlas_dashboard_layout_v2";

function loadLayout(): WidgetLayoutItem[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed) && parsed.length > 0 && parsed[0]?.id) {
        // Filter out quick-actions in case the user had it saved in an older session
        return parsed.filter((w: any) => w.id !== "quick-actions");
      }
    }
  } catch {
    // ignore
  }
  return DEFAULT_LAYOUT;
}

function saveLayout(layout: WidgetLayoutItem[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(layout));
  } catch {
    // ignore
  }
}

// ─── Helpers ────────────────────────────────────────────

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function getFirstName(fullName: string): string {
  return fullName.split(" ")[0] || fullName;
}

function formatDate(): string {
  const now = new Date();
  const days = [
    "Sunday", "Monday", "Tuesday", "Wednesday",
    "Thursday", "Friday", "Saturday",
  ];
  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];
  return `${days[now.getDay()]}, ${months[now.getMonth()]} ${now.getDate()}, ${now.getFullYear()}`;
}

// ─── Sortable Widget Wrapper ────────────────────────────

interface SortableWidgetProps {
  item: WidgetLayoutItem;
  index: number;
  isEditing: boolean;
  onRemove: (id: WidgetId) => void;
  onMoveUp: (index: number) => void;
  onMoveDown: (index: number) => void;
  isFirst: boolean;
  isLast: boolean;
  children: React.ReactNode;
}

function SortableWidget({
  item,
  index,
  isEditing,
  onRemove,
  onMoveUp,
  onMoveDown,
  isFirst,
  isLast,
  children,
}: SortableWidgetProps) {
  const controls = useDragControls();

  // Responsive: on smaller screens force full width
  const responsiveClass =
    item.colSpan === 12
      ? "col-span-12"
      : item.colSpan === 8
      ? "col-span-8 max-lg:col-span-12"
      : item.colSpan === 4
      ? "col-span-4 max-lg:col-span-12"
      : "col-span-6 max-lg:col-span-12";

  return (
    <Reorder.Item
      as="div"
      value={item}
      id={item.id}
      drag // OVERRIDE: Forces full 360 degree (X and Y) dragging
      layout="position" // FIX: Prevents the "half-off" bug by only animating position, not CSS Grid cell width
      dragListener={false} // Prevents dragging by clicking the widget body
      dragControls={controls} // Binds drag solely to the handle
      whileDrag={{
        scale: 1.02,
        boxShadow: "0 25px 50px -12px rgba(0,0,0,0.15)",
        zIndex: 100,
      }}
      className={`${responsiveClass} relative rounded-3xl will-change-transform bg-white ${isEditing ? "select-none" : ""}`}
    >
      {/* Edit mode overlay - Blocks clicks to the widget internals and adds a subtle glass effect */}
      {isEditing && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 z-10 rounded-3xl border-2 border-dashed border-[#5CE1A5]/60 bg-white/10 backdrop-blur-[1.5px]"
        />
      )}

      {/* Edit mode controls */}
      <AnimatePresence>
        {isEditing && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="absolute top-3 left-3 z-20 flex items-center gap-1"
          >
            {/* The Drag Handle */}
            <div
              onPointerDown={(e) => controls.start(e)}
              style={{ touchAction: "none" }} // Prevents mobile scrolling when trying to drag
              className="p-1.5 bg-white/95 backdrop-blur-sm rounded-lg border border-[#E5E7EB] text-[#9CA3AF] cursor-grab active:cursor-grabbing hover:bg-[#F4F5F7] transition-colors shadow-sm"
              title="Drag to move"
            >
              <GripVertical className="size-4" />
            </div>
            
            {/* Fallback explicit move buttons */}
            <button
              onClick={() => onMoveUp(index)}
              disabled={isFirst}
              className="p-1.5 bg-white/95 backdrop-blur-sm rounded-lg border border-[#E5E7EB] text-[#6B7280] hover:bg-[#F4F5F7] disabled:opacity-30 disabled:cursor-not-allowed transition-colors shadow-sm"
              title="Move Up"
            >
              <ChevronUp className="size-4" />
            </button>
            <button
              onClick={() => onMoveDown(index)}
              disabled={isLast}
              className="p-1.5 bg-white/95 backdrop-blur-sm rounded-lg border border-[#E5E7EB] text-[#6B7280] hover:bg-[#F4F5F7] disabled:opacity-30 disabled:cursor-not-allowed transition-colors shadow-sm"
              title="Move Down"
            >
              <ChevronDown className="size-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete button */}
      <AnimatePresence>
        {isEditing && (
          <motion.button
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            onClick={() => onRemove(item.id)}
            className="absolute top-3 right-3 z-20 p-1.5 bg-white/95 backdrop-blur-sm rounded-lg border border-[#E5E7EB] text-[#EF4444] hover:bg-red-50 transition-colors shadow-sm"
            title="Remove Widget"
          >
            <X className="size-4" />
          </motion.button>
        )}
      </AnimatePresence>

      <div className="h-full pointer-events-auto">
        {children}
      </div>
    </Reorder.Item>
  );
}

// ─── Component ──────────────────────────────────────────

export function DashboardClient({
  userName,
  orgName,
  subscriptionTier,
  seatLimit,
  aiCreditsLimit,
  totalMembers,
  activeMembers,
  departmentCount,
  departments,
  recentMembers,
  recentAnnouncements,
  upcomingEvents = [],
}: DashboardProps) {
  const firstName = getFirstName(userName);
  const greeting = getGreeting();
  const dateString = formatDate();

  // ── Layout state ──
  const [layout, setLayout] = useState<WidgetLayoutItem[]>(DEFAULT_LAYOUT);
  const [isEditing, setIsEditing] = useState(false);
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [preEditLayout, setPreEditLayout] = useState<WidgetLayoutItem[]>([]);

  // Load from localStorage on mount
  useEffect(() => {
    setLayout(loadLayout());
  }, []);

  // ── Edit mode handlers ──
  const enterEditMode = useCallback(() => {
    setPreEditLayout([...layout]);
    setIsEditing(true);
  }, [layout]);

  const cancelEdit = useCallback(() => {
    setLayout(preEditLayout);
    setIsEditing(false);
  }, [preEditLayout]);

  const saveEdit = useCallback(() => {
    saveLayout(layout);
    setIsEditing(false);
  }, [layout]);

  // ── Explicit Widget reordering (Fallback to drag) ──
  const moveWidget = useCallback(
    (index: number, direction: "up" | "down") => {
      const newLayout = [...layout];
      const targetIndex = direction === "up" ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= newLayout.length) return;
      [newLayout[index], newLayout[targetIndex]] = [
        newLayout[targetIndex],
        newLayout[index],
      ];
      setLayout(newLayout);
    },
    [layout]
  );

  // ── Widget removal ──
  const removeWidget = useCallback(
    (id: WidgetId) => {
      setLayout(layout.filter((w) => w.id !== id));
    },
    [layout]
  );

  // ── Widget toggle (from library) ──
  const toggleWidget = useCallback(
    (id: WidgetId) => {
      const exists = layout.find((w) => w.id === id);
      if (exists) {
        setLayout(layout.filter((w) => w.id !== id));
      } else {
        const defaultItem = DEFAULT_LAYOUT.find((w) => w.id === id);
        const colSpan = defaultItem?.colSpan ?? 6;
        setLayout([...layout, { id, colSpan }]);
      }
    },
    [layout]
  );

  // ── Widget renderer ──
  function renderWidget(id: WidgetId) {
    switch (id) {
      case "stats-overview":
        return (
          <StatsOverview
            totalMembers={totalMembers}
            activeMembers={activeMembers}
            departmentCount={departmentCount}
            seatLimit={seatLimit}
          />
        );
      case "recent-members":
        return <RecentMembers members={recentMembers} />;
      case "subscription-overview":
        return (
          <SubscriptionOverview
            tier={subscriptionTier}
            seatLimit={seatLimit}
            aiCreditsLimit={aiCreditsLimit}
            totalMembers={totalMembers}
          />
        );
      case "announcements-feed":
        return <AnnouncementsFeed announcements={recentAnnouncements} />;
      case "upcoming-events":
        return <UpcomingEvents events={upcomingEvents} />;
      case "my-tasks":
        return <MyTasks />;
      case "recent-departments":
        return <RecentDepartments departments={departments} />;
      default:
        return null;
    }
  }

  return (
    <div className="max-w-[1400px] mx-auto">
      {/* ── Welcome Header ── */}
      <div
        className="py-2 mb-6 flex items-start justify-between gap-4"
        style={{ borderBottom: "1px solid #E5E7EB" }}
      >
        <div>
          <h1
            className="text-3xl text-[#2D333A]"
            style={{ fontFamily: "var(--font-poppins)", fontWeight: 700 }}
          >
            {greeting}, {firstName}
          </h1>
          <p
            className="text-[15px] text-[#6B7280] mt-1"
            style={{ fontFamily: "var(--font-source-sans)" }}
          >
            {orgName} &middot; {dateString}
          </p>
        </div>

        {/* Customize / Edit controls */}
        <div className="flex items-center gap-3 shrink-0 pt-1">
          <AnimatePresence mode="wait">
            {isEditing ? (
              <motion.div
                key="edit-controls"
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.15 }}
                className="flex items-center gap-2"
              >
                <button
                  onClick={cancelEdit}
                  className="px-4 py-2 rounded-xl bg-white border border-[#E5E7EB] text-[#6B7280] text-[14px] hover:bg-[#F4F5F7] transition-colors"
                  style={{
                    fontFamily: "var(--font-poppins)",
                    fontWeight: 500,
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={() => setCatalogOpen(true)}
                  className="px-4 py-2 rounded-xl bg-white border border-[#5CE1A5] text-[#5CE1A5] text-[14px] hover:bg-[#5CE1A5]/5 transition-colors flex items-center gap-1.5"
                  style={{
                    fontFamily: "var(--font-poppins)",
                    fontWeight: 500,
                  }}
                >
                  <Plus className="size-4" />
                  Add Widget
                </button>
                <button
                  onClick={saveEdit}
                  className="px-5 py-2 rounded-xl bg-[#5CE1A5] text-white text-[14px] hover:bg-[#4BD095] transition-all hover:-translate-y-0.5"
                  style={{
                    fontFamily: "var(--font-poppins)",
                    fontWeight: 600,
                    boxShadow: "0 4px 14px -2px rgba(92, 225, 165, 0.4)",
                  }}
                >
                  Save
                </button>
              </motion.div>
            ) : (
              <motion.button
                key="customize-btn"
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.15 }}
                onClick={enterEditMode}
                className="group flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-[#E5E7EB] hover:border-[#D1D5DB] text-[#6B7280] hover:text-[#2D333A] text-[14px] transition-all hover:shadow-sm"
                style={{
                  fontFamily: "var(--font-poppins)",
                  fontWeight: 500,
                }}
              >
                <Settings className="size-4 group-hover:rotate-90 transition-transform duration-500" />
                Customize
              </motion.button>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* ── Pinned Top Widget (Quick Actions) ── */}
      {/* We use an identical 12-column grid and place it centrally to mirror the dimensions of a 6-col widget below */}
      <div className="grid gap-5 mb-5" style={{ gridTemplateColumns: "repeat(12, minmax(0, 1fr))" }}>
        <div className="col-span-12 lg:col-span-6 lg:col-start-4">
          <QuickActions />
        </div>
      </div>

      {/* ── Widget Grid via Framer Motion Reorder ── */}
      <Reorder.Group
        as="div"
        axis="y"
        values={layout}
        onReorder={setLayout}
        className="grid gap-5"
        style={{
          gridTemplateColumns: "repeat(12, minmax(0, 1fr))",
          gridAutoFlow: "row dense", // FIX: "Dense" packing ensures widgets smartly fill empty spaces around them
        }}
      >
        {layout.map((item, index) => (
          <SortableWidget
            key={item.id}
            item={item}
            index={index}
            isEditing={isEditing}
            onRemove={removeWidget}
            onMoveUp={(idx) => moveWidget(idx, "up")}
            onMoveDown={(idx) => moveWidget(idx, "down")}
            isFirst={index === 0}
            isLast={index === layout.length - 1}
          >
            {renderWidget(item.id)}
          </SortableWidget>
        ))}
      </Reorder.Group>

      {/* Add Widget placeholder - kept in a separate grid block so it doesn't break drag physics */}
      <AnimatePresence>
        {isEditing && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="grid mt-5"
            style={{
              gridTemplateColumns: "repeat(12, minmax(0, 1fr))",
            }}
          >
            <div className="col-span-12">
              <button
                onClick={() => setCatalogOpen(true)}
                className="w-full py-10 rounded-3xl border-2 border-dashed border-[#E5E7EB] hover:border-[#5CE1A5] bg-[#F4F5F7]/50 hover:bg-[#5CE1A5]/5 transition-all flex flex-col items-center justify-center gap-2 group"
              >
                <div className="size-10 rounded-full bg-[#E5E7EB] group-hover:bg-[#5CE1A5]/20 flex items-center justify-center transition-colors">
                  <Plus className="size-5 text-[#9CA3AF] group-hover:text-[#5CE1A5] transition-colors" />
                </div>
                <span
                  className="text-[14px] text-[#9CA3AF] group-hover:text-[#5CE1A5] transition-colors"
                  style={{
                    fontFamily: "var(--font-poppins)",
                    fontWeight: 500,
                  }}
                >
                  Add Widget
                </span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Widget Library Modal ── */}
      <WidgetLibrary
        open={catalogOpen}
        onClose={() => setCatalogOpen(false)}
        activeWidgetIds={layout.map((w) => w.id)}
        onToggleWidget={toggleWidget}
      />
    </div>
  );
}