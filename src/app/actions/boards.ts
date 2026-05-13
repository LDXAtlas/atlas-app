"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { can, getRoleFromProfile } from "@/lib/permissions";
import type { Role } from "@/lib/permissions";

// ─── Types ──────────────────────────────────────────────────
export type BoardVisibility =
  | "organization"
  | "department"
  | "private"
  | "invitees_only";

export type BoardMemberRole = "owner" | "editor" | "member" | "viewer";

export type BoardSummary = {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  color: string;
  icon: string;
  visibility: BoardVisibility;
  is_archived: boolean;
  department_id: string | null;
  department_name: string | null;
  department_color: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  card_count: number;
  completed_count: number;
  member_count: number;
  member_avatars: BoardMemberAvatar[];
  is_starred: boolean;
  viewer_can_edit: boolean;
  viewer_can_delete: boolean;
};

export type BoardMemberAvatar = {
  id: string;
  full_name: string;
  avatar_url: string | null;
};

export type BoardTemplateId =
  | "blank"
  | "basic"
  | "sermon_series"
  | "event_planning"
  | "capital_campaign";

export type CreateBoardInput = {
  name: string;
  description?: string | null;
  color?: string;
  icon?: string;
  department_id?: string | null;
  visibility?: BoardVisibility;
  template?: BoardTemplateId;
};

export type ActionResult<T = unknown> =
  | { success: true; data?: T }
  | { success: false; error: string };

// ─── Detail (single-board view) types ───────────────────────
export type CardLabel = {
  id: string;
  board_id: string;
  name: string;
  color: string;
};

export type BoardMemberInfo = {
  profile_id: string;
  full_name: string;
  avatar_url: string | null;
  role: BoardMemberRole;
};

export type CardAssignee = {
  id: string;
  full_name: string;
  /** Background color for the initials avatar. Mint fallback. */
  avatar_color: string;
};

export type BoardCardWithMeta = {
  id: string;
  board_id: string;
  column_id: string;
  title: string;
  description: string | null;
  cover_color: string | null;
  due_date: string | null;
  assigned_to: string | null;
  position: number;
  is_completed: boolean;
  assignee: CardAssignee | null;
  label_count: number;
  comment_count: number;
  checklist_completed: number;
  checklist_total: number;
};

export type BoardColumnWithCards = {
  id: string;
  board_id: string;
  name: string;
  color: string;
  position: number;
  cards: BoardCardWithMeta[];
};

export type BoardDetail = {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  color: string;
  icon: string;
  visibility: BoardVisibility;
  is_archived: boolean;
  department_id: string | null;
  department_name: string | null;
  department_color: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  columns: BoardColumnWithCards[];
  members: BoardMemberInfo[];
  labels: CardLabel[];
  viewer_can_edit: boolean;
  viewer_can_delete: boolean;
};

// ─── Templates ──────────────────────────────────────────────
//
// Column colors lean on tokens already used elsewhere in the app:
//   neutral / planning blue / accent purple / live orange / mint complete.
const BOARD_TEMPLATES: Record<
  BoardTemplateId,
  { name: string; color: string }[]
> = {
  blank: [],
  basic: [
    { name: "To Do", color: "#9CA3AF" },
    { name: "In Progress", color: "#3B82F6" },
    { name: "Done", color: "#5CE1A5" },
  ],
  sermon_series: [
    { name: "Idea", color: "#8B5CF6" },
    { name: "Outlined", color: "#3B82F6" },
    { name: "Drafted", color: "#F59E0B" },
    { name: "Reviewed", color: "#FBBF24" },
    { name: "Final", color: "#5CE1A5" },
  ],
  event_planning: [
    { name: "Backlog", color: "#9CA3AF" },
    { name: "Planning", color: "#3B82F6" },
    { name: "Promotion", color: "#8B5CF6" },
    { name: "Live", color: "#F97316" },
    { name: "Wrap-up", color: "#5CE1A5" },
  ],
  capital_campaign: [
    { name: "Research", color: "#9CA3AF" },
    { name: "Proposal", color: "#3B82F6" },
    { name: "Active", color: "#F97316" },
    { name: "Complete", color: "#5CE1A5" },
  ],
};

// (Display labels for the templates live in the create-board modal so this
//  "use server" file only exports async functions, per Next.js's RSC rule.)

// ─── Auth helper ────────────────────────────────────────────
async function getAuthContext(): Promise<{
  userId: string;
  organizationId: string;
  role: Role;
} | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const slug = user.user_metadata?.organization_slug;
  if (!slug) return null;

  const { data: org } = await supabaseAdmin
    .from("organizations")
    .select("id")
    .eq("slug", slug)
    .single();
  if (!org?.id) return null;

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  return {
    userId: user.id,
    organizationId: org.id,
    role: getRoleFromProfile(profile),
  };
}

// Visibility check applied in JS since we use the admin client (which
// bypasses RLS). Logic mirrors the SELECT policy in the migration.
function isVisibleTo(
  board: { visibility: string; created_by: string; department_id: string | null },
  viewerId: string,
  isMember: boolean,
  viewerDepartmentIds: Set<string>,
): boolean {
  if (board.created_by === viewerId) return true;
  if (isMember) return true;
  if (board.visibility === "organization") return true;
  if (
    board.visibility === "department" &&
    board.department_id &&
    viewerDepartmentIds.has(board.department_id)
  )
    return true;
  return false;
}

// ─── getBoards ──────────────────────────────────────────────
export async function getBoards(filters?: {
  includeArchived?: boolean;
  search?: string;
  departmentId?: string | null;
  myBoardsOnly?: boolean;
}): Promise<{ data: BoardSummary[]; error?: string }> {
  const ctx = await getAuthContext();
  if (!ctx) return { data: [], error: "Not authenticated" };
  const { userId, organizationId, role } = ctx;

  // Boards in the user's org. RLS would also enforce visibility but we
  // re-apply here for the admin-client read path.
  const { data: rawBoards, error } = await supabaseAdmin
    .from("boards")
    .select(
      "id, organization_id, name, description, color, icon, visibility, is_archived, department_id, created_by, created_at, updated_at",
    )
    .eq("organization_id", organizationId)
    .order("updated_at", { ascending: false });

  if (error) {
    console.error("[getBoards] Select error:", error.message);
    return { data: [], error: error.message };
  }

  let boards = rawBoards ?? [];
  if (boards.length === 0) return { data: [] };

  // Viewer's department assignments — needed for department-visibility boards.
  const { data: myAssignments } = await supabaseAdmin
    .from("profile_departments")
    .select("department_id")
    .eq("profile_id", userId);
  const viewerDepartmentIds = new Set<string>(
    (myAssignments ?? []).map((a: { department_id: string }) => a.department_id),
  );

  const boardIds = boards.map((b: { id: string }) => b.id);

  // Board members — used for visibility, "is_starred", member count, and
  // avatar list. Single fetch, then group.
  const { data: memberRows } = await supabaseAdmin
    .from("board_members")
    .select("board_id, profile_id, role")
    .in("board_id", boardIds);
  const membersByBoard = new Map<
    string,
    { profile_id: string; role: BoardMemberRole }[]
  >();
  (memberRows ?? []).forEach(
    (m: { board_id: string; profile_id: string; role: BoardMemberRole }) => {
      const arr = membersByBoard.get(m.board_id) ?? [];
      arr.push({ profile_id: m.profile_id, role: m.role });
      membersByBoard.set(m.board_id, arr);
    },
  );
  const myMemberBoardIds = new Set<string>(
    (memberRows ?? [])
      .filter((m: { profile_id: string }) => m.profile_id === userId)
      .map((m: { board_id: string }) => m.board_id),
  );

  // Apply visibility filter.
  boards = boards.filter((b) =>
    isVisibleTo(
      b as { visibility: string; created_by: string; department_id: string | null },
      userId,
      myMemberBoardIds.has(b.id),
      viewerDepartmentIds,
    ),
  );

  // Archive filter
  if (!filters?.includeArchived) {
    boards = boards.filter((b) => !b.is_archived);
  }
  // "My Boards" = creator OR member
  if (filters?.myBoardsOnly) {
    boards = boards.filter(
      (b) => b.created_by === userId || myMemberBoardIds.has(b.id),
    );
  }
  // Department filter
  if (filters?.departmentId) {
    boards = boards.filter((b) => b.department_id === filters.departmentId);
  }
  // Search
  if (filters?.search?.trim()) {
    const q = filters.search.trim().toLowerCase();
    boards = boards.filter(
      (b) =>
        b.name.toLowerCase().includes(q) ||
        (b.description?.toLowerCase().includes(q) ?? false),
    );
  }

  if (boards.length === 0) return { data: [] };
  const filteredIds = boards.map((b) => b.id);

  // Stars for the current viewer. Reading the join up front means is_starred
  // reflects what the user has actually starred (persisted across sessions),
  // not the creator/member proxy we used before the board_stars table existed.
  const { data: starRows } = await supabaseAdmin
    .from("board_stars")
    .select("board_id")
    .eq("user_id", userId)
    .in("board_id", filteredIds);
  const myStarredBoardIds = new Set<string>(
    (starRows ?? []).map((r: { board_id: string }) => r.board_id),
  );

  // Card counts (total + completed) per board.
  const { data: cardRows } = await supabaseAdmin
    .from("board_cards")
    .select("board_id, is_completed")
    .in("board_id", filteredIds);
  const cardCounts = new Map<string, { total: number; completed: number }>();
  (cardRows ?? []).forEach(
    (c: { board_id: string; is_completed: boolean | null }) => {
      const cur = cardCounts.get(c.board_id) ?? { total: 0, completed: 0 };
      cur.total += 1;
      if (c.is_completed) cur.completed += 1;
      cardCounts.set(c.board_id, cur);
    },
  );

  // Departments for badge labels (only the ones referenced).
  const referencedDeptIds = Array.from(
    new Set(boards.map((b) => b.department_id).filter((x): x is string => !!x)),
  );
  const deptMap = new Map<string, { name: string; color: string }>();
  if (referencedDeptIds.length > 0) {
    const { data: deptRows } = await supabaseAdmin
      .from("departments")
      .select("id, name, color")
      .in("id", referencedDeptIds);
    (deptRows ?? []).forEach(
      (d: { id: string; name: string; color: string | null }) => {
        deptMap.set(d.id, { name: d.name, color: d.color || "#6B7280" });
      },
    );
  }

  // Profiles for member avatars + creator info — single batched fetch.
  const profileIds = new Set<string>();
  boards.forEach((b) => profileIds.add(b.created_by));
  (memberRows ?? []).forEach((m: { profile_id: string }) =>
    profileIds.add(m.profile_id),
  );
  const profileMap = new Map<
    string,
    { full_name: string; avatar_url: string | null }
  >();
  if (profileIds.size > 0) {
    const { data: profRows } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, avatar_url, email")
      .in("id", Array.from(profileIds));
    (profRows ?? []).forEach(
      (p: {
        id: string;
        full_name: string | null;
        avatar_url: string | null;
        email: string | null;
      }) => {
        profileMap.set(p.id, {
          full_name: p.full_name || p.email?.split("@")[0] || "Unnamed",
          avatar_url: p.avatar_url,
        });
      },
    );
  }

  const isAdmin = role === "admin";

  const summaries: BoardSummary[] = boards.map((b) => {
    const members = membersByBoard.get(b.id) ?? [];
    const counts = cardCounts.get(b.id) ?? { total: 0, completed: 0 };
    const dept = b.department_id ? deptMap.get(b.department_id) : null;
    const isMember = myMemberBoardIds.has(b.id);
    const isCreator = b.created_by === userId;

    // Top 4 avatars: prefer the creator first if present, then the rest.
    const candidateIds = Array.from(
      new Set([b.created_by, ...members.map((m) => m.profile_id)]),
    );
    const memberAvatars: BoardMemberAvatar[] = candidateIds
      .slice(0, 4)
      .map((id) => {
        const p = profileMap.get(id);
        return {
          id,
          full_name: p?.full_name ?? "Unnamed",
          avatar_url: p?.avatar_url ?? null,
        };
      });

    const memberRole = members.find((m) => m.profile_id === userId)?.role;
    const canEdit =
      isCreator ||
      isAdmin ||
      memberRole === "owner" ||
      memberRole === "editor";
    const canDelete = isCreator || isAdmin;

    return {
      id: b.id,
      organization_id: b.organization_id,
      name: b.name,
      description: b.description,
      color: b.color || "#5CE1A5",
      icon: b.icon || "Folder",
      visibility: b.visibility as BoardVisibility,
      is_archived: !!b.is_archived,
      department_id: b.department_id,
      department_name: dept?.name ?? null,
      department_color: dept?.color ?? null,
      created_by: b.created_by,
      created_at: b.created_at,
      updated_at: b.updated_at,
      card_count: counts.total,
      completed_count: counts.completed,
      member_count: members.length + (members.some((m) => m.profile_id === b.created_by) ? 0 : 1),
      member_avatars: memberAvatars,
      is_starred: myStarredBoardIds.has(b.id),
      viewer_can_edit: canEdit,
      viewer_can_delete: canDelete,
    };
  });

  return { data: summaries };
}

