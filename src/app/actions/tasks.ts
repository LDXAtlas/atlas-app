"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { can, getRoleFromProfile } from "@/lib/permissions";

// ─── Types ──────────────────────────────────────────────
export type TaskInput = {
  title: string;
  description?: string;
  priority?: "low" | "medium" | "high" | "urgent";
  due_date?: string | null;
  assigned_to?: string | null;
  department_id?: string | null;
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

// ─── Create Task ────────────────────────────────────────
export async function createTask(data: TaskInput): Promise<ActionResult> {
  const ctx = await getAuthContext();
  if (!ctx)
    return {
      success: false,
      error: "Not authenticated or no organization found.",
    };

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", ctx.userId)
    .single();
  const role = getRoleFromProfile(profile);

  if (!can.createTask(role)) {
    return { success: false, error: "You don't have permission to do this." };
  }

  if (!data.title?.trim()) {
    return { success: false, error: "Title is required." };
  }

  // Get max position for ordering
  const { data: maxPos } = await supabaseAdmin
    .from("tasks")
    .select("position")
    .eq("organization_id", ctx.organizationId)
    .order("position", { ascending: false })
    .limit(1)
    .single();

  const nextPosition = (maxPos?.position ?? 0) + 1;

  const { data: task, error } = await supabaseAdmin
    .from("tasks")
    .insert({
      organization_id: ctx.organizationId,
      title: data.title.trim(),
      description: data.description?.trim() || null,
      status: "todo",
      priority: data.priority || "low",
      due_date: data.due_date || null,
      assigned_to: data.assigned_to || ctx.userId,
      assigned_by: ctx.userId,
      department_id: data.department_id || null,
      position: nextPosition,
    })
    .select("id")
    .single();

  if (error) {
    console.error("[createTask] Error:", error.message);
    return { success: false, error: error.message };
  }

  revalidatePath("/workspace/tasks");
  revalidatePath("/dashboard");
  return { success: true, id: task?.id };
}

// ─── Update Task ────────────────────────────────────────
export async function updateTask(
  id: string,
  data: Partial<TaskInput> & { status?: string },
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
  if (data.priority !== undefined) updates.priority = data.priority;
  if (data.due_date !== undefined) updates.due_date = data.due_date || null;
  if (data.assigned_to !== undefined)
    updates.assigned_to = data.assigned_to || null;
  if (data.department_id !== undefined)
    updates.department_id = data.department_id || null;
  if (data.status !== undefined) updates.status = data.status;

  const { error } = await supabaseAdmin
    .from("tasks")
    .update(updates)
    .eq("id", id)
    .eq("organization_id", ctx.organizationId);

  if (error) {
    console.error("[updateTask] Error:", error.message);
    return { success: false, error: error.message };
  }

  revalidatePath("/workspace/tasks");
  revalidatePath("/dashboard");
  return { success: true };
}

// ─── Delete Task ────────────────────────────────────────
export async function deleteTask(id: string): Promise<ActionResult> {
  const ctx = await getAuthContext();
  if (!ctx)
    return {
      success: false,
      error: "Not authenticated or no organization found.",
    };

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", ctx.userId)
    .single();
  const role = getRoleFromProfile(profile);

  if (!can.deleteAnyTask(role)) {
    return { success: false, error: "You don't have permission to do this." };
  }

  const { error } = await supabaseAdmin
    .from("tasks")
    .delete()
    .eq("id", id)
    .eq("organization_id", ctx.organizationId);

  if (error) {
    console.error("[deleteTask] Error:", error.message);
    return { success: false, error: error.message };
  }

  revalidatePath("/workspace/tasks");
  revalidatePath("/dashboard");
  return { success: true };
}

// ─── Toggle Task Complete ───────────────────────────────
export async function toggleTaskComplete(id: string): Promise<ActionResult> {
  const ctx = await getAuthContext();
  if (!ctx)
    return {
      success: false,
      error: "Not authenticated or no organization found.",
    };

  // Fetch current status
  const { data: current, error: fetchError } = await supabaseAdmin
    .from("tasks")
    .select("status")
    .eq("id", id)
    .eq("organization_id", ctx.organizationId)
    .single();

  if (fetchError || !current) {
    return { success: false, error: "Task not found." };
  }

  const isDone = current.status === "done";
  const { error } = await supabaseAdmin
    .from("tasks")
    .update({
      status: isDone ? "todo" : "done",
      completed_at: isDone ? null : new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("organization_id", ctx.organizationId);

  if (error) {
    console.error("[toggleTaskComplete] Error:", error.message);
    return { success: false, error: error.message };
  }

  revalidatePath("/workspace/tasks");
  revalidatePath("/dashboard");
  return { success: true };
}

// ─── Toggle Task Star ───────────────────────────────────
// TODO: The schema does not have a 'starred' column. For now, star state
// is managed in client-side local state only. If we add a 'starred' boolean
// column to the tasks table in the future, uncomment and use this action.
//
// export async function toggleTaskStar(id: string): Promise<ActionResult> {
//   ...
// }
