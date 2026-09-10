# Currently Working On

Used to coordinate development between Lucas (backend) and Ben (frontend) so we don't step on each other's work.

> **Status (2026-09-09):** Team resumed today after a planned summer pause.
> Target: founding-church launch **January 2027**. Launch scope is the
> **Workspace** module only, **staff-only** — no congregation import required.
> Serve and Care remain post-launch.
>
> Colors: Workspace `#5CE1A5`, Serve `#10B981`, Care `#EC4899`.

## How to use this file

Before you start a coding session:

1. Pull latest from `main`
2. Read this file to see what the other person is working on
3. Update your section with what you're starting on, ETA, and which files to avoid

---

## Lucas (last updated: 2026-09-10)

### Just landed (2026-09-10)
- **Organization data export** — admin can download everything the org has in the Workspace module as a single JSON file, from **Settings → Organization** (new Data Export card). Registry-driven (`src/lib/export/export-registry.ts`, mirrors the AI feature-registry pattern) so adding Serve/Care later = adding entries, not rewriting export logic. Admin-gated server-side, strictly scoped to the caller's org, declared redactions/exclusions (Stripe id, storage keys, secret tokens, Atlas internal config), and a soft completeness check that warns if a future org-scoped table isn't registered. Congregation `members` (incl. pastoral `notes`) are included. Full detail in BACKEND_NOTES → DONE. **No huddles UI touched** (data-only export).

### Landed 2026-09-09 (re-entry session)
- **Dependency refresh:** bumped 8 same-major deps to latest (react/react-dom 19.2.8, @supabase/supabase-js 2.109, stripe 22.6, openai 6.49, resend 6.26, tailwindcss 4.3.3, lucide-react 1.43) and aligned `@tailwindcss/postcss` to 4.3.3. Held back majors/near-breaking: next, typescript, eslint, @anthropic-ai/sdk, @supabase/ssr, motion, @types/node, sharp. Build verified green.
- **Calendar drag-drop persistence:** month-view event reschedule now actually saves. `handleEventDrop` was optimistic-only (local state, reverted on refresh); it now calls the existing `updateEvent` server action, preserves event duration (shifts `ends_at` by the same delta as `starts_at`), and rolls back + shows an error toast if the write fails. Holiday, huddle, and recurring events are non-draggable (recurring occurrences share the base row id, so a single-occurrence move would shift the whole series). See BACKEND_NOTES → DONE.

### Shipped 2026-06-16 (batch)
- **Image upload:** user avatars + org logos (sharp pipeline, Supabase Storage), plus migration of Project Boards components to the shared `<Avatar>`.
- **Notification email templates:** `task_comment`, `board_card_comment`, `board_card_mention`, `mention` — Resend templates wired into `createNotification` via a dispatch set, preference-gated.
- **Project Boards Phase 4 — Duplicate card:** `duplicateCard` server action + UI (was previously queued).
- **Profile edit page:** `/settings/profile` (name/phone editable) replaces the old "Coming Soon" placeholder.
- **Avatar cleanup:** fixed the non-existent `avatar_color` column selects, added `src/lib/avatar.ts` + shared `<Avatar>`, deterministic colors.
- **AI infrastructure — Monthly credit reset cron:** `reset_monthly_ai_credits()` via `pg_cron`, daily.

### Huddles Phase 1 — Meeting orchestration shell (Completed 2026-06-15)
Component files under `src/app/(app)/workspace/huddles/_components/`:
- `huddle-list.tsx` + `huddle-card.tsx` + `meeting-source-badge.tsx` — the list page
- `create-huddle-modal.tsx` — new-huddle flow
- `huddle-detail.tsx` (orchestrator), `huddle-header.tsx`, `agenda-tab.tsx`, `notes-tab.tsx`, `outcomes-tab.tsx`, `attendee-list.tsx` — detail page

Functionally everything works: create huddles with attendees + initial agenda; attendees get notified (reusing the existing `mention` notification type — dedicated `huddle_invited` queued in BACKEND_NOTES); start / end / finalize lifecycle; drag-reorder agenda; autosave notes every 5s; log decisions; track action items and promote them to real tasks in `My Tasks` with `source='huddle'` + a back-link via `source_huddle_id`; mark attendance; huddles appear on the Calendar (mint-saturated pills that route to the huddle page on click — huddles are read-only on the calendar, i.e. not drag-reschedulable).

The Phase 0 AI infrastructure isn't wired to Huddles yet — Phase 2 will add recording upload, transcription via `transcribeAudio()`, and AI summary / action extraction via `callAI()`.

### Huddles Phase 0 — AI infrastructure (Completed 2026-06-12)
- `src/lib/ai/` module: anthropic-client, openai-client, model-selector, credit-accounting, and the unified `index.ts` that exposes `callAI()` + `transcribeAudio()` to feature code. (Also now: feature-registry, org-context, ai-settings-constants from AI Control Center v1.)
- Tier-based model routing with graceful OpenAI fallback when an org runs out of credits — Workspace gets Haiku 4.5, Suite gets Sonnet 4.6, Ultimate gets Sonnet 4.6 by default and Opus 4.7 for complex tasks.
- Every call goes through atomic credit deduction + `ai_usage_log` audit insert. Token-level usage feeds the per-row USD cost estimate.
- `tier-allocations.ts` extended with `huddle_storage_limit_bytes` so the existing Stripe webhook plumbing keeps the new column current on every tier change.
- Smoke-test endpoint at `/api/ai/test` (admin-gated, flagged for removal before public launch).
- Follow-ups: confirming `gpt-5-nano` vs `gpt-4o-mini` as the live OpenAI fallback after the first production call logs which the SDK accepts. (Monthly credit reset cron — now shipped, see 06-16 above.)

