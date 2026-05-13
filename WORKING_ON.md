# Currently Working On

Used to coordinate development between Lucas (backend) and Ben (frontend) so we don't step on each other's work.

## How to use this file

Before you start a coding session:

1. Pull latest from `main`
2. Read this file to see what the other person is working on
3. Update your section with what you're starting on, ETA, and which files to avoid

---

## Lucas (last updated: 2026-05-04)

Free / between tasks. Most recent ship: **Library Phase 1 — file attachments foundation**. Polymorphic `attachments` table (25 MB cap, soft delete, trigger-tracked org storage), 8 server actions in `attachments.ts`, reusable `<FileUploader>` / `<FilePreview>` / `<AttachmentsSection>` plus image / PDF / text preview modals, integrated into tasks, announcements, calendar event detail, and project board cards. Settings → Subscription got a "File Storage" card (tonal progress bar + per-feature breakdown). Stripe webhook now writes `storage_limit_bytes` per tier (2 / 10 / 50 GB).

See `BACKEND_NOTES.md → DONE` for the running history and `BACKEND_NOTES.md → PENDING` for queued work: Library Phase 2 (chunked uploads with real progress, Storage Packs add-on), Library Phase 3 (standalone `/workspace/library` page), and Phase-2 notification follow-ups.

---

## Ben (last updated: 2026-05-XX)

[Update when starting next session]
