"use server";

import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

// ─── Types ─────────────────────────────────────────────────
//
// The full type list mirrors the CHECK constraint on notifications.type.
// Phase 1 only emits a subset (see NOTIFICATION_CATEGORIES below); the
// rest are kept here so future code that calls createNotification with
// them passes type-check.
export type NotificationType =
  | "task_assigned"
  | "task_comment"
  | "task_due_soon"
  | "announcement_posted"
  | "announcement_mention"
  | "event_invited"
  | "event_reminder"
  | "board_member_added"
  | "board_card_assigned"
  | "board_card_comment"
  | "board_card_mention"
  | "team_member_invited"
  | "team_member_joined"
  | "department_assigned"
  | "mention"
  | "system";

export type NotificationEntityType =
  | "task"
  | "announcement"
  | "event"
  | "board"
  | "board_card"
  | "profile"
  | "department"
  | "organization";

export type Notification = {
  id: string;
  organization_id: string;
  recipient_id: string;
  actor_id: string | null;
  type: NotificationType;
  title: string;
  body: string | null;
  entity_type: NotificationEntityType | null;
  entity_id: string | null;
  action_url: string | null;
  metadata: Record<string, unknown>;
  is_read: boolean;
  read_at: string | null;
  created_at: string;
};

export type NotificationActor = {
  id: string;
  full_name: string;
  avatar_color: string;
  role: string;
};

export type NotificationWithActor = Notification & {
  actor: NotificationActor | null;
};

export type CreateNotificationParams = {
  recipientId: string;
  organizationId: string;
  actorId?: string | null;
  type: NotificationType;
  title: string;
  body?: string | null;
  entityType?: NotificationEntityType | null;
  entityId?: string | null;
  actionUrl?: string | null;
  metadata?: Record<string, unknown>;
};

export type NotificationPreferenceRow = {
  notification_type: NotificationType;
  in_app_enabled: boolean;
  email_enabled: boolean;
};

export type ActionResult<T = unknown> =
  | { success: true; data?: T }
  | { success: false; error: string };

// ─── Defaults ──────────────────────────────────────────────
//
// Returned by getNotificationPreferences() for any type the user hasn't
// explicitly customized. Defaults lean toward "notify me in-app, email
// only the things that need immediate attention."
export const DEFAULT_NOTIFICATION_PREFERENCES: Record<
  NotificationType,
  { in_app: boolean; email: boolean }
> = {
  task_assigned: { in_app: true, email: true },
  task_comment: { in_app: true, email: false },
  task_due_soon: { in_app: true, email: false },
  announcement_posted: { in_app: true, email: false },
  announcement_mention: { in_app: true, email: true },
  event_invited: { in_app: true, email: true },
  event_reminder: { in_app: true, email: false },
  board_member_added: { in_app: true, email: true },
  board_card_assigned: { in_app: true, email: false },
  board_card_comment: { in_app: true, email: false },
  board_card_mention: { in_app: true, email: true },
  team_member_invited: { in_app: true, email: false },
  team_member_joined: { in_app: true, email: false },
  department_assigned: { in_app: true, email: false },
  mention: { in_app: true, email: false },
  system: { in_app: true, email: false },
};

// Grouped categories used by the settings preferences page.
export const NOTIFICATION_CATEGORIES: {
  category: string;
  description: string;
  items: { type: NotificationType; label: string; description: string }[];
}[] = [
  {
    category: "Tasks",
    description: "Updates about tasks you own or are assigned to.",
    items: [
      {
        type: "task_assigned",
        label: "Task assigned to you",
        description: "When someone assigns you a task.",
      },
      {
        type: "task_comment",
        label: "Comment on your task",
        description: "When someone comments on a task you created or are assigned to.",
      },
    ],
  },
  {
    category: "Announcements",
    description: "New posts in your org or department.",
    items: [
      {
        type: "announcement_posted",
        label: "New announcement",
        description: "When a new announcement is posted to your org or department.",
      },
    ],
  },
  {
    category: "Calendar",
    description: "Invitations and reminders for events.",
    items: [
      {
        type: "event_invited",
        label: "Invited to an event",
        description: "When you're added as an attendee on an event.",
      },
    ],
  },
  {
    category: "Project Boards",
    description: "Updates on the boards and cards you're part of.",
    items: [
      {
        type: "board_member_added",
        label: "Added to a board",
        description: "When someone adds you to a project board.",
      },
      {
        type: "board_card_assigned",
        label: "Card assigned to you",
        description: "When someone assigns you to a card on a board.",
      },
      {
        type: "board_card_comment",
        label: "Comment on your card",
        description: "When someone comments on a card you own or are assigned to.",
      },
    ],
  },
  {
    category: "Team",
    description: "Updates about your church's team and departments.",
    items: [
      {
        type: "team_member_joined",
        label: "New teammate joined",
        description: "When an invitee accepts and joins your organization.",
      },
      {
        type: "department_assigned",
        label: "Added to a department",
        description: "When someone assigns you to a ministry or department.",
      },
    ],
  },
];

