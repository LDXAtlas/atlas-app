# Backend Notes — Pending Backend Work for Frontend Features

Ben adds entries here when he ships UI that needs a backend hook. Lucas moves them to the **Done** section when completed.

---

## PENDING
1. Drag-and-Drop API Endpoint

What's needed: A server action or API route to update an event's date in Supabase.

Where to plug it in: In calendar-view.tsx, look for the handleEventDrop(eventId: string, newDate: Date) function. They need to trigger an UPDATE to the database inside this function to permanently save the new starts_at (and adjust the ends_at accordingly) when a user drops an event on a new day.

2. National Holidays Feed

What's needed: Real holiday data.

Where to plug it in: Currently, we are generating mock data using a frontend function called getUSCHolidays(year). The backend team should replace this by either sending down event_type: "holiday" items directly in the main events payload, or by providing a separate endpoint (like /api/holidays?year=2026) that the frontend can fetch from.

3. Performance Note on "Expanded Events"

What's needed: Keep an eye on recurring events.

Where to plug it in: Right now, the frontend calculates all recurring event dates locally using getAllEventDates. This is standard for modern apps, but if an organization has thousands of recurring events stretching years into the future, the backend might eventually need to handle the recurrence expansion via an Edge Function before sending the data to the client to save memory.


Lucas you can delete the library-sidebar.tsx file if you dont need it for anything. my libray UI is not using that file at all. 05/14 ben

Folder Hierarchy to Flat List Shift: The getFolderTree endpoint might need to return a pre-formatted path_name string if you allow deeply nested folders, since we removed the vertical tree in favor of a dropdown. 05/14 ben

Expanded Sorting Parameters (NEW): We moved sorting from a global dropdown directly into the table headers. The frontend is now passing six new values in the sortBy payload to getLibraryFiles: "type_asc", "type_desc", "uploader_asc", "uploader_desc", "tags_asc", and "tags_desc". 05/14 ben

TypeScript Interface Update Required (NEW): In @/app/actions/attachments, the type definition for the arguments accepted by getLibraryFiles() needs to be updated. Its sortBy property must be expanded to union the new sort strings mentioned above. (The frontend currently has a temporary as any cast on line 175 of library-view.tsx to bypass the type error until this is updated). 05/14 ben


### Library Phase 2 — Chunked upload Route Handler
- Server actions can't expose byte-level progress (full FormData arrives in one shot), so `FileUploader` currently uses an indeterminate animated bar. Replace with a chunked Route Handler (`/api/attachments/upload`) that streams via `ReadableStream` so the client can show real per-file bytes-uploaded progress.

### Library Phase 2 — Storage Packs add-on
- Stripe product + pricing for incremental storage packs (e.g., +25 GB / +100 GB).
- Webhook treats Storage Pack purchases as additive to `storage_limit_bytes` on top of the tier baseline. Keep a separate `storage_pack_bytes` column (or per-line-item ledger) so cancelling a pack reverses the bump cleanly.
- Settings → Subscription card teaser line ("Need more space? Storage Packs coming soon.") replaces with the real upsell button.

### Library Phase 4 — Polish / extensions
- Drag-and-drop folder reorganization (currently three-dot menu only).
- Deep folder tree recursion in `deleteLibraryFolder('delete_files')` — current implementation soft-deletes files at the top level of the folder being deleted. Nested folders' files survive via `ON DELETE SET NULL`. Fine for most cases; revisit if users start nesting heavily.
- Background "where this file is used" widening — show every entity (not just the original parent) once attachments get re-attached across entities. Today an attachment has a single `entity_type` / `entity_id`, so the UI accurately reflects one parent.

