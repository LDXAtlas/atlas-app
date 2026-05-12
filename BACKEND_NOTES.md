# Backend Notes — Pending Backend Work for Frontend Features

Ben adds entries here when he ships UI that needs a backend hook. Lucas moves them to the **Done** section when completed.

---

## PENDING

### Board Star Persistence
- UI: `BoardCard.onToggleStar` callback + `boards-list.tsx#handleToggleStar` currently flip `board.is_starred` in local state only.
- Needed: `board_stars` junction table (`user_id`, `board_id`, `starred_at`), `toggleBoardStar(boardId)` server action, and `getBoards()` join so the flag persists across reloads.

### Add Member Modal Backend
- UI: `board-detail-header.tsx` opens an inline modal via `addMemberOpen` state. No search results / no insert yet.
- Needed: `searchProfiles(query, excludeBoardId)` returning org profiles minus existing board members; `addBoardMember(boardId, profileId, role)` inserting into `board_members` plus email + in-app notification.

### Board Overview Description Save
- UI: `BoardOverview` component (inline in `board-view.tsx`) has a description editor that currently only updates local state.
- Needed: wire its `handleSave` to call `updateBoard(boardId, { description })` with optimistic UI + toast.

---

## DONE

(empty — entries move here once shipped)
