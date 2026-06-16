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


### Huddles Phase 2 & beyond — planning notes (2026-06-15 session)
Defined ideas from Lucas, sequenced for future phases. Do NOT build yet — these depend on the Phase 2 AI work below and should be built with AI consumption designed in from the start. The four sub-blocks below (Phase 2 AI / Phase 2 Live Notes / Phase 2.5 Agenda / Phase 6 Video) are entries under this planning umbrella.

### Huddles Phase 2 — AI Layer (next major Huddles session)
Builds on Phase 0 infrastructure (`src/lib/ai/`) which is already live.
- Audio recording — browser MediaRecorder API, 24 kbps mono Opus @ 16 kHz. Stores to a SEPARATE `huddle-recordings` Supabase bucket (NOT the attachments bucket). 30-day default retention via `default_recording_retention_days`.
- Whisper transcription via existing `transcribeAudio()`. 1 credit per minute of audio.
- Claude summary + action item extraction via existing `callAI()`. AI output is always SUGGESTIONS requiring human Accept/Edit/Reject, never auto-applied.
- Transcription display lives in Outcomes tab.
- Review/accept flow: accepted action items become real tasks (reuse `promoteActionItemToTask` pattern), accepted decisions go to the decisions log.
- Phase 1 schema is ready: `huddle_recordings`, `huddle_transcripts`, `huddle_summaries` tables exist and are empty. The status enum already has `processing` and `ready` for the post-upload pipeline. Action-item extraction will use `feature: 'huddle_action_extraction'` (`huddle_action_items.source = 'ai_extracted'`).

### Huddles Phase 2 — Live Notes as Color-Coded Message Thread (DECIDE DATA MODEL BEFORE BUILDING PHASE 2)
Replace the current single freeform `huddle_notes` blob with a timestamped, attributed entry model:
- Notes become a series of timestamped entries (like a group chat / message thread), NOT one textarea.
- Each entry attributed to its author with a distinct color/avatar per person.
- Each attendee adds entries from their own device.
- Use Supabase Realtime so entries appear live — BUT use the "separate entries" model (each note is its own row), NOT true simultaneous-editing-of-one-document. If two people post at once, both entries just appear in the thread. This sidesteps operational-transform complexity.
- WHY: gives AI far better-structured, attributed, timestamped input for summarization than one text blob. Also correlates with transcript timestamps in Phase 2.
- Likely needs a new `huddle_note_entries` table (id, huddle_id, author_id, content, created_at) alongside or replacing the current `huddle_notes` single-blob table. Decide BEFORE building the Phase 2 AI pipeline so we don't build on the blob model then migrate.

### Huddles Phase 2.5 — Richer Agenda (after beta validates how much structure churches want)
Current agenda is a flat list with per-item notes. Enhancements to consider:
- Sections / grouping — items grouped under headers (e.g. "Worship," "Budget," "Volunteers").
- Richer per-item detail — talking points, desired outcome, linked resources.
- Visible time-boxing — running total + visual allocation of meeting time.
- More visible per-item ownership.
- CAUTION: do NOT over-build into a full document editor. Hold complex role-gated editing permissions per section until a real church asks for it. Build the light version first.

### Huddles Phase 6 — Native Video (DO NOT BUILD)
Atlas does NOT build native video calling. Position is "the brain, not the pipes."
- `meeting_source` already supports an `atlas_video` value architecturally if ever truly needed.
- Progression is toward better INTEGRATION, NOT hosting video: Phase 3 = upload recordings from any platform → AI processes them; Phase 4 = direct Zoom/Meet/Teams API integration → auto-import recordings.
- Only revisit if ALL of: a competitor ships native church video AND gains share, multiple paying customers call it a deal-breaker, Atlas has 200+ paying churches, and a real differentiator is identified.