// ─── Board access helper (server-only) ──────────────────────
//
// Centralizes the visibility + edit checks every column/card mutation
// needs. Returns the board row when access is granted plus the viewer's
// effective capability flags.
type BoardAccessRow = {
  id: string;
  organization_id: string;
  created_by: string;
  visibility: BoardVisibility;
  department_id: string | null;
};

async function loadBoardForViewer(
  ctx: { userId: string; organizationId: string; role: Role },
  boardId: string,
): Promise<
  | { ok: true; board: BoardAccessRow; canEdit: boolean; canDelete: boolean }
  | { ok: false; error: string }
> {
  const { data: board } = await supabaseAdmin
    .from("boards")
    .select("id, organization_id, created_by, visibility, department_id")
    .eq("id", boardId)
    .maybeSingle();
  if (!board || board.organization_id !== ctx.organizationId) {
    return { ok: false, error: "Board not found." };
  }

  const { data: memberRow } = await supabaseAdmin
    .from("board_members")
    .select("role")
    .eq("board_id", boardId)
    .eq("profile_id", ctx.userId)
    .maybeSingle();
  const memberRole = memberRow?.role as BoardMemberRole | undefined;
  const isMember = !!memberRole;

  // Viewer's department assignments — relevant when visibility = department.
  let isInDept = false;
  if (board.visibility === "department" && board.department_id) {
    const { data: deptRow } = await supabaseAdmin
      .from("profile_departments")
      .select("department_id")
      .eq("profile_id", ctx.userId)
      .eq("department_id", board.department_id)
      .maybeSingle();
    isInDept = !!deptRow;
  }

  const isCreator = board.created_by === ctx.userId;
  const isAdmin = ctx.role === "admin";

  // Visibility check — same logic as the SELECT RLS policy.
  const canSee =
    isCreator ||
    isMember ||
    board.visibility === "organization" ||
    (board.visibility === "department" && isInDept);
  if (!canSee) return { ok: false, error: "Board not found." };

  const canEdit =
    isCreator ||
    isAdmin ||
    memberRole === "owner" ||
    memberRole === "editor";
  const canDelete = isCreator || isAdmin;

  return { ok: true, board, canEdit, canDelete };
}

// Convenience used by mutation actions that require edit privilege.
async function requireEditAccess(
  boardId: string,
): Promise<
  | { ok: true; ctx: { userId: string; organizationId: string; role: Role }; board: BoardAccessRow }
  | { ok: false; error: string }
> {
  const ctx = await getAuthContext();
  if (!ctx) return { ok: false, error: "Not authenticated." };
  const access = await loadBoardForViewer(ctx, boardId);
  if (!access.ok) return access;
  if (!access.canEdit)
    return { ok: false, error: "You can't edit this board." };
  return { ok: true, ctx, board: access.board };
}

// ─── getBoard (full detail) ─────────────────────────────────
export async function getBoard(
  id: string,
): Promise<{ data: BoardDetail | null; error?: string }> {
  const ctx = await getAuthContext();
  if (!ctx) return { data: null, error: "Not authenticated." };

  const access = await loadBoardForViewer(ctx, id);
  if (!access.ok) return { data: null, error: access.error };

  // Fetch the full board row.
  const { data: boardRow, error: boardErr } = await supabaseAdmin
    .from("boards")
    .select(
      "id, organization_id, name, description, color, icon, visibility, is_archived, department_id, created_by, created_at, updated_at",
    )
    .eq("id", id)
    .single();
  if (boardErr || !boardRow) {
    console.error("[getBoard] Board fetch error:", boardErr?.message);
    return { data: null, error: boardErr?.message || "Board not found." };
  }

  // Department badge.
  let department: { id: string; name: string; color: string } | null = null;
  if (boardRow.department_id) {
    const { data: dept } = await supabaseAdmin
      .from("departments")
      .select("id, name, color")
      .eq("id", boardRow.department_id)
      .maybeSingle();
    if (dept) {
      department = {
        id: dept.id,
        name: dept.name,
        color: dept.color || "#6B7280",
      };
    }
  }

  // Columns ordered by position.
  const { data: columnRows } = await supabaseAdmin
    .from("board_columns")
    .select("id, board_id, name, color, position, created_at")
    .eq("board_id", id)
    .order("position", { ascending: true });
  const columns = columnRows ?? [];

  // Cards ordered by position within each column.
  const { data: cardRows } = await supabaseAdmin
    .from("board_cards")
    .select(
      "id, board_id, column_id, title, description, cover_color, due_date, assigned_to, position, is_completed",
    )
    .eq("board_id", id)
    .order("position", { ascending: true });
  const cards = cardRows ?? [];
  const cardIds = cards.map((c: { id: string }) => c.id);

  // Aggregations: label counts, comment counts, checklist totals.
  const labelCountByCard = new Map<string, number>();
  const commentCountByCard = new Map<string, number>();
  const checklistByCard = new Map<string, { total: number; completed: number }>();

  if (cardIds.length > 0) {
    const [labelRes, commentRes, checklistRes] = await Promise.all([
      supabaseAdmin
        .from("board_card_labels")
        .select("card_id")
        .in("card_id", cardIds),
      supabaseAdmin
        .from("card_comments")
        .select("card_id")
        .in("card_id", cardIds),
      supabaseAdmin
        .from("card_checklist_items")
        .select("card_id, is_completed")
        .in("card_id", cardIds),
    ]);
    (labelRes.data ?? []).forEach((r: { card_id: string }) => {
      labelCountByCard.set(r.card_id, (labelCountByCard.get(r.card_id) ?? 0) + 1);
    });
    (commentRes.data ?? []).forEach((r: { card_id: string }) => {
      commentCountByCard.set(
        r.card_id,
        (commentCountByCard.get(r.card_id) ?? 0) + 1,
      );
    });
    (checklistRes.data ?? []).forEach(
      (r: { card_id: string; is_completed: boolean | null }) => {
        const cur = checklistByCard.get(r.card_id) ?? { total: 0, completed: 0 };
        cur.total += 1;
        if (r.is_completed) cur.completed += 1;
        checklistByCard.set(r.card_id, cur);
      },
    );
  }

  // Members (with profile join).
  const { data: memberRows } = await supabaseAdmin
    .from("board_members")
    .select("profile_id, role")
    .eq("board_id", id);
  const memberList = memberRows ?? [];

  // Labels.
  const { data: labelRows } = await supabaseAdmin
    .from("card_labels")
    .select("id, board_id, name, color")
    .eq("board_id", id)
    .order("name", { ascending: true });

  // Profiles to enrich members + assignees + creator.
  const profileIds = new Set<string>();
  profileIds.add(boardRow.created_by);
  memberList.forEach((m: { profile_id: string }) => profileIds.add(m.profile_id));
  cards.forEach((c: { assigned_to: string | null }) => {
    if (c.assigned_to) profileIds.add(c.assigned_to);
  });
  const profileMap = new Map<
    string,
    { full_name: string; avatar_url: string | null }
  >();
  if (profileIds.size > 0) {
    const { data: profRows } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, email, avatar_url")
      .in("id", Array.from(profileIds));
    (profRows ?? []).forEach(
      (p: {
        id: string;
        full_name: string | null;
        email: string | null;
        avatar_url: string | null;
      }) => {
        profileMap.set(p.id, {
          full_name: p.full_name || p.email?.split("@")[0] || "Unnamed",
          avatar_url: p.avatar_url,
        });
      },
    );
  }

  // Assemble columns + cards.
  const cardsByColumn = new Map<string, BoardCardWithMeta[]>();
  cards.forEach(
    (c: {
      id: string;
      board_id: string;
      column_id: string;
      title: string;
      description: string | null;
      cover_color: string | null;
      due_date: string | null;
      assigned_to: string | null;
      position: number;
      is_completed: boolean | null;
    }) => {
      const profile = c.assigned_to ? profileMap.get(c.assigned_to) : null;
      const card: BoardCardWithMeta = {
        id: c.id,
        board_id: c.board_id,
        column_id: c.column_id,
        title: c.title,
        description: c.description,
        cover_color: c.cover_color,
        due_date: c.due_date,
        assigned_to: c.assigned_to,
        position: c.position,
        is_completed: !!c.is_completed,
        assignee:
          c.assigned_to && profile
            ? {
                id: c.assigned_to,
                full_name: profile.full_name,
                avatar_color: "#5CE1A5",
              }
            : null,
        label_count: labelCountByCard.get(c.id) ?? 0,
        comment_count: commentCountByCard.get(c.id) ?? 0,
        checklist_completed:
          checklistByCard.get(c.id)?.completed ?? 0,
        checklist_total: checklistByCard.get(c.id)?.total ?? 0,
      };
      const arr = cardsByColumn.get(c.column_id) ?? [];
      arr.push(card);
      cardsByColumn.set(c.column_id, arr);
    },
  );

  const columnsWithCards: BoardColumnWithCards[] = columns.map(
    (col: {
      id: string;
      board_id: string;
      name: string;
      color: string | null;
      position: number;
    }) => ({
      id: col.id,
      board_id: col.board_id,
      name: col.name,
      color: col.color || "#9CA3AF",
      position: col.position,
      cards: cardsByColumn.get(col.id) ?? [],
    }),
  );

  const members: BoardMemberInfo[] = memberList.map(
    (m: { profile_id: string; role: BoardMemberRole }) => {
      const p = profileMap.get(m.profile_id);
      return {
        profile_id: m.profile_id,
        full_name: p?.full_name ?? "Unnamed",
        avatar_url: p?.avatar_url ?? null,
        role: m.role,
      };
    },
  );

  const labels: CardLabel[] = (labelRows ?? []).map(
    (l: { id: string; board_id: string; name: string; color: string | null }) => ({
      id: l.id,
      board_id: l.board_id,
      name: l.name,
      color: l.color || "#5CE1A5",
    }),
  );

  return {
    data: {
      id: boardRow.id,
      organization_id: boardRow.organization_id,
      name: boardRow.name,
      description: boardRow.description,
      color: boardRow.color || "#5CE1A5",
      icon: boardRow.icon || "Folder",
      visibility: boardRow.visibility as BoardVisibility,
      is_archived: !!boardRow.is_archived,
      department_id: boardRow.department_id,
      department_name: department?.name ?? null,
      department_color: department?.color ?? null,
      created_by: boardRow.created_by,
      created_at: boardRow.created_at,
      updated_at: boardRow.updated_at,
      columns: columnsWithCards,
      members,
      labels,
      viewer_can_edit: access.canEdit,
      viewer_can_delete: access.canDelete,
    },
  };
}

