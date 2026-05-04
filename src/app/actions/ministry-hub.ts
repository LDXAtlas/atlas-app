"use server";

import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getRoleFromProfile } from "@/lib/permissions";
import type { Role } from "@/lib/permissions";
import {
  canAccessMinistry,
  type AccessibleDepartment,
} from "@/lib/ministry-access";

// ─── Types ─────────────────────────────────────────────────
export type MinistryLeadLine =
  | { kind: "announcement"; actor: string; title: string; at: string }
  | { kind: "task"; title: string; due_date: string }
  | { kind: "event"; title: string; starts_at: string; is_all_day: boolean }
  | { kind: "leader"; name: string }
  | { kind: "empty" };

export type MinistryRecentActivityItem =
  | { kind: "announcement"; title: string; actor: string; at: string }
  | { kind: "task"; title: string; due_date: string | null; at: string }
  | { kind: "event"; title: string; starts_at: string; is_all_day: boolean };

export type MinistryTileData = AccessibleDepartment & {
  unread_announcements: number;
  open_tasks: number;
  upcoming_events: number;
  lead_line: MinistryLeadLine;
  user_role_in_ministry: "primary" | "secondary" | null;
  recent_activity: MinistryRecentActivityItem[];
};

export type MinistryOverview = {
  role: Role;
  organizationId: string | null;
  myMinistries: MinistryTileData[];
  allMinistries: MinistryTileData[];
  hasAnyDepartments: boolean;
};

export type MinistryDetailAnnouncement = {
  id: string;
  title: string;
  content: string;
  category: string;
  is_pinned: boolean;
  published_at: string;
  author_name: string;
  cover_image_url: string | null;
  is_read: boolean;
  is_org_wide: boolean;
};

export type MinistryDetailEvent = {
  id: string;
  title: string;
  starts_at: string;
  ends_at: string | null;
  is_all_day: boolean;
  location: string | null;
  color: string;
  event_type: string;
};

export type MinistryDetailTask = {
  id: string;
  title: string;
  status: "todo" | "in_progress" | "done" | "blocked";
  priority: "low" | "medium" | "high" | "urgent";
  due_date: string | null;
  assigned_to: string | null;
  assigned_to_name: string | null;
  created_at: string;
};

export type MinistryDetailMember = {
  profile_id: string;
  full_name: string;
  email: string | null;
  avatar_url: string | null;
  role: Role;
  is_primary: boolean;
};

export type MinistryDetail = {
  department: AccessibleDepartment;
  viewerRole: Role;
  organizationId: string;
  announcements: MinistryDetailAnnouncement[];
  totalAnnouncements: number;
  events: MinistryDetailEvent[];
  tasks: MinistryDetailTask[];
  taskCounts: { todo: number; in_progress: number; blocked: number; done: number };
  team: MinistryDetailMember[];
  weeklyActivity: { posts: number; tasksCompleted: number; eventsHeld: number };
};

// ─── Auth helper ───────────────────────────────────────────
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

