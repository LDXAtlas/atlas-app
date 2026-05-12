# Backend Notes — Pending Backend Work for Frontend Features

Ben adds entries here when he ships UI that needs a backend hook. Lucas moves them to the **Done** section when completed.

---

## PENDING

(empty — all caught up as of 2026-05-12)

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
- In-app notification: TODO — no `notifications` table exists yet (sidebar popover is placeholder data). Email is the real notification surface.
- Wired the modal in `board-detail-header.tsx`: 300ms-debounced search, click-to-add with per-row spinner, optimistic "Just added" panel, inline error banner, and `router.refresh()` on modal close to repopulate the header avatar stack.
