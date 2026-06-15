"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getRoleFromProfile } from "@/lib/permissions";
import type { Role } from "@/lib/permissions";

// ─── Types ────────────────────────────────────────────────

export type HuddleStatus =
  | "scheduled"
  | "in_progress"
  | "completed"
  | "processing"
  | "ready"
  | "archived";

export type HuddleVisibility =
  | "organization"
  | "department"
  | "invitees_only"
  | "private";

export type HuddleMeetingSource =
  | "in_person"
  | "external_video_link"
  | "uploaded_recording"
  | "zoom_native"
  | "meet_native"
  | "teams_native"
  | "atlas_video";

export type AttendeeRole = "organizer" | "presenter" | "attendee" | "optional";

export type ActionResult<T = unknown> =
  | { success: true; data?: T }
  | { success: false; error: string; code?: string };

export type HuddleListItem = {
  id: string;
  title: string;
  description: string | null;
  scheduled_start: string | null;
  scheduled_end: string | null;
  actual_start: string | null;
  actual_end: string | null;
  meeting_source: HuddleMeetingSource;
  external_meeting_url: string | null;
  location: string | null;
  status: HuddleStatus;
  visibility: HuddleVisibility;
  department_id: string | null;
  created_by: string;
  created_at: string;
  attendee_count: number;
  agenda_count: number;
  action_item_count: number;
};

export type ProfileLite = {
  id: string;
  full_name: string;
  avatar_color: string;
  role: Role | null;
};

export type HuddleAttendee = {
  id: string;
  huddle_id: string;
  profile_id: string | null;
  member_id: string | null;
  role: AttendeeRole;
  attended: boolean;
  attended_at: string | null;
  profile: ProfileLite | null;
};

export type HuddleAgendaItem = {
  id: string;
  huddle_id: string;
  title: string;
  description: string | null;
  estimated_minutes: number | null;
  presenter_id: string | null;
  position: number;
  is_completed: boolean;
  presenter: ProfileLite | null;
};

export type HuddleNotes = {
  huddle_id: string;
  content: string;
  last_edited_by: string | null;
  last_edited_at: string | null;
  editor: ProfileLite | null;
};

export type HuddleDecision = {
  id: string;
  huddle_id: string;
  decision: string;
  context: string | null;
  decided_by: string | null;
  source: "manual" | "ai_extracted";
  created_at: string;
  decider: ProfileLite | null;
};

export type HuddleActionItem = {
  id: string;
  huddle_id: string;
  task_id: string | null;
  description: string;
  suggested_assignee_id: string | null;
  suggested_due_date: string | null;
  source: "manual" | "ai_extracted";
  status: "pending" | "accepted" | "rejected";
  created_at: string;
  assignee: ProfileLite | null;
  task_status: string | null;
};

export type HuddleDetail = HuddleListItem & {
  attendees: HuddleAttendee[];
  agenda: HuddleAgendaItem[];
  notes: HuddleNotes | null;
  decisions: HuddleDecision[];
  action_items: HuddleActionItem[];
  // Recording / transcript / summary remain empty until Phase 2.
  recordings: { id: string; storage_path: string; duration_seconds: number | null }[];
  transcripts: { id: string; content: string | null; language: string | null }[];
  summaries: { id: string; summary: string | null; model: string | null }[];
  viewer_can_edit: boolean;
  viewer_can_manage: boolean;
};

// ─── Auth helper ──────────────────────────────────────────

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

// ─── Access helpers ───────────────────────────────────────

async function loadHuddleForViewer(
  ctx: { userId: string; organizationId: string; role: Role },
  huddleId: string,
): Promise<
  | {
      ok: true;
      huddle: {
        id: string;
        organization_id: string;
        created_by: string;
        visibility: HuddleVisibility;
        department_id: string | null;
        status: HuddleStatus;
      };
      canEdit: boolean;
      canManage: boolean;
      isAttendee: boolean;
    }
  | { ok: false; error: string }
> {
  const { data: huddle } = await supabaseAdmin
    .from("huddles")
    .select(
      "id, organization_id, created_by, visibility, department_id, status",
    )
    .eq("id", huddleId)
    .maybeSingle();
  if (!huddle || huddle.organization_id !== ctx.organizationId)
    return { ok: false, error: "Huddle not found." };

  // Resolve attendance + department membership once. Used by both the
  // access check and the canEdit decision (any attendee can edit notes).
  const [{ data: attendance }, { data: deptRows }] = await Promise.all([
    supabaseAdmin
      .from("huddle_attendees")
      .select("id")
      .eq("huddle_id", huddleId)
      .eq("profile_id", ctx.userId)
      .maybeSingle(),
    supabaseAdmin
      .from("profile_departments")
      .select("department_id")
      .eq("profile_id", ctx.userId),
  ]);
  const myDepartments = new Set(
    (deptRows ?? []).map((r: { department_id: string }) => r.department_id),
  );
  const isAttendee = !!attendance;

  // Visibility gate.
  let canSee = false;
  if (huddle.visibility === "organization") canSee = true;
  else if (huddle.created_by === ctx.userId) canSee = true;
  else if (isAttendee) canSee = true;
  else if (
    huddle.visibility === "department" &&
    huddle.department_id &&
    myDepartments.has(huddle.department_id)
  )
    canSee = true;
  if (!canSee) return { ok: false, error: "Huddle not found." };

  // canManage = organizer or admin. canEdit = manage OR an attendee
  // (so any invitee can take notes / add agenda / log decisions).
  const canManage =
    huddle.created_by === ctx.userId || ctx.role === "admin";
  const canEdit = canManage || isAttendee;

  return {
    ok: true,
    huddle: huddle as {
      id: string;
      organization_id: string;
      created_by: string;
      visibility: HuddleVisibility;
      department_id: string | null;
      status: HuddleStatus;
    },
    canEdit,
    canManage,
    isAttendee,
  };
}

// Batched profile hydration for attendee / presenter / assignee joins.
async function hydrateProfiles(
  ids: (string | null | undefined)[],
): Promise<Map<string, ProfileLite>> {
  const unique = Array.from(
    new Set(ids.filter((v): v is string => !!v)),
  );
  const result = new Map<string, ProfileLite>();
  if (unique.length === 0) return result;
  const { data } = await supabaseAdmin
    .from("profiles")
    .select("id, full_name, avatar_color, role")
    .in("id", unique);
  (data ?? []).forEach(
    (p: {
      id: string;
      full_name: string | null;
      avatar_color: string | null;
      role: Role | null;
    }) => {
      result.set(p.id, {
        id: p.id,
        full_name: p.full_name || "Teammate",
        avatar_color: p.avatar_color || "#5CE1A5",
        role: p.role ?? null,
      });
    },
  );
  return result;
}

