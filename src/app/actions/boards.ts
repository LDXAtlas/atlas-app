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

// ─── getBoard ───────────────────────────────────────────────
//
// Phase 1 only needs minimal board metadata for things like the redirect
// flow after createBoard. Full single-board view (columns + cards) lands
// in Phase 2.
export async function getBoard(
  id: string,
): Promise<{ data: BoardSummary | null; error?: string }> {
  const { data, error } = await getBoards({ includeArchived: true });
  if (error) return { data: null, error };
  const found = data.find((b) => b.id === id);
  return { data: found ?? null };
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
