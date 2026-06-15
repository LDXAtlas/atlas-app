# Currently Working On

Used to coordinate development between Lucas (backend) and Ben (frontend) so we don't step on each other's work.

## How to use this file

Before you start a coding session:

1. Pull latest from `main`
2. Read this file to see what the other person is working on
3. Update your section with what you're starting on, ETA, and which files to avoid

---

## Lucas (last updated: 2026-06-15)

Just completed Huddles Phase 1 — the meeting orchestration shell. Page is functional and ready for Ben's design polish pass.

Component files Ben will be working with (all under `src/app/(app)/workspace/huddles/_components/`):
- `huddle-list.tsx` + `huddle-card.tsx` + `meeting-source-badge.tsx` — the list page
- `create-huddle-modal.tsx` — new-huddle flow
- `huddle-detail.tsx` (orchestrator), `huddle-header.tsx`, `agenda-tab.tsx`, `notes-tab.tsx`, `outcomes-tab.tsx`, `attendee-list.tsx` — detail page

Functionally everything works: create huddles with attendees + initial agenda; attendees get notified (reusing the existing `mention` notification type — dedicated `huddle_invited` queued in BACKEND_NOTES); start / end / finalize lifecycle; drag-reorder agenda; autosave notes every 5s; log decisions; track action items and promote them to real tasks in `My Tasks` with `source='huddle'` + a back-link via `source_huddle_id`; mark attendance; huddles appear on the Calendar (mint-saturated pills that route to the huddle page on click — drag-reschedule is read-only on the calendar for Phase 1).

The Phase 0 AI infrastructure isn't wired yet — Phase 2 will add recording upload, transcription via `transcribeAudio()`, and AI summary / action extraction via `callAI()`.

Phase 0 highlights (previous ship):
- `src/lib/ai/` module with five files: anthropic-client, openai-client, model-selector, credit-accounting, and the unified `index.ts` that exposes `callAI()` + `transcribeAudio()` to feature code.

Phase 0 highlights:
- `src/lib/ai/` module with five files: anthropic-client, openai-client, model-selector, credit-accounting, and the unified `index.ts` that exposes `callAI()` + `transcribeAudio()` to feature code.
- Tier-based model routing with graceful OpenAI fallback when an org runs out of credits — Workspace gets Haiku 4.5, Suite gets Sonnet 4.6, Ultimate gets Sonnet 4.6 by default and Opus 4.7 for complex tasks.
- Every call goes through atomic credit deduction + `ai_usage_log` audit insert. Token-level usage feeds the per-row USD cost estimate.
- `tier-allocations.ts` extended with `huddle_storage_limit_bytes` so the existing Stripe webhook plumbing keeps the new column current on every tier change.
- Smoke-test endpoint at `/api/ai/test` (admin-gated, flagged for removal before public launch).
- Two follow-ups queued: monthly credit reset cron, and confirming `gpt-5-nano` vs `gpt-4o-mini` as the live OpenAI fallback after the first production call logs which one the SDK accepts.

Phase 0 ship before this: Library Phase 3 (standalone `/workspace/library` page) and Project Boards Phase 3.

Library Phase 3 highlights:
- New schema in Supabase: `library_folders` (hierarchical with org / department / private visibility), `library_tags` (org-scoped), `attachment_tags` junction. Existing `attachments` table gained `folder_id`, `is_pinned`, `view_count`, `download_count`, `last_accessed_at`; `entity_id` is now nullable so direct-library uploads can sit at `entity_type='library' + entity_id IS NULL` without a sentinel.
- 19 new server actions covering folder CRUD, tag CRUD, universal file fetcher with virtual-folder / filter / tag-intersection / search routing, copy / pin / rename / describe / detail / direct-library upload / view + download tracking.
- The "files live in multiple places" model: `moveAttachmentToFolder` only writes `folder_id`, never changes `entity_type` / `entity_id`. A file attached to a task and moved into a custom folder appears in both "From Tasks" and the custom folder.
- 11 new UI components: sidebar (filters + folder tree + tags), topbar (breadcrumb + search + filters + sort + view toggle + upload), grid / list views, detail panel with inline rename + previews + parent-link, create-folder / folder-picker modals, bulk-actions toolbar, empty states, storage banner, plus the orchestrator that ties it all together. Replaces the prior "Coming Soon" placeholder.

