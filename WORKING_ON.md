# Currently Working On

Used to coordinate development between Lucas (backend) and Ben (frontend) so we don't step on each other's work.

## How to use this file

Before you start a coding session:

1. Pull latest from `main`
2. Read this file to see what the other person is working on
3. Update your section with what you're starting on, ETA, and which files to avoid

---

## Lucas (last updated: 2026-05-12)

Wiring up backend for Ben's three pending UI tasks:

- Board star persistence (`board_stars` table + `toggleBoardStar`)
- Add Member modal backend (`searchProfiles` + `addBoardMember`)
- Board Overview description save (`updateBoard` wiring)

Files to avoid touching while this is in flight:

- `src/app/actions/boards.ts`
- `src/app/actions/profiles.ts` (new)
- `src/app/(app)/workspace/projects/[id]/_components/board-view.tsx` (Overview section only)
- `src/app/(app)/workspace/projects/[id]/_components/board-detail-header.tsx` (Add Member modal only)
- `src/app/(app)/workspace/projects/_components/boards-list.tsx` (star toggle only)
- `supabase/migrations/` (will add `board_stars`)

---

## Ben (last updated: 2026-05-XX)

[Update when starting next session]
