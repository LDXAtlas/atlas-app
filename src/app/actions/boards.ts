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
      is_starred: isCreator || isMember,
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

  const { data: card } = await supabaseAdmin
    .from("board_cards")
    .select("board_id")
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
    .select("id, board_id")
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

// ─── Helper: bump board.updated_at ──────────────────────────
async function touchBoard(boardId: string) {
  await supabaseAdmin
    .from("boards")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", boardId);
}