// ─── Huddle CRUD ──────────────────────────────────────────

export interface CreateHuddleInput {
  title: string;
  description?: string;
  scheduledStart?: string | null;
  scheduledEnd?: string | null;
  timezone?: string;
  meetingSource?: HuddleMeetingSource;
  externalMeetingUrl?: string | null;
  location?: string | null;
  departmentId?: string | null;
  visibility?: HuddleVisibility;
  attendeeIds?: string[];
  agendaItems?: { title: string; description?: string; estimatedMinutes?: number }[];
}

export async function createHuddle(
  input: CreateHuddleInput,
): Promise<ActionResult<{ id: string }>> {
  const ctx = await getAuthContext();
  if (!ctx) return { success: false, error: "Not authenticated." };
  if (!["admin", "staff", "leader"].includes(ctx.role))
    return {
      success: false,
      error: "Only admins, staff, and leaders can create huddles.",
      code: "FORBIDDEN",
    };

  const title = input.title.trim();
  if (!title)
    return { success: false, error: "Title is required.", code: "BAD_INPUT" };

  const meetingSource = input.meetingSource ?? "in_person";
  if (meetingSource === "external_video_link" && !input.externalMeetingUrl?.trim()) {
    return {
      success: false,
      error: "External video link requires a URL.",
      code: "BAD_INPUT",
    };
  }

  const { data: huddle, error } = await supabaseAdmin
    .from("huddles")
    .insert({
      organization_id: ctx.organizationId,
      title,
      description: input.description?.trim() || null,
      scheduled_start: input.scheduledStart || null,
      scheduled_end: input.scheduledEnd || null,
      timezone: input.timezone || null,
      meeting_source: meetingSource,
      external_meeting_url: input.externalMeetingUrl?.trim() || null,
      location: input.location?.trim() || null,
      department_id: input.departmentId || null,
      visibility: input.visibility ?? "invitees_only",
      created_by: ctx.userId,
    })
    .select("id, title")
    .single();
  if (error || !huddle) {
    console.error("[createHuddle] Insert error:", error?.message);
    return { success: false, error: error?.message || "Couldn't create huddle." };
  }

  // Creator is always organizer.
  await supabaseAdmin.from("huddle_attendees").insert({
    huddle_id: huddle.id,
    profile_id: ctx.userId,
    role: "organizer",
  });

  // Empty notes row up front so the upsert pattern in updateHuddleNotes
  // can do plain UPDATE without a coalesce dance.
  await supabaseAdmin.from("huddle_notes").insert({
    huddle_id: huddle.id,
    content: "",
  });

  // Extra attendees + agenda items.
  const extraAttendees = (input.attendeeIds ?? []).filter(
    (id) => id && id !== ctx.userId,
  );
  if (extraAttendees.length > 0) {
    await supabaseAdmin.from("huddle_attendees").insert(
      extraAttendees.map((profileId) => ({
        huddle_id: huddle.id,
        profile_id: profileId,
        role: "attendee" as AttendeeRole,
      })),
    );
  }
  if (input.agendaItems && input.agendaItems.length > 0) {
    await supabaseAdmin.from("huddle_agenda_items").insert(
      input.agendaItems.map((a, i) => ({
        huddle_id: huddle.id,
        title: a.title.trim(),
        description: a.description?.trim() || null,
        estimated_minutes: a.estimatedMinutes ?? null,
        position: i,
      })),
    );
  }

  // Fan out invite notifications. Reuses the existing 'mention' type
  // since notifications.type CHECK doesn't yet include 'huddle_invited'.
  // Best-effort — failure logs and continues.
  if (extraAttendees.length > 0) {
    try {
      const { createNotification } = await import("@/app/actions/notifications");
      const { data: actor } = await supabaseAdmin
        .from("profiles")
        .select("full_name")
        .eq("id", ctx.userId)
        .maybeSingle();
      const actorName = actor?.full_name || "A teammate";
      await Promise.all(
        extraAttendees.map((recipientId) =>
          createNotification({
            recipientId,
            organizationId: ctx.organizationId,
            actorId: ctx.userId,
            type: "mention",
            title: `${actorName} invited you to a huddle`,
            body: huddle.title,
            entityType: "task",
            entityId: huddle.id,
            actionUrl: `/workspace/huddles/${huddle.id}`,
          }),
        ),
      );
    } catch (err) {
      console.error("[createHuddle] Notification fan-out failed:", err);
    }
  }

  revalidatePath("/workspace/huddles");
  revalidatePath("/workspace/calendar");
  return { success: true, data: { id: huddle.id } };
}

export interface UpdateHuddleInput {
  title?: string;
  description?: string | null;
  scheduledStart?: string | null;
  scheduledEnd?: string | null;
  meetingSource?: HuddleMeetingSource;
  externalMeetingUrl?: string | null;
  location?: string | null;
  departmentId?: string | null;
  visibility?: HuddleVisibility;
}

export async function updateHuddle(
  huddleId: string,
  data: UpdateHuddleInput,
): Promise<ActionResult> {
  const ctx = await getAuthContext();
  if (!ctx) return { success: false, error: "Not authenticated." };
  const access = await loadHuddleForViewer(ctx, huddleId);
  if (!access.ok) return { success: false, error: access.error };
  if (!access.canManage)
    return {
      success: false,
      error: "Only the organizer or an admin can edit this huddle.",
      code: "FORBIDDEN",
    };

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof data.title === "string" && data.title.trim())
    update.title = data.title.trim();
  if ("description" in data)
    update.description = data.description?.trim() || null;
  if ("scheduledStart" in data) update.scheduled_start = data.scheduledStart;
  if ("scheduledEnd" in data) update.scheduled_end = data.scheduledEnd;
  if (data.meetingSource) update.meeting_source = data.meetingSource;
  if ("externalMeetingUrl" in data)
    update.external_meeting_url = data.externalMeetingUrl?.trim() || null;
  if ("location" in data) update.location = data.location?.trim() || null;
  if ("departmentId" in data) update.department_id = data.departmentId || null;
  if (data.visibility) update.visibility = data.visibility;

  const { error } = await supabaseAdmin
    .from("huddles")
    .update(update)
    .eq("id", huddleId);
  if (error) {
    console.error("[updateHuddle] Update error:", error.message);
    return { success: false, error: error.message };
  }
  revalidatePath(`/workspace/huddles/${huddleId}`);
  revalidatePath("/workspace/huddles");
  revalidatePath("/workspace/calendar");
  return { success: true };
}

