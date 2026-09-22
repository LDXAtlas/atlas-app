"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getRoleFromProfile } from "@/lib/permissions";
import type { Role } from "@/lib/permissions";
import { transcribeAudio } from "@/lib/ai";
import { getOrgAIContext } from "@/lib/ai/org-context";
import { getRemainingCredits } from "@/lib/ai/credit-accounting";
import {
  HUDDLE_RECORDING_ALLOWED_BASE_MIME,
  HUDDLE_RECORDING_BUCKET,
  HUDDLE_RECORDING_MIN_CREDITS,
  HUDDLE_RECORDING_STALE_MS,
  HUDDLE_SEGMENT_MAX_BYTES,
  huddleRecordingExtension,
} from "@/lib/huddles/huddle-types";
import type {
  HuddleListFilter,
  HuddleRecordingLifecycleState,
  HuddleSegmentUploadInput,
  HuddleSegmentUploadTicket,
  MyHuddleActionItem,
  RecentHuddleDecision,
} from "@/lib/huddles/huddle-types";

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
  /** Email used as a humane fallback when full_name is empty/null. */
  email: string | null;
  avatar_color: string;
  /** Optional avatar URL for orgs that have uploaded photos. */
  avatar_url: string | null;
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
  /** Free-form notes the team captures against this specific topic
   *  during the meeting. Optional; column lands via the agenda-notes
   *  migration and the UI degrades gracefully if it isn't applied. */
  notes: string | null;
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

// Batch visibility filter for huddle rows already scoped to the caller's
// org. Reads run on the service-role client, so RLS is bypassed — this
// mirrors the huddles SELECT policy in JS. Row order is preserved.
// (getHuddlesForCalendar and loadHuddleForViewer still carry their own
// copies of the same predicate.)
async function filterVisibleHuddles<
  T extends {
    id: string;
    visibility: string;
    created_by: string;
    department_id: string | null;
  },
>(ctx: { userId: string }, rows: T[]): Promise<T[]> {
  const { data: deptRows } = await supabaseAdmin
    .from("profile_departments")
    .select("department_id")
    .eq("profile_id", ctx.userId);
  const myDepartments = new Set(
    (deptRows ?? []).map((r: { department_id: string }) => r.department_id),
  );

  // Batch fetch the attendee links for all candidate huddles.
  const candidateIds = rows.map((r) => r.id);
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

  return rows.filter((h) => {
    const isAttendee = attendeeByHuddle.get(h.id) === true;
    if (h.visibility === "organization") return true;
    if (h.created_by === ctx.userId) return true;
    if (isAttendee) return true;
    if (
      h.visibility === "department" &&
      h.department_id &&
      myDepartments.has(h.department_id)
    )
      return true;
    return false;
  });
}

// Deterministic avatar tint from a uuid so attendees who haven't set a
// custom color still get visually distinct circles. Same hashing
// approach as elsewhere in Atlas — first byte mod palette length.
const AVATAR_FALLBACK_PALETTE = [
  "#5CE1A5",
  "#3B82F6",
  "#8B5CF6",
  "#F59E0B",
  "#F97316",
  "#EF4444",
  "#EC4899",
  "#10B981",
  "#06B6D4",
  "#14B8A6",
  "#A855F7",
  "#6366F1",
];
function deterministicAvatarColor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return AVATAR_FALLBACK_PALETTE[hash % AVATAR_FALLBACK_PALETTE.length];
}