// ─── createBoard ────────────────────────────────────────────
export async function createBoard(
  input: CreateBoardInput,
): Promise<ActionResult<{ id: string }>> {
  const ctx = await getAuthContext();
  if (!ctx) return { success: false, error: "Not authenticated." };
  const { userId, organizationId, role } = ctx;

  if (!can.createDepartment(role)) {
    // createDepartment/createBoard share the admin/staff/leader gate. If we
    // ever fork these, swap to a dedicated permission helper.
    return {
      success: false,
      error: "You don't have permission to create boards.",
    };
  }

  if (!input.name?.trim()) {
    return { success: false, error: "A board name is required." };
  }

  const visibility: BoardVisibility = input.visibility ?? "organization";
  if (
    !["organization", "department", "private", "invitees_only"].includes(
      visibility,
    )
  ) {
    return { success: false, error: "Unknown visibility setting." };
  }

  // Department-visibility boards must point at a department.
  const departmentId =
    input.department_id && input.department_id.length > 0
      ? input.department_id
      : null;
  if (visibility === "department" && !departmentId) {
    return {
      success: false,
      error: "Pick a department for department-visibility boards.",
    };
  }

  const { data: inserted, error: insertError } = await supabaseAdmin
    .from("boards")
    .insert({
      organization_id: organizationId,
      name: input.name.trim(),
      description: input.description?.trim() || null,
      color: input.color || "#5CE1A5",
      icon: input.icon || "Folder",
      department_id: departmentId,
      visibility,
      created_by: userId,
    })
    .select("id")
    .single();

  if (insertError || !inserted) {
    console.error("[createBoard] Insert error:", insertError?.message);
    return {
      success: false,
      error: insertError?.message || "Failed to create board.",
    };
  }

  // Always add the creator as a board owner so member listings pick them up.
  await supabaseAdmin.from("board_members").insert({
    board_id: inserted.id,
    profile_id: userId,
    role: "owner",
  });

  // Apply template columns if requested.
  const template = input.template ?? "blank";
  const columns = BOARD_TEMPLATES[template];
  if (columns && columns.length > 0) {
    const rows = columns.map((c, idx) => ({
      board_id: inserted.id,
      name: c.name,
      color: c.color,
      position: idx,
    }));
    const { error: colError } = await supabaseAdmin
      .from("board_columns")
      .insert(rows);
    if (colError) {
      console.error("[createBoard] Column insert error:", colError.message);
      // Non-fatal — board exists, columns can be re-added manually.
    }
  }

  revalidatePath("/workspace/projects");
  return { success: true, data: { id: inserted.id } };
}

// ─── updateBoard ────────────────────────────────────────────
export type UpdateBoardInput = Partial<{
  name: string;
  description: string | null;
  color: string;
  icon: string;
  department_id: string | null;
  visibility: BoardVisibility;
}>;

export async function updateBoard(
  id: string,
  data: UpdateBoardInput,
): Promise<ActionResult> {
  const access = await requireEditAccess(id);
  if (!access.ok) return { success: false, error: access.error };

  const update: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (typeof data.name === "string") {
    const trimmed = data.name.trim();
    if (!trimmed) return { success: false, error: "Board name can't be empty." };
    update.name = trimmed;
  }
  if (data.description !== undefined) {
    update.description = data.description?.trim() || null;
  }
  if (typeof data.color === "string") update.color = data.color;
  if (typeof data.icon === "string") update.icon = data.icon;
  if (data.department_id !== undefined) {
    update.department_id = data.department_id || null;
  }
  if (data.visibility !== undefined) {
    if (
      !["organization", "department", "private", "invitees_only"].includes(
        data.visibility,
      )
    ) {
      return { success: false, error: "Unknown visibility setting." };
    }
    update.visibility = data.visibility;
  }

  // Only updated_at and we'd still no-op the user-visible state — fine to apply.
  const { error } = await supabaseAdmin
    .from("boards")
    .update(update)
    .eq("id", id);
  if (error) {
    console.error("[updateBoard] Update error:", error.message);
    return { success: false, error: error.message };
  }
  revalidatePath("/workspace/projects");
  revalidatePath(`/workspace/projects/${id}`);
  return { success: true };
}