### Phase 2 notification follow-ups
- Email delivery for the rest of the notification types — currently only the invitation email (`send-invitation`) and the board-member-added email (`send-board-member-added`) actually send. The `email_enabled` toggle in `/settings/notifications` records the preference but won't fire emails for `task_assigned` / `event_invited` / `announcement_posted` / `task_comment` / `board_card_comment` / `board_card_mention` / etc. until each type gets its own `send-*` template + Resend hook.
- Remaining Phase-2 types (`task_due_soon`, `announcement_mention`, `event_reminder`) — wired into the type union and preferences, but no action emits them yet. Add them when each feature lands. (`board_card_mention`, `board_card_comment`, `task_comment`, and generic `mention` now fire — see DONE below.)

### Project Boards Phase 4 — "Duplicate card"
- The card detail panel's three-dot menu shows a disabled "Duplicate · Soon" item. Server action would clone title/description/cover/labels/checklist items (positions remapped) and place at the head of the same column. Don't carry over comments or activity.

---

## DONE

### Library Phase 3 — Standalone /workspace/library page — Completed 2026-05-13
- Migration documentation: `supabase/migrations/20260513_library_phase_3.sql` mirrors the SQL already applied in Supabase. New tables: `library_folders` (hierarchical, visibility = organization/department/private, color + icon for the sidebar tree), `library_tags` (org-scoped, unique on `(organization_id, name)`), `attachment_tags` junction. New columns on `attachments`: `folder_id` (nullable, FK to library_folders ON DELETE SET NULL), `is_pinned`, `view_count`, `download_count`, `last_accessed_at`. Separate `ALTER` drops the NOT NULL on `attachments.entity_id` so direct-library uploads use `entity_type='library' + entity_id IS NULL` instead of a sentinel uuid.
- 19 new server actions in `attachments.ts`:
  - **Folders**: `getLibraryFolders`, `getFolderTree` (with per-folder file counts), `createLibraryFolder` (admin/staff/leader), `updateLibraryFolder`, `deleteLibraryFolder` (cascade options: `move_to_root` re-parents files, `delete_files` soft-deletes them and manually decrements `storage_used_bytes` since the trigger only fires on hard DELETE), `moveLibraryFolder` (walks parent chain to reject cycles).
  - **Tags**: `getLibraryTags` (org-filtered usage counts), `createLibraryTag`, `updateLibraryTag`, `deleteLibraryTag`, `addTagToAttachment`, `removeTagFromAttachment`.
  - **Files**: `getLibraryFiles` is the universal fetcher (folderId/filter routing — `recent` = 30 day window, `pinned` = is_pinned, `from_*` = entity_type filter; tag intersection, file-type filter, ILIKE search, six sort modes, cursor pagination by id). `moveAttachmentToFolder` only writes `folder_id` — never changes entity_type/entity_id (multi-location model). `copyAttachment` clones bytes + thumbnail under a new storage path with `entity_type='library' + entity_id=null`. `pinAttachment` / `unpinAttachment`. `renameAttachment`. `updateAttachmentDescription`. `getAttachmentDetail` (joins folder + parent entity for the "Where this file is used" block).
  - **Upload**: `uploadToLibrary` — direct-library upload (entity_type='library', entity_id=null). Reuses Phase 1's MIME/size/storage checks and sharp thumbnail pipeline.
  - **Tracking**: `trackAttachmentView`, `trackAttachmentDownload` — best-effort counters, never blocks the action that triggered them.