// Batched profile hydration for attendee / presenter / assignee joins.
// Confirmed via schema query: profiles has (id, organization_id, email,
// full_name, avatar_url, role, phone, last_active, created_at). There is
// NO avatar_color column — an older codebase pattern in boards.ts /
// notifications.ts / profiles.ts references it but those queries silently
// fail and fall back to hardcoded mint. We avoid the trap by selecting
// only real columns here and computing the avatar tint deterministically
// from the user id.
async function hydrateProfiles(
  ids: (string | null | undefined)[],
): Promise<Map<string, ProfileLite>> {
  const unique = Array.from(
    new Set(ids.filter((v): v is string => !!v)),
  );
  const result = new Map<string, ProfileLite>();
  if (unique.length === 0) return result;
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("id, full_name, email, avatar_url, role")
    .in("id", unique);
  if (error) {
    console.error("[hydrateProfiles] Profile select error:", error.message);
    return result;
  }
  (data ?? []).forEach(
    (p: {
      id: string;
      full_name: string | null;
      email: string | null;
      avatar_url: string | null;
      role: Role | null;
    }) => {
      const displayName =
        (p.full_name && p.full_name.trim()) ||
        (p.email ? p.email.split("@")[0] : "") ||
        "Teammate";
      result.set(p.id, {
        id: p.id,
        full_name: displayName,
        email: p.email,
        // No stored color → derive deterministically so the circle still
        // varies between users instead of all reading as flat mint.
        avatar_color: deterministicAvatarColor(p.id),
        avatar_url: p.avatar_url,
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

// Settings-panel updates — visibility, department, retention. Calls
// through to updateHuddle for visibility / department but adds
// recording_retention_days which the existing UpdateHuddleInput
// doesn't carry.
export interface HuddleSettingsInput {
  visibility?: HuddleVisibility;
  departmentId?: string | null;
  recordingRetentionDays?: number | null;
}

export async function updateHuddleSettings(
  huddleId: string,
  data: HuddleSettingsInput,
): Promise<ActionResult> {
  const ctx = await getAuthContext();
  if (!ctx) return { success: false, error: "Not authenticated." };
  const access = await loadHuddleForViewer(ctx, huddleId);
  if (!access.ok) return { success: false, error: access.error };
  if (!access.canManage)
    return {
      success: false,
      error: "Only the organizer or an admin can change huddle settings.",
      code: "FORBIDDEN",
    };

  const update: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (data.visibility) update.visibility = data.visibility;
  if ("departmentId" in data) update.department_id = data.departmentId ?? null;
  if ("recordingRetentionDays" in data)
    update.recording_retention_days = data.recordingRetentionDays ?? null;
  if (Object.keys(update).length === 1) return { success: true };

  const { error } = await supabaseAdmin
    .from("huddles")
    .update(update)
    .eq("id", huddleId);
  if (error) {
    console.error("[updateHuddleSettings] Update error:", error.message);
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
  options: { filter?: HuddleListFilter } = {},
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
  } else if (options.filter === "needs_attention") {
    // Ended but not finalized. The finalize permission gate is applied
    // after the visibility filter below.
    query = query
      .eq("status", "completed")
      .order("scheduled_start", { ascending: false });
  } else {
    query = query.order("scheduled_start", { ascending: false });
  }

  const { data: rows, error } = await query;
  if (error) {
    console.error("[getHuddles] Select error:", error.message);
    return { success: false, error: error.message };
  }
  // Apply visibility filter client-side since RLS is bypassed by the
  // service-role client. Mirrors the SELECT policy in JS.
  let visible = await filterVisibleHuddles(ctx, rows ?? []);
  // needs_attention only nudges people who can act on it: finalizeHuddle
  // goes through lifecycleUpdate, which requires canManage (organizer =
  // created_by, or an org admin).
  if (options.filter === "needs_attention") {
    visible = visible.filter(
      (h) => h.created_by === ctx.userId || ctx.role === "admin",
    );
  }
  const accessibleIds = visible.map((h) => h.id);

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

// Returns scheduled / in-progress huddles where the caller is on the
// attendee list. Used by the My Tasks page to render a 'Your Huddles'
// section above the task list — huddles are NOT promoted to fake
// tasks; they're a parallel object type the user can browse alongside
// their work.
export async function getMyUpcomingHuddles(): Promise<
  ActionResult<HuddleListItem[]>
> {
  const ctx = await getAuthContext();
  if (!ctx) return { success: false, error: "Not authenticated." };

  // Pull attendee links first so the huddles query stays org-scoped.
  const { data: links } = await supabaseAdmin
    .from("huddle_attendees")
    .select("huddle_id")
    .eq("profile_id", ctx.userId);
  const huddleIds = Array.from(
    new Set((links ?? []).map((r: { huddle_id: string }) => r.huddle_id)),
  );
  if (huddleIds.length === 0) return { success: true, data: [] };

  const { data: rows, error } = await supabaseAdmin
    .from("huddles")
    .select(
      "id, title, description, scheduled_start, scheduled_end, actual_start, actual_end, meeting_source, external_meeting_url, location, status, visibility, department_id, created_by, created_at",
    )
    .eq("organization_id", ctx.organizationId)
    .in("id", huddleIds)
    .in("status", ["scheduled", "in_progress"]);
  if (error) {
    console.error("[getMyUpcomingHuddles] Select error:", error.message);
    return { success: false, error: error.message };
  }

  // Counts for the standard list-card shape.
  const idList = (rows ?? []).map((r) => r.id);
  const counts = {
    attendees: new Map<string, number>(),
    agenda: new Map<string, number>(),
    actions: new Map<string, number>(),
  };
  if (idList.length > 0) {
    const [aRes, gRes, iRes] = await Promise.all([
      supabaseAdmin.from("huddle_attendees").select("huddle_id").in("huddle_id", idList),
      supabaseAdmin.from("huddle_agenda_items").select("huddle_id").in("huddle_id", idList),
      supabaseAdmin.from("huddle_action_items").select("huddle_id").in("huddle_id", idList),
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

  const items: HuddleListItem[] = (rows ?? []).map((h) => ({
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

  // Sort: in_progress first (live meetings need attention), then by
  // scheduled_start ascending. Null start times drift to the end.
  items.sort((a, b) => {
    if (a.status !== b.status) {
      if (a.status === "in_progress") return -1;
      if (b.status === "in_progress") return 1;
    }
    const av = a.scheduled_start ? new Date(a.scheduled_start).getTime() : Infinity;
    const bv = b.scheduled_start ? new Date(b.scheduled_start).getTime() : Infinity;
    return av - bv;
  });

  return { success: true, data: items };
}

// Pending action items suggested to the caller — not yet promoted to a
// task (status 'accepted') and not dismissed (the UI deletes the row).
// The assignee may not be able to see the parent huddle, so the item is
// always returned but the huddle title only when the huddle is visible.
export async function getMyHuddleActionItems(): Promise<
  ActionResult<MyHuddleActionItem[]>
> {
  const ctx = await getAuthContext();
  if (!ctx) return { success: false, error: "Not authenticated." };

  const { data: itemRows, error } = await supabaseAdmin
    .from("huddle_action_items")
    .select("id, huddle_id, description, suggested_due_date, source, created_at")
    .eq("suggested_assignee_id", ctx.userId)
    .eq("status", "pending")
    .order("created_at", { ascending: false });
  if (error) {
    console.error("[getMyHuddleActionItems] Select error:", error.message);
    return { success: false, error: error.message };
  }
  if (!itemRows || itemRows.length === 0) return { success: true, data: [] };

  const huddleIds = Array.from(new Set(itemRows.map((r) => r.huddle_id)));
  const { data: huddleRows, error: huddleError } = await supabaseAdmin
    .from("huddles")
    .select("id, title, visibility, created_by, department_id")
    .eq("organization_id", ctx.organizationId)
    .in("id", huddleIds);
  if (huddleError) {
    console.error("[getMyHuddleActionItems] Huddle select error:", huddleError.message);
    return { success: false, error: huddleError.message };
  }

  // Child tables carry no organization_id, so org scoping comes from the
  // parent huddle: items whose huddle isn't in the caller's org drop out
  // here, before anything else.
  const huddleById = new Map((huddleRows ?? []).map((h) => [h.id, h]));
  const scoped = itemRows.filter((r) => huddleById.has(r.huddle_id));

  const visibleIds = new Set(
    (await filterVisibleHuddles(ctx, Array.from(huddleById.values()))).map(
      (h) => h.id,
    ),
  );

  return {
    success: true,
    data: scoped.map((r) => {
      const canView = visibleIds.has(r.huddle_id);
      return {
        id: r.id,
        huddle_id: r.huddle_id,
        huddle_title: canView ? huddleById.get(r.huddle_id)!.title : null,
        can_view_huddle: canView,
        description: r.description,
        suggested_due_date: r.suggested_due_date,
        source: r.source as "manual" | "ai_extracted",
        created_at: r.created_at,
      };
    }),
  };
}

// Most recent decisions across every huddle the caller may see, newest
// first. Visibility can only be applied after the query, so we over-fetch
// the org's newest RECENT_DECISIONS_SCAN_CAP decisions, drop those from
// huddles the caller can't see, then slice to `limit`. If the caller can
// see fewer than `limit` of those 200, they get fewer rows even though
// older visible decisions exist — acceptable for a "recent" rail.
const RECENT_DECISIONS_SCAN_CAP = 200;
const RECENT_DECISIONS_MAX = 25;

export async function getRecentDecisions(
  limit = 8,
): Promise<ActionResult<RecentHuddleDecision[]>> {
  const ctx = await getAuthContext();
  if (!ctx) return { success: false, error: "Not authenticated." };

  // Server actions accept arbitrary args from the client — clamp to 1–25.
  const n = Math.floor(Number(limit));
  const take = Number.isFinite(n)
    ? Math.min(RECENT_DECISIONS_MAX, Math.max(1, n))
    : 8;

  // huddle_decisions has no organization_id; scope via the parent huddle.
  const { data, error } = await supabaseAdmin
    .from("huddle_decisions")
    .select(
      "id, huddle_id, decision, context, decided_by, source, decided_at, huddles!inner(id, title, visibility, created_by, department_id, organization_id)",
    )
    .eq("huddles.organization_id", ctx.organizationId)
    .order("decided_at", { ascending: false })
    .limit(RECENT_DECISIONS_SCAN_CAP);
  if (error) {
    console.error("[getRecentDecisions] Select error:", error.message);
    return { success: false, error: error.message };
  }

  type HuddleRef = {
    id: string;
    title: string;
    visibility: string;
    created_by: string;
    department_id: string | null;
    organization_id: string;
  };
  const rows = (data ?? []) as unknown as {
    id: string;
    huddle_id: string;
    decision: string;
    context: string | null;
    decided_by: string | null;
    source: string | null;
    decided_at: string;
    huddles: HuddleRef;
  }[];

  const huddleById = new Map<string, HuddleRef>();
  rows.forEach((r) => {
    if (r.huddles && r.huddles.organization_id === ctx.organizationId)
      huddleById.set(r.huddles.id, r.huddles);
  });
  const visibleIds = new Set(
    (await filterVisibleHuddles(ctx, Array.from(huddleById.values()))).map(
      (h) => h.id,
    ),
  );

  const picked = rows.filter((r) => visibleIds.has(r.huddle_id)).slice(0, take);
  const profileMap = await hydrateProfiles(picked.map((r) => r.decided_by));

  return {
    success: true,
    data: picked.map((r) => ({
      id: r.id,
      huddle_id: r.huddle_id,
      huddle_title: huddleById.get(r.huddle_id)!.title,
      decision: r.decision,
      context: r.context,
      decided_by: r.decided_by,
      source: r.source as "manual" | "ai_extracted",
      decided_at: r.decided_at,
      decider: r.decided_by ? profileMap.get(r.decided_by) ?? null : null,
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
        "id, huddle_id, decision, context, decided_by, source, decided_at",
      )
      .eq("huddle_id", huddleId)
      .order("decided_at", { ascending: true }),
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
  // Defensive notes hydrate. Separate query so a missing column doesn't
  // break the main agenda fetch — pre-ALTER environments simply get null
  // notes everywhere.
  const agendaIds = agendaRows.map((a) => a.id);
  const notesByAgendaId = new Map<string, string | null>();
  if (agendaIds.length > 0) {
    const { data: noteRows, error: notesError } = await supabaseAdmin
      .from("huddle_agenda_items")
      .select("id, notes")
      .in("id", agendaIds);
    if (notesError) {
      if (notesError.code !== "42703") {
        console.error("[getHuddle] Agenda notes fetch error:", notesError.message);
      }
      // 42703 = undefined_column. Silently ignore until the ALTER ships.
    } else {
      (noteRows ?? []).forEach((r: { id: string; notes: string | null }) => {
        notesByAgendaId.set(r.id, r.notes ?? null);
      });
    }
  }

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
      notes: notesByAgendaId.get(a.id) ?? null,
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
      // Live column is decided_at (there is no huddle_decisions.created_at);
      // the HuddleDecision field name is kept for the existing UI.
      created_at: d.decided_at,
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

export async function updateAttendeeRole(
  attendeeId: string,
  role: AttendeeRole,
): Promise<ActionResult> {
  const ctx = await getAuthContext();
  if (!ctx) return { success: false, error: "Not authenticated." };

  const { data: attendee } = await supabaseAdmin
    .from("huddle_attendees")
    .select("id, huddle_id, role")
    .eq("id", attendeeId)
    .maybeSingle();
  if (!attendee) return { success: false, error: "Attendee not found." };

  const access = await loadHuddleForViewer(ctx, attendee.huddle_id);
  if (!access.ok) return { success: false, error: access.error };
  if (!access.canManage)
    return {
      success: false,
      error: "Only the organizer or an admin can change attendee roles.",
      code: "FORBIDDEN",
    };

  // Prevent demoting the only organizer — leaves the huddle ownerless.
  if (attendee.role === "organizer" && role !== "organizer") {
    const { data: others } = await supabaseAdmin
      .from("huddle_attendees")
      .select("id")
      .eq("huddle_id", attendee.huddle_id)
      .eq("role", "organizer")
      .neq("id", attendeeId);
    if (!others || others.length === 0)
      return {
        success: false,
        error: "Promote another attendee to organizer before demoting this one.",
        code: "ORGANIZER_REQUIRED",
      };
  }

  const { error } = await supabaseAdmin
    .from("huddle_attendees")
    .update({ role })
    .eq("id", attendeeId);
  if (error) {
    console.error("[updateAttendeeRole] Update error:", error.message);
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
      // Newly created items have no notes yet; the column may also not
      // exist — either way the safe value is null.
      notes: null,
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

// Per-item notes. Defensive: if the huddle_agenda_items.notes column
// doesn't exist yet (pre-ALTER environments), surface
// SCHEMA_MISSING so the UI can show a useful placeholder rather than
// silently failing.
export async function updateAgendaItemNotes(
  itemId: string,
  notes: string,
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

  const { error } = await supabaseAdmin
    .from("huddle_agenda_items")
    .update({ notes })
    .eq("id", itemId);
  if (error) {
    if (error.code === "42703") {
      return {
        success: false,
        error:
          "The agenda notes column isn't applied yet. Run the agenda-notes ALTER in Supabase to enable per-item notes.",
        code: "SCHEMA_MISSING",
      };
    }
    console.error("[updateAgendaItemNotes] Update error:", error.message);
    return { success: false, error: error.message };
  }
  // Same pattern as updateHuddleNotes — skip revalidate so autosave
  // doesn't thrash the cache.
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
    .select("id, huddle_id, decision, context, decided_by, source, decided_at")
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
      id: row.id,
      huddle_id: row.huddle_id,
      decision: row.decision,
      context: row.context,
      decided_by: row.decided_by,
      source: row.source as "manual" | "ai_extracted",
      // Live column is decided_at; see getHuddle.
      created_at: row.decided_at,
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

  // The tasks.source + tasks.source_huddle_id columns are documented as
  // live but the original migration was applied separately from the
  // Phase 1 huddles ALTER. If they don't exist in this org's Supabase,
  // the insert will return PostgREST error 42703 ("column ... does not
  // exist"). Retry the insert without those fields so the task still
  // lands in My Tasks — we just lose the back-link, which is better
  // than silently dropping the action item promotion.
  const basePayload = {
    organization_id: ctx.organizationId,
    title: item.description.slice(0, 240),
    description: `From Huddle: ${huddleTitle}`,
    status: "todo",
    priority: "medium",
    due_date: item.suggested_due_date || null,
    assigned_to: assigneeId,
    assigned_by: ctx.userId,
    position: nextPosition,
  };

  let task: { id: string } | null = null;
  let insertError: { message: string; code?: string } | null = null;
  {
    const { data, error } = await supabaseAdmin
      .from("tasks")
      .insert({
        ...basePayload,
        source: "huddle",
        source_huddle_id: item.huddle_id,
      })
      .select("id")
      .single();
    if (error) {
      insertError = error;
      // 42703 = undefined_column. Retry without the source fields so
      // the promote still works in environments that haven't run the
      // ALTER yet. Log clearly so the gap shows up in deploy logs.
      if (error.code === "42703") {
        console.warn(
          "[promoteActionItemToTask] tasks.source columns missing — retrying without back-link. Apply the Phase 1 ALTER to enable source tracking.",
        );
        const retry = await supabaseAdmin
          .from("tasks")
          .insert(basePayload)
          .select("id")
          .single();
        task = retry.data;
        insertError = retry.error;
      }
    } else {
      task = data;
    }
  }

  if (insertError || !task) {
    console.error(
      "[promoteActionItemToTask] Task insert error:",
      insertError?.message,
    );
    return {
      success: false,
      error: insertError?.message || "Couldn't create task.",
    };
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

// ─── Recording — Phase 2 part 1 ───────────────────────────
//
// Segment model: pause/resume and the 15-minute / ~20 MB rolls each end
// a segment, so every huddle_recordings row is one self-contained audio
// file that can be uploaded and transcribed on its own. Column names
// follow the live schema (supabase/LIVE_SCHEMA_2026-09-22.md):
// file_type holds the MIME type, not mime_type; deleted_at is unused
// because delete means delete.

type RecordingRow = {
  id: string;
  huddle_id: string;
  organization_id: string;
  segment_index: number;
  storage_path: string | null;
  file_type: string | null;
  size_bytes: number | null;
  duration_seconds: number | null;
  upload_status: string;
  transcription_status: string;
  transcription_attempts: number;
  transcription_started_at: string | null;
};

const RECORDING_COLUMNS =
  "id, huddle_id, organization_id, segment_index, storage_path, file_type, size_bytes, duration_seconds, upload_status, transcription_status, transcription_attempts, transcription_started_at";

function baseMimeType(value: string): string {
  return (value.split(";")[0] ?? "").trim().toLowerCase();
}

// A recorder that crashed or had its tab closed stops heartbeating; after
// that the huddle no longer counts as live.
function isHeartbeatFresh(heartbeatAt: string | null): boolean {
  if (!heartbeatAt) return false;
  const ts = Date.parse(heartbeatAt);
  return Number.isFinite(ts) && Date.now() - ts < HUDDLE_RECORDING_STALE_MS;
}

// Recording rows are only ever read or written by the organizer or an
// org admin — the same canManage gate finalizeHuddle uses.
async function loadRecordingForManage(
  ctx: { userId: string; organizationId: string; role: Role },
  recordingId: string,
): Promise<
  | { ok: true; row: RecordingRow }
  | { ok: false; error: string; code?: string }
> {
  const { data: row } = await supabaseAdmin
    .from("huddle_recordings")
    .select(RECORDING_COLUMNS)
    .eq("id", recordingId)
    .maybeSingle();
  if (!row || row.organization_id !== ctx.organizationId)
    return { ok: false, error: "Recording not found." };
  const access = await loadHuddleForViewer(ctx, row.huddle_id);
  if (!access.ok) return { ok: false, error: access.error };
  if (!access.canManage)
    return {
      ok: false,
      error: "Only the organizer or an admin can manage recordings.",
      code: "FORBIDDEN",
    };
  return { ok: true, row: row as RecordingRow };
}

// Start recording. Refuses up front for the reasons the recorder should
// explain rather than discover halfway through a meeting.
export async function startHuddleRecording(
  huddleId: string,
): Promise<ActionResult<{ startedAt: string }>> {
  const ctx = await getAuthContext();
  if (!ctx) return { success: false, error: "Not authenticated." };
  const access = await loadHuddleForViewer(ctx, huddleId);
  if (!access.ok) return { success: false, error: access.error };
  if (!access.canManage)
    return {
      success: false,
      error: "Only the organizer or an admin can record this huddle.",
      code: "FORBIDDEN",
    };
  if (access.huddle.status !== "in_progress")
    return {
      success: false,
      error: "Start the huddle before recording.",
      code: "NOT_IN_PROGRESS",
    };

  const orgContext = await getOrgAIContext(ctx.organizationId);
  if (!orgContext.aiEnabled)
    return {
      success: false,
      error:
        "AI is turned off for this organization. An admin can re-enable it in Settings > AI Control Center.",
      code: "AI_DISABLED",
    };

  // consume_ai_credits cannot refuse (it adds unconditionally and returns
  // GREATEST(0, limit - used)), so this pre-call check is the only guard
  // against overspending. Recording is never interrupted mid-meeting for
  // credits — segments park as awaiting_credits instead.
  const remaining = await getRemainingCredits(ctx.organizationId);
  if (remaining < HUDDLE_RECORDING_MIN_CREDITS)
    return {
      success: false,
      error: `Not enough AI credits to start recording — ${remaining} left, and we hold back ${HUDDLE_RECORDING_MIN_CREDITS} (about ${HUDDLE_RECORDING_MIN_CREDITS} minutes of transcription).`,
      code: "INSUFFICIENT_CREDITS",
    };

  const { data: current } = await supabaseAdmin
    .from("huddles")
    .select("recording_state, recording_state_by, recording_heartbeat_at")
    .eq("id", huddleId)
    .maybeSingle();
  if (
    current &&
    current.recording_state !== "idle" &&
    current.recording_state_by &&
    current.recording_state_by !== ctx.userId &&
    isHeartbeatFresh(current.recording_heartbeat_at)
  )
    return {
      success: false,
      error: "This huddle is already being recorded on another device.",
      code: "ALREADY_RECORDING",
    };

  const now = new Date().toISOString();
  const { error } = await supabaseAdmin
    .from("huddles")
    .update({
      recording_state: "recording",
      recording_state_by: ctx.userId,
      recording_heartbeat_at: now,
      updated_at: now,
    })
    .eq("id", huddleId);
  if (error) {
    console.error("[startHuddleRecording] Update error:", error.message);
    return { success: false, error: error.message };
  }
  revalidatePath(`/workspace/huddles/${huddleId}`);
  return { success: true, data: { startedAt: now } };
}

// Called every ~30s while recording or paused. Also how pause/resume is
// persisted, so the consent indicator reflects the real state.
export async function heartbeatHuddleRecording(
  huddleId: string,
  state: HuddleRecordingLifecycleState,
): Promise<ActionResult> {
  const ctx = await getAuthContext();
  if (!ctx) return { success: false, error: "Not authenticated." };
  if (state !== "recording" && state !== "paused" && state !== "idle")
    return { success: false, error: "Unknown recording state.", code: "BAD_INPUT" };
  const access = await loadHuddleForViewer(ctx, huddleId);
  if (!access.ok) return { success: false, error: access.error };
  if (!access.canManage)
    return {
      success: false,
      error: "Only the organizer or an admin can record this huddle.",
      code: "FORBIDDEN",
    };

  const { error } = await supabaseAdmin
    .from("huddles")
    .update({
      recording_state: state,
      recording_state_by: ctx.userId,
      recording_heartbeat_at: new Date().toISOString(),
    })
    .eq("id", huddleId);
  if (error) {
    console.error("[heartbeatHuddleRecording] Update error:", error.message);
    return { success: false, error: error.message };
  }
  return { success: true };
}

export async function stopHuddleRecording(
  huddleId: string,
): Promise<ActionResult> {
  const ctx = await getAuthContext();
  if (!ctx) return { success: false, error: "Not authenticated." };
  const access = await loadHuddleForViewer(ctx, huddleId);
  if (!access.ok) return { success: false, error: access.error };
  if (!access.canManage)
    return {
      success: false,
      error: "Only the organizer or an admin can record this huddle.",
      code: "FORBIDDEN",
    };

  const { error } = await supabaseAdmin
    .from("huddles")
    .update({
      recording_state: "idle",
      recording_heartbeat_at: new Date().toISOString(),
    })
    .eq("id", huddleId);
  if (error) {
    console.error("[stopHuddleRecording] Update error:", error.message);
    return { success: false, error: error.message };
  }
  revalidatePath(`/workspace/huddles/${huddleId}`);
  return { success: true };
}

// Registers a finished segment and returns a signed upload URL so the
// browser can PUT the audio straight to storage. Server actions can't
// carry the bytes: their request body is capped (1 MB by default, 4.25 MB
// here) and Vercel caps function bodies at 4.5 MB, while a segment runs
// to ~20 MB.
export async function createRecordingSegmentUpload(
  input: HuddleSegmentUploadInput,
): Promise<ActionResult<HuddleSegmentUploadTicket>> {
  const ctx = await getAuthContext();
  if (!ctx) return { success: false, error: "Not authenticated." };
  const access = await loadHuddleForViewer(ctx, input.huddleId);
  if (!access.ok) return { success: false, error: access.error };
  if (!access.canManage)
    return {
      success: false,
      error: "Only the organizer or an admin can record this huddle.",
      code: "FORBIDDEN",
    };

  // Client input — validate every field.
  const mimeType = (input.mimeType ?? "").trim();
  const base = baseMimeType(mimeType);
  if (!(HUDDLE_RECORDING_ALLOWED_BASE_MIME as readonly string[]).includes(base))
    return {
      success: false,
      error: `Unsupported audio format (${mimeType || "unknown"}).`,
      code: "BAD_INPUT",
    };
  const sizeBytes = Math.floor(Number(input.sizeBytes));
  if (!Number.isFinite(sizeBytes) || sizeBytes <= 0)
    return { success: false, error: "Empty audio segment.", code: "BAD_INPUT" };
  if (sizeBytes > HUDDLE_SEGMENT_MAX_BYTES)
    return {
      success: false,
      error: "That segment is too large to transcribe (25 MB max).",
      code: "SEGMENT_TOO_LARGE",
    };
  const startedMs = Date.parse(input.startedAt);
  const endedMs = Date.parse(input.endedAt);
  if (!Number.isFinite(startedMs) || !Number.isFinite(endedMs) || endedMs < startedMs)
    return { success: false, error: "Invalid segment times.", code: "BAD_INPUT" };
  const durationSeconds = Math.max(
    0,
    Math.round(
      Number.isFinite(Number(input.durationSeconds))
        ? Number(input.durationSeconds)
        : (endedMs - startedMs) / 1000,
    ),
  );
  const bitrate = Math.floor(Number(input.audioBitsPerSecond));

  // segment_index is assigned here, never by the client: it keeps
  // counting across pause/resume and across separate sessions.
  const { data: last } = await supabaseAdmin
    .from("huddle_recordings")
    .select("segment_index")
    .eq("huddle_id", input.huddleId)
    .order("segment_index", { ascending: false })
    .limit(1)
    .maybeSingle();
  const segmentIndex = (last?.segment_index ?? -1) + 1;

  const recordingId = crypto.randomUUID();
  const storagePath = `${ctx.organizationId}/${input.huddleId}/${recordingId}.${huddleRecordingExtension(base)}`;

  const { error: insertError } = await supabaseAdmin
    .from("huddle_recordings")
    .insert({
      id: recordingId,
      huddle_id: input.huddleId,
      organization_id: ctx.organizationId,
      segment_index: segmentIndex,
      started_at: new Date(startedMs).toISOString(),
      ended_at: new Date(endedMs).toISOString(),
      duration_seconds: durationSeconds,
      // Claimed size; replaced with the real object size on confirm.
      size_bytes: sizeBytes,
      file_type: mimeType,
      audio_bits_per_second: Number.isFinite(bitrate) && bitrate > 0 ? bitrate : null,
      source_type: "browser_recording",
      storage_path: storagePath,
      uploaded_by: ctx.userId,
      upload_status: "pending_upload",
      transcription_status: "pending",
    });
  if (insertError) {
    console.error("[createRecordingSegmentUpload] Insert error:", insertError.message);
    return { success: false, error: insertError.message };
  }

  const { data: signed, error: signError } = await supabaseAdmin.storage
    .from(HUDDLE_RECORDING_BUCKET)
    .createSignedUploadUrl(storagePath);
  if (signError || !signed) {
    // No upload URL means the row can never be filled — drop it.
    await supabaseAdmin.from("huddle_recordings").delete().eq("id", recordingId);
    console.error(
      "[createRecordingSegmentUpload] Signed URL error:",
      signError?.message,
    );
    return {
      success: false,
      error: signError?.message ?? "Couldn't prepare the upload.",
    };
  }

  return {
    success: true,
    data: {
      recordingId,
      bucket: HUDDLE_RECORDING_BUCKET,
      path: signed.path,
      token: signed.token,
    },
  };
}

// Confirms the object landed. The size is read from storage rather than
// trusted from the browser, then added to the org's usage counter.
export async function completeRecordingSegmentUpload(
  recordingId: string,
): Promise<ActionResult<{ sizeBytes: number }>> {
  const ctx = await getAuthContext();
  if (!ctx) return { success: false, error: "Not authenticated." };
  const access = await loadRecordingForManage(ctx, recordingId);
  if (!access.ok)
    return { success: false, error: access.error, code: access.code };
  const row = access.row;
  if (!row.storage_path)
    return { success: false, error: "Recording has no storage path." };
  // Already confirmed — don't count the bytes twice.
  if (row.upload_status === "uploaded")
    return { success: true, data: { sizeBytes: Number(row.size_bytes ?? 0) } };

  const { data: info, error: infoError } = await supabaseAdmin.storage
    .from(HUDDLE_RECORDING_BUCKET)
    .info(row.storage_path);
  if (infoError || !info) {
    await supabaseAdmin
      .from("huddle_recordings")
      .update({ upload_status: "upload_failed" })
      .eq("id", recordingId);
    console.error(
      "[completeRecordingSegmentUpload] Object missing:",
      infoError?.message,
    );
    return {
      success: false,
      error: "The audio didn't finish uploading. Try again.",
      code: "UPLOAD_MISSING",
    };
  }

  const actualSize = Math.max(0, Math.floor(Number(info.size ?? 0)));
  const { error: updateError } = await supabaseAdmin
    .from("huddle_recordings")
    .update({
      upload_status: "uploaded",
      size_bytes: actualSize,
      uploaded_at: new Date().toISOString(),
    })
    .eq("id", recordingId);
  if (updateError) {
    console.error(
      "[completeRecordingSegmentUpload] Update error:",
      updateError.message,
    );
    return { success: false, error: updateError.message };
  }

  // Atomic +bytes; the RPC clamps at 0 and is service-role only.
  const { error: usageError } = await supabaseAdmin.rpc(
    "adjust_huddle_storage_used",
    { p_organization_id: ctx.organizationId, p_delta_bytes: actualSize },
  );
  if (usageError)
    console.error(
      "[completeRecordingSegmentUpload] Storage counter error:",
      usageError.message,
    );

  return { success: true, data: { sizeBytes: actualSize } };
}

// Transcribe one uploaded segment. Exported so the Route Handler at
// /api/huddles/recordings/[recordingId]/transcribe can call it: a server
// action inherits its timeout from the *page* that invokes it (Next
// docs, maxDuration → "Server Actions"), and that page is the huddles UI
// we don't own. The handler sets maxDuration = 300 instead. It re-checks
// auth here anyway, so calling it directly is safe.
export async function transcribeHuddleRecording(
  recordingId: string,
): Promise<ActionResult<{ status: string }>> {
  const ctx = await getAuthContext();
  if (!ctx) return { success: false, error: "Not authenticated." };
  const access = await loadRecordingForManage(ctx, recordingId);
  if (!access.ok)
    return { success: false, error: access.error, code: access.code };
  const row = access.row;

  if (row.upload_status !== "uploaded")
    return {
      success: false,
      error: "That segment hasn't finished uploading yet.",
      code: "NOT_UPLOADED",
    };
  if (row.transcription_status === "done")
    return { success: true, data: { status: "done" } };
  if (!row.storage_path)
    return { success: false, error: "Recording has no storage path." };

  // Claim the segment in one statement so two callers can't both pay
  // Whisper for it. A 'processing' row whose attempt started over ten
  // minutes ago is treated as abandoned (killed function, closed tab).
  const nowIso = new Date().toISOString();
  const staleCutoff = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const { data: claimed } = await supabaseAdmin
    .from("huddle_recordings")
    .update({
      transcription_status: "processing",
      transcription_started_at: nowIso,
      transcription_attempts: row.transcription_attempts + 1,
      transcription_error: null,
    })
    .eq("id", recordingId)
    .or(
      `transcription_status.in.(pending,failed,awaiting_credits),and(transcription_status.eq.processing,transcription_started_at.lt.${staleCutoff})`,
    )
    .select("id")
    .maybeSingle();
  if (!claimed)
    // Another call holds it; the UI polls the segment list for the result.
    return { success: true, data: { status: "processing" } };

  // 1 credit per minute, rounded up. consume_ai_credits can't refuse, so
  // this pre-check is the only thing standing between an out-of-credit
  // org and an overspend. Parked segments stay retryable.
  const needed = Math.max(1, Math.ceil((row.duration_seconds ?? 0) / 60));
  const remaining = await getRemainingCredits(ctx.organizationId);
  if (remaining < needed) {
    await supabaseAdmin
      .from("huddle_recordings")
      .update({
        transcription_status: "awaiting_credits",
        transcription_error: `Needs ${needed} credit(s); ${remaining} left.`,
      })
      .eq("id", recordingId);
    return {
      success: false,
      error: `Out of AI credits — this segment is saved and will transcribe once credits are topped up (needs ${needed}, ${remaining} left).`,
      code: "AWAITING_CREDITS",
    };
  }

  const { data: audio, error: downloadError } = await supabaseAdmin.storage
    .from(HUDDLE_RECORDING_BUCKET)
    .download(row.storage_path);
  if (downloadError || !audio) {
    await supabaseAdmin
      .from("huddle_recordings")
      .update({
        transcription_status: "failed",
        transcription_error: downloadError?.message ?? "Audio not found.",
      })
      .eq("id", recordingId);
    return {
      success: false,
      error: downloadError?.message ?? "Couldn't read the audio.",
    };
  }

  // Whisper sniffs the format from the filename extension, so pass one
  // that matches what the browser actually recorded.
  const fileType = row.file_type ?? "audio/webm";
  const base = baseMimeType(fileType);
  const result = await transcribeAudio({
    organizationId: ctx.organizationId,
    userId: ctx.userId,
    audio,
    filename: `${row.id}.${huddleRecordingExtension(base)}`,
    contentType: base,
    language: "en",
  });
  if (!result.success) {
    await supabaseAdmin
      .from("huddle_recordings")
      .update({
        transcription_status: "failed",
        transcription_error: result.error.slice(0, 500),
      })
      .eq("id", recordingId);
    return { success: false, error: result.error };
  }

  // One transcript row per segment (recording_id is UNIQUE). full_text is
  // the live column — there is no `content`.
  const { error: transcriptError } = await supabaseAdmin
    .from("huddle_transcripts")
    .upsert(
      {
        huddle_id: row.huddle_id,
        recording_id: row.id,
        full_text: result.transcript,
        segments: result.segments,
        language: "en",
        model_used: "whisper-1",
      },
      { onConflict: "recording_id" },
    );
  if (transcriptError) {
    // The credits are already spent, so record why the text was lost.
    await supabaseAdmin
      .from("huddle_recordings")
      .update({
        transcription_status: "failed",
        transcription_error: transcriptError.message.slice(0, 500),
      })
      .eq("id", recordingId);
    console.error(
      "[transcribeHuddleRecording] Transcript insert error:",
      transcriptError.message,
    );
    return { success: false, error: transcriptError.message };
  }

  await supabaseAdmin
    .from("huddle_recordings")
    .update({ transcription_status: "done", transcription_error: null })
    .eq("id", recordingId);

  revalidatePath(`/workspace/huddles/${row.huddle_id}`);
  return { success: true, data: { status: "done" } };
}
