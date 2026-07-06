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
  ImageIcon,
  MoreHorizontal,
} from "lucide-react";
import { ComposeModal } from "./compose-modal";
import {
  markAsRead,
  togglePin,
  deleteAnnouncement,
} from "@/app/actions/announcements";
import { AttachmentsSection } from "@/components/attachments-section";

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
  cover_image_url?: string | null;
  cover_image_alt?: string | null;
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
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

// ─── Initials avatar ────────────────────────────────────
function InitialsAvatar({ name, color, size = "size-10" }: { name: string; color: string, size?: string }) {
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <div
      className={`${size} rounded-full flex items-center justify-center text-white text-[13px] shrink-0 shadow-sm`}
      style={{ backgroundColor: color, fontWeight: 700 }}
    >
      {initials}
    </div>
  );
}

// ─── Category badge ─────────────────────────────────────
function CategoryBadge({ category }: { category: string }) {
  const config = CATEGORY_CONFIG[category] || CATEGORY_CONFIG.general;
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] uppercase tracking-widest"
      style={{
        fontWeight: 700,
        backgroundColor: `${config.color}15`,
        color: config.color,
      }}
    >
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
  autoOpenCompose = false,
  defaultDepartmentId = null,
}: {
  announcements: Announcement[];
  departments?: { id: string; name: string; color: string }[];
  currentUserId?: string;
  currentUserRole?: string;
  autoOpenCompose?: boolean;
  defaultDepartmentId?: string | null;
}) {
  const [activeTab, setActiveTab] = useState<FilterTab>("all");
  const [showCompose, setShowCompose] = useState(autoOpenCompose);
  const [editingAnnouncement, setEditingAnnouncement] = useState<Announcement | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [bookmarkedIds, setBookmarkedIds] = useState<Set<string>>(new Set());
  const [, startTransition] = useTransition();

  const filtered = activeTab === "all" ? announcements : announcements.filter((a) => a.category === activeTab);
  const pinned = filtered.filter((a) => a.is_pinned);
  const feed = filtered;

  const handleMarkAsRead = useCallback((id: string) => {
    startTransition(async () => { await markAsRead(id); });
  }, []);

  const handleTogglePin = useCallback((id: string) => {
    startTransition(async () => { await togglePin(id); });
  }, []);

  const handleDelete = useCallback((id: string) => {
    startTransition(async () => { await deleteAnnouncement(id); });
  }, []);

  const toggleBookmark = useCallback((id: string) => {
    setBookmarkedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  const toggleExpanded = useCallback((id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
    const ann = announcements.find((a) => a.id === id);
    if (ann && !ann.is_read) handleMarkAsRead(id);
  }, [announcements, handleMarkAsRead]);

  return (
    <div className="min-h-full bg-[#FAFAFA] text-[#2D333A] font-source-sans">
      <div className="max-w-[1300px] mx-auto px-4 sm:px-6 py-8 flex flex-col lg:flex-row gap-8 items-start">
        
        {/* Left Column: Navigation Sidebar */}
        <aside className="w-full lg:w-[240px] shrink-0 lg:sticky lg:top-8 flex flex-col gap-6">
          <div>
            <h1 className="text-[24px] font-bold text-[#2D333A] font-poppins leading-tight">
              Announcements
            </h1>
            <p className="text-[14px] text-[#6B7280] mt-1">
              Updates across your church.
            </p>
          </div>

          {["admin", "staff"].includes(currentUserRole) && (
            <button
              onClick={() => { setEditingAnnouncement(null); setShowCompose(true); }}
              className="flex items-center justify-center gap-2 w-full py-3 bg-[#3B82F6] text-white rounded-xl font-semibold text-[14px] shadow-sm hover:bg-blue-600 transition-colors"
            >
              <Plus className="size-4" />
              Post Update
            </button>
          )}

          <nav className="flex lg:flex-col gap-1 overflow-x-auto lg:overflow-visible pb-2 lg:pb-0">
            {FILTER_TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-[14px] font-semibold transition-all whitespace-nowrap ${
                    isActive ? "bg-white text-[#3B82F6] shadow-sm border border-[#E5E7EB]" : "text-[#6B7280] hover:bg-[#F4F5F7] hover:text-[#2D333A] border border-transparent"
                  }`}
                >
                  <Icon className="size-4" />
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </aside>

        {/* Center Column: The Feed */}
        <main className="flex-1 max-w-[700px] w-full flex flex-col gap-6">
          
          {/* Quick Compose Input */}
          {["admin", "staff"].includes(currentUserRole) && (
            <div 
              onClick={() => setShowCompose(true)}
              className="bg-white rounded-2xl border border-[#E5E7EB] p-4 shadow-sm flex items-center gap-3 cursor-text hover:border-[#9CA3AF] transition-colors"
            >
              <div className="size-10 rounded-full bg-[#F4F5F7] flex items-center justify-center shrink-0">
                <Plus className="size-5 text-[#9CA3AF]" />
              </div>
              <div className="flex-1 text-[15px] text-[#9CA3AF]">
                Create a church announcement...
              </div>
              <div className="flex gap-2">
                <button className="p-2 bg-[#F4F5F7] rounded-lg text-[#6B7280] hover:bg-[#E5E7EB] transition-colors">
                  <ImageIcon className="size-4" />
                </button>
              </div>
            </div>
          )}

          {/* Mobile-Only Pinned Section (Hidden on Desktop) */}
          {pinned.length > 0 && (
            <div className="xl:hidden space-y-4">
              <div className="flex items-center gap-2">
                <Pin className="size-4 text-amber-500" />
                <h2 className="text-[12px] font-bold uppercase tracking-widest text-[#9CA3AF]">Pinned Spotlight</h2>
              </div>
              {pinned.map((ann) => (
                <AnnouncementCard
                  key={ann.id}
                  announcement={ann}
                  isPinned
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
          )}

          {/* Main Feed */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Sparkles className="size-4 text-[#5CE1A5]" />
              <h2 className="text-[12px] font-bold uppercase tracking-widest text-[#9CA3AF]">Latest Updates</h2>
            </div>
            
            {feed.length === 0 ? (
               <div className="flex flex-col items-center justify-center py-20 text-center bg-white rounded-2xl border border-[#E5E7EB] border-dashed">
                 <Megaphone className="size-10 text-[#9CA3AF] mb-4" strokeWidth={1.5} />
                 <h3 className="text-[18px] font-semibold text-[#2D333A] mb-2 font-poppins">No announcements yet</h3>
                 <p className="text-[14px] text-[#6B7280]">Be the first to post an update in this channel!</p>
               </div>
            ) : (
              feed.map((ann) => (
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
              ))
            )}
          </div>
        </main>

        {/* Right Column: Pinned Sidebar (Desktop Only) */}
        <aside className="hidden xl:flex w-[280px] shrink-0 sticky top-8 flex-col gap-4">
          <div className="flex items-center gap-2 pb-2 border-b border-[#E5E7EB]">
            <Pin className="size-4 text-amber-500" />
            <h2 className="text-[13px] font-bold uppercase tracking-widest text-[#2D333A]">Important</h2>
          </div>
          
          <div className="flex flex-col gap-3">
            {pinned.length === 0 ? (
              <p className="text-[13px] text-[#9CA3AF] italic">No pinned announcements.</p>
            ) : (
              pinned.map((ann) => {
                // Check if the current user has permission to unpin
                const canManagePin = (ann.author_id === currentUserId && ["admin", "staff"].includes(currentUserRole)) || currentUserRole === "admin";

                return (
                  <div 
                    key={ann.id} 
                    className="group/pin bg-white p-4 rounded-2xl border border-[#E5E7EB] shadow-sm hover:border-[#9CA3AF] transition-colors cursor-pointer relative" 
                    onClick={() => toggleExpanded(ann.id)}
                  >
                    <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2 overflow-hidden">
                          <InitialsAvatar name={ann.author_name || "Unknown"} color={CATEGORY_CONFIG[ann.category]?.color || "#9CA3AF"} size="size-6" />
                          <span className="text-[13px] font-semibold text-[#2D333A] truncate">{ann.author_name}</span>
                        </div>
                        
                        {/* Unpin Action (Only visible on hover if user has permission) */}
                        {canManagePin && (
                          <button 
                            onClick={(e) => {
                              e.stopPropagation(); // Prevents the card from expanding when you click unpin
                              handleTogglePin(ann.id);
                            }}
                            className="p-1.5 text-[#9CA3AF] hover:text-amber-500 hover:bg-amber-50 rounded-md transition-colors opacity-0 group-hover/pin:opacity-100 shrink-0"
                            title="Unpin announcement"
                          >
                            <Pin className="size-3.5 fill-current" />
                          </button>
                        )}
                    </div>
                    <h3 className="text-[14px] font-semibold text-[#2D333A] font-poppins leading-snug line-clamp-2">{ann.title}</h3>
                  </div>
                );
              })
            )}
          </div>
        </aside>

      </div>

      {/* Compose Modal */}
      <ComposeModal
        open={showCompose}
        onClose={() => { setShowCompose(false); setEditingAnnouncement(null); }}
        departments={departments}
        editAnnouncement={editingAnnouncement}
        defaultDepartmentId={defaultDepartmentId}
      />
    </div>
  );
}

// ─── Compact Announcement Card ──────────────────────────────────
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
  const [showMenu, setShowMenu] = useState(false);

  return (
    <div className="group relative bg-white rounded-2xl border border-[#E5E7EB] p-5 shadow-sm hover:shadow-md transition-all duration-300">
      
      {/* Compact Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <InitialsAvatar name={authorName} color={config.color} />
          <div className="flex flex-col">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[15px] font-bold text-[#2D333A]">{authorName}</span>
              <CategoryBadge category={ann.category} />
              {ann.target_department_name && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md" style={{ color: ann.target_department_color || "#8B5CF6", backgroundColor: `${ann.target_department_color || "#8B5CF6"}15` }}>
                  {ann.target_department_name}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5 text-[12px] text-[#9CA3AF] mt-0.5">
              <Clock className="size-3" />
              {relativeTime(ann.published_at)}
              {!ann.is_read && <span className="size-2 rounded-full bg-[#3B82F6] ml-1" />}
            </div>
          </div>
        </div>

        {/* Action Menu (...) */}
        <div className="relative">
          <button onClick={() => setShowMenu(!showMenu)} className="p-2 text-[#9CA3AF] hover:bg-[#F4F5F7] rounded-full transition-colors opacity-0 group-hover:opacity-100">
             <MoreHorizontal className="size-5" />
          </button>
          
          {showMenu && (
            <div className="absolute right-0 mt-2 w-36 bg-white rounded-xl shadow-lg border border-[#E5E7EB] overflow-hidden z-10 py-1" onMouseLeave={() => setShowMenu(false)}>
               <button onClick={() => { onTogglePin(); setShowMenu(false); }} className="w-full text-left px-4 py-2 text-[13px] font-semibold text-[#6B7280] hover:bg-[#F4F5F7]">
                 {ann.is_pinned ? "Unpin Post" : "Pin Post"}
               </button>
               {canEdit && (
                 <button onClick={() => { onEdit(); setShowMenu(false); }} className="w-full text-left px-4 py-2 text-[13px] font-semibold text-[#6B7280] hover:bg-[#F4F5F7]">
                   Edit Post
                 </button>
               )}
               {canDelete && (
                 <button onClick={() => { onDelete(); setShowMenu(false); }} className="w-full text-left px-4 py-2 text-[13px] font-semibold text-red-500 hover:bg-red-50">
                   Delete
                 </button>
               )}
            </div>
          )}
        </div>
      </div>

      {/* Title */}
      <h3 className="text-[18px] font-bold text-[#2D333A] mb-2 font-poppins cursor-pointer hover:text-[#3B82F6] transition-colors" onClick={onToggleExpand}>
        {ann.title}
      </h3>

      {/* Content */}
      <div className={`text-[15px] text-[#4B5563] leading-relaxed whitespace-pre-wrap ${!isExpanded && "line-clamp-3"}`}>
         {ann.content}
      </div>

      {/* Inline Image Thumbnail */}
      {ann.cover_image_url && (
        <div className={`mt-4 rounded-xl overflow-hidden border border-[#E5E7EB] bg-[#F4F5F7] flex items-center justify-center ${!isExpanded ? "max-h-[200px]" : ""}`}>
          <img 
            src={ann.cover_image_url} 
            alt={ann.cover_image_alt || "Cover"} 
            className={`w-full ${!isExpanded ? "max-h-[200px] object-contain" : "h-auto object-contain"}`} 
          />
        </div>
      )}

      {/* Attachments */}
      {isExpanded && (
        <div className="mt-4">
          <AttachmentsSection entityType="announcement" entityId={ann.id} canUpload={canEdit} canDeleteAny={canEdit} collapsible={false} />
        </div>
      )}

      {/* Subtle Footer */}
      <div className="flex items-center gap-6 mt-4 pt-4 border-t border-[#F4F5F7]">
        <button onClick={onToggleExpand} className="flex items-center gap-1.5 text-[13px] font-semibold text-[#6B7280] hover:text-[#3B82F6] transition-colors">
          <MessageSquare className="size-4" />
          {isExpanded ? "Collapse" : "Read more"}
        </button>
        <button onClick={onToggleBookmark} className={`flex items-center gap-1.5 text-[13px] font-semibold transition-colors ${isBookmarked ? "text-[#5CE1A5]" : "text-[#6B7280] hover:text-[#5CE1A5]"}`}>
          <Bookmark className="size-4" fill={isBookmarked ? "currentColor" : "none"} />
          Save
        </button>
      </div>
    </div>
  );
}