"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

// ─── Types ──────────────────────────────────────────────

export type EventInput = {
  title: string;
  description?: string;
  event_type?: string;
  visibility?: string;
  starts_at: string;
  ends_at?: string;
  is_all_day?: boolean;
  timezone?: string;
  location?: string;
  location_type?: string;
  virtual_url?: string;
  color?: string;
  department_id?: string | null;
  department_ids?: string[];
  recurrence_frequency?: string;
  recurrence_rule?: string;
  status?: string;
};

export type ActionResult = {
  success: boolean;
  error?: string;
  id?: string;
};

// ─── Helpers ────────────────────────────────────────────

async function getAuthContext(): Promise<{
  userId: string;
  organizationId: string;
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
    .select("id")
    .eq("id", user.id)
    .single();

  if (!profile?.id) return null;

  return { userId: profile.id, organizationId: org.id };
}

// ─── Create Event ──────────────────────────────────────

export async function createEvent(data: EventInput): Promise<ActionResult> {
  const ctx = await getAuthContext();
  if (!ctx)
    return {
      success: false,
      error: "Not authenticated or no organization found.",
    };

  if (!data.title?.trim()) {
    return { success: false, error: "Title is required." };
  }

  if (!data.starts_at) {
    return { success: false, error: "Start date/time is required." };
  }

  const { data: event, error } = await supabaseAdmin
    .from("events")
    .insert({
      organization_id: ctx.organizationId,
      title: data.title.trim(),
      description: data.description?.trim() || null,
      event_type: data.event_type || "general",
      visibility: data.visibility || "public",
      starts_at: data.starts_at,
      ends_at: data.ends_at || null,
      is_all_day: data.is_all_day || false,
      timezone: data.timezone || "America/New_York",
      location: data.location?.trim() || null,
      location_type: data.location_type || "in_person",
      virtual_url: data.virtual_url?.trim() || null,
      color: data.color || "#5CE1A5",
      department_id: data.department_id || null,
      owner_user_id: ctx.userId,
      recurrence_frequency: data.recurrence_frequency || "none",
      recurrence_rule: data.recurrence_rule?.trim() || null,
      status: data.status || "confirmed",
      created_by: ctx.userId,
    })
    .select("id")
    .single();

  if (error) {
    console.error("[createEvent] Error:", error.message);
    return { success: false, error: error.message };
  }

  // Insert multi-department associations
  if (event?.id && data.department_ids && data.department_ids.length > 0) {
    const rows = data.department_ids.map((deptId) => ({
      event_id: event.id,
      department_id: deptId,
    }));
    await supabaseAdmin.from("event_departments").insert(rows);
  }

  revalidatePath("/workspace/events");
  revalidatePath("/workspace/calendar");
  revalidatePath("/dashboard");
  return { success: true, id: event?.id };
}

// ─── Update Event ──────────────────────────────────────

export async function updateEvent(
  id: string,
  data: Partial<EventInput>,
): Promise<ActionResult> {
  const ctx = await getAuthContext();
  if (!ctx)
    return {
      success: false,
      error: "Not authenticated or no organization found.",
    };

  const updates: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (data.title !== undefined) updates.title = data.title.trim();
  if (data.description !== undefined)
    updates.description = data.description?.trim() || null;
  if (data.event_type !== undefined) updates.event_type = data.event_type;
  if (data.visibility !== undefined) updates.visibility = data.visibility;
  if (data.starts_at !== undefined) updates.starts_at = data.starts_at;
  if (data.ends_at !== undefined) updates.ends_at = data.ends_at || null;
  if (data.is_all_day !== undefined) updates.is_all_day = data.is_all_day;
  if (data.timezone !== undefined) updates.timezone = data.timezone;
  if (data.location !== undefined)
    updates.location = data.location?.trim() || null;
  if (data.location_type !== undefined)
    updates.location_type = data.location_type;
  if (data.virtual_url !== undefined)
    updates.virtual_url = data.virtual_url?.trim() || null;
  if (data.color !== undefined) updates.color = data.color;
  if (data.department_id !== undefined)
    updates.department_id = data.department_id || null;
  if (data.recurrence_frequency !== undefined)
    updates.recurrence_frequency = data.recurrence_frequency;
  if (data.recurrence_rule !== undefined)
    updates.recurrence_rule = data.recurrence_rule?.trim() || null;
  if (data.status !== undefined) updates.status = data.status;

  const { error } = await supabaseAdmin
    .from("events")
    .update(updates)
    .eq("id", id)
    .eq("organization_id", ctx.organizationId);

  if (error) {
    console.error("[updateEvent] Error:", error.message);
    return { success: false, error: error.message };
  }

  // Update multi-department associations
  if (data.department_ids !== undefined) {
    await supabaseAdmin.from("event_departments").delete().eq("event_id", id);
    if (data.department_ids.length > 0) {
      const rows = data.department_ids.map((deptId) => ({
        event_id: id,
        department_id: deptId,
      }));
      await supabaseAdmin.from("event_departments").insert(rows);
    }
  }

  revalidatePath("/workspace/events");
  revalidatePath("/workspace/calendar");
  revalidatePath("/dashboard");
  return { success: true };
}

// ─── Delete Event ──────────────────────────────────────

export async function deleteEvent(id: string): Promise<ActionResult> {
  const ctx = await getAuthContext();
  if (!ctx)
    return {
      success: false,
      error: "Not authenticated or no organization found.",
    };

  const { error } = await supabaseAdmin
    .from("events")
    .delete()
    .eq("id", id)
    .eq("organization_id", ctx.organizationId);

  if (error) {
    console.error("[deleteEvent] Error:", error.message);
    return { success: false, error: error.message };
  }

  revalidatePath("/workspace/events");
  revalidatePath("/workspace/calendar");
  revalidatePath("/dashboard");
  return { success: true };
}

// ─── Cancel Event ──────────────────────────────────────

export async function cancelEvent(id: string): Promise<ActionResult> {
  const ctx = await getAuthContext();
  if (!ctx)
    return {
      success: false,
      error: "Not authenticated or no organization found.",
    };

  const { error } = await supabaseAdmin
    .from("events")
    .update({
      status: "cancelled",
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("organization_id", ctx.organizationId);

  if (error) {
    console.error("[cancelEvent] Error:", error.message);
    return { success: false, error: error.message };
  }

  revalidatePath("/workspace/events");
  revalidatePath("/workspace/calendar");
  revalidatePath("/dashboard");
  return { success: true };
}

// ─── Create Custom Event Type ──────────────────────────

export async function createCustomEventType(
  name: string,
  color: string,
): Promise<ActionResult> {
  const ctx = await getAuthContext();
  if (!ctx)
    return {
      success: false,
      error: "Not authenticated or no organization found.",
    };

  if (!name?.trim()) {
    return { success: false, error: "Name is required." };
  }

  const { data: eventType, error } = await supabaseAdmin
    .from("custom_event_types")
    .insert({
      organization_id: ctx.organizationId,
      name: name.trim(),
      color: color || "#6B7280",
      created_by: ctx.userId,
    })
    .select("id")
    .single();

  if (error) {
    console.error("[createCustomEventType] Error:", error.message);
    return { success: false, error: error.message };
  }

  revalidatePath("/workspace/calendar");
  return { success: true, id: eventType?.id };
}