### Huddles Phase 1 — Notification type follow-up
- `huddle_invited` and `huddle_action_assigned` aren't in the `notifications.type` CHECK constraint. Phase 1 reuses `mention` for huddle invites and `task_assigned` for promoted action items so notifications still fire today.
- To clean up the messaging copy: extend the constraint via `ALTER TABLE notifications ... DROP CONSTRAINT ... ADD CONSTRAINT ... CHECK (type IN (... 'huddle_invited', 'huddle_action_assigned'))`, add the two strings to `src/lib/notifications-config.ts` (union + DEFAULT_NOTIFICATION_PREFERENCES + NOTIFICATION_CATEGORIES), then swap the two call sites in `src/app/actions/huddles.ts` (createHuddle, addHuddleAttendee, promoteActionItemToTask).

### AI infrastructure — Confirm `gpt-5-nano` availability
- `src/lib/ai/openai-client.ts` defaults the OpenAI fallback to `gpt-5-nano` with a runtime swap to `gpt-4o-mini` if the API returns model-not-found. First production call will log which one is in effect — verify and decide whether to hard-code the working id.

### AI infrastructure — Remove `/api/ai/test` before public launch
- Admin-gated POST endpoint that burns real credits on every call. Fine for QA, not for production. Either delete or move behind a stricter feature flag once Huddles Phase 1 is in real use.

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
- Email delivery for the remaining notification types — `task_assigned`, `event_invited`, `announcement_posted`, `board_card_assigned`, `board_member_added` (already has a sender — verify it still fires), `team_member_invited`, `team_member_joined`, `department_assigned`. Each needs a `send-*-email.ts` template and either central wiring (the createNotification dispatcher pattern landed for `task_comment` / `board_card_comment` / `board_card_mention` / `mention`) or a per-call-site sender depending on payload shape.
- Remaining Phase-2 types (`task_due_soon`, `announcement_mention`, `event_reminder`) — wired into the type union and preferences, but no action emits them yet. Add them when each feature lands.

---

## DONE

### Image upload — user avatars + org logos + Project Boards avatar migration — Completed 2026-06-16
- **User avatars**: `uploadMyAvatar(formData)` + `removeMyAvatar()` in `src/app/actions/profiles.ts`. Auth via `auth.uid()`, mime/size validation (jpeg/png/webp, 5 MB cap), sharp pipeline does EXIF rotate + 256×256 cover-crop centred + webp@88. Writes to the public `avatars` bucket at `{user_id}/avatar.webp` (storage policies already enforce per-folder write), saves the public URL + `?v=timestamp` cache-bust to `profiles.avatar_url`. Profile settings page's previously-disabled "Change photo · Soon" button is now a real picker with "Upload / Change / Remove" affordances and a Loader2 spinner. Revalidates `/settings`, `/dashboard`, `/directory` so the new image appears everywhere immediately.
- **Org logos**: new `src/app/actions/organizations.ts` with `uploadOrgLogo` + `removeOrgLogo` + `getMyOrgSummary`. Admin-gated via `can.editOrganization` re-checked server-side. Sharp uses `fit: 'contain'` with transparent background so wide wordmarks / tall lockups aren't cropped. Writes to the public `org-logos` bucket at `{organization_id}/logo.webp`, saves URL to `organizations.logo_url`. New `OrgLogoCard` UI on `/settings/organization` (admin-only controls; non-admins see read-only logo with a hint).
- **Shared `<OrgLogo>` component** at `src/components/org-logo.tsx` mirrors the `<Avatar>` API. Uses the same `bg-gradient-to-br from-[#5CE1A5] to-[#3DB882]` treatment as the sidebar user-avatar circle so the two feel like siblings. Image when `logoUrl` is present, first-letter fallback otherwise.
- **Dashboard greeting**: added a 44px `<OrgLogo>` to the left of "Good morning, {firstName}". Once an admin uploads a logo it shows immediately on the dashboard hero. Settings → Organization page header swapped its generic Users icon for the real `<OrgLogo>` too.
- **Project Boards avatar migration**: 5 components under `projects/[id]/_components/` (`kanban-card`, `comments-section`, `card-detail-panel`, `board-detail-header`, `activity-log`) migrated from inline `avatar_color` spans to the shared `<Avatar>`. Once a user uploads a profile photo it now shows on every kanban card / comment / assignee picker / member list / activity row without any further code changes. `board-view.tsx` and `card-detail-panel.tsx` each retain a single synthetic `{ avatar_color: '#5CE1A5', avatar_url: null }` literal inside an optimistic patch — that gets overwritten on next refresh and isn't a render site.
- Constraints respected: no files under `src/app/(app)/workspace/huddles/` touched; sharp pattern + Supabase storage client + Resend infra all reused; admin gates enforced server-side, not just UI.

