"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Bell, Check, Settings, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  getNotifications,
  markAllNotificationsAsRead,
  markNotificationAsRead,
  type NotificationWithActor,
} from "@/app/actions/notifications";

// Browser-side Realtime is preferred so the bell + dropdown both pick up
// new rows instantly. The shell still polls every 60s as a belt-and-
// suspenders fallback in case the channel drops (covered in shell.tsx).

interface NotificationsDropdownProps {
  userId: string;
  unreadCount: number;
  onUnreadCountChange: (n: number) => void;
  onClose: () => void;
}

type TabId = "all" | "unread";

function initialsOf(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((n) => n[0])
      .join("")
      .toUpperCase() || "?"
  );
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

type Bucket = "today" | "yesterday" | "this_week" | "earlier";
const BUCKET_LABELS: Record<Bucket, string> = {
  today: "Today",
  yesterday: "Yesterday",
  this_week: "This Week",
  earlier: "Earlier",
};

function bucketFor(iso: string): Bucket {
  const now = new Date();
  const created = new Date(iso);
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startCreated = new Date(
    created.getFullYear(),
    created.getMonth(),
    created.getDate(),
  );
  const diff = Math.floor(
    (startToday.getTime() - startCreated.getTime()) / 86_400_000,
  );
  if (diff <= 0) return "today";
  if (diff === 1) return "yesterday";
  if (diff < 7) return "this_week";
  return "earlier";
}