export async function deleteHuddle(huddleId: string): Promise<ActionResult> {
  const ctx = await getAuthContext();
  if (!ctx) return { success: false, error: "Not authenticated." };
  const access = await loadHuddleForViewer(ctx, huddleId);
  if (!access.ok) return { success: false, error: access.error };
  if (!access.canManage)
    return {
      success: false,
      error: "Only the organizer or an admin can delete this huddle.",
      code: "FORBIDDEN",
    };

  const { error } = await supabaseAdmin
    .from("huddles")
    .delete()
    .eq("id", huddleId);
  if (error) {
    console.error("[deleteHuddle] Delete error:", error.message);
    return { success: false, error: error.message };
  }
  revalidatePath("/workspace/huddles");
  revalidatePath("/workspace/calendar");
  return { success: true };
}

// ─── List ─────────────────────────────────────────────────

export async function getHuddles(
  options: { filter?: "upcoming" | "past" | "all" } = {},
): Promise<ActionResult<HuddleListItem[]>> {
  const ctx = await getAuthContext();
  if (!ctx) return { success: false, error: "Not authenticated." };

  let query = supabaseAdmin
    .from("huddles")
    .select(
      "id, title, description, scheduled_start, scheduled_end, actual_start, actual_end, meeting_source, external_meeting_url, location, status, visibility, department_id, created_by, created_at",
    )
    .eq("organization_id", ctx.organizationId);

  if (options.filter === "upcoming") {
    query = query
      .in("status", ["scheduled", "in_progress"])
      .order("scheduled_start", { ascending: true });
  } else if (options.filter === "past") {
    query = query
      .in("status", ["completed", "archived"])
      .order("scheduled_start", { ascending: false });
  } else {
    query = query.order("scheduled_start", { ascending: false });
  }

  const { data: rows, error } = await query;
  if (error) {
    console.error("[getHuddles] Select error:", error.message);
    return { success: false, error: error.message };
  }
  const accessibleIds: string[] = [];
  // Apply visibility filter client-side since RLS is bypassed by the
  // service-role client. Mirrors the SELECT policy in JS.
  const { data: deptRows } = await supabaseAdmin
    .from("profile_departments")
    .select("department_id")
    .eq("profile_id", ctx.userId);
  const myDepartments = new Set(
    (deptRows ?? []).map((r: { department_id: string }) => r.department_id),
  );

  // Batch fetch the attendee links for all candidate huddles.
  const candidateIds = (rows ?? []).map((r) => r.id);
  const attendeeByHuddle = new Map<string, boolean>();
  if (candidateIds.length > 0) {
    const { data: attRows } = await supabaseAdmin
      .from("huddle_attendees")
      .select("huddle_id")
      .in("huddle_id", candidateIds)
      .eq("profile_id", ctx.userId);
    (attRows ?? []).forEach((r: { huddle_id: string }) =>
      attendeeByHuddle.set(r.huddle_id, true),
    );
  }

  const visible: typeof rows = [];
  (rows ?? []).forEach((h) => {
    const isAttendee = attendeeByHuddle.get(h.id) === true;
    let canSee = false;
    if (h.visibility === "organization") canSee = true;
    else if (h.created_by === ctx.userId) canSee = true;
    else if (isAttendee) canSee = true;
    else if (
      h.visibility === "department" &&
      h.department_id &&
      myDepartments.has(h.department_id)
    )
      canSee = true;
    if (canSee) {
      visible.push(h);
      accessibleIds.push(h.id);
    }
  });

  // Aggregate counts in three batched queries.
  const counts = {
    attendees: new Map<string, number>(),
    agenda: new Map<string, number>(),
    actions: new Map<string, number>(),
  };
  if (accessibleIds.length > 0) {
    const [aRes, gRes, iRes] = await Promise.all([
      supabaseAdmin.from("huddle_attendees").select("huddle_id").in("huddle_id", accessibleIds),
      supabaseAdmin.from("huddle_agenda_items").select("huddle_id").in("huddle_id", accessibleIds),
      supabaseAdmin.from("huddle_action_items").select("huddle_id").in("huddle_id", accessibleIds),
    ]);
    (aRes.data ?? []).forEach((r: { huddle_id: string }) =>
      counts.attendees.set(r.huddle_id, (counts.attendees.get(r.huddle_id) ?? 0) + 1),
    );
    (gRes.data ?? []).forEach((r: { huddle_id: string }) =>
      counts.agenda.set(r.huddle_id, (counts.agenda.get(r.huddle_id) ?? 0) + 1),
    );
    (iRes.data ?? []).forEach((r: { huddle_id: string }) =>
      counts.actions.set(r.huddle_id, (counts.actions.get(r.huddle_id) ?? 0) + 1),
    );
  }

  const items: HuddleListItem[] = visible.map((h) => ({
    id: h.id,
    title: h.title,
    description: h.description,
    scheduled_start: h.scheduled_start,
    scheduled_end: h.scheduled_end,
    actual_start: h.actual_start ?? null,
    actual_end: h.actual_end ?? null,
    meeting_source: h.meeting_source as HuddleMeetingSource,
    external_meeting_url: h.external_meeting_url,
    location: h.location,
    status: h.status as HuddleStatus,
    visibility: h.visibility as HuddleVisibility,
    department_id: h.department_id,
    created_by: h.created_by,
    created_at: h.created_at,
    attendee_count: counts.attendees.get(h.id) ?? 0,
    agenda_count: counts.agenda.get(h.id) ?? 0,
    action_item_count: counts.actions.get(h.id) ?? 0,
  }));

  // Upcoming gets a stable ordering when scheduled_start is null —
  // append nulls at the end rather than letting Postgres NULLS-FIRST
  // them.
  if (options.filter === "upcoming") {
    items.sort((a, b) => {
      const av = a.scheduled_start ? new Date(a.scheduled_start).getTime() : Infinity;
      const bv = b.scheduled_start ? new Date(b.scheduled_start).getTime() : Infinity;
      return av - bv;
    });
  }

  return { success: true, data: items };
}

// Calendar wants huddles that have a scheduled_start to interleave with
// events. We keep this as its own action so the calendar page can stay
// scoped to just what it needs.
export async function getHuddlesForCalendar(): Promise<
  ActionResult<
    {
      id: string;
      title: string;
      scheduled_start: string;
      scheduled_end: string | null;
      meeting_source: HuddleMeetingSource;
      status: HuddleStatus;
      department_id: string | null;
    }[]
  >