// ─── Overview data ─────────────────────────────────────────
export async function getMinistryOverviewData(): Promise<MinistryOverview> {
  const ctx = await getAuthContext();
  if (!ctx) {
    return {
      role: "member",
      organizationId: null,
      myMinistries: [],
      allMinistries: [],
      hasAnyDepartments: false,
    };
  }

  const { userId, organizationId, role } = ctx;

  // Members and volunteers are redirected from the page; this guard keeps the
  // server action shape consistent if it's invoked elsewhere.
  if (role === "member" || role === "volunteer") {
    return {
      role,
      organizationId,
      myMinistries: [],
      allMinistries: [],
      hasAnyDepartments: false,
    };
  }

  // Fetch ALL org departments — admin / staff / leader can browse them all.
  const { data: deptRows } = await supabaseAdmin
    .from("departments")
    .select("id, name, color, icon, description, member_count, hub_enabled, leader_id")
    .eq("organization_id", organizationId)
    .order("name", { ascending: true });

  const allDepts = (deptRows ?? []).map(
    (d: {
      id: string;
      name: string;
      color: string | null;
      icon: string | null;
      description: string | null;
      member_count: number | null;
      hub_enabled: boolean | null;
      leader_id: string | null;
    }) => ({
      id: d.id,
      name: d.name,
      color: d.color || "#5CE1A5",
      icon: d.icon || "Building",
      description: d.description,
      member_count: d.member_count ?? 0,
      hub_enabled: d.hub_enabled ?? false,
      leader_id: d.leader_id,
    }),
  );

  const hasAnyDepartments = allDepts.length > 0;
  if (!hasAnyDepartments) {
    return {
      role,
      organizationId,
      myMinistries: [],
      allMinistries: [],
      hasAnyDepartments: false,
    };
  }

  const allDeptIds = allDepts.map((d) => d.id);

  // Which of these are "mine"?
  const { data: myAssignmentRows } = await supabaseAdmin
    .from("profile_departments")
    .select("department_id, is_primary")
    .eq("profile_id", userId);
  const userRoleByDept = new Map<string, "primary" | "secondary">();
  (myAssignmentRows ?? []).forEach(
    (a: { department_id: string; is_primary: boolean }) => {
      userRoleByDept.set(a.department_id, a.is_primary ? "primary" : "secondary");
    },
  );

  // All assignments — used for member counts on every tile.
  const { data: allAssignmentRows } = await supabaseAdmin
    .from("profile_departments")
    .select("profile_id, department_id, is_primary")
    .in("department_id", allDeptIds);
  const assignmentRows = allAssignmentRows ?? [];

  const now = new Date();
  const weekOut = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const leaderIdByDept = new Map<string, string | null>();
  allDepts.forEach((d) => leaderIdByDept.set(d.id, d.leader_id));

  // Per-ministry tile data — fetch counts, lead-line, and recent_activity in parallel
  const tiles: MinistryTileData[] = await Promise.all(
    allDepts.map(async (dept) => {
      const [
        annListRes,
        taskCountRes,
        eventCountRes,
        nextTaskRes,
        nextEventRes,
        latestTaskRes,
      ] = await Promise.all([
        // Recent announcements targeted to this dept (also used to compute unread)
        supabaseAdmin
          .from("announcements")
          .select("id, title, author_id, published_at")
          .eq("organization_id", organizationId)
          .eq("is_published", true)
          .eq("target_department_id", dept.id)
          .order("published_at", { ascending: false })
          .limit(10),
        supabaseAdmin
          .from("tasks")
          .select("id", { count: "exact", head: true })
          .eq("organization_id", organizationId)
          .eq("department_id", dept.id)
          .neq("status", "done"),
        supabaseAdmin
          .from("events")
          .select("id", { count: "exact", head: true })
          .eq("organization_id", organizationId)
          .eq("department_id", dept.id)
          .gte("starts_at", now.toISOString())
          .lte("starts_at", weekOut.toISOString())
          .neq("status", "cancelled"),
        // Next open task with a due date within the next 7 days
        supabaseAdmin
          .from("tasks")
          .select("id, title, due_date")
          .eq("organization_id", organizationId)
          .eq("department_id", dept.id)
          .neq("status", "done")
          .not("due_date", "is", null)
          .gte("due_date", new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString())
          .lte("due_date", weekOut.toISOString())
          .order("due_date", { ascending: true })
          .limit(1),
        // Next upcoming event (any time in the future, not just 7 days — for the
        // lead line we want to surface what's coming up even if it's a few weeks out)
        supabaseAdmin
          .from("events")
          .select("id, title, starts_at, is_all_day")
          .eq("organization_id", organizationId)
          .eq("department_id", dept.id)
          .gte("starts_at", now.toISOString())
          .neq("status", "cancelled")
          .order("starts_at", { ascending: true })
          .limit(1),
        // Latest task (any state) — used in the hover-preview recent activity list
        supabaseAdmin
          .from("tasks")
          .select("id, title, due_date, created_at")
          .eq("organization_id", organizationId)
          .eq("department_id", dept.id)
          .order("created_at", { ascending: false })
          .limit(1),
      ]);

      const annRows = annListRes.data ?? [];
      const annIds = annRows.map((a: { id: string }) => a.id);
      const readSet = new Set<string>();
      if (annIds.length > 0) {
        const { data: reads } = await supabaseAdmin
          .from("announcement_reads")
          .select("announcement_id")
          .eq("user_id", userId)
          .in("announcement_id", annIds);
        (reads ?? []).forEach((r: { announcement_id: string }) =>
          readSet.add(r.announcement_id),
        );
      }
      const unread = annIds.filter((id) => !readSet.has(id)).length;

      // Resolve any actor names we'll need (top unread announcement + leader)
      const topUnread = annRows.find(
        (a: { id: string }) => !readSet.has(a.id),
      ) as
        | { id: string; title: string; author_id: string | null; published_at: string }
        | undefined;
      const leaderId = leaderIdByDept.get(dept.id) ?? null;
      // Fallback: first primary-assigned profile in this dept
      const fallbackLeaderId = leaderId
        ? null
        : assignmentRows.find(
            (a) => a.department_id === dept.id && a.is_primary,
          )?.profile_id ?? null;

      const actorIds = new Set<string>();
      if (topUnread?.author_id) actorIds.add(topUnread.author_id);
      if (leaderId) actorIds.add(leaderId);
      if (fallbackLeaderId) actorIds.add(fallbackLeaderId);

      let actorMap: Record<string, string> = {};
      if (actorIds.size > 0) {
        const { data: actors } = await supabaseAdmin
          .from("profiles")
          .select("id, full_name")
          .in("id", Array.from(actorIds));
        actorMap = (actors ?? []).reduce(
          (
            acc: Record<string, string>,
            p: { id: string; full_name: string | null },
          ) => {
            acc[p.id] = p.full_name || "Someone";
            return acc;
          },
          {},
        );
      }

      // Lead-line priority: unread announcement → next due task → next event → leader → fallback
      let leadLine: MinistryLeadLine = { kind: "empty" };
      if (topUnread) {
        leadLine = {
          kind: "announcement",
          actor: topUnread.author_id
            ? actorMap[topUnread.author_id] || "Someone"
            : "Someone",
          title: topUnread.title,
          at: topUnread.published_at,
        };
      } else if ((nextTaskRes.data ?? []).length > 0) {
        const t = nextTaskRes.data![0] as {
          title: string;
          due_date: string;
        };
        leadLine = { kind: "task", title: t.title, due_date: t.due_date };
      } else if ((nextEventRes.data ?? []).length > 0) {
        const e = nextEventRes.data![0] as {
          title: string;
          starts_at: string;
          is_all_day: boolean;
        };
        leadLine = {
          kind: "event",
          title: e.title,
          starts_at: e.starts_at,
          is_all_day: e.is_all_day,
        };
      } else {
        const resolvedLeaderId = leaderId ?? fallbackLeaderId;
        if (resolvedLeaderId && actorMap[resolvedLeaderId]) {
          leadLine = { kind: "leader", name: actorMap[resolvedLeaderId] };
        }
      }

      const memberCount = new Set(
        assignmentRows
          .filter((a) => a.department_id === dept.id)
          .map((a) => a.profile_id),
      ).size;

      // Build recent_activity for the hover preview — at most one of each kind
      const recentActivity: MinistryRecentActivityItem[] = [];
      const latestAnnouncement = annRows[0] as
        | { title: string; author_id: string | null; published_at: string }
        | undefined;
      if (latestAnnouncement) {
        // Author may not be in actorMap yet (we only added top-unread + leaders)
        let actor = "Someone";
        if (latestAnnouncement.author_id) {
          if (actorMap[latestAnnouncement.author_id]) {
            actor = actorMap[latestAnnouncement.author_id];
          } else {
            const { data: a } = await supabaseAdmin
              .from("profiles")
              .select("full_name")
              .eq("id", latestAnnouncement.author_id)
              .maybeSingle();
            actor = a?.full_name || "Someone";
          }
        }
        recentActivity.push({
          kind: "announcement",
          title: latestAnnouncement.title,
          actor,
          at: latestAnnouncement.published_at,
        });
      }
      const latestTask = (latestTaskRes.data ?? [])[0] as
        | { title: string; due_date: string | null; created_at: string }
        | undefined;
      if (latestTask) {
        recentActivity.push({
          kind: "task",
          title: latestTask.title,
          due_date: latestTask.due_date,
          at: latestTask.created_at,
        });
      }
      const nextEvent = (nextEventRes.data ?? [])[0] as
        | { title: string; starts_at: string; is_all_day: boolean }
        | undefined;
      if (nextEvent) {
        recentActivity.push({
          kind: "event",
          title: nextEvent.title,
          starts_at: nextEvent.starts_at,
          is_all_day: nextEvent.is_all_day,
        });
      }

      const userRoleInMinistry = userRoleByDept.get(dept.id) ?? null;

      // Strip leader_id from the dept payload (it's a server-only field).
      const { leader_id: _leader, ...publicDept } = dept;
      void _leader;

      return {
        ...publicDept,
        member_count: memberCount,
        unread_announcements: unread,
        open_tasks: taskCountRes.count ?? 0,
        upcoming_events: eventCountRes.count ?? 0,
        lead_line: leadLine,
        user_role_in_ministry: userRoleInMinistry,
        recent_activity: recentActivity,
      };
    }),
  );

  // Split into my (assigned) and all (everything else); sort each.
  const myMinistries = tiles
    .filter((t) => t.user_role_in_ministry !== null)
    .sort((a, b) => {
      // Primary first, then secondary, then alphabetical.
      const rank = (r: "primary" | "secondary" | null) =>
        r === "primary" ? 0 : r === "secondary" ? 1 : 2;
      const diff = rank(a.user_role_in_ministry) - rank(b.user_role_in_ministry);
      if (diff !== 0) return diff;
      return a.name.localeCompare(b.name);
    });
  const allMinistries = tiles
    .filter((t) => t.user_role_in_ministry === null)
    .sort((a, b) => a.name.localeCompare(b.name));

  return {
    role,
    organizationId,
    myMinistries,
    allMinistries,
    hasAnyDepartments,
  };
}