export function NotificationsDropdown({
  userId,
  unreadCount,
  onUnreadCountChange,
  onClose,
}: NotificationsDropdownProps) {
  const router = useRouter();
  const [items, setItems] = useState<NotificationWithActor[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabId>("all");
  // Used to flash newly-arrived notifications mint for a moment.
  const [flashIds, setFlashIds] = useState<Set<string>>(new Set());
  const supabaseRef = useRef<ReturnType<typeof createClient> | null>(null);

  // Initial fetch.
  const reload = useCallback(async () => {
    setLoading(true);
    const result = await getNotifications({ limit: 30 });
    setItems(result.data);
    setLoading(false);
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  // Realtime channel for live inserts targeted at this user. If the
  // subscription fails to attach (env mis-configured, network), the
  // dropdown still works — it just won't auto-update without a reopen.
  useEffect(() => {
    if (!supabaseRef.current) supabaseRef.current = createClient();
    const supabase = supabaseRef.current;
    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `recipient_id=eq.${userId}`,
        },
        async () => {
          // Refetch to get the joined actor info. Cheap given we cap at 30.
          await reload();
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, reload]);

  // Filter for the active tab.
  const visible = tab === "unread" ? items.filter((n) => !n.is_read) : items;

  // Group by bucket while preserving server ordering.
  const groups: { bucket: Bucket; items: NotificationWithActor[] }[] = [];
  for (const item of visible) {
    const b = bucketFor(item.created_at);
    const last = groups[groups.length - 1];
    if (!last || last.bucket !== b) groups.push({ bucket: b, items: [item] });
    else last.items.push(item);
  }

  async function handleRowClick(n: NotificationWithActor) {
    // Optimistically mark as read so the dot disappears immediately.
    if (!n.is_read) {
      setItems((prev) =>
        prev.map((x) =>
          x.id === n.id
            ? { ...x, is_read: true, read_at: new Date().toISOString() }
            : x,
        ),
      );
      onUnreadCountChange(Math.max(0, unreadCount - 1));
      // Fire-and-forget — RLS guarantees we can only mark our own.
      void markNotificationAsRead(n.id);
    }
    onClose();
    if (n.action_url) router.push(n.action_url);
  }

  async function handleMarkAllRead() {
    const unread = items.filter((n) => !n.is_read);
    if (unread.length === 0) return;
    // Optimistic
    const now = new Date().toISOString();
    setItems((prev) =>
      prev.map((x) => (!x.is_read ? { ...x, is_read: true, read_at: now } : x)),
    );
    onUnreadCountChange(0);
    const result = await markAllNotificationsAsRead();
    if (!result.success) {
      // Revert on failure — re-fetch is the cleanest reset.
      await reload();
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 8, scale: 0.96 }}
      transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
      className="absolute right-0 top-[calc(100%+8px)] w-[400px] max-w-[calc(100vw-32px)] bg-white border border-[#E5E7EB] rounded-2xl z-[100] overflow-hidden"
      style={{ boxShadow: "0 12px 36px rgba(15, 23, 42, 0.14)" }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#E5E7EB]">
        <h3
          className="text-[16px] text-[#2D333A]"
          style={{ fontFamily: "var(--font-poppins)", fontWeight: 700 }}
        >
          Notifications
        </h3>
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={handleMarkAllRead}
              className="text-[12px] font-semibold text-[#5CE1A5] hover:text-[#3DB882] transition-colors"
              style={{ fontFamily: "var(--font-poppins)" }}
            >
              Mark all read
            </button>
          )}
          <Link
            href="/settings/notifications"
            onClick={onClose}
            className="size-7 rounded-md flex items-center justify-center text-[#9CA3AF] hover:text-[#2D333A] hover:bg-[#F4F5F7] transition-colors"
            aria-label="Notification settings"
          >
            <Settings className="size-3.5" />
          </Link>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 px-3 py-2 border-b border-[#E5E7EB] bg-[#F8FAFC]">
        <TabPill
          label="All"
          active={tab === "all"}
          onClick={() => setTab("all")}
        />
        <TabPill
          label="Unread"
          active={tab === "unread"}
          badge={unreadCount > 0 ? unreadCount : undefined}
          onClick={() => setTab("unread")}
        />
      </div>

      {/* Body */}
      <div className="max-h-[440px] overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-10 text-[12px] text-[#6B7280]">
            <Loader2 className="size-4 animate-spin" />
            Loading...
          </div>
        ) : visible.length === 0 ? (
          <EmptyState filter={tab} />
        ) : (
          groups.map((g) => (
            <div key={g.bucket}>
              <p
                className="px-4 py-2 text-[10px] uppercase tracking-[0.08em] text-[#9CA3AF] bg-[#F8FAFC] border-b border-[#F1F5F9] sticky top-0"
                style={{ fontFamily: "var(--font-poppins)", fontWeight: 700 }}
              >
                {BUCKET_LABELS[g.bucket]}
              </p>
              <ul>
                {g.items.map((n) => (
                  <NotificationRow
                    key={n.id}
                    notification={n}
                    flashing={flashIds.has(n.id)}
                    onClick={() => handleRowClick(n)}
                    onFlashDone={() => {
                      setFlashIds((prev) => {
                        if (!prev.has(n.id)) return prev;
                        const next = new Set(prev);
                        next.delete(n.id);
                        return next;
                      });
                    }}
                  />
                ))}
              </ul>
            </div>
          ))
        )}
      </div>

      {/* Footer */}
      <Link
        href="/settings/notifications"
        onClick={onClose}
        className="block text-center px-4 py-2.5 text-[12px] text-[#6B7280] hover:text-[#5CE1A5] hover:bg-[#F8FAFC] border-t border-[#E5E7EB] transition-colors"
        style={{ fontFamily: "var(--font-poppins)", fontWeight: 600 }}
      >
        View all notifications
      </Link>
    </motion.div>
  );
}