> {
  const ctx = await getAuthContext();
  if (!ctx) return { success: false, error: "Not authenticated." };

  const { data: rows } = await supabaseAdmin
    .from("huddles")
    .select(
      "id, title, scheduled_start, scheduled_end, meeting_source, status, visibility, department_id, created_by",
    )
    .eq("organization_id", ctx.organizationId)
    .not("scheduled_start", "is", null);
  if (!rows) return { success: true, data: [] };

  const { data: deptRows } = await supabaseAdmin
    .from("profile_departments")
    .select("department_id")
    .eq("profile_id", ctx.userId);
  const myDepartments = new Set(
    (deptRows ?? []).map((r: { department_id: string }) => r.department_id),
  );
  const candidateIds = rows.map((r) => r.id);
  const attendeeSet = new Set<string>();
  if (candidateIds.length > 0) {
    const { data: attRows } = await supabaseAdmin
      .from("huddle_attendees")
      .select("huddle_id")
      .in("huddle_id", candidateIds)
      .eq("profile_id", ctx.userId);
    (attRows ?? []).forEach((r: { huddle_id: string }) =>
      attendeeSet.add(r.huddle_id),
    );
  }

  const visible = rows.filter((h) => {
    if (h.visibility === "organization") return true;
    if (h.created_by === ctx.userId) return true;
    if (attendeeSet.has(h.id)) return true;
    if (
      h.visibility === "department" &&
      h.department_id &&
      myDepartments.has(h.department_id)
    )
      return true;
    return false;
  });

  return {
    success: true,
    data: visible.map((h) => ({
      id: h.id,
      title: h.title,
      scheduled_start: h.scheduled_start as string,
      scheduled_end: h.scheduled_end,
      meeting_source: h.meeting_source as HuddleMeetingSource,
      status: h.status as HuddleStatus,
      department_id: h.department_id,
    })),
  };
}

// ─── Detail (single huddle) ───────────────────────────────

export async function getHuddle(
  huddleId: string,
): Promise<ActionResult<HuddleDetail>> {
  const ctx = await getAuthContext();
  if (!ctx) return { success: false, error: "Not authenticated." };
  const access = await loadHuddleForViewer(ctx, huddleId);
  if (!access.ok) return { success: false, error: access.error };

  const [
    huddleRes,
    attendeesRes,
    agendaRes,
    notesRes,
    decisionsRes,
    actionItemsRes,
    recRes,
    transRes,
    sumRes,
  ] = await Promise.all([
    supabaseAdmin
      .from("huddles")
      .select(
        "id, title, description, scheduled_start, scheduled_end, actual_start, actual_end, meeting_source, external_meeting_url, location, status, visibility, department_id, created_by, created_at",
      )
      .eq("id", huddleId)
      .single(),
    supabaseAdmin
      .from("huddle_attendees")
      .select("id, huddle_id, profile_id, member_id, role, attended, attended_at")
      .eq("huddle_id", huddleId),
    supabaseAdmin
      .from("huddle_agenda_items")
      .select(
        "id, huddle_id, title, description, estimated_minutes, presenter_id, position, is_completed",
      )
      .eq("huddle_id", huddleId)
      .order("position", { ascending: true }),
    supabaseAdmin
      .from("huddle_notes")
      .select("huddle_id, content, last_edited_by, last_edited_at")
      .eq("huddle_id", huddleId)
      .maybeSingle(),
    supabaseAdmin
      .from("huddle_decisions")
      .select(
        "id, huddle_id, decision, context, decided_by, source, created_at",
      )
      .eq("huddle_id", huddleId)
      .order("created_at", { ascending: true }),
    supabaseAdmin
      .from("huddle_action_items")
      .select(
        "id, huddle_id, task_id, description, suggested_assignee_id, suggested_due_date, source, status, created_at",
      )
      .eq("huddle_id", huddleId)
      .order("created_at", { ascending: true }),
    supabaseAdmin
      .from("huddle_recordings")
      .select("id, storage_path, duration_seconds")
      .eq("huddle_id", huddleId),
    supabaseAdmin
      .from("huddle_transcripts")
      .select("id, content, language")
      .eq("huddle_id", huddleId),
    supabaseAdmin
      .from("huddle_summaries")
      .select("id, summary, model")
      .eq("huddle_id", huddleId),
  ]);

  if (huddleRes.error || !huddleRes.data) {
    return { success: false, error: huddleRes.error?.message || "Huddle not found." };
  }
  const h = huddleRes.data;

  // Hydrate every profile reference in one query.
  const attendeeRows = attendeesRes.data ?? [];
  const agendaRows = agendaRes.data ?? [];
  const decisionRows = decisionsRes.data ?? [];
  const actionRows = actionItemsRes.data ?? [];
  const note = notesRes.data ?? null;
  const profileMap = await hydrateProfiles([
    ...attendeeRows.map((a) => a.profile_id),
    ...agendaRows.map((a) => a.presenter_id),
    ...decisionRows.map((d) => d.decided_by),
    ...actionRows.map((a) => a.suggested_assignee_id),
    note?.last_edited_by ?? null,
  ]);

  // Pull task status for any promoted action items so the UI can render
  // "View task" + open / done state.
  const taskIds = actionRows
    .map((a) => a.task_id)
    .filter((v): v is string => !!v);
  const taskStatusById = new Map<string, string>();
  if (taskIds.length > 0) {
    const { data: tasks } = await supabaseAdmin
      .from("tasks")
      .select("id, status")
      .in("id", taskIds);
    (tasks ?? []).forEach((t: { id: string; status: string | null }) => {
      taskStatusById.set(t.id, t.status ?? "todo");
    });
  }

  const detail: HuddleDetail = {
    id: h.id,
    title: h.title,
    description: h.description,
    scheduled_start: h.scheduled_start,
    scheduled_end: h.scheduled_end,
    actual_start: h.actual_start ?? null,
    actual_end: h.actual_end ?? null,
    meeting_source: h.meeting_source as HuddleMeetingSource,
    external_meeting_url: h.external_meeting_url,
    location: h.location,
    status: h.status as HuddleStatus,
    visibility: h.visibility as HuddleVisibility,
    department_id: h.department_id,
    created_by: h.created_by,
    created_at: h.created_at,
    attendee_count: attendeeRows.length,
    agenda_count: agendaRows.length,
    action_item_count: actionRows.length,
    attendees: attendeeRows.map((a) => ({
      id: a.id,
      huddle_id: a.huddle_id,
      profile_id: a.profile_id,
      member_id: a.member_id,
      role: a.role as AttendeeRole,
      attended: !!a.attended,
      attended_at: a.attended_at,
      profile: a.profile_id ? profileMap.get(a.profile_id) ?? null : null,
    })),
    agenda: agendaRows.map((a) => ({
      id: a.id,
      huddle_id: a.huddle_id,
      title: a.title,
      description: a.description,
      estimated_minutes: a.estimated_minutes,
      presenter_id: a.presenter_id,
      position: a.position,
      is_completed: !!a.is_completed,
      presenter: a.presenter_id ? profileMap.get(a.presenter_id) ?? null : null,
    })),
    notes: note
      ? {
          huddle_id: note.huddle_id,
          content: note.content ?? "",
          last_edited_by: note.last_edited_by,
          last_edited_at: note.last_edited_at,
          editor: note.last_edited_by
            ? profileMap.get(note.last_edited_by) ?? null
            : null,
        }
      : null,
    decisions: decisionRows.map((d) => ({
      id: d.id,
      huddle_id: d.huddle_id,
      decision: d.decision,
      context: d.context,
      decided_by: d.decided_by,
      source: d.source as "manual" | "ai_extracted",
      created_at: d.created_at,
      decider: d.decided_by ? profileMap.get(d.decided_by) ?? null : null,
    })),
    action_items: actionRows.map((a) => ({
      id: a.id,
      huddle_id: a.huddle_id,
      task_id: a.task_id,
      description: a.description,
      suggested_assignee_id: a.suggested_assignee_id,
      suggested_due_date: a.suggested_due_date,
      source: a.source as "manual" | "ai_extracted",
      status: a.status as "pending" | "accepted" | "rejected",
      created_at: a.created_at,
      assignee: a.suggested_assignee_id
        ? profileMap.get(a.suggested_assignee_id) ?? null
        : null,
      task_status: a.task_id ? taskStatusById.get(a.task_id) ?? null : null,
    })),
    recordings: (recRes.data ?? []).map((r) => ({
      id: r.id,
      storage_path: r.storage_path,
      duration_seconds: r.duration_seconds,
    })),
    transcripts: (transRes.data ?? []).map((t) => ({
      id: t.id,
      content: t.content,
      language: t.language,
    })),
    summaries: (sumRes.data ?? []).map((s) => ({
      id: s.id,
      summary: s.summary,
      model: s.model,
    })),
    viewer_can_edit: access.canEdit,
    viewer_can_manage: access.canManage,
  };

  return { success: true, data: detail };
}