// ─── archiveBoard ───────────────────────────────────────────
export async function archiveBoard(
  id: string,
): Promise<ActionResult> {
  const ctx = await getAuthContext();
  if (!ctx) return { success: false, error: "Not authenticated." };

  const { data: board } = await supabaseAdmin
    .from("boards")
    .select("id, organization_id, created_by")
    .eq("id", id)
    .maybeSingle();
  if (!board || board.organization_id !== ctx.organizationId) {
    return { success: false, error: "Board not found." };
  }
  if (!(board.created_by === ctx.userId || ctx.role === "admin")) {
    return { success: false, error: "You can't archive this board." };
  }

  const { error } = await supabaseAdmin
    .from("boards")
    .update({ is_archived: true, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) {
    console.error("[archiveBoard] Update error:", error.message);
    return { success: false, error: error.message };
  }
  revalidatePath("/workspace/projects");
  revalidatePath(`/workspace/projects/${id}`);
  return { success: true };
}

// ─── deleteBoard ────────────────────────────────────────────
export async function deleteBoard(
  id: string,
): Promise<ActionResult> {
  const ctx = await getAuthContext();
  if (!ctx) return { success: false, error: "Not authenticated." };

  const { data: board } = await supabaseAdmin
    .from("boards")
    .select("id, organization_id, created_by")
    .eq("id", id)
    .maybeSingle();
  if (!board || board.organization_id !== ctx.organizationId) {
    return { success: false, error: "Board not found." };
  }
  if (!(board.created_by === ctx.userId || ctx.role === "admin")) {
    return { success: false, error: "You can't delete this board." };
  }

  const { error } = await supabaseAdmin.from("boards").delete().eq("id", id);
  if (error) {
    console.error("[deleteBoard] Delete error:", error.message);
    return { success: false, error: error.message };
  }
  revalidatePath("/workspace/projects");
  return { success: true };
}

// ─── toggleBoardStar ────────────────────────────────────────
//
// Per-user favorite. If a (user, board) row exists in board_stars it's
// deleted (unstar); otherwise it's inserted (star). Returns the resulting
// is_starred so the client can sync against actual server state instead of
// trusting its own optimistic flip.
export async function toggleBoardStar(
  boardId: string,
): Promise<ActionResult<{ is_starred: boolean }>> {
  const ctx = await getAuthContext();
  if (!ctx) return { success: false, error: "Not authenticated." };

  // Verify the user can actually see this board before we let them star it.
  // We don't require edit access — anyone with visibility should be able to
  // favorite a board for their own dashboard.
  const access = await loadBoardForViewer(ctx, boardId);
  if (!access.ok) return { success: false, error: access.error };

  const { data: existing } = await supabaseAdmin
    .from("board_stars")
    .select("user_id")
    .eq("user_id", ctx.userId)
    .eq("board_id", boardId)
    .maybeSingle();

  if (existing) {
    const { error } = await supabaseAdmin
      .from("board_stars")
      .delete()
      .eq("user_id", ctx.userId)
      .eq("board_id", boardId);
    if (error) {
      console.error("[toggleBoardStar] Delete error:", error.message);
      return { success: false, error: error.message };
    }
    revalidatePath("/workspace/projects");
    return { success: true, data: { is_starred: false } };
  }

  const { error } = await supabaseAdmin.from("board_stars").insert({
    user_id: ctx.userId,
    board_id: boardId,
  });
  if (error) {
    console.error("[toggleBoardStar] Insert error:", error.message);
    return { success: false, error: error.message };
  }
  revalidatePath("/workspace/projects");
  return { success: true, data: { is_starred: true } };
}

// ─── addBoardMember ─────────────────────────────────────────
//
// Adds a profile to a board with the given role. Caller needs edit access
// to the board (creator, admin, or existing owner/editor). Target must be
// in the same organization. Sends a notification email; the in-app
// notifications table doesn't exist yet, so the in-app piece is a TODO.
export type AddBoardMemberResult = {
  member: {
    profile_id: string;
    full_name: string;
    email: string;
    avatar_url: string | null;
    role: BoardMemberRole;
  };
};

export async function addBoardMember(
  boardId: string,
  profileId: string,
  role: BoardMemberRole = "member",
): Promise<ActionResult<AddBoardMemberResult>> {
  const access = await requireEditAccess(boardId);
  if (!access.ok) return { success: false, error: access.error };
  const { ctx, board } = access;

  if (!["owner", "editor", "member", "viewer"].includes(role)) {
    return { success: false, error: "Unknown member role." };
  }

  // Target profile must exist and be in the same org.
  const { data: target } = await supabaseAdmin
    .from("profiles")
    .select("id, full_name, email, avatar_url, organization_id, role")
    .eq("id", profileId)
    .maybeSingle();
  if (!target || target.organization_id !== ctx.organizationId) {
    return { success: false, error: "That person isn't in your organization." };
  }

  // Insert the membership. Unique constraint on (board_id, profile_id)
  // gives us a nice "already a member" failure mode.
  const { error: insertError } = await supabaseAdmin
    .from("board_members")
    .insert({
      board_id: boardId,
      profile_id: profileId,
      role,
    });

  if (insertError) {
    // 23505 = unique_violation. Surface a friendly message instead of leaking
    // the constraint name.
    if ((insertError as { code?: string }).code === "23505") {
      return { success: false, error: "They're already on this board." };
    }
    console.error("[addBoardMember] Insert error:", insertError.message);
    return { success: false, error: insertError.message };
  }

  // Resolve display names for the email template.
  const [{ data: inviterProfile }, { data: orgRow }] = await Promise.all([
    supabaseAdmin
      .from("profiles")
      .select("full_name, email")
      .eq("id", ctx.userId)
      .maybeSingle(),
    supabaseAdmin
      .from("organizations")
      .select("name")
      .eq("id", board.organization_id)
      .maybeSingle(),
  ]);

  const inviterName =
    inviterProfile?.full_name ||
    inviterProfile?.email?.split("@")[0] ||
    "A teammate";
  const recipientName =
    target.full_name || target.email?.split("@")[0] || "there";
  const organizationName = orgRow?.name || "your organization";

  // Fetch the board name for the email subject/body. We have access to
  // board.id/board_id but the BoardAccessRow shape doesn't include name.
  const { data: boardRow } = await supabaseAdmin
    .from("boards")
    .select("name")
    .eq("id", boardId)
    .maybeSingle();
  const boardName = boardRow?.name || "a project board";

  // Notification email — best-effort. Email failure shouldn't roll back the
  // membership insert; we just log it and continue.
  if (target.email) {
    try {
      const { sendBoardMemberAddedEmail } = await import(
        "@/lib/email/send-board-member-added"
      );
      await sendBoardMemberAddedEmail({
        to: target.email,
        recipientName,
        inviterName,
        boardName,
        boardId,
        organizationName,
        role,
      });
    } catch (err) {
      console.error("[addBoardMember] Email send failed:", err);
    }
  }

  // In-app notification — best-effort. Same fail-soft posture as the email:
  // the membership insert stands even if notify falls over.
  try {
    const { createNotification } = await import("@/app/actions/notifications");
    await createNotification({
      recipientId: target.id,
      organizationId: board.organization_id,
      actorId: ctx.userId,
      type: "board_member_added",
      title: `${inviterName} added you to ${boardName}`,
      body: "You're now part of this project board.",
      entityType: "board",
      entityId: boardId,
      actionUrl: `/workspace/projects/${boardId}`,
    });
  } catch (err) {
    console.error("[addBoardMember] Notification send failed:", err);
  }

  revalidatePath("/workspace/projects");
  revalidatePath(`/workspace/projects/${boardId}`);

  return {
    success: true,
    data: {
      member: {
        profile_id: target.id,
        full_name: recipientName,
        email: target.email || "",
        avatar_url: target.avatar_url,
        role,
      },
    },
  };
}

// ─── Columns ─────────────────────────────────────────────────
export async function createColumn(
  boardId: string,
  data: { name: string; color?: string },
): Promise<ActionResult<BoardColumnWithCards>> {
  const access = await requireEditAccess(boardId);
  if (!access.ok) return { success: false, error: access.error };
  if (!data.name?.trim()) {
    return { success: false, error: "Column name is required." };
  }

  // Position = current max + 1 (or 0 if empty)
  const { data: existing } = await supabaseAdmin
    .from("board_columns")
    .select("position")
    .eq("board_id", boardId)
    .order("position", { ascending: false })
    .limit(1);
  const nextPos =
    existing && existing.length > 0
      ? (existing[0] as { position: number }).position + 1
      : 0;

  const { data: inserted, error } = await supabaseAdmin
    .from("board_columns")
    .insert({
      board_id: boardId,
      name: data.name.trim(),
      color: data.color || "#9CA3AF",
      position: nextPos,
    })
    .select("id, board_id, name, color, position")
    .single();

  if (error || !inserted) {
    console.error("[createColumn] Insert error:", error?.message);
    return { success: false, error: error?.message || "Failed to create column." };
  }

  await touchBoard(boardId);
  revalidatePath(`/workspace/projects/${boardId}`);
  return {
    success: true,
    data: {
      id: inserted.id,
      board_id: inserted.board_id,
      name: inserted.name,
      color: inserted.color || "#9CA3AF",
      position: inserted.position,
      cards: [],
    },
  };
}

export async function updateColumn(
  columnId: string,
  data: { name?: string; color?: string },
): Promise<ActionResult> {
  const ctx = await getAuthContext();
  if (!ctx) return { success: false, error: "Not authenticated." };

  const { data: col } = await supabaseAdmin
    .from("board_columns")
    .select("board_id")
    .eq("id", columnId)
    .maybeSingle();
  if (!col) return { success: false, error: "Column not found." };

  const access = await loadBoardForViewer(ctx, col.board_id);
  if (!access.ok || !access.canEdit)
    return { success: false, error: "You can't edit this column." };

  const update: Record<string, unknown> = {};
  if (typeof data.name === "string" && data.name.trim()) {
    update.name = data.name.trim();
  }
  if (typeof data.color === "string") update.color = data.color;
  if (Object.keys(update).length === 0) return { success: true };

  const { error } = await supabaseAdmin
    .from("board_columns")
    .update(update)
    .eq("id", columnId);
  if (error) {
    console.error("[updateColumn] Update error:", error.message);
    return { success: false, error: error.message };
  }
  await touchBoard(col.board_id);
  revalidatePath(`/workspace/projects/${col.board_id}`);
  return { success: true };
}

export async function deleteColumn(
  columnId: string,
): Promise<ActionResult> {
  const ctx = await getAuthContext();
  if (!ctx) return { success: false, error: "Not authenticated." };

  const { data: col } = await supabaseAdmin
    .from("board_columns")
    .select("board_id")
    .eq("id", columnId)
    .maybeSingle();
  if (!col) return { success: false, error: "Column not found." };

  const access = await loadBoardForViewer(ctx, col.board_id);
  if (!access.ok || !access.canEdit)
    return { success: false, error: "You can't delete this column." };

  const { error } = await supabaseAdmin
    .from("board_columns")
    .delete()
    .eq("id", columnId);
  if (error) {
    console.error("[deleteColumn] Delete error:", error.message);
    return { success: false, error: error.message };
  }
  await touchBoard(col.board_id);
  revalidatePath(`/workspace/projects/${col.board_id}`);
  return { success: true };
}

export async function reorderColumns(
  boardId: string,
  columnIds: string[],
): Promise<ActionResult> {
  const access = await requireEditAccess(boardId);
  if (!access.ok) return { success: false, error: access.error };
  if (!Array.isArray(columnIds) || columnIds.length === 0) {
    return { success: true };
  }

  // Update positions sequentially. Supabase JS doesn't expose multi-row
  // CASE updates; we issue one PATCH per column. Cheap for small column
  // counts (kanban boards rarely exceed ~10 columns).
  for (let i = 0; i < columnIds.length; i++) {
    const id = columnIds[i];
    const { error } = await supabaseAdmin
      .from("board_columns")
      .update({ position: i })
      .eq("id", id)
      .eq("board_id", boardId);
    if (error) {
      console.error("[reorderColumns] Update error:", error.message);
      return { success: false, error: error.message };
    }
  }
  await touchBoard(boardId);
  revalidatePath(`/workspace/projects/${boardId}`);
  return { success: true };
}

// ─── Cards ──────────────────────────────────────────────────
export type CreateCardInput = {
  title: string;
  description?: string | null;
  cover_color?: string | null;
  assigned_to?: string | null;
  due_date?: string | null;
};

export async function createCard(
  columnId: string,
  data: CreateCardInput,
): Promise<ActionResult<BoardCardWithMeta>> {
  const ctx = await getAuthContext();
  if (!ctx) return { success: false, error: "Not authenticated." };
  if (!data.title?.trim()) {
    return { success: false, error: "Card title is required." };
  }

  const { data: col } = await supabaseAdmin
    .from("board_columns")
    .select("id, board_id")
    .eq("id", columnId)
    .maybeSingle();
  if (!col) return { success: false, error: "Column not found." };

  const access = await loadBoardForViewer(ctx, col.board_id);
  if (!access.ok || !access.canEdit)
    return { success: false, error: "You can't add cards here." };

  const { data: existing } = await supabaseAdmin
    .from("board_cards")
    .select("position")
    .eq("column_id", columnId)
    .order("position", { ascending: false })
    .limit(1);
  const nextPos =
    existing && existing.length > 0
      ? (existing[0] as { position: number }).position + 1
      : 0;

  const { data: inserted, error } = await supabaseAdmin
    .from("board_cards")
    .insert({
      board_id: col.board_id,
      column_id: columnId,
      title: data.title.trim(),
      description: data.description?.trim() || null,
      cover_color: data.cover_color || null,
      assigned_to: data.assigned_to || null,
      due_date: data.due_date || null,
      position: nextPos,
      created_by: ctx.userId,
    })
    .select(
      "id, board_id, column_id, title, description, cover_color, due_date, assigned_to, position, is_completed",
    )
    .single();

  if (error || !inserted) {
    console.error("[createCard] Insert error:", error?.message);
    return { success: false, error: error?.message || "Failed to create card." };
  }

  recordCardActivity(inserted.id, ctx.userId, "created", {
    title: inserted.title,
  });
  if (inserted.assigned_to && inserted.assigned_to !== ctx.userId) {
    recordCardActivity(inserted.id, ctx.userId, "assigned", {
      profile_id: inserted.assigned_to,
    });
  }

  // Resolve assignee for the immediate UI return.
  let assignee: CardAssignee | null = null;
  if (inserted.assigned_to) {
    const { data: prof } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, email")
      .eq("id", inserted.assigned_to)
      .maybeSingle();
    if (prof) {
      assignee = {
        id: prof.id,
        full_name:
          prof.full_name || prof.email?.split("@")[0] || "Unnamed",
        avatar_color: "#5CE1A5",
      };
    }
  }

  // Notify the assignee (if any and not the creator). Best-effort.
  if (
    inserted.assigned_to &&
    inserted.assigned_to !== ctx.userId &&
    assignee
  ) {
    try {
      const { createNotification } = await import("@/app/actions/notifications");
      // Pull the actor + board name in parallel for the notification copy.
      const [{ data: actor }, { data: boardRow }] = await Promise.all([
        supabaseAdmin
          .from("profiles")
          .select("full_name, email")
          .eq("id", ctx.userId)
          .maybeSingle(),
        supabaseAdmin
          .from("boards")
          .select("name, organization_id")
          .eq("id", col.board_id)
          .maybeSingle(),
      ]);
      const actorName =
        actor?.full_name || actor?.email?.split("@")[0] || "A teammate";
      const boardName = boardRow?.name || "a project board";
      const organizationId = boardRow?.organization_id ?? ctx.organizationId;
      await createNotification({
        recipientId: inserted.assigned_to,
        organizationId,
        actorId: ctx.userId,
        type: "board_card_assigned",
        title: `${actorName} assigned you a card`,
        body: `"${inserted.title}" on ${boardName}`,
        entityType: "board_card",
        entityId: inserted.id,
        actionUrl: `/workspace/projects/${col.board_id}`,
      });
    } catch (err) {
      console.error("[createCard] Notification send failed:", err);
    }
  }

  await touchBoard(col.board_id);
  revalidatePath(`/workspace/projects/${col.board_id}`);
  return {
    success: true,
    data: {
      id: inserted.id,
      board_id: inserted.board_id,
      column_id: inserted.column_id,
      title: inserted.title,
      description: inserted.description,
      cover_color: inserted.cover_color,
      due_date: inserted.due_date,
      assigned_to: inserted.assigned_to,
      position: inserted.position,
      is_completed: !!inserted.is_completed,
      assignee,
      label_count: 0,
      comment_count: 0,
      checklist_completed: 0,
      checklist_total: 0,
    },
  };
}

export type UpdateCardInput = Partial<{
  title: string;
  description: string | null;
  cover_color: string | null;
  assigned_to: string | null;
  due_date: string | null;
  is_completed: boolean;
}>;

export async function updateCard(
  cardId: string,
  data: UpdateCardInput,
): Promise<ActionResult> {
  const ctx = await getAuthContext();
  if (!ctx) return { success: false, error: "Not authenticated." };

  // Fetch the existing row so we can both detect real changes (vs. no-op
  // re-saves) and craft notification/activity copy without an extra hop.
  const { data: card } = await supabaseAdmin
    .from("board_cards")
    .select(
      "board_id, title, description, assigned_to, due_date, is_completed",
    )
    .eq("id", cardId)
    .maybeSingle();
  if (!card) return { success: false, error: "Card not found." };

  const access = await loadBoardForViewer(ctx, card.board_id);
  if (!access.ok || !access.canEdit)
    return { success: false, error: "You can't edit this card." };

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof data.title === "string" && data.title.trim()) {
    update.title = data.title.trim();
  }
  if (data.description !== undefined) {
    update.description = data.description?.trim() || null;
  }
  if (data.cover_color !== undefined) update.cover_color = data.cover_color || null;
  if (data.assigned_to !== undefined) update.assigned_to = data.assigned_to || null;
  if (data.due_date !== undefined) update.due_date = data.due_date || null;
  if (data.is_completed !== undefined) {
    update.is_completed = data.is_completed;
    update.completed_at = data.is_completed ? new Date().toISOString() : null;
  }

  const { error } = await supabaseAdmin
    .from("board_cards")
    .update(update)
    .eq("id", cardId);
  if (error) {
    console.error("[updateCard] Update error:", error.message);
    return { success: false, error: error.message };
  }

  // Activity diff — one row per changed field. Best-effort: failure to
  // record activity must never roll back the user's save (handled inside
  // recordCardActivity).
  if (update.title && update.title !== card.title) {
    recordCardActivity(cardId, ctx.userId, "title_changed", {
      from: card.title,
      to: update.title,
    });
  }
  if (
    "description" in update &&
    (update.description ?? null) !== (card.description ?? null)
  ) {
    recordCardActivity(cardId, ctx.userId, "description_changed", {});
  }
  if (
    data.assigned_to !== undefined &&
    (update.assigned_to ?? null) !== (card.assigned_to ?? null)
  ) {
    recordCardActivity(
      cardId,
      ctx.userId,
      update.assigned_to ? "assigned" : "unassigned",
      { profile_id: update.assigned_to ?? card.assigned_to },
    );
  }
  if (
    data.due_date !== undefined &&
    (update.due_date ?? null) !== (card.due_date ?? null)
  ) {
    recordCardActivity(cardId, ctx.userId, "due_date_changed", {
      from: card.due_date,
      to: update.due_date,
    });
  }
  if (
    data.is_completed !== undefined &&
    update.is_completed !== card.is_completed
  ) {
    recordCardActivity(
      cardId,
      ctx.userId,
      update.is_completed ? "completed" : "reopened",
      {},
    );
  }

  // Notify the new assignee on an actual change (not a no-op re-save) and
  // only when it's not the actor themselves.
  const newAssignee =
    data.assigned_to !== undefined ? data.assigned_to || null : card.assigned_to;
  const changed =
    data.assigned_to !== undefined && newAssignee !== card.assigned_to;
  if (changed && newAssignee && newAssignee !== ctx.userId) {
    try {
      const { createNotification } = await import("@/app/actions/notifications");
      const [{ data: actor }, { data: boardRow }] = await Promise.all([
        supabaseAdmin
          .from("profiles")
          .select("full_name, email")
          .eq("id", ctx.userId)
          .maybeSingle(),
        supabaseAdmin
          .from("boards")
          .select("name, organization_id")
          .eq("id", card.board_id)
          .maybeSingle(),
      ]);
      const actorName =
        actor?.full_name || actor?.email?.split("@")[0] || "A teammate";
      const boardName = boardRow?.name || "a project board";
      const organizationId = boardRow?.organization_id ?? ctx.organizationId;
      const cardTitle = (update.title as string) || card.title;
      await createNotification({
        recipientId: newAssignee,
        organizationId,
        actorId: ctx.userId,
        type: "board_card_assigned",
        title: `${actorName} assigned you a card`,
        body: `"${cardTitle}" on ${boardName}`,
        entityType: "board_card",
        entityId: cardId,
        actionUrl: `/workspace/projects/${card.board_id}`,
      });
    } catch (err) {
      console.error("[updateCard] Notification send failed:", err);
    }
  }

  await touchBoard(card.board_id);
  revalidatePath(`/workspace/projects/${card.board_id}`);
  return { success: true };
}

