# Currently Working On

Used to coordinate development between Lucas (backend) and Ben (frontend) so we don't step on each other's work.

## How to use this file

Before you start a coding session:

1. Pull latest from `main`
2. Read this file to see what the other person is working on
3. Update your section with what you're starting on, ETA, and which files to avoid

---

## Lucas (last updated: 2026-05-13)

Free / between tasks. Most recent ship: **Library Phase 3 — standalone /workspace/library page**.

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

## Ben (last updated: 2026-05-XX)

[Update when starting next session]
