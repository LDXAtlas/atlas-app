# Backend Notes — Pending Backend Work for Frontend Features

Ben adds entries here when he ships UI that needs a backend hook. Lucas moves them to the **Done** section when completed.

---

## PENDING

### Phase 2 notification follow-ups
- `task_comment` notifications — `tasks.ts` doesn't have a comment server action yet. Once the comment write path lands, hook `createNotification({ type: 'task_comment' })` into it (notify task assignee + creator when they aren't the commenter).
- Email delivery for the rest of the notification types — currently only the invitation email (`send-invitation`) and the board-member-added email (`send-board-member-added`) actually send. The `email_enabled` toggle in `/settings/notifications` records the preference but won't fire emails for `task_assigned` / `event_invited` / `announcement_posted` / etc. until each type gets its own `send-*` template + Resend hook.
- Phase-2 types (`task_due_soon`, `announcement_mention`, `event_reminder`, `board_card_mention`, `mention`) — wired into the type union and preferences, but no action emits them yet. Add them when each feature lands.

---

## DONE

### Board Overview description save — Completed 2026-05-12
- Added `updateBoard(boardId, data)` server action in `src/app/actions/boards.ts` accepting partial updates for `name` / `description` / `color` / `icon` / `department_id` / `visibility`, gated by `requireEditAccess`.
- Wired `BoardOverview.handleSave` (inline in `board-view.tsx`) with optimistic UI: flips the description and exits edit mode immediately, then calls the action. On error, reverts local state, re-opens the editor, and surfaces the error in an auto-dismissing toast.
- Save button reflects pending state and disables to prevent double-submits.

### Board star persistence — Completed 2026-05-12
- Added `supabase/migrations/20260512_create_board_stars.sql`: composite-PK `board_stars` table (`user_id`, `board_id`, `starred_at`) with FK cascades and per-user RLS so each user only sees and writes their own rows.
- Added `toggleBoardStar(boardId)` action. Verifies viewer visibility (no edit requirement — any viewer can favorite), inserts/deletes the row, and returns the resulting `is_starred` so the client can sync against server truth.
- Replaced the creator/member proxy in `getBoards()` with a real `board_stars` join: `is_starred` now reflects actual stars across reloads.
- Wired `boards-list.tsx#handleToggleStar` to call the action behind the existing optimistic flip. Errors revert local state and surface an inline banner.

### Add Member modal backend — Completed 2026-05-12
- New `src/app/actions/profiles.ts` with `searchProfiles(query, excludeBoardId?)`: case-insensitive ILIKE on `full_name` and `email`, capped at 10, filters out existing `board_members` when `excludeBoardId` is supplied, gated by org membership + board access.
- New `addBoardMember(boardId, profileId, role)` action in `boards.ts`. Requires edit access; validates target org; gracefully maps `23505` unique-constraint violation to "already on this board."
- Sends an email via Resend (`src/lib/email/send-board-member-added.ts`) mirroring the existing invitation template. Email failure is logged but doesn't roll back the membership.
- In-app notification: ✅ now wired via the notifications system below (board_member_added).
- Wired the modal in `board-detail-header.tsx`: 300ms-debounced search, click-to-add with per-row spinner, optimistic "Just added" panel, inline error banner, and `router.refresh()` on modal close to repopulate the header avatar stack.

### In-app notifications system — Completed 2026-05-12
- Migration documentation: `supabase/migrations/20260512_create_notifications.sql` mirrors the live `notifications` + `notification_preferences` schema, RLS, and the `get_unread_notification_count(p_user_id)` RPC.
- New `src/app/actions/notifications.ts` with the full action set:
  - `createNotification` — honors per-recipient `notification_preferences` (column is `notification_type`, not `type`); skips self-notify.
  - `createNotificationsBatch` — single bulk insert for fan-outs (announcements, events) with one preference query.
  - `getNotifications` — paginated by `created_at` cursor with `unreadOnly` filter and batched actor profile join.
  - `getUnreadNotificationCount` — wraps the `get_unread_notification_count` RPC.
  - `markNotificationAsRead`, `markAllNotificationsAsRead`, `deleteNotification`, `clearAllNotifications`.
  - `getNotificationPreferences` — merges stored rows with `DEFAULT_NOTIFICATION_PREFERENCES` so the UI sees every type with an `is_default` flag.
  - `updateNotificationPreference` — upsert on `(user_id, notification_type)`. `resetNotificationPreferences` clears all custom rows.
- `src/lib/notifications-config.ts` holds the runtime constants (`DEFAULT_NOTIFICATION_PREFERENCES`, `NOTIFICATION_CATEGORIES`) and type aliases (`NotificationType`, `NotificationEntityType`) — `"use server"` files can only export async functions, so the config has its own module.
- Wired notification creation into existing actions, all best-effort (failures log + continue, never roll back the primary write):
  - `boards.ts` `addBoardMember` → `board_member_added`
  - `boards.ts` `createCard` / `updateCard` → `board_card_assigned` on real reassign to a non-self user
  - `tasks.ts` `createTask` / `updateTask` → `task_assigned` on real reassign
  - `announcements.ts` `createAnnouncement` → `announcement_posted` batch (department-targeted profiles, or org-wide when `target_department_id` is null)
  - `events.ts` `createEvent` → `event_invited` batch to members of any associated department (org-wide events intentionally skipped to avoid spam)
  - `invitations.ts` `acceptInvitation` → `team_member_joined` to every org admin
  - `profile-departments.ts` `bulkUpdateAssignments` → one `department_assigned` notification per newly-added dept, with Primary/Secondary body text. Snapshots existing rows before the wholesale rewrite so a no-op save doesn't re-notify.
- UI: new `src/app/(app)/_components/notifications-dropdown.tsx` — 400px dropdown with All/Unread tabs, date buckets (Today / Yesterday / This Week / Earlier) with sticky headers, optimistic mark-as-read, mark-all-read, click-to-navigate via `action_url`, Bell empty state, and live `INSERT` subscription via Supabase Realtime channel `notifications:<userId>`.
- `_components/shell.tsx` wired: real unread count via the RPC on mount, Realtime channel for live `*` events with a 60s polling fallback, red badge in the bell (`99+` cap), `NotificationsDropdown` replaces the static placeholder. `layout.tsx` threads `user.id` through as `AppShell.userId`.
- Settings page: new `/settings/notifications` route with category cards (Tasks / Announcements / Calendar / Project Boards / Team), per-row in-app + email toggles, optimistic save with per-row spinner, inline toast, "Reset to defaults" link, and a banner noting email delivery isn't wired for every type yet. Settings home `/settings` "Notifications" card became a live link.