export async function moveCard(
  cardId: string,
  targetColumnId: string,
  newPosition: number,
): Promise<ActionResult> {
  const ctx = await getAuthContext();
  if (!ctx) return { success: false, error: "Not authenticated." };

  const { data: card } = await supabaseAdmin
    .from("board_cards")
    .select("id, board_id, column_id")
    .eq("id", cardId)
    .maybeSingle();
  if (!card) return { success: false, error: "Card not found." };

  // Target column must belong to the same board.
  const { data: targetCol } = await supabaseAdmin
    .from("board_columns")
    .select("id, board_id, name")
    .eq("id", targetColumnId)
    .maybeSingle();
  if (!targetCol || targetCol.board_id !== card.board_id) {
    return { success: false, error: "Target column not found." };
  }

  const access = await loadBoardForViewer(ctx, card.board_id);
  if (!access.ok || !access.canEdit)
    return { success: false, error: "You can't move this card." };

  const { error } = await supabaseAdmin
    .from("board_cards")
    .update({
      column_id: targetColumnId,
      position: Math.max(0, Math.floor(newPosition)),
      updated_at: new Date().toISOString(),
    })
    .eq("id", cardId);
  if (error) {
    console.error("[moveCard] Update error:", error.message);
    return { success: false, error: error.message };
  }

  // Only log a column change — drag-within-column reorders are noise.
  if (targetColumnId !== card.column_id) {
    const { data: fromCol } = await supabaseAdmin
      .from("board_columns")
      .select("name")
      .eq("id", card.column_id)
      .maybeSingle();
    recordCardActivity(cardId, ctx.userId, "moved_column", {
      from: fromCol?.name,
      to: targetCol.name,
      from_column_id: card.column_id,
      to_column_id: targetColumnId,
    });
  }

  await touchBoard(card.board_id);
  revalidatePath(`/workspace/projects/${card.board_id}`);
  return { success: true };
}

export async function reorderCardsInColumn(
  columnId: string,
  cardIds: string[],
): Promise<ActionResult> {
  const ctx = await getAuthContext();
  if (!ctx) return { success: false, error: "Not authenticated." };

  const { data: col } = await supabaseAdmin
    .from("board_columns")
    .select("id, board_id")
    .eq("id", columnId)
    .maybeSingle();
  if (!col) return { success: false, error: "Column not found." };

  const access = await loadBoardForViewer(ctx, col.board_id);
  if (!access.ok || !access.canEdit)
    return { success: false, error: "You can't reorder cards here." };

  if (!Array.isArray(cardIds) || cardIds.length === 0) return { success: true };

  for (let i = 0; i < cardIds.length; i++) {
    const id = cardIds[i];
    const { error } = await supabaseAdmin
      .from("board_cards")
      .update({ position: i, column_id: columnId })
      .eq("id", id)
      .eq("board_id", col.board_id);
    if (error) {
      console.error("[reorderCardsInColumn] Update error:", error.message);
      return { success: false, error: error.message };
    }
  }
  await touchBoard(col.board_id);
  revalidatePath(`/workspace/projects/${col.board_id}`);
  return { success: true };
}