- Phase 1 `userHasParentAccess` updated: the `library` branch still returns `{ ok: true }`. For direct-library uploads (entity_id IS NULL), the upload path uses `uploadToLibrary` instead of `uploadAttachment`, so the existing helper never gets called with a null id.
- UI: 11 new components under `src/app/(app)/workspace/library/_components/`:
  - `library-sidebar.tsx` — quick filters + virtual folders + folder tree (with file-count badges, recursive expand/collapse, context-menu hook) + tag pill list.
  - `library-topbar.tsx` — breadcrumb chain rebuilt from `parent_folder_id`, search input, filters popover (file types, uploaded-by), sort menu (6 modes), grid/list toggle, upload + new folder CTAs, active tag-filter chips.
  - `file-card.tsx` + `file-grid.tsx` — responsive 1/2/3/4-column grid with hover lift, multi-select checkbox, per-card three-dot menu, pin badge, lazy thumbnail load via `getThumbnailUrl`.
  - `file-list.tsx` — table view with the spec's full column set (thumbnail, name, type, size, uploader, modified, tags, actions).
  - `file-detail-panel.tsx` — 640px slide-in with inline rename, click-to-edit description, native previews (image → lightbox, PDF → iframe, audio → player, others → download CTA), tag picker over the org catalog, "Where this file is used" link to parent entity, Download / Copy link / Move to / Pin / Delete actions.
  - `create-folder-modal.tsx` — dual-purpose create/edit with name, description, 12-color palette, curated icon picker over `getIconByName`, visibility radio with department dropdown.
  - `folder-picker-modal.tsx` — searchable tree picker with "Library Root" option and an optional "Create new folder" handoff.
  - `bulk-actions-toolbar.tsx` — sticky bottom-center pill (Move / Tag / Pin / Delete / Clear).
  - `empty-states.tsx` — empty library, empty folder, no search results, storage banner at 80% / 100%.
  - `library-view.tsx` — the state-holding orchestrator that pulls it all together.
- Replaces the "Coming Soon" placeholder at `/workspace/library`.

### Project Boards Phase 3 — Card detail panel, checklist, comments, labels, activity — Completed 2026-05-13
- Migration documentation: `supabase/migrations/20260513_create_card_activity.sql` — `card_activity` table (CHECK-constrained `action_type`, jsonb `metadata`, per-card descending index, RLS) plus `card_checklist_items.completed_at`. SQL was applied directly to Supabase first; migration file is the source-of-truth copy.
- 14 new server actions in `boards.ts`:
  - Checklist: `createChecklistItem`, `updateChecklistItem` (flips `completed_at` on real `false→true` transitions only), `deleteChecklistItem`, `reorderChecklistItems`.
  - Comments: `createCardComment` (parses `@[Name](uuid)` mention tokens into `board_card_mention` notifications; emits `board_card_comment` to assignee + creator; de-dupes against the commenter), `updateCardComment`, `deleteCardComment`, `getCardComments`.
  - Labels: `getBoardLabels` (with `usage_count`), `createBoardLabel` (handles 23505 unique on `(board_id, name)`), `updateBoardLabel`, `deleteBoardLabel`, `addCardLabel`, `removeCardLabel`.
  - Activity: `recordCardActivity` helper (best-effort — failures log and continue, never roll back the primary write), `getCardActivity`.
  - `getCard` fresh: parallel `Promise.all` across board / column / labels / checklist / comments / activity / profiles. Returns assignee + creator joined, `viewer_can_edit` / `viewer_can_delete`, latest 20 activity entries.
- Activity diffs retrofitted into `createCard`, `updateCard` (title, description, assigned_to, due_date, is_completed — diffed against pre-update row to skip no-op re-saves), and `moveCard` (column changes only — in-column reorders are noise).
- UI components: `<MentionInput>` reusable @-trigger textarea with debounced `searchProfiles` dropdown and keyboard navigation; `<MentionRenderer>` for pill rendering; `<CommentsSection>` entity-agnostic, takes onCreate/onUpdate/onDelete props; `<ChecklistSection>` @dnd-kit drag-reorder with optimistic flips + progress bar; `<LabelsPicker>` popover; `<ManageLabelsModal>` per-row CRUD with usage counts; `<ActivityLog>` with phrase formatter per action_type; `<CardDetailPanel>` 720px slide-in orchestrator replacing the old `EditCardModal`.
- `board-view.tsx` rewired: `handleCardPatch` applies partial updates and handles cross-column moves by splicing rather than swapping in place; `handleCardRemoved` pulls deleted cards out of the kanban immediately. `EditCardModal` file deleted.

