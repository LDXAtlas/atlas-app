-- Notifications Schema
--
-- NOTE: This file is documentation only. The schema is already live in
-- Supabase from SQL run earlier; do not re-apply this migration against
-- a database that already has these tables.

-- Notifications table
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations ON DELETE CASCADE,
  recipient_id uuid NOT NULL REFERENCES public.profiles ON DELETE CASCADE,
  actor_id uuid REFERENCES public.profiles ON DELETE SET NULL,
  type text NOT NULL CHECK (type IN (
    'task_assigned',
    'task_comment',
    'task_due_soon',
    'announcement_posted',
    'announcement_mention',
    'event_invited',
    'event_reminder',
    'board_member_added',
    'board_card_assigned',
    'board_card_comment',
    'board_card_mention',
    'team_member_invited',
    'team_member_joined',
    'department_assigned',
    'mention',
    'system'
  )),
  title text NOT NULL,
  body text,
  entity_type text CHECK (entity_type IN ('task', 'announcement', 'event', 'board', 'board_card', 'profile', 'department', 'organization')),
  entity_id uuid,
  action_url text,
  metadata jsonb DEFAULT '{}'::jsonb,
  is_read boolean DEFAULT false,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT title_not_empty CHECK (length(title) > 0)
);

CREATE INDEX idx_notifications_recipient ON public.notifications (recipient_id, created_at DESC);
CREATE INDEX idx_notifications_recipient_unread ON public.notifications (recipient_id, is_read, created_at DESC) WHERE is_read = false;
CREATE INDEX idx_notifications_org ON public.notifications (organization_id);
CREATE INDEX idx_notifications_entity ON public.notifications (entity_type, entity_id) WHERE entity_type IS NOT NULL;

-- Notification Preferences (per-user, per-type)
CREATE TABLE public.notification_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles ON DELETE CASCADE,
  notification_type text NOT NULL,
  in_app_enabled boolean DEFAULT true,
  email_enabled boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, notification_type)
);

CREATE INDEX idx_notification_prefs_user ON public.notification_preferences (user_id);

-- Row Level Security
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

-- Notifications: users can only see their own
CREATE POLICY "Users can view their own notifications"
  ON public.notifications FOR SELECT
  USING (recipient_id = auth.uid());

-- Service role can insert (notifications are created by server actions, not directly by users)
-- Users themselves can update only the read state of their own notifications
CREATE POLICY "Users can mark their own notifications as read"
  ON public.notifications FOR UPDATE
  USING (recipient_id = auth.uid())
  WITH CHECK (recipient_id = auth.uid());

-- Users can delete their own notifications
CREATE POLICY "Users can delete their own notifications"
  ON public.notifications FOR DELETE
  USING (recipient_id = auth.uid());

-- Notification preferences: users manage only their own
CREATE POLICY "Users can view their own preferences"
  ON public.notification_preferences FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can manage their own preferences"
  ON public.notification_preferences FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Helper function: get unread count
CREATE OR REPLACE FUNCTION public.get_unread_notification_count(p_user_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY INVOKER
AS $$
  SELECT COUNT(*)::integer
  FROM public.notifications
  WHERE recipient_id = p_user_id
    AND is_read = false;
$$;

REVOKE EXECUTE ON FUNCTION public.get_unread_notification_count(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_unread_notification_count(uuid) TO authenticated;