export async function deleteCard(cardId: string): Promise<ActionResult> {
  const ctx = await getAuthContext();
  if (!ctx) return { success: false, error: "Not authenticated." };

  const { data: card } = await supabaseAdmin
    .from("board_cards")
    .select("board_id")
    .eq("id", cardId)
    .maybeSingle();
  if (!card) return { success: false, error: "Card not found." };

  const access = await loadBoardForViewer(ctx, card.board_id);
  if (!access.ok || !access.canEdit)
    return { success: false, error: "You can't delete this card." };

  const { error } = await supabaseAdmin
    .from("board_cards")
    .delete()
    .eq("id", cardId);
  if (error) {
    console.error("[deleteCard] Delete error:", error.message);
    return { success: false, error: error.message };
  }
  await touchBoard(card.board_id);
  revalidatePath(`/workspace/projects/${card.board_id}`);
  return { success: true };
}

// ============================================================
//  Phase 3 — checklist, comments, labels, activity, getCard
// ============================================================

// ─── Phase 3 types ──────────────────────────────────────────
export type ChecklistItem = {
  id: string;
  card_id: string;
  title: string;
  is_completed: boolean;
  position: number;
  completed_at: string | null;
  created_at: string;
};

export type CommentAuthor = {
  id: string;
  full_name: string;
  avatar_color: string;
  role: Role | null;
};

export type CardComment = {
  id: string;
  card_id: string;
  author_id: string;
  content: string;
  created_at: string;
  updated_at: string;
  author: CommentAuthor | null;
};

export type CardActivityActionType =
  | "created"
  | "title_changed"
  | "description_changed"
  | "moved_column"
  | "assigned"
  | "unassigned"
  | "due_date_changed"
  | "label_added"
  | "label_removed"
  | "checklist_added"
  | "checklist_completed"
  | "checklist_removed"
  | "comment_added"
  | "attachment_added"
  | "attachment_removed"
  | "completed"
  | "reopened";

export type CardActivityEntry = {
  id: string;
  card_id: string;
  actor_id: string;
  action_type: CardActivityActionType;
  metadata: Record<string, unknown>;
  created_at: string;
  actor: CommentAuthor | null;
};

export type CardDetail = {
  id: string;
  board_id: string;
  column_id: string;
  title: string;
  description: string | null;
  cover_color: string | null;
  due_date: string | null;
  assigned_to: string | null;
  position: number;
  is_completed: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
  assignee: CommentAuthor | null;
  creator: CommentAuthor | null;
  column: { id: string; name: string; color: string };
  board: { id: string; name: string };
  labels: CardLabel[];
  checklist_items: ChecklistItem[];
  comments: CardComment[];
  activity: CardActivityEntry[];
  viewer_can_edit: boolean;
  viewer_can_delete: boolean;
};

// ─── Helpers ────────────────────────────────────────────────

// Mention tokens embedded in comment content. UI inserts these via the
// autocomplete picker; the parser pulls out the profile IDs for routing
// notifications and the renderer turns them into pills.
//   syntax: @[Full Name](profile-uuid)
const MENTION_RE = /@\[[^\]]+\]\(([0-9a-fA-F-]{36})\)/g;
function parseMentions(content: string): string[] {
  const ids = new Set<string>();
  let match: RegExpExecArray | null;
  while ((match = MENTION_RE.exec(content)) !== null) ids.add(match[1]);
  return Array.from(ids);
}

// Activity inserts are best-effort. A failure here must NEVER roll back the
// primary write (the user's intent already succeeded).
async function recordCardActivity(
  cardId: string,
  actorId: string,
  actionType: CardActivityActionType,
  metadata: Record<string, unknown> = {},
): Promise<void> {
  try {
    const { error } = await supabaseAdmin.from("card_activity").insert({
      card_id: cardId,
      actor_id: actorId,
      action_type: actionType,
      metadata,
    });
    if (error) {
      console.error("[recordCardActivity] Insert error:", error.message);
    }
  } catch (err) {
    console.error("[recordCardActivity] Threw:", err);
  }
}

// Loads a card row + its board_id, and verifies the viewer can access /
// edit it. Centralizes the access pattern used by every Phase 3 action.
async function loadCardForViewer(
  ctx: { userId: string; organizationId: string; role: Role },
  cardId: string,
): Promise<
  | { ok: true; boardId: string; canEdit: boolean; canDelete: boolean }
  | { ok: false; error: string }
> {
  const { data: card } = await supabaseAdmin
    .from("board_cards")
    .select("board_id")
    .eq("id", cardId)
    .maybeSingle();
  if (!card) return { ok: false, error: "Card not found." };
  const access = await loadBoardForViewer(ctx, card.board_id);
  if (!access.ok) return { ok: false, error: access.error };
  return {
    ok: true,
    boardId: card.board_id,
    canEdit: access.canEdit,
    canDelete: access.canDelete,
  };
}

// ─── Checklist ──────────────────────────────────────────────