// ─── Sub-components ────────────────────────────────────────
function TabPill({
  label,
  active,
  badge,
  onClick,
}: {
  label: string;
  active: boolean;
  badge?: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className="h-7 px-3 rounded-lg text-[12px] inline-flex items-center gap-1.5 transition-colors"
      style={{
        fontFamily: "var(--font-poppins)",
        fontWeight: 600,
        backgroundColor: active ? "white" : "transparent",
        color: active ? "#2D333A" : "#6B7280",
        boxShadow: active ? "0 1px 2px rgba(15, 23, 42, 0.06)" : undefined,
      }}
    >
      {label}
      {badge !== undefined && (
        <span
          className="inline-flex items-center justify-center h-4 min-w-[16px] px-1 rounded-full text-[10px] bg-[#5CE1A5] text-white tabular-nums"
          style={{ fontFamily: "var(--font-poppins)", fontWeight: 700 }}
        >
          {badge > 99 ? "99+" : badge}
        </span>
      )}
    </button>
  );
}

function NotificationRow({
  notification: n,
  flashing,
  onClick,
  onFlashDone,
}: {
  notification: NotificationWithActor;
  flashing: boolean;
  onClick: () => void;
  onFlashDone: () => void;
}) {
  useEffect(() => {
    if (!flashing) return;
    const t = setTimeout(onFlashDone, 1200);
    return () => clearTimeout(t);
  }, [flashing, onFlashDone]);

  const actorName = n.actor?.full_name || "System";
  return (
    <li className="border-b border-[#F1F5F9] last:border-b-0">
      <button
        type="button"
        onClick={onClick}
        className="w-full text-left px-4 py-3 hover:bg-[#FAFBFC] transition-colors flex items-start gap-3"
        style={{
          backgroundColor: flashing ? "rgba(92, 225, 165, 0.08)" : undefined,
        }}
      >
        <span
          className="size-8 rounded-full text-white text-[11px] flex items-center justify-center shrink-0"
          style={{
            fontFamily: "var(--font-poppins)",
            fontWeight: 600,
            backgroundColor: n.actor?.avatar_color || "#5CE1A5",
          }}
          aria-hidden
        >
          {initialsOf(actorName)}
        </span>
        <div className="flex-1 min-w-0">
          <p
            className="text-[13px] text-[#2D333A] leading-snug"
            style={{ fontFamily: "var(--font-source-sans)" }}
          >
            <span style={{ fontWeight: 600 }}>{n.title}</span>
          </p>
          {n.body && (
            <p
              className="text-[12px] text-[#6B7280] leading-snug mt-0.5 line-clamp-2"
              style={{ fontFamily: "var(--font-source-sans)" }}
            >
              {n.body}
            </p>
          )}
          <p
            className="text-[11px] text-[#9CA3AF] mt-1"
            style={{ fontFamily: "var(--font-source-sans)" }}
          >
            {relativeTime(n.created_at)}
          </p>
        </div>
        {!n.is_read && (
          <span
            className="size-2 rounded-full bg-[#5CE1A5] mt-2 shrink-0"
            aria-label="Unread"
          />
        )}
      </button>
    </li>
  );
}

function EmptyState({ filter }: { filter: TabId }) {
  return (
    <div className="flex flex-col items-center text-center py-12 px-6">
      <div
        className="size-12 rounded-2xl flex items-center justify-center mb-3"
        style={{ backgroundColor: "rgba(92, 225, 165, 0.10)" }}
      >
        <Bell className="size-6 text-[#5CE1A5]" />
      </div>
      <h4
        className="text-[14px] text-[#2D333A] mb-1"
        style={{ fontFamily: "var(--font-poppins)", fontWeight: 700 }}
      >
        {filter === "unread" ? "No unread notifications" : "You're all caught up"}
      </h4>
      <p
        className="text-[12px] text-[#6B7280] max-w-[260px]"
        style={{ fontFamily: "var(--font-source-sans)" }}
      >
        New activity from your team will show up here.
      </p>
      {filter !== "unread" && (
        <p
          className="text-[11px] text-[#9CA3AF] mt-2 flex items-center gap-1"
          style={{ fontFamily: "var(--font-source-sans)" }}
        >
          <Check className="size-3" /> All read
        </p>
      )}
    </div>
  );
}