### Notification email templates — task_comment / board_card_comment / board_card_mention / mention — Completed 2026-06-16
- Four new Resend templates under `src/lib/email/`: `send-task-comment-email.ts`, `send-board-card-comment-email.ts`, `send-board-card-mention-email.ts`, `send-mention-email.ts`. Shared layout helper at `src/lib/email/_template.ts` (gradient header, mint CTA pill, quoted-snippet card, "Adjust your notification preferences" footer link) matches the existing `send-invitation` + `send-board-member-added` look.
- All four use `notifications@atlaschurchsolutions.com` as the from address to keep them separate from the transactional `invites@` mailbox.
- Wired into `createNotification` via an `EMAIL_DISPATCH_TYPES` Set + `dispatchEmailNotification(params)` helper that runs after the in-app insert. Fire-and-forget (`void promise.catch(...)`) so Resend hiccups never undermine the in-app row that already landed. Best-effort try/catch + console log on failure.
- Preference gate: reads `notification_preferences.email_enabled` for the recipient + type, falls back to `DEFAULT_NOTIFICATION_PREFERENCES[type].email`. Users who toggle email off at `/settings/notifications` for one of these four types stop receiving the email immediately; in-app is unaffected.
- Each type-branch knows the exact title + body composition its originating call site uses (`createTaskComment` in tasks.ts, `createCardComment` for both comment + mention branches in boards.ts, `addHuddleAttendee` + `createHuddle` for huddle invites + promoted action items), extracts the entity title + snippet via `firstQuoted` / `stringMeta` helpers, then dynamically imports the matching template sender.
- Self-notify check already lives at the top of `createNotification` — the email branch can't accidentally email the actor about their own action. `createNotificationsBatch` (announcements, events, org-wide invites) intentionally bypasses the dispatcher; none of its current callers fire any of the four email-dispatch types.

