"use client";

import { useState, useTransition, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Plus,
  Megaphone,
  Globe,
  ShieldCheck,
  Users,
  Pin,
  MessageSquare,
  Bookmark,
  Clock,
  Sparkles,
} from "lucide-react";
import { ComposeModal } from "./compose-modal";
import {
  markAsRead,
  togglePin,
  deleteAnnouncement,
} from "@/app/actions/announcements";

// ─── Types ──────────────────────────────────────────────
export type Announcement = {
  id: string;
  title: string;
  content: string;
  category: string;
  is_pinned: boolean;
  is_published: boolean;
  published_at: string;
  created_at: string;
  updated_at?: string;
  author_id: string;
  author_name: string | null;
  is_read: boolean;
  target_department_id?: string | null;
  target_department_name?: string | null;
  target_department_color?: string | null;
};

type FilterTab = "all" | "general" | "staff" | "ministry";

// ─── Category config ────────────────────────────────────
const CATEGORY_CONFIG: Record<
  string,
  { icon: typeof Globe; color: string; label: string }
> = {
  general: { icon: Globe, color: "#5CE1A5", label: "General" },
  staff: { icon: ShieldCheck, color: "#3B82F6", label: "Staff" },
  ministry: { icon: Users, color: "#8B5CF6", label: "Ministry" },
};

// ─── Filter Tabs ────────────────────────────────────────
const FILTER_TABS: {
  id: FilterTab;
  label: string;
  icon: typeof Megaphone;
}[] = [
  { id: "all", label: "All Updates", icon: Megaphone },
  { id: "general", label: "General", icon: Globe },
  { id: "staff", label: "Staff", icon: ShieldCheck },
  { id: "ministry", label: "Ministry", icon: Users },
];

// ─── Helper: relative time ──────────────────────────────
function relativeTime(dateString: string): string {
  const now = new Date();
  const date = new Date(dateString);
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  const diffWeeks = Math.floor(diffDays / 7);
  if (diffWeeks < 4) return `${diffWeeks}w ago`;
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

// ─── Initials avatar ────────────────────────────────────
function InitialsAvatar({
  name,
  color,
}: {
  name: string;
  color: string;
}) {
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <div
      className="size-10 rounded-xl flex items-center justify-center text-white text-[13px] shrink-0"
      style={{ backgroundColor: color, fontWeight: 700 }}
    >
      {initials}
    </div>
  );
}

// ─── Category badge ─────────────────────────────────────
function CategoryBadge({ category }: { category: string }) {
  const config = CATEGORY_CONFIG[category] || CATEGORY_CONFIG.general;
  const Icon = config.icon;
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] uppercase tracking-wider"
      style={{
        fontWeight: 600,
        backgroundColor: `${config.color}14`,
        color: config.color,
      }}
    >
      <Icon className="size-3" />
      {config.label}
    </span>
  );
}