// ─── Lifecycle ────────────────────────────────────────────

async function lifecycleUpdate(
  huddleId: string,
  patch: Record<string, unknown>,
): Promise<ActionResult> {
  const ctx = await getAuthContext();
  if (!ctx) return { success: false, error: "Not authenticated." };
  const access = await loadHuddleForViewer(ctx, huddleId);
  if (!access.ok) return { success: false, error: access.error };
  if (!access.canManage)
    return {
      success: false,
      error: "Only the organizer or an admin can change huddle status.",
      code: "FORBIDDEN",
    };
  const { error } = await supabaseAdmin
    .from("huddles")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", huddleId);
  if (error) {
    console.error("[lifecycleUpdate] Error:", error.message);
    return { success: false, error: error.message };
  }
  revalidatePath(`/workspace/huddles/${huddleId}`);
  revalidatePath("/workspace/huddles");
  revalidatePath("/workspace/calendar");
  return { success: true };
}

export async function startHuddle(huddleId: string): Promise<ActionResult> {
  return lifecycleUpdate(huddleId, {
    status: "in_progress",
    actual_start: new Date().toISOString(),
  });
}

export async function endHuddle(huddleId: string): Promise<ActionResult> {
  return lifecycleUpdate(huddleId, {
    status: "completed",
    actual_end: new Date().toISOString(),
  });
}

export async function finalizeHuddle(huddleId: string): Promise<ActionResult> {
  return lifecycleUpdate(huddleId, { status: "archived" });
}

// ─── Attendees ────────────────────────────────────────────

export async function addHuddleAttendee(
  huddleId: string,
  profileId: string,
  role: AttendeeRole = "attendee",
): Promise<ActionResult<HuddleAttendee>> {
  const ctx = await getAuthContext();
  if (!ctx) return { success: false, error: "Not authenticated." };
  const access = await loadHuddleForViewer(ctx, huddleId);
  if (!access.ok) return { success: false, error: access.error };
  if (!access.canManage)
    return {
      success: false,
      error: "Only the organizer or an admin can manage attendees.",
      code: "FORBIDDEN",
    };

  const { data: row, error } = await supabaseAdmin
    .from("huddle_attendees")
    .insert({
      huddle_id: huddleId,
      profile_id: profileId,
      role,
    })
    .select(
      "id, huddle_id, profile_id, member_id, role, attended, attended_at",
    )
    .single();
  if (error || !row) {
    // 23505 = unique violation if you ever add a (huddle_id, profile_id)
    // unique constraint. Map gracefully.
    if (error?.code === "23505")
      return { success: false, error: "That person is already on the huddle." };
    console.error("[addHuddleAttendee] Insert error:", error?.message);
    return { success: false, error: error?.message || "Couldn't add attendee." };
  }

  const profileMap = await hydrateProfiles([profileId]);
  const attendee: HuddleAttendee = {
    id: row.id,
    huddle_id: row.huddle_id,
    profile_id: row.profile_id,
    member_id: row.member_id,
    role: row.role as AttendeeRole,
    attended: !!row.attended,
    attended_at: row.attended_at,
    profile: profileMap.get(profileId) ?? null,
  };

  // Invite notification (same 'mention' reuse as createHuddle).
  try {
    if (profileId !== ctx.userId) {
      const { createNotification } = await import("@/app/actions/notifications");
      const [{ data: actor }, { data: huddleRow }] = await Promise.all([
        supabaseAdmin
          .from("profiles")
          .select("full_name")
          .eq("id", ctx.userId)
          .maybeSingle(),
        supabaseAdmin
          .from("huddles")
          .select("title")
          .eq("id", huddleId)
          .maybeSingle(),
      ]);
      await createNotification({
        recipientId: profileId,
        organizationId: ctx.organizationId,
        actorId: ctx.userId,
        type: "mention",
        title: `${actor?.full_name || "A teammate"} invited you to a huddle`,
        body: huddleRow?.title || "Huddle",
        entityType: "task",
        entityId: huddleId,
        actionUrl: `/workspace/huddles/${huddleId}`,
      });
    }
  } catch (err) {
    console.error("[addHuddleAttendee] Notification failed:", err);
  }

  revalidatePath(`/workspace/huddles/${huddleId}`);
  return { success: true, data: attendee };
}