export async function createChecklistItem(
  cardId: string,
  title: string,
): Promise<ActionResult<ChecklistItem>> {
  const ctx = await getAuthContext();
  if (!ctx) return { success: false, error: "Not authenticated." };
  const trimmed = title.trim();
  if (!trimmed) return { success: false, error: "Title is required." };

  const access = await loadCardForViewer(ctx, cardId);
  if (!access.ok) return { success: false, error: access.error };
  if (!access.canEdit)
    return { success: false, error: "You can't edit this card." };

  // Find the largest position so the new item lands at the end.
  const { data: tail } = await supabaseAdmin
    .from("card_checklist_items")
    .select("position")
    .eq("card_id", cardId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  const position = ((tail?.position as number | undefined) ?? -1) + 1;

  const { data, error } = await supabaseAdmin
    .from("card_checklist_items")
    .insert({ card_id: cardId, title: trimmed, position })
    .select("id, card_id, title, is_completed, position, completed_at, created_at")
    .single();
  if (error || !data) {
    console.error("[createChecklistItem] Insert error:", error?.message);
    return { success: false, error: error?.message || "Couldn't add item." };
  }

  recordCardActivity(cardId, ctx.userId, "checklist_added", { title: trimmed });
  await touchBoard(access.boardId);
  revalidatePath(`/workspace/projects/${access.boardId}`);
  return { success: true, data: data as ChecklistItem };
}

export async function updateChecklistItem(
  itemId: string,
  data: { title?: string; is_completed?: boolean },
): Promise<ActionResult<ChecklistItem>> {
  const ctx = await getAuthContext();
  if (!ctx) return { success: false, error: "Not authenticated." };

  const { data: existing } = await supabaseAdmin
    .from("card_checklist_items")
    .select("id, card_id, title, is_completed")
    .eq("id", itemId)
    .maybeSingle();
  if (!existing) return { success: false, error: "Item not found." };

  const access = await loadCardForViewer(ctx, existing.card_id);
  if (!access.ok) return { success: false, error: access.error };
  if (!access.canEdit)
    return { success: false, error: "You can't edit this card." };

  const update: Record<string, unknown> = {};
  if (typeof data.title === "string" && data.title.trim())
    update.title = data.title.trim();
  if (typeof data.is_completed === "boolean") {
    update.is_completed = data.is_completed;
    update.completed_at = data.is_completed
      ? new Date().toISOString()
      : null;
  }
  if (Object.keys(update).length === 0)
    return { success: true, data: existing as unknown as ChecklistItem };

  const { data: row, error } = await supabaseAdmin
    .from("card_checklist_items")
    .update(update)
    .eq("id", itemId)
    .select("id, card_id, title, is_completed, position, completed_at, created_at")
    .single();
  if (error || !row) {
    console.error("[updateChecklistItem] Update error:", error?.message);
    return { success: false, error: error?.message || "Couldn't save." };
  }

  // Emit "checklist_completed" only when a real flip from false→true happens.
  if (
    data.is_completed === true &&
    existing.is_completed !== true &&
    row.is_completed === true
  ) {
    recordCardActivity(existing.card_id, ctx.userId, "checklist_completed", {
      title: row.title,
    });
  }

  await touchBoard(access.boardId);
  revalidatePath(`/workspace/projects/${access.boardId}`);
  return { success: true, data: row as ChecklistItem };
}

export async function deleteChecklistItem(
  itemId: string,
): Promise<ActionResult> {
  const ctx = await getAuthContext();
  if (!ctx) return { success: false, error: "Not authenticated." };

  const { data: existing } = await supabaseAdmin
    .from("card_checklist_items")
    .select("id, card_id, title")
    .eq("id", itemId)
    .maybeSingle();
  if (!existing) return { success: false, error: "Item not found." };

  const access = await loadCardForViewer(ctx, existing.card_id);
  if (!access.ok) return { success: false, error: access.error };
  if (!access.canEdit)
    return { success: false, error: "You can't edit this card." };

  const { error } = await supabaseAdmin
    .from("card_checklist_items")
    .delete()
    .eq("id", itemId);
  if (error) {
    console.error("[deleteChecklistItem] Delete error:", error.message);
    return { success: false, error: error.message };
  }

  recordCardActivity(existing.card_id, ctx.userId, "checklist_removed", {
    title: existing.title,
  });
  await touchBoard(access.boardId);
  revalidatePath(`/workspace/projects/${access.boardId}`);
  return { success: true };
}

export async function reorderChecklistItems(
  cardId: string,
  itemIds: string[],
): Promise<ActionResult> {
  const ctx = await getAuthContext();
  if (!ctx) return { success: false, error: "Not authenticated." };

  const access = await loadCardForViewer(ctx, cardId);
  if (!access.ok) return { success: false, error: access.error };
  if (!access.canEdit)
    return { success: false, error: "You can't edit this card." };
  if (!Array.isArray(itemIds) || itemIds.length === 0)
    return { success: true };

  // Sequential rather than a single bulk upsert because Postgres lacks a
  // CASE-WHEN convenience without sending raw SQL. Modest N — board cards
  // rarely have more than ~30 items.
  for (let i = 0; i < itemIds.length; i++) {
    const { error } = await supabaseAdmin
      .from("card_checklist_items")
      .update({ position: i })
      .eq("id", itemIds[i])
      .eq("card_id", cardId);
    if (error) {
      console.error("[reorderChecklistItems] Update error:", error.message);
      return { success: false, error: error.message };
    }
  }

  await touchBoard(access.boardId);
  revalidatePath(`/workspace/projects/${access.boardId}`);
  return { success: true };
}

// ─── Comments ───────────────────────────────────────────────

// Joins author profile data so the UI can render without a second hop.
async function joinCommentAuthors(
  rows: { id: string; card_id: string; author_id: string; content: string; created_at: string; updated_at: string }[],
): Promise<CardComment[]> {
  if (rows.length === 0) return [];
  const ids = Array.from(new Set(rows.map((r) => r.author_id)));
  const { data: profiles } = await supabaseAdmin
    .from("profiles")
    .select("id, full_name, avatar_color, role")
    .in("id", ids);
  const byId = new Map<string, CommentAuthor>();
  (profiles ?? []).forEach((p: { id: string; full_name: string | null; avatar_color: string | null; role: Role | null }) => {
    byId.set(p.id, {
      id: p.id,
      full_name: p.full_name || "Teammate",
      avatar_color: p.avatar_color || "#5CE1A5",
      role: p.role ?? null,
    });
  });
  return rows.map((r) => ({ ...r, author: byId.get(r.author_id) ?? null }));
}

export async function getCardComments(
  cardId: string,
): Promise<ActionResult<CardComment[]>> {
  const ctx = await getAuthContext();
  if (!ctx) return { success: false, error: "Not authenticated." };
  const access = await loadCardForViewer(ctx, cardId);
  if (!access.ok) return { success: false, error: access.error };

  const { data, error } = await supabaseAdmin
    .from("card_comments")
    .select("id, card_id, author_id, content, created_at, updated_at")
    .eq("card_id", cardId)
    .order("created_at", { ascending: true });
  if (error) {
    console.error("[getCardComments] Select error:", error.message);
    return { success: false, error: error.message };
  }
  const comments = await joinCommentAuthors(data ?? []);
  return { success: true, data: comments };
}

export async function createCardComment(
  cardId: string,
  content: string,
): Promise<ActionResult<CardComment>> {
  const ctx = await getAuthContext();
  if (!ctx) return { success: false, error: "Not authenticated." };
  const trimmed = content.trim();
  if (!trimmed) return { success: false, error: "Comment is empty." };

  const access = await loadCardForViewer(ctx, cardId);
  if (!access.ok) return { success: false, error: access.error };

  const { data: row, error } = await supabaseAdmin
    .from("card_comments")
    .insert({ card_id: cardId, author_id: ctx.userId, content: trimmed })
    .select("id, card_id, author_id, content, created_at, updated_at")
    .single();
  if (error || !row) {
    console.error("[createCardComment] Insert error:", error?.message);
    return { success: false, error: error?.message || "Couldn't post comment." };
  }
  const [comment] = await joinCommentAuthors([row]);

  recordCardActivity(cardId, ctx.userId, "comment_added", {
    preview: trimmed.slice(0, 120),
  });

  // Notifications: assignee + creator + every @mentioned profile, all
  // de-duplicated and never sent to the commenter themselves.
  try {
    const { createNotification } = await import("@/app/actions/notifications");
    const [{ data: card }, { data: boardRow }] = await Promise.all([
      supabaseAdmin
        .from("board_cards")
        .select("title, assigned_to, created_by")
        .eq("id", cardId)
        .maybeSingle(),
      supabaseAdmin
        .from("boards")
        .select("id, name, organization_id")
        .eq("id", access.boardId)
        .maybeSingle(),
    ]);

    const actorName =
      comment?.author?.full_name || "A teammate";
    const cardTitle = card?.title || "a card";
    const boardName = boardRow?.name || "a project board";
    const organizationId = boardRow?.organization_id ?? ctx.organizationId;
    const actionUrl = `/workspace/projects/${access.boardId}?card=${cardId}`;
    const sent = new Set<string>([ctx.userId]);

    const mentionIds = parseMentions(trimmed);
    for (const recipientId of mentionIds) {
      if (sent.has(recipientId)) continue;
      sent.add(recipientId);
      await createNotification({
        recipientId,
        organizationId,
        actorId: ctx.userId,
        type: "board_card_mention",
        title: `${actorName} mentioned you`,
        body: `On "${cardTitle}" — ${trimmed.slice(0, 140)}`,
        entityType: "board_card",
        entityId: cardId,
        actionUrl,
      });
    }

    const baseRecipients = [card?.assigned_to, card?.created_by].filter(
      (id): id is string => !!id,
    );
    for (const recipientId of baseRecipients) {
      if (sent.has(recipientId)) continue;
      sent.add(recipientId);
      await createNotification({
        recipientId,
        organizationId,
        actorId: ctx.userId,
        type: "board_card_comment",
        title: `${actorName} commented on "${cardTitle}"`,
        body: `${trimmed.slice(0, 140)} · ${boardName}`,
        entityType: "board_card",
        entityId: cardId,
        actionUrl,
      });
    }
  } catch (err) {
    console.error("[createCardComment] Notification send failed:", err);
  }

  await touchBoard(access.boardId);
  revalidatePath(`/workspace/projects/${access.boardId}`);
  return { success: true, data: comment };
}

export async function updateCardComment(
  commentId: string,
  content: string,
): Promise<ActionResult<CardComment>> {
  const ctx = await getAuthContext();
  if (!ctx) return { success: false, error: "Not authenticated." };
  const trimmed = content.trim();
  if (!trimmed) return { success: false, error: "Comment is empty." };

  const { data: existing } = await supabaseAdmin
    .from("card_comments")
    .select("id, card_id, author_id")
    .eq("id", commentId)
    .maybeSingle();
  if (!existing) return { success: false, error: "Comment not found." };
  if (existing.author_id !== ctx.userId)
    return { success: false, error: "You can only edit your own comments." };

  const access = await loadCardForViewer(ctx, existing.card_id);
  if (!access.ok) return { success: false, error: access.error };

  const { data: row, error } = await supabaseAdmin
    .from("card_comments")
    .update({ content: trimmed, updated_at: new Date().toISOString() })
    .eq("id", commentId)
    .select("id, card_id, author_id, content, created_at, updated_at")
    .single();
  if (error || !row) {
    console.error("[updateCardComment] Update error:", error?.message);
    return { success: false, error: error?.message || "Couldn't save." };
  }
  const [comment] = await joinCommentAuthors([row]);
  revalidatePath(`/workspace/projects/${access.boardId}`);
  return { success: true, data: comment };
}

export async function deleteCardComment(
  commentId: string,
): Promise<ActionResult> {
  const ctx = await getAuthContext();
  if (!ctx) return { success: false, error: "Not authenticated." };

  const { data: existing } = await supabaseAdmin
    .from("card_comments")
    .select("id, card_id, author_id")
    .eq("id", commentId)
    .maybeSingle();
  if (!existing) return { success: false, error: "Comment not found." };
  if (existing.author_id !== ctx.userId && ctx.role !== "admin")
    return { success: false, error: "You can't delete this comment." };

  const access = await loadCardForViewer(ctx, existing.card_id);
  if (!access.ok) return { success: false, error: access.error };

  const { error } = await supabaseAdmin
    .from("card_comments")
    .delete()
    .eq("id", commentId);
  if (error) {
    console.error("[deleteCardComment] Delete error:", error.message);
    return { success: false, error: error.message };
  }
  revalidatePath(`/workspace/projects/${access.boardId}`);
  return { success: true };
}

// ─── Board labels ───────────────────────────────────────────

export async function getBoardLabels(
  boardId: string,
): Promise<ActionResult<(CardLabel & { usage_count: number })[]>> {
  const ctx = await getAuthContext();
  if (!ctx) return { success: false, error: "Not authenticated." };
  const access = await loadBoardForViewer(ctx, boardId);
  if (!access.ok) return { success: false, error: access.error };

  const [{ data: labels, error }, { data: junctions }] = await Promise.all([
    supabaseAdmin
      .from("card_labels")
      .select("id, board_id, name, color")
      .eq("board_id", boardId)
      .order("name", { ascending: true }),
    supabaseAdmin.from("board_card_labels").select("label_id"),
  ]);
  if (error) {
    console.error("[getBoardLabels] Select error:", error.message);
    return { success: false, error: error.message };
  }
  const counts = new Map<string, number>();
  (junctions ?? []).forEach((r: { label_id: string }) => {
    counts.set(r.label_id, (counts.get(r.label_id) ?? 0) + 1);
  });
  return {
    success: true,
    data: (labels ?? []).map((l) => ({
      ...l,
      usage_count: counts.get(l.id) ?? 0,
    })),
  };
}

export async function createBoardLabel(
  boardId: string,
  name: string,
  color: string,
): Promise<ActionResult<CardLabel>> {
  const ctx = await getAuthContext();
  if (!ctx) return { success: false, error: "Not authenticated." };
  const trimmed = name.trim();
  if (!trimmed) return { success: false, error: "Label name is required." };

  const access = await loadBoardForViewer(ctx, boardId);
  if (!access.ok) return { success: false, error: access.error };
  if (!access.canEdit)
    return { success: false, error: "You can't manage labels on this board." };

  const { data, error } = await supabaseAdmin
    .from("card_labels")
    .insert({ board_id: boardId, name: trimmed, color: color || "#5CE1A5" })
    .select("id, board_id, name, color")
    .single();
  if (error || !data) {
    // 23505 = unique violation on (board_id, name)
    if (error?.code === "23505")
      return { success: false, error: "A label with that name already exists." };
    console.error("[createBoardLabel] Insert error:", error?.message);
    return { success: false, error: error?.message || "Couldn't create label." };
  }
  return { success: true, data };
}

export async function updateBoardLabel(
  labelId: string,
  data: { name?: string; color?: string },
): Promise<ActionResult<CardLabel>> {
  const ctx = await getAuthContext();
  if (!ctx) return { success: false, error: "Not authenticated." };

  const { data: existing } = await supabaseAdmin
    .from("card_labels")
    .select("id, board_id")
    .eq("id", labelId)
    .maybeSingle();
  if (!existing) return { success: false, error: "Label not found." };

  const access = await loadBoardForViewer(ctx, existing.board_id);
  if (!access.ok) return { success: false, error: access.error };
  if (!access.canEdit)
    return { success: false, error: "You can't manage labels on this board." };

  const update: Record<string, unknown> = {};
  if (typeof data.name === "string" && data.name.trim())
    update.name = data.name.trim();
  if (typeof data.color === "string") update.color = data.color;
  if (Object.keys(update).length === 0)
    return { success: false, error: "Nothing to update." };

  const { data: row, error } = await supabaseAdmin
    .from("card_labels")
    .update(update)
    .eq("id", labelId)
    .select("id, board_id, name, color")
    .single();
  if (error || !row) {
    if (error?.code === "23505")
      return { success: false, error: "A label with that name already exists." };
    console.error("[updateBoardLabel] Update error:", error?.message);
    return { success: false, error: error?.message || "Couldn't save." };
  }
  return { success: true, data: row };
}

export async function deleteBoardLabel(
  labelId: string,
): Promise<ActionResult> {
  const ctx = await getAuthContext();
  if (!ctx) return { success: false, error: "Not authenticated." };

  const { data: existing } = await supabaseAdmin
    .from("card_labels")
    .select("id, board_id")
    .eq("id", labelId)
    .maybeSingle();
  if (!existing) return { success: false, error: "Label not found." };

  const access = await loadBoardForViewer(ctx, existing.board_id);
  if (!access.ok) return { success: false, error: access.error };
  if (!access.canEdit)
    return { success: false, error: "You can't manage labels on this board." };

  // FK ON DELETE CASCADE on board_card_labels.label_id handles the junction.
  const { error } = await supabaseAdmin
    .from("card_labels")
    .delete()
    .eq("id", labelId);
  if (error) {
    console.error("[deleteBoardLabel] Delete error:", error.message);
    return { success: false, error: error.message };
  }
  return { success: true };
}

export async function addCardLabel(
  cardId: string,
  labelId: string,
): Promise<ActionResult> {
  const ctx = await getAuthContext();
  if (!ctx) return { success: false, error: "Not authenticated." };

  const access = await loadCardForViewer(ctx, cardId);
  if (!access.ok) return { success: false, error: access.error };
  if (!access.canEdit)
    return { success: false, error: "You can't edit this card." };

  const { data: label } = await supabaseAdmin
    .from("card_labels")
    .select("id, board_id, name")
    .eq("id", labelId)
    .maybeSingle();
  if (!label || label.board_id !== access.boardId)
    return { success: false, error: "Label not found on this board." };

  const { error } = await supabaseAdmin
    .from("board_card_labels")
    .insert({ card_id: cardId, label_id: labelId });
  if (error) {
    if (error.code === "23505") return { success: true }; // already on card
    console.error("[addCardLabel] Insert error:", error.message);
    return { success: false, error: error.message };
  }

  recordCardActivity(cardId, ctx.userId, "label_added", {
    label_id: labelId,
    label_name: label.name,
  });
  await touchBoard(access.boardId);
  revalidatePath(`/workspace/projects/${access.boardId}`);
  return { success: true };
}

export async function removeCardLabel(
  cardId: string,
  labelId: string,
): Promise<ActionResult> {
  const ctx = await getAuthContext();
  if (!ctx) return { success: false, error: "Not authenticated." };

  const access = await loadCardForViewer(ctx, cardId);
  if (!access.ok) return { success: false, error: access.error };
  if (!access.canEdit)
    return { success: false, error: "You can't edit this card." };

  const { data: label } = await supabaseAdmin
    .from("card_labels")
    .select("name")
    .eq("id", labelId)
    .maybeSingle();

  const { error } = await supabaseAdmin
    .from("board_card_labels")
    .delete()
    .eq("card_id", cardId)
    .eq("label_id", labelId);
  if (error) {
    console.error("[removeCardLabel] Delete error:", error.message);
    return { success: false, error: error.message };
  }

  recordCardActivity(cardId, ctx.userId, "label_removed", {
    label_id: labelId,
    label_name: label?.name,
  });
  await touchBoard(access.boardId);
  revalidatePath(`/workspace/projects/${access.boardId}`);
  return { success: true };
}

// ─── Activity ───────────────────────────────────────────────

export async function getCardActivity(
  cardId: string,
  limit: number = 20,
): Promise<ActionResult<CardActivityEntry[]>> {
  const ctx = await getAuthContext();
  if (!ctx) return { success: false, error: "Not authenticated." };
  const access = await loadCardForViewer(ctx, cardId);
  if (!access.ok) return { success: false, error: access.error };

  const { data, error } = await supabaseAdmin
    .from("card_activity")
    .select("id, card_id, actor_id, action_type, metadata, created_at")
    .eq("card_id", cardId)
    .order("created_at", { ascending: false })
    .limit(Math.min(Math.max(1, limit), 200));
  if (error) {
    console.error("[getCardActivity] Select error:", error.message);
    return { success: false, error: error.message };
  }
  if (!data || data.length === 0) return { success: true, data: [] };

  const actorIds = Array.from(new Set(data.map((r) => r.actor_id)));
  const { data: profiles } = await supabaseAdmin
    .from("profiles")
    .select("id, full_name, avatar_color, role")
    .in("id", actorIds);
  const byId = new Map<string, CommentAuthor>();
  (profiles ?? []).forEach(
    (p: { id: string; full_name: string | null; avatar_color: string | null; role: Role | null }) => {
      byId.set(p.id, {
        id: p.id,
        full_name: p.full_name || "Teammate",
        avatar_color: p.avatar_color || "#5CE1A5",
        role: p.role ?? null,
      });
    },
  );

  const entries: CardActivityEntry[] = data.map((r) => ({
    id: r.id,
    card_id: r.card_id,
    actor_id: r.actor_id,
    action_type: r.action_type as CardActivityActionType,
    metadata: (r.metadata as Record<string, unknown>) ?? {},
    created_at: r.created_at,
    actor: byId.get(r.actor_id) ?? null,
  }));
  return { success: true, data: entries };
}

// ─── getCard (full detail) ──────────────────────────────────

export async function getCard(
  cardId: string,
): Promise<ActionResult<CardDetail>> {
  const ctx = await getAuthContext();
  if (!ctx) return { success: false, error: "Not authenticated." };

  const { data: cardRow, error: cardErr } = await supabaseAdmin
    .from("board_cards")
    .select(
      "id, board_id, column_id, title, description, cover_color, due_date, assigned_to, position, is_completed, created_by, created_at, updated_at",
    )
    .eq("id", cardId)
    .maybeSingle();
  if (cardErr || !cardRow) {
    if (cardErr) console.error("[getCard] Select error:", cardErr.message);
    return { success: false, error: "Card not found." };
  }

  const access = await loadBoardForViewer(ctx, cardRow.board_id);
  if (!access.ok) return { success: false, error: access.error };

  // Parallel fan-out of everything the detail panel renders.
  const [
    boardRes,
    columnRes,
    labelsRes,
    checklistRes,
    commentsRes,
    activityRes,
    profilesRes,
  ] = await Promise.all([
    supabaseAdmin
      .from("boards")
      .select("id, name")
      .eq("id", cardRow.board_id)
      .single(),
    supabaseAdmin
      .from("board_columns")
      .select("id, name, color")
      .eq("id", cardRow.column_id)
      .single(),
    supabaseAdmin
      .from("board_card_labels")
      .select("label_id, card_labels(id, board_id, name, color)")
      .eq("card_id", cardId),
    supabaseAdmin
      .from("card_checklist_items")
      .select(
        "id, card_id, title, is_completed, position, completed_at, created_at",
      )
      .eq("card_id", cardId)
      .order("position", { ascending: true }),
    supabaseAdmin
      .from("card_comments")
      .select("id, card_id, author_id, content, created_at, updated_at")
      .eq("card_id", cardId)
      .order("created_at", { ascending: true }),
    supabaseAdmin
      .from("card_activity")
      .select("id, card_id, actor_id, action_type, metadata, created_at")
      .eq("card_id", cardId)
      .order("created_at", { ascending: false })
      .limit(20),
    // Pre-fetch the assignee + creator profiles in a single query.
    supabaseAdmin
      .from("profiles")
      .select("id, full_name, avatar_color, role")
      .in(
        "id",
        Array.from(
          new Set(
            [cardRow.assigned_to, cardRow.created_by].filter(
              (v): v is string => !!v,
            ),
          ),
        ),
      ),
  ]);

  const profileById = new Map<string, CommentAuthor>();
  (profilesRes.data ?? []).forEach(
    (p: { id: string; full_name: string | null; avatar_color: string | null; role: Role | null }) => {
      profileById.set(p.id, {
        id: p.id,
        full_name: p.full_name || "Teammate",
        avatar_color: p.avatar_color || "#5CE1A5",
        role: p.role ?? null,
      });
    },
  );

  const labels: CardLabel[] = (labelsRes.data ?? [])
    .map(
      (j: { card_labels: CardLabel | CardLabel[] | null }) =>
        // PostgREST returns an array when the FK is one-to-many shaped; in
        // our case it's one-to-one so we take the first element if any.
        (Array.isArray(j.card_labels) ? j.card_labels[0] : j.card_labels) ??
        null,
    )
    .filter((l): l is CardLabel => !!l)
    .sort((a, b) => a.name.localeCompare(b.name));

  const comments = await joinCommentAuthors(commentsRes.data ?? []);

  // Activity actor join: pull the missing actor profiles for activity rows
  // not already in `profileById` (assignee/creator).
  const missingActorIds = Array.from(
    new Set(
      (activityRes.data ?? [])
        .map((r) => r.actor_id)
        .filter((id) => !profileById.has(id)),
    ),
  );
  if (missingActorIds.length > 0) {
    const { data: extra } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, avatar_color, role")
      .in("id", missingActorIds);
    (extra ?? []).forEach(
      (p: { id: string; full_name: string | null; avatar_color: string | null; role: Role | null }) => {
        profileById.set(p.id, {
          id: p.id,
          full_name: p.full_name || "Teammate",
          avatar_color: p.avatar_color || "#5CE1A5",
          role: p.role ?? null,
        });
      },
    );
  }

  const activity: CardActivityEntry[] = (activityRes.data ?? []).map((r) => ({
    id: r.id,
    card_id: r.card_id,
    actor_id: r.actor_id,
    action_type: r.action_type as CardActivityActionType,
    metadata: (r.metadata as Record<string, unknown>) ?? {},
    created_at: r.created_at,
    actor: profileById.get(r.actor_id) ?? null,
  }));

  const board = boardRes.data ?? { id: cardRow.board_id, name: "Board" };
  const column = columnRes.data ?? {
    id: cardRow.column_id,
    name: "Column",
    color: "#9CA3AF",
  };

  const canDelete = access.canDelete || cardRow.created_by === ctx.userId;

  return {
    success: true,
    data: {
      ...cardRow,
      assignee: cardRow.assigned_to
        ? profileById.get(cardRow.assigned_to) ?? null
        : null,
      creator: profileById.get(cardRow.created_by) ?? null,
      column,
      board,
      labels,
      checklist_items: (checklistRes.data ?? []) as ChecklistItem[],
      comments,
      activity,
      viewer_can_edit: access.canEdit,
      viewer_can_delete: canDelete,
    } as CardDetail,
  };
}

// ─── Helper: bump board.updated_at ──────────────────────────
async function touchBoard(boardId: string) {
  await supabaseAdmin
    .from("boards")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", boardId);
}