### Task comments — Completed 2026-05-13
- Closes the long-standing task_comment notification gap. Same @mention token syntax as card comments. `createTaskComment` fans out `task_comment` notifications to the assignee + creator and a generic `mention` notification to anyone tagged. `updateTaskComment` is author-only; `deleteTaskComment` is author-or-admin (re-resolves viewer role since `tasks.ts`'s auth helper doesn't carry it).
- `TaskComments` wrapper component slots inside `task-modal.tsx` right under attachments, rendered only when the task already has an id. Reuses the shared `<CommentsSection>` from project boards — same pill rendering, same edit/delete affordances.

### Library Phase 1 — File attachments foundation — Completed 2026-05-04
- Migration documentation: `supabase/migrations/20260513_attachments_phase_1.sql` — polymorphic `attachments` table (entity_type ∈ {task, announcement, event, board_card, library}, 25 MB CHECK constraint, soft-delete via `deleted_at`, unique `storage_path`, optional `thumbnail_path`), `organizations.storage_used_bytes` + `storage_limit_bytes` columns, and an INSERT/DELETE trigger that maintains `storage_used_bytes`. Trigger does NOT fire on UPDATE, so soft deletes manually decrement.
- `src/lib/file-utils.ts`: shared pure helpers — `MAX_FILE_BYTES` (25 MB), `TIER_STORAGE_LIMITS` (2 / 10 / 50 GB), `ALLOWED_MIME_TYPES` allow-list (images, PDFs, audio, Word/Excel/PowerPoint, text), `categorizeFile`, `formatBytes`, `sanitizeFilename`, `shouldGenerateThumbnail`.
- `src/app/actions/attachments.ts` (~570 LOC, `"use server"`): `uploadAttachment` (MIME + size + storage-limit checks, sharp-generated 200×200 WebP thumbnail for images, service-role storage write with rollback, parent-access gating per entity type, role gate re-enforced because service role bypasses RLS), `getAttachments`, `deleteAttachment` (soft delete + storage cleanup + manual `storage_used_bytes` decrement), `getDownloadUrl` / `getInlineUrl` / `getThumbnailUrl` (60-min signed URLs), `getOrganizationStorageUsage`, `getStorageBreakdown` (per-entity_type rollup).
- Reusable client components: `<FileUploader>` (drag-drop, multi-file, client-side size/MIME/storage pre-checks, indeterminate per-row progress bar — TODO Phase 2), `<FilePreview>` (type-aware row with thumbnail / icon, three-dot menu: Download / Copy link / Delete with uploader-or-admin gate), `<AttachmentsSection>` (collapsible wrapper, orchestrates preview modals, self-resolves viewerId via browser supabase client). Three preview modals: `<LightboxModal>` (image carousel with ←/→ keys + Esc), `<PDFPreviewModal>` (iframe), `<TextPreviewModal>` (256 KB inline cap + truncation banner).
- Integrations: Task modal (below description, edit mode only), Announcement card (inside expanded body, gated by `canEdit`), Calendar `EventDetailPanel` (replaces the previously-mocked Linked Files block), `EditCardModal` for project boards (below description). Audio plays inline via expanded `<audio>` player on click; Office docs route straight to download.
- Settings → Subscription gained a "File Storage" card: tonal usage bar (mint < 80%, amber 80–99%, red ≥ 100%), per-feature breakdown (Tasks, Announcements, Events, Boards, Library), 25 MB note, Storage Packs teaser.
- Stripe webhook now writes `storage_limit_bytes` on every tier change. `getAllocationsForTier` returns it alongside `seat_limit` and `ai_credits_limit`, so `checkout.session.completed`, `customer.subscription.updated`, `sync-stripe`, and onboarding success all pick it up automatically. Downgrades that take usage above the new limit keep existing files (blocks new uploads only).

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