### Library Phase 3 — Standalone /workspace/library page (Completed 2026-05-13)
- New schema in Supabase: `library_folders` (hierarchical with org / department / private visibility), `library_tags` (org-scoped), `attachment_tags` junction. Existing `attachments` table gained `folder_id`, `is_pinned`, `view_count`, `download_count`, `last_accessed_at`; `entity_id` is now nullable so direct-library uploads can sit at `entity_type='library' + entity_id IS NULL` without a sentinel.
- 19 new server actions covering folder CRUD, tag CRUD, universal file fetcher with virtual-folder / filter / tag-intersection / search routing, copy / pin / rename / describe / detail / direct-library upload / view + download tracking.
- The "files live in multiple places" model: `moveAttachmentToFolder` only writes `folder_id`, never changes `entity_type` / `entity_id`. A file attached to a task and moved into a custom folder appears in both "From Tasks" and the custom folder.
- Replaced the prior "Coming Soon" placeholder with the full UI. (Note: Ben later reworked the topbar/navigation — see his section.)

### Project Boards Phase 3 — Card detail panel, checklist, comments, labels, activity (Completed 2026-05-13)
- `card_activity` table with diff-driven retrofit into `createCard` / `updateCard` / `moveCard` (best-effort; never rolls back the primary write).
- 14 new server actions covering checklist CRUD with drag-reorder, comments with `@[Name](uuid)` mention tokens + de-duped notification fan-out, label CRUD with usage counts, and a fresh `getCard` with parallel joins.
- New 720px slide-in `<CardDetailPanel>` replacing the old `EditCardModal`.
- Task comments retrofit closes the `task_comment` notification gap.

### Queued / next
See `BACKEND_NOTES.md → PENDING` for the full list. Highlights still open: Library Phase 2 (chunked uploads with real progress, Storage Packs add-on), remaining notification email-template hookups, Huddles Phase 2 (AI layer), the National Holidays feed, and the multi-day-event month-view render bug (display-only). Library Phase 3 and Project Boards Phase 4 have **shipped** — no longer queued.

---

## Ben (last updated: 2026-05-20)

_(Drag-drop status note updated 2026-09-09 by Lucas to reflect the backend persistence that landed today.)_

**1. Premium Drag-and-Drop (Month View)**

Users can click and drag event pills across the month grid to reschedule them.

The pill snaps to the new day instantly (optimistic UI). **As of 2026-09-09 this now persists to Supabase** via the `updateEvent` server action — event duration is preserved and the move rolls back with an error toast if the server write fails. Recurring, huddle, and holiday events are intentionally **not** draggable.

**2. Fluid Animations & Micro-interactions**

Added Framer Motion tap and hover states (the pills pop up slightly when you hover or click them). Added layout animations, so when you filter out an event, the remaining events gracefully slide into the empty space instead of instantly snapping.

**3. Live Sidebar Filtering & Mobile Support**

Wired up the right-side "Calendar Sources" and "Departments" checkboxes so they instantly filter the calendar view. Added a responsive mobile design: on smaller screens, the sidebar hides and a "Filter" icon appears; tapping it slides up a bottom sheet containing the filters.

**4. Smart Conflict Detection**

If a user is double-booked, the overlapping events get a diagonal-striped background and a red alert icon. A red notification pill appears at the top of the screen next to "Create Event" to warn how many overlapping events are scheduled.

**5. Dynamic Navigation**

The `<` / `>` arrows are context-aware: Week view steps 7 days, Day view steps 1 day. The date label between the arrows formats to match the current view (e.g., "May 10 - 16, 2026").

**6. Edge-to-Edge Canvas Layout (Library)**

Removed the hardcoded max-widths (1400px) and grey gutters around the main content so the Library bleeds edge-to-edge, inheriting the global app background.

Dropped the vertical library sidebar from the Library UI in favor of the topbar navigation below. **Note:** the `library-sidebar.tsx` file still exists in the repo and is now orphaned (not imported anywhere) — **pending deletion**, not yet removed (see BACKEND_NOTES).

**7. Modernized Topbar & Navigation (Library)**

Replaced the sidebar tree with a horizontal row of navigation chips (All Files, Favorites, Recent) and a "Folders" dropdown. Standardized primary actions (Upload File, New Folder) into pill-shaped floating buttons. Moved the storage capacity meter into a compact pill in the top-right corner.

**8. Premium Interactions & Quality of Life (Library)**

Full-screen drag & drop: dragging a file from the OS over the browser shows a frosted-glass overlay with a dashed drop-zone for instant uploads. Click-to-sort table headers: clicking a column header in List View toggles asc/desc with active arrow indicators (replaces the old Sort dropdown). _Backend note: the type/uploader/tags sort values are not yet handled server-side — see BACKEND_NOTES._