export async function removeHuddleAttendee(
  attendeeId: string,
): Promise<ActionResult> {
  const ctx = await getAuthContext();
  if (!ctx) return { success: false, error: "Not authenticated." };
  const { data: attendee } = await supabaseAdmin
    .from("huddle_attendees")
    .select("id, huddle_id")
    .eq("id", attendeeId)
    .maybeSingle();
  if (!attendee) return { success: false, error: "Attendee not found." };
  const access = await loadHuddleForViewer(ctx, attendee.huddle_id);
  if (!access.ok) return { success: false, error: access.error };
  if (!access.canManage)
    return {
      success: false,
      error: "Only the organizer or an admin can manage attendees.",
      code: "FORBIDDEN",
    };

  const { error } = await supabaseAdmin
    .from("huddle_attendees")
    .delete()
    .eq("id", attendeeId);
  if (error) {
    console.error("[removeHuddleAttendee] Delete error:", error.message);
    return { success: false, error: error.message };
  }
  revalidatePath(`/workspace/huddles/${attendee.huddle_id}`);
  return { success: true };
}

export async function markAttendance(
  attendeeId: string,
  attended: boolean,
): Promise<ActionResult> {
  const ctx = await getAuthContext();
  if (!ctx) return { success: false, error: "Not authenticated." };
  const { data: attendee } = await supabaseAdmin
    .from("huddle_attendees")
    .select("id, huddle_id")
    .eq("id", attendeeId)
    .maybeSingle();
  if (!attendee) return { success: false, error: "Attendee not found." };
  const access = await loadHuddleForViewer(ctx, attendee.huddle_id);
  if (!access.ok) return { success: false, error: access.error };
  if (!access.canManage)
    return {
      success: false,
      error: "Only the organizer or an admin can mark attendance.",
      code: "FORBIDDEN",
    };

  const { error } = await supabaseAdmin
    .from("huddle_attendees")
    .update({
      attended,
      attended_at: attended ? new Date().toISOString() : null,
    })
    .eq("id", attendeeId);
  if (error) {
    console.error("[markAttendance] Update error:", error.message);
    return { success: false, error: error.message };
  }
  revalidatePath(`/workspace/huddles/${attendee.huddle_id}`);
  return { success: true };
}

// ─── Agenda ───────────────────────────────────────────────

async function ensureCanEdit(
  ctx: { userId: string; organizationId: string; role: Role },
  huddleId: string,
): Promise<{ ok: true; huddleId: string } | { ok: false; error: string }> {
  const access = await loadHuddleForViewer(ctx, huddleId);
  if (!access.ok) return { ok: false, error: access.error };
  if (!access.canEdit)
    return { ok: false, error: "You don't have access to edit this huddle." };
  return { ok: true, huddleId };
}