// ─── Detail data ───────────────────────────────────────────
export async function getMinistryDetailData(
  departmentId: string,
): Promise<{ data: MinistryDetail | null; error?: string }> {
  const ctx = await getAuthContext();
  if (!ctx) return { data: null, error: "Not authenticated" };

  const { userId, organizationId, role } = ctx;

  const allowed = await canAccessMinistry(userId, role, organizationId, departmentId);
  if (!allowed) return { data: null, error: "You don't have access to this ministry." };

  const { data: deptRow } = await supabaseAdmin
    .from("departments")
    .select("id, name, color, icon, description, member_count, hub_enabled")
    .eq("id", departmentId)
    .eq("organization_id", organizationId)
    .single();
  if (!deptRow) return { data: null, error: "Ministry not found." };

  const department: AccessibleDepartment = {
    id: deptRow.id,
    name: deptRow.name,
    color: deptRow.color || "#5CE1A5",
    icon: deptRow.icon || "Building",
    description: deptRow.description,
    member_count: deptRow.member_count ?? 0,
    hub_enabled: deptRow.hub_enabled ?? false,
  };

  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [
    announcementsRes,
    annTotalRes,
    eventsRes,
    tasksRes,
    taskCountRes,
    teamRes,
    weeklyAnnRes,
    weeklyTasksDoneRes,
    weeklyEventsRes,
  ] = await Promise.all([
    // Recent announcements: targeted to this dept OR org-wide
    supabaseAdmin
      .from("announcements")
      .select(
        "id, title, content, category, is_pinned, published_at, author_id, target_department_id, cover_image_url",
      )
      .eq("organization_id", organizationId)
      .eq("is_published", true)
      .or(`target_department_id.eq.${departmentId},target_department_id.is.null`)
      .order("is_pinned", { ascending: false })
      .order("published_at", { ascending: false })
      .limit(5),
    supabaseAdmin
      .from("announcements")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("is_published", true)
      .or(`target_department_id.eq.${departmentId},target_department_id.is.null`),
    supabaseAdmin
      .from("events")
      .select(
        "id, title, starts_at, ends_at, is_all_day, location, color, event_type, status",
      )
      .eq("organization_id", organizationId)
      .eq("department_id", departmentId)
      .gte("starts_at", now.toISOString())
      .neq("status", "cancelled")
      .order("starts_at", { ascending: true })
      .limit(5),
    supabaseAdmin
      .from("tasks")
      .select(
        "id, title, status, priority, due_date, assigned_to, created_at",
      )
      .eq("organization_id", organizationId)
      .eq("department_id", departmentId)
      .neq("status", "done")
      .order("due_date", { ascending: true, nullsFirst: false })
      .limit(8),
    supabaseAdmin
      .from("tasks")
      .select("id, status")
      .eq("organization_id", organizationId)
      .eq("department_id", departmentId),
    supabaseAdmin
      .from("profile_departments")
      .select("profile_id, is_primary")
      .eq("department_id", departmentId),
    supabaseAdmin
      .from("announcements")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("is_published", true)
      .eq("target_department_id", departmentId)
      .gte("published_at", weekAgo.toISOString()),
    supabaseAdmin
      .from("tasks")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("department_id", departmentId)
      .eq("status", "done")
      .gte("completed_at", weekAgo.toISOString()),
    supabaseAdmin
      .from("events")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("department_id", departmentId)
      .lte("starts_at", now.toISOString())
      .gte("starts_at", weekAgo.toISOString())
      .neq("status", "cancelled"),
  ]);

  // Resolve author + assignee names
  const annRows = announcementsRes.data ?? [];
  const taskRows = tasksRes.data ?? [];
  const teamRows = teamRes.data ?? [];

  const actorIds = new Set<string>();
  annRows.forEach((a: { author_id: string }) => actorIds.add(a.author_id));
  taskRows.forEach((t: { assigned_to: string | null }) => {
    if (t.assigned_to) actorIds.add(t.assigned_to);
  });
  teamRows.forEach((m: { profile_id: string }) => actorIds.add(m.profile_id));

  let profileMap: Record<
    string,
    { full_name: string; email: string | null; role: Role; avatar_url: string | null }
  > = {};
  if (actorIds.size > 0) {
    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, email, role, avatar_url")
      .in("id", Array.from(actorIds));
    const allowedRoles: Role[] = ["admin", "staff", "leader", "volunteer", "member"];
    profileMap = (profiles ?? []).reduce(
      (
        acc: typeof profileMap,
        p: {
          id: string;
          full_name: string | null;
          email: string | null;
          role: string | null;
          avatar_url: string | null;
        },
      ) => {
        acc[p.id] = {
          full_name: p.full_name || p.email?.split("@")[0] || "Unnamed",
          email: p.email,
          role: allowedRoles.includes((p.role || "") as Role)
            ? (p.role as Role)
            : "member",
          avatar_url: p.avatar_url,
        };
        return acc;
      },
      {} as typeof profileMap,
    );
  }

  // Read status for the recent announcements
  const readSet = new Set<string>();
  if (annRows.length > 0) {
    const { data: reads } = await supabaseAdmin
      .from("announcement_reads")
      .select("announcement_id")
      .eq("user_id", userId)
      .in(
        "announcement_id",
        annRows.map((a: { id: string }) => a.id),
      );
    (reads ?? []).forEach((r: { announcement_id: string }) =>
      readSet.add(r.announcement_id),
    );
  }

  const announcements: MinistryDetailAnnouncement[] = annRows.map(
    (a: {
      id: string;
      title: string;
      content: string;
      category: string;
      is_pinned: boolean;
      published_at: string;
      author_id: string;
      target_department_id: string | null;
      cover_image_url: string | null;
    }) => ({
      id: a.id,
      title: a.title,
      content: a.content,
      category: a.category || "general",
      is_pinned: a.is_pinned,
      published_at: a.published_at,
      author_name: profileMap[a.author_id]?.full_name || "Unknown",
      cover_image_url: a.cover_image_url,
      is_read: readSet.has(a.id),
      is_org_wide: !a.target_department_id,
    }),
  );

  const events: MinistryDetailEvent[] = (eventsRes.data ?? []).map(
    (e: {
      id: string;
      title: string;
      starts_at: string;
      ends_at: string | null;
      is_all_day: boolean;
      location: string | null;
      color: string | null;
      event_type: string;
    }) => ({
      id: e.id,
      title: e.title,
      starts_at: e.starts_at,
      ends_at: e.ends_at,
      is_all_day: e.is_all_day,
      location: e.location,
      color: e.color || "#5CE1A5",
      event_type: e.event_type,
    }),
  );

  const tasks: MinistryDetailTask[] = taskRows.map(
    (t: {
      id: string;
      title: string;
      status: string;
      priority: string;
      due_date: string | null;
      assigned_to: string | null;
      created_at: string;
    }) => ({
      id: t.id,
      title: t.title,
      status: t.status as MinistryDetailTask["status"],
      priority: t.priority as MinistryDetailTask["priority"],
      due_date: t.due_date,
      assigned_to: t.assigned_to,
      assigned_to_name: t.assigned_to
        ? profileMap[t.assigned_to]?.full_name || null
        : null,
      created_at: t.created_at,
    }),
  );

  const taskCounts = (taskCountRes.data ?? []).reduce(
    (acc, row: { status: string }) => {
      const k = row.status as keyof typeof acc;
      if (k in acc) acc[k] += 1;
      return acc;
    },
    { todo: 0, in_progress: 0, blocked: 0, done: 0 },
  );

  const team: MinistryDetailMember[] = teamRows
    .map((m: { profile_id: string; is_primary: boolean }) => {
      const p = profileMap[m.profile_id];
      if (!p) return null;
      return {
        profile_id: m.profile_id,
        full_name: p.full_name,
        email: p.email,
        avatar_url: p.avatar_url,
        role: p.role,
        is_primary: m.is_primary,
      };
    })
    .filter((x): x is MinistryDetailMember => x !== null)
    .sort((a, b) => {
      if (a.is_primary !== b.is_primary) return a.is_primary ? -1 : 1;
      return a.full_name.localeCompare(b.full_name);
    });

  return {
    data: {
      department,
      viewerRole: role,
      organizationId,
      announcements,
      totalAnnouncements: annTotalRes.count ?? 0,
      events,
      tasks,
      taskCounts,
      team,
      weeklyActivity: {
        posts: weeklyAnnRes.count ?? 0,
        tasksCompleted: weeklyTasksDoneRes.count ?? 0,
        eventsHeld: weeklyEventsRes.count ?? 0,
      },
    },
  };
}