Previous ship before this: Project Boards Phase 3 (card detail panel + checklist + comments + labels + activity) and task comments retrofit.

Phase 3 highlights:
- `card_activity` table with diff-driven retrofit into `createCard` / `updateCard` / `moveCard` (best-effort; never rolls back the primary write).
- 14 new server actions covering checklist CRUD with drag-reorder, comments with `@[Name](uuid)` mention tokens + de-duped notification fan-out, label CRUD with usage counts, and a fresh `getCard` with parallel joins.
- New 720px slide-in `<CardDetailPanel>` replacing the old `EditCardModal`: inline title/description editing, drag-reorder checklist with progress bar, AttachmentsSection (from Library Phase 1) for files, collapsible activity log, comments with @mention autocomplete + edit/delete, sidebar with status / assignee picker / due date / labels / cover color / created by.
- Task comments retrofit closes the `task_comment` notification gap. Reuses the same `<CommentsSection>` from Project Boards inside `task-modal.tsx`.

See `BACKEND_NOTES.md → DONE` for the running history and `BACKEND_NOTES.md → PENDING` for queued work: Library Phase 2 (chunked uploads with real progress, Storage Packs add-on), Library Phase 3 (standalone `/workspace/library` page), Project Boards Phase 4 (duplicate card), and the remaining email-template hookups.

---

## Ben (last updated: 2026-05-20)


1. Premium Drag-and-Drop (Month View)

Users can now click and drag event pills across the month grid to reschedule them.

We added "Optimistic UI" updates, meaning the pill snaps to the new day instantly without waiting for the server, making the app feel lightning fast.

2. Fluid Animations & Micro-interactions

Added Framer Motion tap and hover states (the pills pop up slightly when you hover or click them).

Added layout animations, so when you filter out an event, the remaining events gracefully slide into the empty space instead of instantly snapping.

3. Live Sidebar Filtering & Mobile Support

Wired up the right-side "Calendar Sources" and "Departments" checkboxes so they instantly filter the calendar view.

Added a responsive mobile design: on smaller screens, the sidebar hides, and a sleek "Filter" icon appears at the top. Tapping it slides up an Apple-style bottom sheet containing the filters.

4. Smart Conflict Detection

The calendar now acts as an intelligent assistant. If a user is double-booked, the overlapping events get a premium diagonal-striped background and a red alert icon.

A red notification pill automatically appears at the top of the screen next to "Create Event" to warn the user exactly how many overlapping events they currently have scheduled.

5. Dynamic Navigation

Upgraded the < / > arrows at the top to be context-aware. If you are in the Week view, they step forward exactly 7 days. If you are in Day view, they step 1 day.

The date label between the arrows dynamically updates to format exactly what you are looking at (e.g., "May 10 - 16, 2026").

. Edge-to-Edge Canvas Layout

Removed the Boxed Constraints: We removed the hardcoded max-widths (1400px) and grey gutters surrounding the main content. The Library now bleeds edge-to-edge seamlessly, inheriting the global app background for a more native, immersive feel.

Deleted the Sidebar: We completely removed the vertical library-sidebar.tsx. This opened up a massive amount of horizontal breathing room for the actual files.

. Modernized Topbar & Navigation

Horizontal Navigation: We replaced the sidebar tree with a sleek, horizontal row of navigation chips (All Files, Favorites, Recent) and a clean "Folders" dropdown menu.

Floating Action Buttons: We standardized the primary actions (Upload File, New Folder) into modern, pill-shaped buttons that float on the canvas rather than sitting inside a rigid white header box.

Integrated Storage Meter: Moved the storage capacity progress bar into a compact, pill-shaped indicator in the top right corner, perfectly balancing the header.

. Premium Interactions & Quality of Life

Full-Screen Drag & Drop: Added a global drag-and-drop listener to the Library view. Whenever a user drags a file from their computer over the browser, a frosted glass overlay with a dashed drop-zone appears, allowing for instant, frictionless uploads.

Click-to-Sort Table Headers: Removed the clunky "Sort" dropdown menu from the UI. Instead, users can now simply click the column headers in the List View (Name, Type, Size, Uploaded By, etc.) to toggle between ascending and descending order, complete with active arrow indicators.


