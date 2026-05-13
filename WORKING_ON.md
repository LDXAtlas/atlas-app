# Currently Working On

Used to coordinate development between Lucas (backend) and Ben (frontend) so we don't step on each other's work.

## How to use this file

Before you start a coding session:

1. Pull latest from `main`
2. Read this file to see what the other person is working on
3. Update your section with what you're starting on, ETA, and which files to avoid

---

## Lucas (last updated: 2026-05-13)

Free / between tasks. Most recent ship: **Project Boards Phase 3 — card detail panel, checklist, comments, labels, activity** + **task comments retrofit**.

Phase 3 highlights:
- `card_activity` table with diff-driven retrofit into `createCard` / `updateCard` / `moveCard` (best-effort; never rolls back the primary write).
- 14 new server actions covering checklist CRUD with drag-reorder, comments with `@[Name](uuid)` mention tokens + de-duped notification fan-out, label CRUD with usage counts, and a fresh `getCard` with parallel joins.
- New 720px slide-in `<CardDetailPanel>` replacing the old `EditCardModal`: inline title/description editing, drag-reorder checklist with progress bar, AttachmentsSection (from Library Phase 1) for files, collapsible activity log, comments with @mention autocomplete + edit/delete, sidebar with status / assignee picker / due date / labels / cover color / created by.
- Task comments retrofit closes the `task_comment` notification gap. Reuses the same `<CommentsSection>` from Project Boards inside `task-modal.tsx`.

See `BACKEND_NOTES.md → DONE` for the running history and `BACKEND_NOTES.md → PENDING` for queued work: Library Phase 2 (chunked uploads with real progress, Storage Packs add-on), Library Phase 3 (standalone `/workspace/library` page), Project Boards Phase 4 (duplicate card), and the remaining email-template hookups.

---

## Ben (last updated: 2026-05-XX)

[Update when starting next session]