export async function createAgendaItem(
  huddleId: string,
  title: string,
  description?: string,
  estimatedMinutes?: number,
  presenterId?: string,
): Promise<ActionResult<HuddleAgendaItem>> {
  const ctx = await getAuthContext();
  if (!ctx) return { success: false, error: "Not authenticated." };
  const access = await ensureCanEdit(ctx, huddleId);
  if (!access.ok) return { success: false, error: access.error };

  const trimmed = title.trim();
  if (!trimmed)
    return { success: false, error: "Title is required.", code: "BAD_INPUT" };

  // Append at the end of the position order.
  const { data: tail } = await supabaseAdmin
    .from("huddle_agenda_items")
    .select("position")
    .eq("huddle_id", huddleId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  const position = ((tail?.position as number | undefined) ?? -1) + 1;

  const { data, error } = await supabaseAdmin
    .from("huddle_agenda_items")
    .insert({
      huddle_id: huddleId,
      title: trimmed,
      description: description?.trim() || null,
      estimated_minutes: estimatedMinutes ?? null,
      presenter_id: presenterId || null,
      position,
    })
    .select(
      "id, huddle_id, title, description, estimated_minutes, presenter_id, position, is_completed",
    )
    .single();
  if (error || !data) {
    console.error("[createAgendaItem] Insert error:", error?.message);
    return { success: false, error: error?.message || "Couldn't add item." };
  }

  const profileMap = data.presenter_id
    ? await hydrateProfiles([data.presenter_id])
    : new Map<string, ProfileLite>();

  revalidatePath(`/workspace/huddles/${huddleId}`);
  return {
    success: true,
    data: {
      id: data.id,
      huddle_id: data.huddle_id,
      title: data.title,
      description: data.description,
      estimated_minutes: data.estimated_minutes,
      presenter_id: data.presenter_id,
      position: data.position,
      is_completed: !!data.is_completed,
      presenter: data.presenter_id ? profileMap.get(data.presenter_id) ?? null : null,
    },
  };
}

export async function updateAgendaItem(
  itemId: string,
  data: {
    title?: string;
    description?: string | null;
    estimatedMinutes?: number | null;
    presenterId?: string | null;
    isCompleted?: boolean;
  },
): Promise<ActionResult> {
  const ctx = await getAuthContext();
  if (!ctx) return { success: false, error: "Not authenticated." };
  const { data: existing } = await supabaseAdmin
    .from("huddle_agenda_items")
    .select("id, huddle_id")
    .eq("id", itemId)
    .maybeSingle();
  if (!existing) return { success: false, error: "Item not found." };
  const access = await ensureCanEdit(ctx, existing.huddle_id);
  if (!access.ok) return { success: false, error: access.error };

  const update: Record<string, unknown> = {};
  if (typeof data.title === "string" && data.title.trim())
    update.title = data.title.trim();
  if ("description" in data)
    update.description = data.description?.trim() || null;
  if ("estimatedMinutes" in data)
    update.estimated_minutes = data.estimatedMinutes ?? null;
  if ("presenterId" in data) update.presenter_id = data.presenterId ?? null;
  if (typeof data.isCompleted === "boolean")
    update.is_completed = data.isCompleted;
  if (Object.keys(update).length === 0) return { success: true };

  const { error } = await supabaseAdmin
    .from("huddle_agenda_items")
    .update(update)
    .eq("id", itemId);
  if (error) {
    console.error("[updateAgendaItem] Update error:", error.message);
    return { success: false, error: error.message };
  }
  revalidatePath(`/workspace/huddles/${existing.huddle_id}`);
  return { success: true };
}

export async function deleteAgendaItem(itemId: string): Promise<ActionResult> {
  const ctx = await getAuthContext();
  if (!ctx) return { success: false, error: "Not authenticated." };
  const { data: existing } = await supabaseAdmin
    .from("huddle_agenda_items")
    .select("id, huddle_id")
    .eq("id", itemId)
    .maybeSingle();
  if (!existing) return { success: false, error: "Item not found." };
  const access = await ensureCanEdit(ctx, existing.huddle_id);
  if (!access.ok) return { success: false, error: access.error };

  const { error } = await supabaseAdmin
    .from("huddle_agenda_items")
    .delete()
    .eq("id", itemId);
  if (error) {
    console.error("[deleteAgendaItem] Delete error:", error.message);
    return { success: false, error: error.message };
  }
  revalidatePath(`/workspace/huddles/${existing.huddle_id}`);
  return { success: true };
}

export async function reorderAgendaItems(
  huddleId: string,
  itemIds: string[],
): Promise<ActionResult> {
  const ctx = await getAuthContext();
  if (!ctx) return { success: false, error: "Not authenticated." };
  const access = await ensureCanEdit(ctx, huddleId);
  if (!access.ok) return { success: false, error: access.error };
  if (!Array.isArray(itemIds) || itemIds.length === 0)
    return { success: true };

  // Sequential single-field updates — modest N (huddle agendas rarely
  // exceed a couple dozen items).
  for (let i = 0; i < itemIds.length; i++) {
    const { error } = await supabaseAdmin
      .from("huddle_agenda_items")
      .update({ position: i })
      .eq("id", itemIds[i])
      .eq("huddle_id", huddleId);
    if (error) {
      console.error("[reorderAgendaItems] Update error:", error.message);
      return { success: false, error: error.message };
    }
  }
  revalidatePath(`/workspace/huddles/${huddleId}`);
  return { success: true };
}

// ─── Notes ────────────────────────────────────────────────

export async function updateHuddleNotes(
  huddleId: string,
  content: string,
): Promise<ActionResult> {
  const ctx = await getAuthContext();
  if (!ctx) return { success: false, error: "Not authenticated." };
  const access = await ensureCanEdit(ctx, huddleId);
  if (!access.ok) return { success: false, error: access.error };

  const nowIso = new Date().toISOString();
  // Upsert on the PK so the very first edit creates the row even if the
  // huddle was created before we started auto-seeding it.
  const { error } = await supabaseAdmin.from("huddle_notes").upsert(
    {
      huddle_id: huddleId,
      content,
      last_edited_by: ctx.userId,
      last_edited_at: nowIso,
    },
    { onConflict: "huddle_id" },
  );
  if (error) {
    console.error("[updateHuddleNotes] Upsert error:", error.message);
    return { success: false, error: error.message };
  }
  // Intentionally NOT revalidatePath — notes autosave every 5s and we
  // don't want to thrash the cache. The client patches optimistically.
  return { success: true };
}

// ─── Decisions ────────────────────────────────────────────

export async function createDecision(
  huddleId: string,
  decision: string,
  context?: string,
): Promise<ActionResult<HuddleDecision>> {
  const ctx = await getAuthContext();
  if (!ctx) return { success: false, error: "Not authenticated." };
  const access = await ensureCanEdit(ctx, huddleId);
  if (!access.ok) return { success: false, error: access.error };

  const trimmed = decision.trim();
  if (!trimmed)
    return { success: false, error: "Decision is required.", code: "BAD_INPUT" };

  const { data: row, error } = await supabaseAdmin
    .from("huddle_decisions")
    .insert({
      huddle_id: huddleId,
      decision: trimmed,
      context: context?.trim() || null,
      decided_by: ctx.userId,
      source: "manual",
    })
    .select("id, huddle_id, decision, context, decided_by, source, created_at")
    .single();
  if (error || !row) {
    console.error("[createDecision] Insert error:", error?.message);
    return { success: false, error: error?.message || "Couldn't save decision." };
  }
  const profileMap = await hydrateProfiles([row.decided_by]);
  revalidatePath(`/workspace/huddles/${huddleId}`);
  return {
    success: true,
    data: {
      ...row,
      source: row.source as "manual" | "ai_extracted",
      decider: row.decided_by ? profileMap.get(row.decided_by) ?? null : null,
    },
  };
}

export async function updateDecision(
  decisionId: string,
  data: { decision?: string; context?: string | null },
): Promise<ActionResult> {
  const ctx = await getAuthContext();
  if (!ctx) return { success: false, error: "Not authenticated." };
  const { data: existing } = await supabaseAdmin
    .from("huddle_decisions")
    .select("id, huddle_id")
    .eq("id", decisionId)
    .maybeSingle();
  if (!existing) return { success: false, error: "Decision not found." };
  const access = await ensureCanEdit(ctx, existing.huddle_id);
  if (!access.ok) return { success: false, error: access.error };

  const update: Record<string, unknown> = {};
  if (typeof data.decision === "string" && data.decision.trim())
    update.decision = data.decision.trim();
  if ("context" in data) update.context = data.context?.trim() || null;
  if (Object.keys(update).length === 0) return { success: true };

  const { error } = await supabaseAdmin
    .from("huddle_decisions")
    .update(update)
    .eq("id", decisionId);
  if (error) {
    console.error("[updateDecision] Update error:", error.message);
    return { success: false, error: error.message };
  }
  revalidatePath(`/workspace/huddles/${existing.huddle_id}`);
  return { success: true };
}

export async function deleteDecision(
  decisionId: string,
): Promise<ActionResult> {
  const ctx = await getAuthContext();
  if (!ctx) return { success: false, error: "Not authenticated." };
  const { data: existing } = await supabaseAdmin
    .from("huddle_decisions")
    .select("id, huddle_id")
    .eq("id", decisionId)
    .maybeSingle();
  if (!existing) return { success: false, error: "Decision not found." };
  const access = await ensureCanEdit(ctx, existing.huddle_id);
  if (!access.ok) return { success: false, error: access.error };

  const { error } = await supabaseAdmin
    .from("huddle_decisions")
    .delete()
    .eq("id", decisionId);
  if (error) {
    console.error("[deleteDecision] Delete error:", error.message);
    return { success: false, error: error.message };
  }
  revalidatePath(`/workspace/huddles/${existing.huddle_id}`);
  return { success: true };
}

// ─── Action items ─────────────────────────────────────────

export async function createActionItem(
  huddleId: string,
  description: string,
  suggestedAssigneeId?: string,
  suggestedDueDate?: string,
): Promise<ActionResult<HuddleActionItem>> {
  const ctx = await getAuthContext();
  if (!ctx) return { success: false, error: "Not authenticated." };
  const access = await ensureCanEdit(ctx, huddleId);
  if (!access.ok) return { success: false, error: access.error };

  const trimmed = description.trim();
  if (!trimmed)
    return { success: false, error: "Description is required.", code: "BAD_INPUT" };

  const { data: row, error } = await supabaseAdmin
    .from("huddle_action_items")
    .insert({
      huddle_id: huddleId,
      description: trimmed,
      suggested_assignee_id: suggestedAssigneeId || null,
      suggested_due_date: suggestedDueDate || null,
      source: "manual",
      status: "pending",
    })
    .select(
      "id, huddle_id, task_id, description, suggested_assignee_id, suggested_due_date, source, status, created_at",
    )
    .single();
  if (error || !row) {
    console.error("[createActionItem] Insert error:", error?.message);
    return { success: false, error: error?.message || "Couldn't add action item." };
  }
  const profileMap = row.suggested_assignee_id
    ? await hydrateProfiles([row.suggested_assignee_id])
    : new Map<string, ProfileLite>();
  revalidatePath(`/workspace/huddles/${huddleId}`);
  return {
    success: true,
    data: {
      ...row,
      source: row.source as "manual" | "ai_extracted",
      status: row.status as "pending" | "accepted" | "rejected",
      assignee: row.suggested_assignee_id
        ? profileMap.get(row.suggested_assignee_id) ?? null
        : null,
      task_status: null,
    },
  };
}

export async function updateActionItem(
  itemId: string,
  data: {
    description?: string;
    suggestedAssigneeId?: string | null;
    suggestedDueDate?: string | null;
    status?: "pending" | "accepted" | "rejected";
  },
): Promise<ActionResult> {
  const ctx = await getAuthContext();
  if (!ctx) return { success: false, error: "Not authenticated." };
  const { data: existing } = await supabaseAdmin
    .from("huddle_action_items")
    .select("id, huddle_id")
    .eq("id", itemId)
    .maybeSingle();
  if (!existing) return { success: false, error: "Action item not found." };
  const access = await ensureCanEdit(ctx, existing.huddle_id);
  if (!access.ok) return { success: false, error: access.error };

  const update: Record<string, unknown> = {};
  if (typeof data.description === "string" && data.description.trim())
    update.description = data.description.trim();
  if ("suggestedAssigneeId" in data)
    update.suggested_assignee_id = data.suggestedAssigneeId ?? null;
  if ("suggestedDueDate" in data)
    update.suggested_due_date = data.suggestedDueDate ?? null;
  if (data.status) update.status = data.status;
  if (Object.keys(update).length === 0) return { success: true };

  const { error } = await supabaseAdmin
    .from("huddle_action_items")
    .update(update)
    .eq("id", itemId);
  if (error) {
    console.error("[updateActionItem] Update error:", error.message);
    return { success: false, error: error.message };
  }
  revalidatePath(`/workspace/huddles/${existing.huddle_id}`);
  return { success: true };
}

export async function deleteActionItem(itemId: string): Promise<ActionResult> {
  const ctx = await getAuthContext();
  if (!ctx) return { success: false, error: "Not authenticated." };
  const { data: existing } = await supabaseAdmin
    .from("huddle_action_items")
    .select("id, huddle_id")
    .eq("id", itemId)
    .maybeSingle();
  if (!existing) return { success: false, error: "Action item not found." };
  const access = await ensureCanEdit(ctx, existing.huddle_id);
  if (!access.ok) return { success: false, error: access.error };

  const { error } = await supabaseAdmin
    .from("huddle_action_items")
    .delete()
    .eq("id", itemId);
  if (error) {
    console.error("[deleteActionItem] Delete error:", error.message);
    return { success: false, error: error.message };
  }
  revalidatePath(`/workspace/huddles/${existing.huddle_id}`);
  return { success: true };
}

// Promote a huddle action item into a real task in the tasks table.
// Sets source='huddle' + source_huddle_id so reverse lookups work.
// Reuses 'task_assigned' notification copy (assignee gets notified the
// same way as any other task assignment).
export async function promoteActionItemToTask(
  itemId: string,
): Promise<ActionResult<{ taskId: string }>> {
  const ctx = await getAuthContext();
  if (!ctx) return { success: false, error: "Not authenticated." };

  const { data: item } = await supabaseAdmin
    .from("huddle_action_items")
    .select(
      "id, huddle_id, task_id, description, suggested_assignee_id, suggested_due_date",
    )
    .eq("id", itemId)
    .maybeSingle();
  if (!item) return { success: false, error: "Action item not found." };
  if (item.task_id)
    return { success: false, error: "Already promoted to a task." };

  const access = await ensureCanEdit(ctx, item.huddle_id);
  if (!access.ok) return { success: false, error: access.error };

  const { data: huddle } = await supabaseAdmin
    .from("huddles")
    .select("title")
    .eq("id", item.huddle_id)
    .maybeSingle();
  const huddleTitle = huddle?.title || "Huddle";

  // Compute task position at end of org backlog (matches createTask).
  const { data: maxPos } = await supabaseAdmin
    .from("tasks")
    .select("position")
    .eq("organization_id", ctx.organizationId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextPosition = ((maxPos?.position as number | undefined) ?? 0) + 1;

  const assigneeId = item.suggested_assignee_id || ctx.userId;

  const { data: task, error } = await supabaseAdmin
    .from("tasks")
    .insert({
      organization_id: ctx.organizationId,
      title: item.description.slice(0, 240),
      description: `From Huddle: ${huddleTitle}`,
      status: "todo",
      priority: "medium",
      due_date: item.suggested_due_date || null,
      assigned_to: assigneeId,
      assigned_by: ctx.userId,
      position: nextPosition,
      source: "huddle",
      source_huddle_id: item.huddle_id,
    })
    .select("id")
    .single();
  if (error || !task) {
    console.error("[promoteActionItemToTask] Task insert error:", error?.message);
    return { success: false, error: error?.message || "Couldn't create task." };
  }

  // Link back from the action item.
  await supabaseAdmin
    .from("huddle_action_items")
    .update({ task_id: task.id, status: "accepted" })
    .eq("id", itemId);

  // Notification — reuses existing 'task_assigned'.
  if (assigneeId && assigneeId !== ctx.userId) {
    try {
      const { createNotification } = await import("@/app/actions/notifications");
      const { data: actor } = await supabaseAdmin
        .from("profiles")
        .select("full_name")
        .eq("id", ctx.userId)
        .maybeSingle();
      const actorName = actor?.full_name || "A teammate";
      await createNotification({
        recipientId: assigneeId,
        organizationId: ctx.organizationId,
        actorId: ctx.userId,
        type: "task_assigned",
        title: `${actorName} assigned you a task from ${huddleTitle}`,
        body: item.description.slice(0, 140),
        entityType: "task",
        entityId: task.id,
        actionUrl: `/workspace/tasks?taskId=${task.id}`,
      });
    } catch (err) {
      console.error("[promoteActionItemToTask] Notification failed:", err);
    }
  }

  revalidatePath(`/workspace/huddles/${item.huddle_id}`);
  revalidatePath("/workspace/tasks");
  revalidatePath("/dashboard");
  return { success: true, data: { taskId: task.id } };
}