// ─── Main View ──────────────────────────────────────────
export function AnnouncementsView({
  announcements,
  departments = [],
  currentUserId = "",
  currentUserRole = "member",
}: {
  announcements: Announcement[];
  departments?: { id: string; name: string; color: string }[];
  currentUserId?: string;
  currentUserRole?: string;
}) {
  const [activeTab, setActiveTab] = useState<FilterTab>("all");
  const [showCompose, setShowCompose] = useState(false);
  const [editingAnnouncement, setEditingAnnouncement] = useState<Announcement | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [bookmarkedIds, setBookmarkedIds] = useState<Set<string>>(
    new Set(),
  );
  const [, startTransition] = useTransition();

  // Filter announcements
  const filtered =
    activeTab === "all"
      ? announcements
      : announcements.filter((a) => a.category === activeTab);

  const pinned = filtered.filter((a) => a.is_pinned);
  const feed = filtered.filter((a) => !a.is_pinned);

  const handleMarkAsRead = useCallback(
    (id: string) => {
      startTransition(async () => {
        await markAsRead(id);
      });
    },
    [startTransition],
  );

  const handleTogglePin = useCallback(
    (id: string) => {
      startTransition(async () => {
        await togglePin(id);
      });
    },
    [startTransition],
  );

  const handleDelete = useCallback(
    (id: string) => {
      startTransition(async () => {
        await deleteAnnouncement(id);
      });
    },
    [startTransition],
  );

  const toggleBookmark = useCallback((id: string) => {
    setBookmarkedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const toggleExpanded = useCallback(
    (id: string) => {
      setExpandedId((prev) => (prev === id ? null : id));
      // Mark as read when expanding
      const ann = announcements.find((a) => a.id === id);
      if (ann && !ann.is_read) {
        handleMarkAsRead(id);
      }
    },
    [announcements, handleMarkAsRead],
  );

  return (
    <div className="h-full flex flex-col overflow-y-auto bg-white">
      {/* Header */}
      <div className="flex items-end justify-between mb-8 px-4 sm:px-6 pt-4 sm:pt-6">
        <div>
          <h1
            className="text-[24px] text-[#2D333A] leading-tight"
            style={{
              fontFamily: "var(--font-poppins)",
              fontWeight: 700,
            }}
          >
            Announcements
          </h1>
          <p
            className="text-[16px] text-[#6B7280] mt-1"
            style={{ fontFamily: "var(--font-source-sans)" }}
          >
            See updates on what&apos;s happening at your church.
          </p>
        </div>
        {["admin", "staff"].includes(currentUserRole) && (
          <div className="mb-1">
            <button
              onClick={() => { setEditingAnnouncement(null); setShowCompose(true); }}
              className="flex items-center gap-2 px-6 py-3 bg-[#2D333A] text-white rounded-xl text-[14px] hover:bg-[#1A1F24] transition-all"
              style={{ fontWeight: 600 }}
            >
              <Plus className="size-4" />
              Post Update
            </button>
          </div>
        )}
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center mb-8 overflow-x-auto px-4 sm:px-6">
        <div className="bg-[#F4F5F7] p-1 rounded-2xl flex items-center gap-1 mx-auto">
          {FILTER_TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`relative flex items-center gap-1.5 px-4 py-2 rounded-xl text-[13px] transition-all whitespace-nowrap ${
                  isActive
                    ? "text-[#2D333A]"
                    : "text-[#6B7280] hover:text-[#2D333A]"
                }`}
                style={{ fontWeight: 600 }}
              >
                {isActive && (
                  <motion.div
                    layoutId="announcementFilterTab"
                    className="absolute inset-0 bg-white rounded-xl shadow-sm"
                    transition={{
                      type: "spring",
                      bounce: 0.2,
                      duration: 0.6,
                    }}
                  />
                )}
                <span className="relative z-10 flex items-center gap-1.5">
                  <Icon
                    className={`size-3.5 ${
                      isActive ? "text-[#5CE1A5]" : "text-[#9CA3AF]"
                    }`}
                  />
                  {tab.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <div className="px-4 sm:px-6 max-w-[1100px] mx-auto w-full flex-1 pb-8">
        <div className="grid grid-cols-1 gap-8">
          {/* Pinned section */}
          {pinned.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Pin className="size-3.5 text-[#5CE1A5]" />
                <h2
                  className="text-[12px] uppercase tracking-widest text-[#9CA3AF]"
                  style={{ fontWeight: 600 }}
                >
                  Pinned Spotlight
                </h2>
              </div>
              {pinned.map((ann) => (
                <AnnouncementCard
                  key={ann.id}
                  announcement={ann}
                  isPinned
                  isExpanded={expandedId === ann.id}
                  isBookmarked={bookmarkedIds.has(ann.id)}
                  onToggleExpand={() => toggleExpanded(ann.id)}
                  onToggleBookmark={() => toggleBookmark(ann.id)}
                  canEdit={(ann.author_id === currentUserId && ["admin", "staff"].includes(currentUserRole)) || currentUserRole === "admin"}
                  canDelete={(ann.author_id === currentUserId && ["admin", "staff"].includes(currentUserRole)) || currentUserRole === "admin"}
                  onTogglePin={() => handleTogglePin(ann.id)}
                  onDelete={() => handleDelete(ann.id)}
                  onEdit={() => { setEditingAnnouncement(ann); setShowCompose(true); }}
                />
              ))}
            </div>
          )}

          {/* Feed */}
          {feed.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Sparkles className="size-3.5 text-[#5CE1A5]" />
                <h2
                  className="text-[12px] uppercase tracking-widest text-[#9CA3AF]"
                  style={{ fontWeight: 600 }}
                >
                  Latest Updates
                </h2>
              </div>
              <div className="space-y-3">
                {feed.map((ann) => (
                  <AnnouncementCard
                    key={ann.id}
                    announcement={ann}
                    isPinned={false}
                    isExpanded={expandedId === ann.id}
                    isBookmarked={bookmarkedIds.has(ann.id)}
                    canEdit={(ann.author_id === currentUserId && ["admin", "staff"].includes(currentUserRole)) || currentUserRole === "admin"}
                    canDelete={(ann.author_id === currentUserId && ["admin", "staff"].includes(currentUserRole)) || currentUserRole === "admin"}
                    onToggleExpand={() => toggleExpanded(ann.id)}
                    onToggleBookmark={() => toggleBookmark(ann.id)}
                    onTogglePin={() => handleTogglePin(ann.id)}
                    onDelete={() => handleDelete(ann.id)}
                    onEdit={() => { setEditingAnnouncement(ann); setShowCompose(true); }}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Empty state */}
          {filtered.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="size-20 rounded-full bg-[#F4F5F7] flex items-center justify-center mb-5">
                <Megaphone
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
                No announcements yet
              </h3>
              <p
                className="text-[15px] text-[#6B7280] max-w-[320px] leading-relaxed"
                style={{ fontFamily: "var(--font-source-sans)" }}
              >
                There are no announcements in this channel yet. Be the
                first to post an update!
              </p>
              <button
                onClick={() => setShowCompose(true)}
                className="mt-6 flex items-center gap-2 px-5 py-2.5 bg-[#5CE1A5] text-white rounded-xl text-[14px] hover:bg-[#4CD99A] transition-all"
                style={{ fontWeight: 600 }}
              >
                <Plus className="size-4" />
                Post Update
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Compose Modal */}
      <ComposeModal
        open={showCompose}
        onClose={() => { setShowCompose(false); setEditingAnnouncement(null); }}
        departments={departments}
        editAnnouncement={editingAnnouncement}
      />
    </div>
  );
}

// ─── Announcement Card ──────────────────────────────────
function AnnouncementCard({
  announcement: ann,
  isPinned,
  isExpanded,
  isBookmarked,
  canEdit,
  canDelete,
  onToggleExpand,
  onToggleBookmark,
  onTogglePin,
  onDelete,
  onEdit,
}: {
  announcement: Announcement;
  isPinned: boolean;
  isExpanded: boolean;
  isBookmarked: boolean;
  canEdit: boolean;
  canDelete: boolean;
  onToggleExpand: () => void;
  onToggleBookmark: () => void;
  onTogglePin: () => void;
  onDelete: () => void;
  onEdit: () => void;
}) {
  const config = CATEGORY_CONFIG[ann.category] || CATEGORY_CONFIG.general;
  const authorName = ann.author_name || "Unknown";
  const wasEdited = ann.updated_at && ann.created_at && new Date(ann.updated_at).getTime() - new Date(ann.created_at).getTime() > 5000;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="group relative bg-white rounded-3xl border border-[#E5E7EB]/50 p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)] hover:shadow-[0_4px_20px_rgba(0,0,0,0.08)] transition-all duration-300"
    >
      <div className="flex items-start gap-4">
        {/* Avatar */}
        <InitialsAvatar name={authorName} color={config.color} />

        <div className="flex-1 min-w-0">
          {/* Author line */}
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <p
              className="text-[14px] text-[#2D333A]"
              style={{
                fontFamily: "var(--font-poppins)",
                fontWeight: 600,
              }}
            >
              {authorName}
            </p>
            <span className="text-[#E5E7EB]">&middot;</span>
            <CategoryBadge category={ann.category} />
            {ann.target_department_name && (
              <span
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px]"
                style={{
                  fontFamily: "var(--font-poppins)",
                  fontWeight: 600,
                  color: ann.target_department_color || "#8B5CF6",
                  backgroundColor: `${ann.target_department_color || "#8B5CF6"}10`,
                }}
              >
                {ann.target_department_name}
              </span>
            )}
            {isPinned && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] text-amber-500 bg-amber-50">
                <Pin className="size-3" />
              </span>
            )}
            {!ann.is_read && (
              <span className="size-2 rounded-full bg-[#5CE1A5] shrink-0" />
            )}
            <div className="flex items-center gap-1.5 text-[11px] text-[#9CA3AF] ml-auto">
              <Clock className="size-3" />
              {relativeTime(ann.published_at)}
              {wasEdited && (
                <span className="text-[#9CA3AF]">&middot; Edited</span>
              )}
            </div>
          </div>

          {/* Title */}
          <h3
            className="text-[18px] text-[#2D333A] mb-2 leading-snug cursor-pointer hover:text-[#5CE1A5] transition-colors"
            style={{
              fontFamily: "var(--font-poppins)",
              fontWeight: 600,
            }}
            onClick={onToggleExpand}
          >
            {ann.title}
          </h3>

          {/* Content preview or full */}
          <AnimatePresence mode="wait">
            {isExpanded ? (
              <motion.div
                key="full"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="text-[15px] text-[#6B7280] leading-relaxed mb-3 whitespace-pre-wrap"
                style={{ fontFamily: "var(--font-source-sans)" }}
              >
                {ann.content}
              </motion.div>
            ) : (
              <motion.p
                key="preview"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="text-[15px] text-[#6B7280] leading-relaxed mb-3 line-clamp-3"
                style={{ fontFamily: "var(--font-source-sans)" }}
              >
                {ann.content}
              </motion.p>
            )}
          </AnimatePresence>

          {/* Footer */}
          <div className="flex items-center justify-between pt-3 border-t border-[#E5E7EB]/50">
            <div className="flex items-center gap-4">
              <button
                onClick={onToggleExpand}
                className="flex items-center gap-1.5 text-[#9CA3AF] hover:text-[#5CE1A5] transition-colors text-[13px]"
                style={{ fontWeight: 600 }}
              >
                <MessageSquare className="size-4" />
                {isExpanded ? "Collapse" : "Read more"}
              </button>
              <button
                onClick={onToggleBookmark}
                className={`flex items-center gap-1.5 transition-colors text-[13px] ${
                  isBookmarked
                    ? "text-[#5CE1A5]"
                    : "text-[#9CA3AF] hover:text-[#5CE1A5]"
                }`}
                style={{ fontWeight: 600 }}
              >
                <Bookmark
                  className="size-4"
                  fill={isBookmarked ? "currentColor" : "none"}
                />
              </button>
            </div>
            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
              {canEdit && (
                <button
                  onClick={onEdit}
                  className="text-[11px] text-[#9CA3AF] hover:text-[#5CE1A5] transition-colors px-2 py-1 rounded-lg hover:bg-[#5CE1A5]/5"
                  style={{ fontWeight: 600 }}
                >
                  Edit
                </button>
              )}
              <button
                onClick={onTogglePin}
                className="text-[11px] text-[#9CA3AF] hover:text-amber-500 transition-colors px-2 py-1 rounded-lg hover:bg-amber-50"
                style={{ fontWeight: 600 }}
              >
                {ann.is_pinned ? "Unpin" : "Pin"}
              </button>
              {canDelete && (
                <button
                  onClick={onDelete}
                  className="text-[11px] text-[#9CA3AF] hover:text-red-500 transition-colors px-2 py-1 rounded-lg hover:bg-red-50"
                  style={{ fontWeight: 600 }}
                >
                  Delete
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