// ─── Auth helper ────────────────────────────────────────────
async function getAuthContext(): Promise<{ userId: string } | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  return { userId: user.id };
}

// ─── createNotification (called by other server actions) ───
//
// Best-effort write. The caller's primary work shouldn't roll back on
// notification failure, so this returns { success: false } on error but
// the caller is expected to log + continue.
export async function createNotification(
  params: CreateNotificationParams,
): Promise<ActionResult<{ id: string }>> {
  if (!params.recipientId) {
    return { success: false, error: "recipientId is required." };
  }
  if (!params.organizationId) {
    return { success: false, error: "organizationId is required." };
  }
  if (!params.title?.trim()) {
    return { success: false, error: "title is required." };
  }
  // Don't notify yourself.
  if (params.actorId && params.actorId === params.recipientId) {
    return { success: false, error: "Recipient and actor are the same user." };
  }

  // Honor the recipient's in-app preference for this type. We only fetch
  // the one row we care about — `notification_type` is the column name
  // (not `type`), per the schema.
  const { data: prefRow } = await supabaseAdmin
    .from("notification_preferences")
    .select("in_app_enabled")
    .eq("user_id", params.recipientId)
    .eq("notification_type", params.type)
    .maybeSingle();

  const defaultPref = DEFAULT_NOTIFICATION_PREFERENCES[params.type];
  const inAppEnabled =
    prefRow?.in_app_enabled ?? defaultPref?.in_app ?? true;
  if (!inAppEnabled) {
    return { success: true }; // Silently skip — not an error.
  }

  const { data, error } = await supabaseAdmin
    .from("notifications")
    .insert({
      organization_id: params.organizationId,
      recipient_id: params.recipientId,
      actor_id: params.actorId ?? null,
      type: params.type,
      title: params.title.trim(),
      body: params.body?.trim() || null,
      entity_type: params.entityType ?? null,
      entity_id: params.entityId ?? null,
      action_url: params.actionUrl ?? null,
      metadata: params.metadata ?? {},
    })
    .select("id")
    .single();

  if (error) {
    console.error("[createNotification] Insert error:", error.message);
    return { success: false, error: error.message };
  }
  return { success: true, data: { id: data.id } };
}

// ─── createNotificationsBatch (efficient broadcast) ─────────
//
// Used by announcements where one event fans out to dozens or hundreds
// of recipients. Applies per-recipient preference checks in JS before
// the bulk insert so we don't fan-out to anyone who's opted out.
export async function createNotificationsBatch(
  recipientIds: string[],
  shared: Omit<CreateNotificationParams, "recipientId">,
): Promise<ActionResult<{ inserted: number }>> {
  const targets = Array.from(
    new Set(recipientIds.filter((id) => id && id !== shared.actorId)),
  );
  if (targets.length === 0) return { success: true, data: { inserted: 0 } };

  // Filter targets by their in-app preferences.
  const { data: prefs } = await supabaseAdmin
    .from("notification_preferences")
    .select("user_id, in_app_enabled")
    .eq("notification_type", shared.type)
    .in("user_id", targets);
  const explicitlyDisabled = new Set(
    (prefs ?? [])
      .filter((r: { in_app_enabled: boolean }) => !r.in_app_enabled)
      .map((r: { user_id: string }) => r.user_id),
  );
  const defaultPref =
    DEFAULT_NOTIFICATION_PREFERENCES[shared.type]?.in_app ?? true;
  const finalTargets = targets.filter((id) =>
    defaultPref ? !explicitlyDisabled.has(id) : false,
  );
  if (finalTargets.length === 0) return { success: true, data: { inserted: 0 } };

  const rows = finalTargets.map((recipientId) => ({
    organization_id: shared.organizationId,
    recipient_id: recipientId,
    actor_id: shared.actorId ?? null,
    type: shared.type,
    title: shared.title.trim(),
    body: shared.body?.trim() || null,
    entity_type: shared.entityType ?? null,
    entity_id: shared.entityId ?? null,
    action_url: shared.actionUrl ?? null,
    metadata: shared.metadata ?? {},
  }));

  const { error } = await supabaseAdmin.from("notifications").insert(rows);
  if (error) {
    console.error("[createNotificationsBatch] Insert error:", error.message);
    return { success: false, error: error.message };
  }
  return { success: true, data: { inserted: rows.length } };
}