### Project Boards Phase 4 — Duplicate card — Completed 2026-06-16
- New `duplicateCard(cardId)` server action in `src/app/actions/boards.ts`. Permission check via `loadBoardForViewer` matches `updateCard`. Position handling: shifts every card in the source's column with `position > source.position` by +1, then inserts the copy at `source.position + 1` so the duplicate appears immediately below the original.
- Copies: title (with " (Copy)" appended), description, cover_color, due_date, board_card_labels junction rows, and card_checklist_items (with `is_completed=false` + `completed_at=null` reset so the new card starts as a fresh checklist).
- Intentionally drops: assigned_to (don't auto-assign), is_completed (default false), comments, attachments, activity log. The duplicator becomes the new `created_by`.
- Writes a single `card_activity` entry with `action_type='created'` and `metadata.duplicated_from = sourceCardId` so the audit trail still captures the linkage. (The `action_type` CHECK doesn't include `'duplicated'`.)
- UI: `card-detail-panel.tsx` three-dot menu's previously-disabled "Duplicate · Soon" item is now a real handler that calls `duplicateCard`, emits the new card to the parent via a new `onCardDuplicated` callback, and closes the panel. `board-view.tsx` splices the returned `BoardCardWithMeta` into the source column immediately after the source for optimistic render. No "Soon" pill anywhere on Project Boards anymore.

### Profile edit page — Completed 2026-06-16
- `/settings/profile` replaces the prior "Coming Soon" placeholder card on the settings index. Editable: `full_name` (required, max 120) and `phone` (optional, lenient `+()-./` regex, max 32). Read-only: email (note: "Contact an admin to change"), role (badge with `src/lib/roles.ts` colors + icons), organization name.
- Server actions in `src/app/actions/profiles.ts`: `getMyProfile()` returns the caller's profile + org name; `updateMyProfile({ full_name, phone })` writes only those two columns, bound to `.eq("id", auth.uid())` so neither `role` / `email` / `organization_id` nor another user's row can be touched even if input is steered. revalidatePath busts settings, dashboard, and directory since the user's name appears in shell chrome.
- Avatar renders via the shared `<Avatar size={80}>` (image-or-deterministic-initials). "Change photo" button is intentionally disabled with a "Soon" pill — photo upload deferred (see PENDING).
- Settings index card flipped from a non-link Coming Soon card to a real `<Link href="/settings/profile">` with mint icon styling matching the other index cards. Shell breadcrumb map adds `/settings/profile → "My Profile"`.

### Avatar cleanup — Completed 2026-06-16
- `profiles.avatar_color` doesn't exist on the DB. Five action-file SELECTs (`boards.ts` × 4 in `joinCommentAuthors` and three other hydrate paths, `tasks.ts` × 1 in `joinTaskCommentAuthors`) were silently failing PostgREST and getting masked by hardcoded mint fallbacks downstream. Replaced with `'.select(id, full_name, email, avatar_url, role)'`.
- Hardcoded-mint fallback paths in `notifications.ts`, `profiles.ts`, and three sites in `attachments.ts` (`uploaderMap`, `resolveUploader`, `hydrateLibraryFiles`) plus two inline assignee constructions in `boards.ts` (`getBoard` + `createCard`) now populate `avatar_color: deterministicAvatarColor(profile.id)` — varied per user instead of uniform mint.
- New shared helpers at `src/lib/avatar.ts` (palette + `deterministicAvatarColor` + `initials` + `displayName`) and shared `<Avatar>` component at `src/components/avatar.tsx` (renders `avatar_url` image when present, deterministic colored initials otherwise). Imported by every non-huddles consumer that needs it.
- Type-additive across every type: existing `avatar_color: string` field stays, new `avatar_url: string | null` added alongside. Old consumers reading `.avatar_color` continue to work unchanged.
- Three consumer components migrated to the shared `<Avatar>`: `notifications-dropdown.tsx`, `library/file-list.tsx`, and `components/file-preview.tsx`. Each call passes id (for deterministic color when avatar_url is null), avatar_url, full_name, and an appropriate size + ring setting.
- Deferred to a future "photo-upload UI" pass: full migration of the 7 Project Boards components under `projects/[id]/_components/` to the shared `<Avatar>`. They render varied per-user colors automatically via the fixed actions layer today; the `<Avatar>` migration ships when image upload does. (Three of those board components received one-line additive `avatar_url: null` edits to satisfy the widened types — no rendering changes.)
- Huddles folder untouched. Huddles already had its own correct pattern (`attendee-avatar.tsx` + private `deterministicAvatarColor` in `huddles.ts`); the shared helpers in `lib/avatar.ts` mirror that pattern so a future huddles migration is straightforward.

### AI infrastructure — Monthly credit reset cron — Completed 2026-06-16
- `public.reset_monthly_ai_credits()` runs daily at 00:05 UTC via `pg_cron` (`SELECT cron.schedule('reset-monthly-ai-credits', '5 0 * * *', ...)`). Each tick zeroes `ai_credits_used` and rolls `ai_credits_reset_at` forward one calendar month for every org whose reset date has passed.
- `SECURITY DEFINER` + `SET search_path = public, pg_catalog` follow the security advisor's mutable-search-path rule. `EXECUTE` is revoked from `PUBLIC` / `anon` / `authenticated` so only the cron runner can call the reset — application code can't trigger it by accident.
- Migration documentation at `supabase/migrations/20260615_monthly_credit_reset_cron.sql` mirrors the live function + REVOKEs + schedule. Marked doc-only at the top — already applied to Supabase.

### Session 2026-06-15 — Huddles bug fixes, restructure, and security cleanup
Additional ships during the same session as Phase 1, layered on top of the entry below:
- **Bug fixes**: lifecycle optimistic UI flip (Start/End/Finalize updates the badge before the server round-trip and reverts on error), attendee profile hydration root-caused (`avatar_color` was the false trail — the real fix was `avatar_url` + deterministic color), role management (`updateAttendeeRole` + dropdown + organizer-required guard), calendar population (added `'huddle'` to default `activeFilters` Set + backfilled department metadata), `Your Huddles` rail wired correctly inside the My Tasks scroll container, in-progress pulsing indicator on detail + list cards.
- **Four-tab restructure**: Overview / Agenda / Notes / Outcomes, Overview is the default. Attendance + role management moved from Outcomes to Overview where it belongs. `huddle-settings-panel.tsx` modal added behind a header gear (visibility / department / recording-retention-days / delete with two-step confirm). Per-agenda-item notes added with a defensive `42703` fallback — `updateAgendaItemNotes` returns `SCHEMA_MISSING` and the UI flips to a disabled placeholder until the `ALTER TABLE huddle_agenda_items ADD COLUMN notes text` ships.
- **Security advisor cleanup**: fixed mutable `search_path` on 4 functions, revoked PUBLIC / anon / authenticated execute on 4 SECURITY DEFINER functions (`consume_ai_credits`, `update_org_storage_on_attachment`, `handle_new_user`, `rls_auto_enable`), enabled leaked-password protection. All advisor warnings cleared.

### Huddles Phase 1 — Meeting orchestration shell — Completed 2026-06-15
- Migration documentation: `supabase/migrations/20260615_huddles_phase_1.sql` mirrors the live schema for `huddles` (with status / visibility / meeting_source CHECK constraints), `huddle_attendees` (profile_id XOR member_id), `huddle_agenda_items`, `huddle_notes` (one row per huddle, PK = huddle_id), `huddle_decisions`, `huddle_action_items` (task_id FK), plus the empty Phase 2 placeholders (`huddle_recordings`, `huddle_transcripts`, `huddle_summaries`) and the new `tasks.source` + `tasks.source_huddle_id` columns.
- `src/app/actions/huddles.ts` (~1300 lines): full CRUD over huddles + child tables, batched count / hydration for the list view, getHuddle with parallel Promise.all over every related table, lifecycle helpers (`startHuddle`, `endHuddle`, `finalizeHuddle`) that stamp the right timestamps, `promoteActionItemToTask` that creates a real tasks row with `source='huddle'` + `source_huddle_id` and fires the existing `task_assigned` notification.
- Notification reuse: `mention` covers huddle invites, `task_assigned` covers promoted action items. Dedicated types queued under PENDING.
- UI components under `src/app/(app)/workspace/huddles/_components/`:
  - `huddle-list.tsx` — Upcoming / Past / All filter tabs, friendly empty state with CTA.
  - `huddle-card.tsx` — list-row card with status pill, schedule, meeting source badge, attendee / agenda / action-item counts. Links to the detail page.
  - `meeting-source-badge.tsx` — reusable icon + label for the seven `meeting_source` variants.
  - `create-huddle-modal.tsx` — title, datetime pickers, meeting source toggle with conditional URL / location field, department + visibility selectors, debounced `searchProfiles` attendee picker, optional inline agenda drafts. On success, routes to the new huddle's detail page.
  - `huddle-header.tsx` — inline-editable title, status pill, breadcrumb, lifecycle button ladder (Start → End → Finalize), 'Join Meeting' shortcut, manage-only delete.
  - `agenda-tab.tsx` — `@dnd-kit` drag-reorder, click-to-toggle complete, inline rename, minute / presenter rendering, total / completed summary.
  - `notes-tab.tsx` — single textarea with 5-second debounced autosave + 'Saved Xs ago · last edited by Y' indicator. Two quick-add cards below: action item and decision.
  - `outcomes-tab.tsx` — action items with `Promote to task` button (links to the resulting task on success), decisions list, attendance via `attendee-list.tsx`, friendly Phase 2 placeholder for the auto-summary.
  - `attendee-list.tsx` — `searchProfiles` invite picker, attendance checkbox, per-row remove for managers.
  - `huddle-detail.tsx` — client orchestrator that lifts state across the three tabs.
- Calendar integration (minimal pass): `CalendarEvent` gained optional `is_huddle` + `huddle_id` discriminators. `calendar/page.tsx` server query now runs `getHuddlesForCalendar()` in parallel and interleaves the scheduled rows into the events array (`event_type='huddle'`, mint-saturated emerald color). Click handler routes huddle pills to `/workspace/huddles/<id>` instead of the event detail modal. Drag-reschedule and edit-from-calendar are intentionally deferred — Phase 2 territory.

### Huddles Phase 0 — AI infrastructure — Completed 2026-06-12
- SDK install: `@anthropic-ai/sdk ^0.104.1`, `openai ^6.42.0`.
- `src/lib/ai/anthropic-client.ts` — singleton client, `callClaude()` with structured retry (3 attempts, 1s/2s/4s backoff on 408/429/5xx/network only), prompt caching on by default, user-friendly error mapping. Reports billed input + cache-read tokens separately.
- `src/lib/ai/openai-client.ts` — `transcribeAudio()` (Whisper-1 verbose_json with segment timestamps) and `callGPTNanoFallback()` (graceful chat fallback). `PRIMARY_FALLBACK_MODEL='gpt-5-nano'` with a runtime swap to `SECONDARY_FALLBACK_MODEL='gpt-4o-mini'` if the API returns model-not-found.
- `src/lib/ai/model-selector.ts` — single source of truth for "which model handles this call?". 0 credits → OpenAI fallback. Ultimate+complex → Opus 4.7. Workspace → Haiku 4.5. Otherwise → Sonnet 4.6. `MODEL_PRICING` covers all five model ids (Anthropic three + both OpenAI fallback candidates + whisper-1) for accurate `cost_usd_estimated` math.
- `src/lib/ai/credit-accounting.ts` — `getRemainingCredits()` wraps the live `get_ai_credits_remaining` RPC. `estimateCreditsForCall()` is feature- and model-family-aware. `consumeCredits()` runs the live `consume_ai_credits` RPC then writes a row to `ai_usage_log` with the full token breakdown and an estimated USD cost.
- `src/lib/ai/index.ts` — `callAI()` and `transcribeAudio()` are the public API. Every feature in Atlas (Huddles, Atlas AI chatbot, announcement gen, smart suggestions, etc.) imports from here. Feature code never touches the SDKs or the credit columns.
- Schema documentation: `supabase/migrations/20260612_huddles_phase_0_ai_infra.sql` mirrors the live `ai_usage_log` table (CHECK constraints on `feature` and `provider`, per-org/time + per-feature/time indexes, RLS that lets org members SELECT their own usage), plus pointer notes for the columns already on `organizations` and the two live PostgreSQL helpers.
- `src/lib/tier-allocations.ts` extended with `huddle_storage_limit_bytes` (workspace 10GB, suite 50GB, ultimate 200GB). The Stripe webhook + sync-stripe + onboarding success all spread `getAllocationsForTier()` into the org update, so the new column lands on every tier-change code path with a single source change.
- `POST /api/ai/test` — admin-gated end-to-end smoke test. Calls `callAI({ feature: 'other' })`, returns model / provider / wasFallback / creditsRemaining / usage. Flagged for removal before public launch.

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
