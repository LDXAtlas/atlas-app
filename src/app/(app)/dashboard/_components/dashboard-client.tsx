"use client";

import { useState, useEffect, useCallback } from "react";
import { AnimatePresence, motion, Reorder, useDragControls } from "motion/react";
import { Settings, GripVertical, ChevronUp, ChevronDown, Plus, X } from "lucide-react";

import { QuickActions } from "./widgets/quick-actions";
import { StatsOverview } from "./widgets/stats-overview";
import { RecentMembers } from "./widgets/recent-members";
import { SubscriptionOverview } from "./widgets/subscription-overview";
import { AnnouncementsFeed } from "./widgets/announcements-feed";
import { UpcomingEvents, type UpcomingEventData } from "./widgets/upcoming-events";
import { MyTasks } from "./widgets/my-tasks";
import { OrgLogo } from "@/components/org-logo";
import { RecentDepartments } from "./widgets/recent-departments";
import { WidgetLibrary } from "./widget-library";

// ─── Types ──────────────────────────────────────────────

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
  orgLogoUrl?: string | null;
  subscriptionTier: string;
  seatLimit: number;
  aiCreditsLimit: number;
  totalMembers: number;
  activeMembers: number;
  departmentCount: number;
  departments: { id: string; name: string; color: string; member_count: number }[];
  recentMembers: any[];
  recentAnnouncements: any[];
  upcomingEvents?: UpcomingEventData[];
}

export interface WidgetLayoutItem {
  id: WidgetId;
}

const DEFAULT_LEFT_LAYOUT: WidgetLayoutItem[] = [
  { id: "my-tasks" },
  { id: "announcements-feed" },
  { id: "upcoming-events" },
  { id: "recent-members" },
];

const DEFAULT_RIGHT_LAYOUT: WidgetLayoutItem[] = [
  { id: "stats-overview" },
  { id: "recent-departments" },
  { id: "subscription-overview" },
];

const STORAGE_KEY_LEFT = "atlas_dash_left_v3";
const STORAGE_KEY_RIGHT = "atlas_dash_right_v3";

function loadLayout(key: string, defaultLayout: WidgetLayoutItem[]): WidgetLayoutItem[] {
  try {
    const stored = localStorage.getItem(key);
    if (stored) return JSON.parse(stored);
  } catch {}
  return defaultLayout;
}