// ─── getNotifications ──────────────────────────────────────
export type GetNotificationsOptions = {
  limit?: number;
  /** ISO timestamp of the last seen notification (created_at); items strictly older are returned. */
  cursor?: string;
  unreadOnly?: boolean;
};

export async function getNotifications(
  options: GetNotificationsOptions = {},
): Promise<{ data: NotificationWithActor[]; error?: string }> {
  const ctx = await getAuthContext();
  if (!ctx) return { data: [], error: "Not authenticated." };

  const limit = Math.max(1, Math.min(options.limit ?? 20, 100));

  let q = supabaseAdmin
    .from("notifications")
    .select(
      "id, organization_id, recipient_id, actor_id, type, title, body, entity_type, entity_id, action_url, metadata, is_read, read_at, created_at",
    )
    .eq("recipient_id", ctx.userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (options.cursor) q = q.lt("created_at", options.cursor);
  if (options.unreadOnly) q = q.eq("is_read", false);

  const { data: rows, error } = await q;
  if (error) {
    console.error("[getNotifications] Select error:", error.message);
    return { data: [], error: error.message };
  }

  // Resolve actor profiles in one batch.
  const actorIds = Array.from(
    new Set(
      (rows ?? [])
        .map((r: { actor_id: string | null }) => r.actor_id)
        .filter((x): x is string => !!x),
    ),
  );

  const actorMap = new Map<string, NotificationActor>();
  if (actorIds.length > 0) {
    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, email, role")
      .in("id", actorIds);
    (profiles ?? []).forEach(
      (p: {
        id: string;
        full_name: string | null;
        email: string | null;
        role: string | null;
      }) => {
        actorMap.set(p.id, {
          id: p.id,
          full_name: p.full_name || p.email?.split("@")[0] || "Unnamed",
          // Mint fallback matches the rest of the app's avatar treatment.
          avatar_color: "#5CE1A5",
          role: p.role || "member",
        });
      },
    );
  }

  const data: NotificationWithActor[] = (rows ?? []).map(
    (
      r: Notification & { actor_id: string | null },
    ): NotificationWithActor => ({
      ...r,
      actor: r.actor_id ? actorMap.get(r.actor_id) ?? null : null,
    }),
  );
  return { data };
}

// ─── getUnreadNotificationCount ────────────────────────────
export async function getUnreadNotificationCount(): Promise<{
  count: number;
  error?: string;
}> {
  const ctx = await getAuthContext();
  if (!ctx) return { count: 0, error: "Not authenticated." };

  const { data, error } = await supabaseAdmin.rpc(
    "get_unread_notification_count",
    { p_user_id: ctx.userId },
  );
  if (error) {
    console.error("[getUnreadNotificationCount] RPC error:", error.message);
    return { count: 0, error: error.message };
  }
  return { count: Number(data ?? 0) };
}

// ─── Mark-as-read ──────────────────────────────────────────
export async function markNotificationAsRead(
  notificationId: string,
): Promise<ActionResult> {
  const ctx = await getAuthContext();
  if (!ctx) return { success: false, error: "Not authenticated." };

  const { error } = await supabaseAdmin
    .from("notifications")
    .update({ is_read: true, read_at: new Date().toISOString() })
    .eq("id", notificationId)
    .eq("recipient_id", ctx.userId);
  if (error) {
    console.error("[markNotificationAsRead] Update error:", error.message);
    return { success: false, error: error.message };
  }
  return { success: true };
}

export async function markAllNotificationsAsRead(): Promise<ActionResult> {
  const ctx = await getAuthContext();
  if (!ctx) return { success: false, error: "Not authenticated." };

  const { error } = await supabaseAdmin
    .from("notifications")
    .update({ is_read: true, read_at: new Date().toISOString() })
    .eq("recipient_id", ctx.userId)
    .eq("is_read", false);
  if (error) {
    console.error("[markAllNotificationsAsRead] Update error:", error.message);
    return { success: false, error: error.message };
  }
  return { success: true };
}

// ─── Delete ────────────────────────────────────────────────
export async function deleteNotification(
  notificationId: string,
): Promise<ActionResult> {
  const ctx = await getAuthContext();
  if (!ctx) return { success: false, error: "Not authenticated." };

  const { error } = await supabaseAdmin
    .from("notifications")
    .delete()
    .eq("id", notificationId)
    .eq("recipient_id", ctx.userId);
  if (error) {
    console.error("[deleteNotification] Delete error:", error.message);
    return { success: false, error: error.message };
  }
  return { success: true };
}

export async function clearAllNotifications(): Promise<ActionResult> {
  const ctx = await getAuthContext();
  if (!ctx) return { success: false, error: "Not authenticated." };

  const { error } = await supabaseAdmin
    .from("notifications")
    .delete()
    .eq("recipient_id", ctx.userId);
  if (error) {
    console.error("[clearAllNotifications] Delete error:", error.message);
    return { success: false, error: error.message };
  }
  return { success: true };
}

// ─── Preferences ───────────────────────────────────────────
export type NotificationPreferenceWithDefaults = {
  type: NotificationType;
  in_app: boolean;
  email: boolean;
  /** True when this row came from defaults rather than a stored preference. */
  is_default: boolean;
};

export async function getNotificationPreferences(): Promise<{
  data: NotificationPreferenceWithDefaults[];
  error?: string;
}> {
  const ctx = await getAuthContext();
  if (!ctx) return { data: [], error: "Not authenticated." };

  const { data: rows, error } = await supabaseAdmin
    .from("notification_preferences")
    .select("notification_type, in_app_enabled, email_enabled")
    .eq("user_id", ctx.userId);
  if (error) {
    console.error("[getNotificationPreferences] Select error:", error.message);
    return { data: [], error: error.message };
  }

  const stored = new Map<string, NotificationPreferenceRow>();
  (rows ?? []).forEach((r: NotificationPreferenceRow) => {
    stored.set(r.notification_type, r);
  });

  // Merge stored prefs with defaults so the UI always renders the full
  // type list, with a flag distinguishing user-set values from defaults.
  const all: NotificationType[] = Object.keys(
    DEFAULT_NOTIFICATION_PREFERENCES,
  ) as NotificationType[];
  const merged: NotificationPreferenceWithDefaults[] = all.map((type) => {
    const fromStore = stored.get(type);
    const fallback = DEFAULT_NOTIFICATION_PREFERENCES[type];
    return {
      type,
      in_app: fromStore?.in_app_enabled ?? fallback.in_app,
      email: fromStore?.email_enabled ?? fallback.email,
      is_default: !fromStore,
    };
  });

  return { data: merged };
}

export async function updateNotificationPreference(
  type: NotificationType,
  prefs: { in_app?: boolean; email?: boolean },
): Promise<ActionResult> {
  const ctx = await getAuthContext();
  if (!ctx) return { success: false, error: "Not authenticated." };

  // Resolve unspecified fields from defaults so an upsert always writes
  // a complete row.
  const fallback = DEFAULT_NOTIFICATION_PREFERENCES[type];
  if (!fallback) {
    return { success: false, error: "Unknown notification type." };
  }
  const in_app_enabled = prefs.in_app ?? fallback.in_app;
  const email_enabled = prefs.email ?? fallback.email;

  const { error } = await supabaseAdmin
    .from("notification_preferences")
    .upsert(
      {
        user_id: ctx.userId,
        notification_type: type,
        in_app_enabled,
        email_enabled,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,notification_type" },
    );
  if (error) {
    console.error("[updateNotificationPreference] Upsert error:", error.message);
    return { success: false, error: error.message };
  }
  return { success: true };
}

export async function resetNotificationPreferences(): Promise<ActionResult> {
  const ctx = await getAuthContext();
  if (!ctx) return { success: false, error: "Not authenticated." };

  const { error } = await supabaseAdmin
    .from("notification_preferences")
    .delete()
    .eq("user_id", ctx.userId);
  if (error) {
    console.error("[resetNotificationPreferences] Delete error:", error.message);
    return { success: false, error: error.message };
  }
  return { success: true };
}