function saveLayout(key: string, layout: WidgetLayoutItem[]) {
  try {
    localStorage.setItem(key, JSON.stringify(layout));
  } catch {}
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
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

function SortableWidget({ item, index, isEditing, onRemove, onMoveUp, onMoveDown, isFirst, isLast, children }: SortableWidgetProps) {
  const controls = useDragControls();

  return (
    <Reorder.Item
      as="div"
      value={item}
      id={item.id}
      drag
      layout="position"
      dragListener={false}
      dragControls={controls}
      whileDrag={{ scale: 1.02, boxShadow: "0 25px 50px -12px rgba(0,0,0,0.15)", zIndex: 100 }}
      className={`relative rounded-3xl will-change-transform bg-white w-full ${isEditing ? "select-none" : ""}`}
    >
      {isEditing && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 z-10 rounded-3xl border-2 border-dashed border-[#5CE1A5]/60 bg-white/10 backdrop-blur-[1.5px]"
        />
      )}

      <AnimatePresence>
        {isEditing && (
          <>
            {/* Remove Button on Left */}
            <motion.button
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={() => onRemove(item.id)}
              className="absolute top-3 left-3 z-20 p-1.5 bg-white/95 backdrop-blur-sm rounded-lg border border-[#E5E7EB] text-[#EF4444] hover:bg-red-50 transition-colors shadow-sm"
            >
              <X className="size-4" />
            </motion.button>

            {/* Move Controls on Right */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="absolute top-3 right-3 z-20 flex items-center gap-1"
            >
              <button
                onClick={() => onMoveUp(index)}
                disabled={isFirst}
                className="p-1.5 bg-white/95 backdrop-blur-sm rounded-lg border border-[#E5E7EB] text-[#6B7280] hover:bg-[#F4F5F7] disabled:opacity-30 disabled:cursor-not-allowed transition-colors shadow-sm"
              >
                <ChevronUp className="size-4" />
              </button>
              <button
                onClick={() => onMoveDown(index)}
                disabled={isLast}
                className="p-1.5 bg-white/95 backdrop-blur-sm rounded-lg border border-[#E5E7EB] text-[#6B7280] hover:bg-[#F4F5F7] disabled:opacity-30 disabled:cursor-not-allowed transition-colors shadow-sm"
              >
                <ChevronDown className="size-4" />
              </button>
              <div
                onPointerDown={(e) => controls.start(e)}
                style={{ touchAction: "none" }}
                className="p-1.5 bg-white/95 backdrop-blur-sm rounded-lg border border-[#E5E7EB] text-[#9CA3AF] cursor-grab active:cursor-grabbing hover:bg-[#F4F5F7] transition-colors shadow-sm ml-1"
              >
                <GripVertical className="size-4" />
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <div className="h-full pointer-events-auto">{children}</div>
    </Reorder.Item>
  );
}

// ─── Component ──────────────────────────────────────────

export function DashboardClient({
  userName, orgName, orgLogoUrl, subscriptionTier, seatLimit, aiCreditsLimit, totalMembers,
  activeMembers, departmentCount, departments, recentMembers, recentAnnouncements, upcomingEvents = []
}: DashboardProps) {
  const firstName = userName.split(" ")[0] || userName;

  const [leftLayout, setLeftLayout] = useState<WidgetLayoutItem[]>(DEFAULT_LEFT_LAYOUT);
  const [rightLayout, setRightLayout] = useState<WidgetLayoutItem[]>(DEFAULT_RIGHT_LAYOUT);
  
  const [isEditing, setIsEditing] = useState(false);
  const [catalogOpen, setCatalogOpen] = useState(false);
  
  const [preEditLeft, setPreEditLeft] = useState<WidgetLayoutItem[]>([]);
  const [preEditRight, setPreEditRight] = useState<WidgetLayoutItem[]>([]);

  useEffect(() => {
    setLeftLayout(loadLayout(STORAGE_KEY_LEFT, DEFAULT_LEFT_LAYOUT));
    setRightLayout(loadLayout(STORAGE_KEY_RIGHT, DEFAULT_RIGHT_LAYOUT));
  }, []);

  const enterEditMode = useCallback(() => {
    setPreEditLeft([...leftLayout]);
    setPreEditRight([...rightLayout]);
    setIsEditing(true);
  }, [leftLayout, rightLayout]);

  const cancelEdit = useCallback(() => {
    setLeftLayout(preEditLeft);
    setRightLayout(preEditRight);
    setIsEditing(false);
  }, [preEditLeft, preEditRight]);

  const saveEdit = useCallback(() => {
    saveLayout(STORAGE_KEY_LEFT, leftLayout);
    saveLayout(STORAGE_KEY_RIGHT, rightLayout);
    setIsEditing(false);
  }, [leftLayout, rightLayout]);

  const removeWidget = useCallback((id: WidgetId) => {
    setLeftLayout(prev => prev.filter(w => w.id !== id));
    setRightLayout(prev => prev.filter(w => w.id !== id));
  }, []);

  const toggleWidget = useCallback((id: WidgetId) => {
    const inLeft = leftLayout.find((w) => w.id === id);
    const inRight = rightLayout.find((w) => w.id === id);
    
    if (inLeft) {
      setLeftLayout(leftLayout.filter((w) => w.id !== id));
    } else if (inRight) {
      setRightLayout(rightLayout.filter((w) => w.id !== id));
    } else {
      // Smart Add: Put known compact widgets in the right column, large ones in the left.
      const smallWidgets = ["stats-overview", "recent-departments", "subscription-overview"];
      if (smallWidgets.includes(id)) {
        setRightLayout([...rightLayout, { id }]);
      } else {
        setLeftLayout([...leftLayout, { id }]);
      }
    }
  }, [leftLayout, rightLayout]);

  const moveWidget = (layout: WidgetLayoutItem[], setLayout: any, index: number, direction: "up" | "down") => {
    const newLayout = [...layout];
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newLayout.length) return;
    [newLayout[index], newLayout[targetIndex]] = [newLayout[targetIndex], newLayout[index]];
    setLayout(newLayout);
  };

  function renderWidget(id: WidgetId) {
    switch (id) {
      case "stats-overview": return <StatsOverview totalMembers={totalMembers} activeMembers={activeMembers} departmentCount={departmentCount} seatLimit={seatLimit} />;
      case "recent-members": return <RecentMembers members={recentMembers} />;
      case "subscription-overview": return <SubscriptionOverview tier={subscriptionTier} seatLimit={seatLimit} aiCreditsLimit={aiCreditsLimit} totalMembers={totalMembers} />;
      case "announcements-feed": return <AnnouncementsFeed announcements={recentAnnouncements} />;
      case "upcoming-events": return <UpcomingEvents events={upcomingEvents} />;
      case "my-tasks": return <MyTasks />;
      case "recent-departments": return <RecentDepartments departments={departments} />;
      default: return null;
    }
  }

  return (
    <div className="max-w-[1400px] mx-auto pb-12">
      <div className="py-2 mb-6 flex items-start justify-between gap-4 border-b border-[#E5E7EB]">
        <div className="flex items-start gap-3 min-w-0">
          <OrgLogo name={orgName} logoUrl={orgLogoUrl ?? null} size={44} />
          <div className="min-w-0">
            <h1 className="text-3xl text-[#2D333A] font-bold" style={{ fontFamily: "var(--font-poppins)" }}>
              {getGreeting()}, {firstName}
            </h1>
            <p className="text-[15px] text-[#6B7280] mt-1 truncate" style={{ fontFamily: "var(--font-source-sans)" }}>
              {orgName}
            </p>
          </div>
        </div>

        {/* Edit Controls with restored "Add Widget" */}
        <div className="flex items-center gap-3 pt-1">
          <AnimatePresence mode="wait">
            {isEditing ? (
              <motion.div key="edit-controls" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} className="flex items-center gap-2">
                <button onClick={cancelEdit} className="px-4 py-2 rounded-xl bg-white border border-[#E5E7EB] text-[#6B7280] text-[14px] hover:bg-[#F4F5F7] font-medium">Cancel</button>
                <button onClick={() => setCatalogOpen(true)} className="px-4 py-2 rounded-xl bg-white border border-[#5CE1A5] text-[#5CE1A5] text-[14px] hover:bg-[#5CE1A5]/5 transition-colors flex items-center gap-1.5 font-medium">
                  <Plus className="size-4" /> Add Widget
                </button>
                <button onClick={saveEdit} className="px-5 py-2 rounded-xl bg-[#5CE1A5] text-white text-[14px] hover:bg-[#4BD095] font-semibold shadow-sm transition-transform hover:-translate-y-0.5">Save</button>
              </motion.div>
            ) : (
              <motion.button key="customize-btn" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} onClick={enterEditMode} className="group flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-[#E5E7EB] hover:border-[#D1D5DB] text-[#6B7280] hover:text-[#2D333A] text-[14px] transition-all hover:shadow-sm font-medium">
                <Settings className="size-4 group-hover:rotate-90 transition-transform duration-500" />
                Customize
              </motion.button>
            )}
          </AnimatePresence>
        </div>
      </div>

      <div className="flex justify-center mb-8 w-full">
        <div className="w-full max-w-4xl">
          <QuickActions />
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6 items-start">
        <div className="w-full lg:w-3/4">
          <Reorder.Group axis="y" values={leftLayout} onReorder={setLeftLayout} className="flex flex-col gap-6">
            {leftLayout.map((item, index) => (
              <SortableWidget key={item.id} item={item} index={index} isEditing={isEditing} onRemove={removeWidget} onMoveUp={(idx) => moveWidget(leftLayout, setLeftLayout, idx, "up")} onMoveDown={(idx) => moveWidget(leftLayout, setLeftLayout, idx, "down")} isFirst={index === 0} isLast={index === leftLayout.length - 1}>
                {renderWidget(item.id)}
              </SortableWidget>
            ))}
          </Reorder.Group>
        </div>

        <div className="w-full lg:w-1/4 lg:sticky lg:top-6">
          <Reorder.Group axis="y" values={rightLayout} onReorder={setRightLayout} className="flex flex-col gap-6">
            {rightLayout.map((item, index) => (
              <SortableWidget key={item.id} item={item} index={index} isEditing={isEditing} onRemove={removeWidget} onMoveUp={(idx) => moveWidget(rightLayout, setRightLayout, idx, "up")} onMoveDown={(idx) => moveWidget(rightLayout, setRightLayout, idx, "down")} isFirst={index === 0} isLast={index === rightLayout.length - 1}>
                {renderWidget(item.id)}
              </SortableWidget>
            ))}
          </Reorder.Group>
        </div>
      </div>

      <WidgetLibrary
        open={catalogOpen}
        onClose={() => setCatalogOpen(false)}
        activeWidgetIds={[...leftLayout.map((w) => w.id), ...rightLayout.map((w) => w.id)]}
        onToggleWidget={toggleWidget}
      />
    </div>
  );
}