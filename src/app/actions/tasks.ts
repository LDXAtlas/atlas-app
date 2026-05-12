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

  // Notify the assignee if it's someone other than the actor. Self-assign
  // doesn't notify. Best-effort — failure here doesn't roll back the task.
  const assigneeId = data.assigned_to || null;
  if (task?.id && assigneeId && assigneeId !== ctx.userId) {
    try {
      const { createNotification } = await import("@/app/actions/notifications");
      const { data: actor } = await supabaseAdmin
        .from("profiles")
        .select("full_name, email")
        .eq("id", ctx.userId)
        .maybeSingle();
      const actorName =
        actor?.full_name || actor?.email?.split("@")[0] || "A teammate";
      const titleSnippet = data.title.trim().slice(0, 100);
      await createNotification({
        recipientId: assigneeId,
        organizationId: ctx.organizationId,
        actorId: ctx.userId,
        type: "task_assigned",
        title: `${actorName} assigned you a task`,
        body: titleSnippet,
        entityType: "task",
        entityId: task.id,
        actionUrl: `/workspace/tasks?taskId=${task.id}`,
      });
    } catch (err) {
      console.error("[createTask] Notification send failed:", err);
    }
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

  // Pull the current assignment + title so we can both detect a real
  // reassign and craft notification copy without an extra round-trip.
  const { data: existing } = await supabaseAdmin
    .from("tasks")
    .select("title, assigned_to")
    .eq("id", id)
    .eq("organization_id", ctx.organizationId)
    .maybeSingle();

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

  // Notify the new assignee on a real reassign (and not a no-op self-save).
  const newAssignee =
    data.assigned_to !== undefined
      ? data.assigned_to || null
      : existing?.assigned_to ?? null;
  const reassigned =
    data.assigned_to !== undefined && newAssignee !== existing?.assigned_to;
  if (reassigned && newAssignee && newAssignee !== ctx.userId) {
    try {
      const { createNotification } = await import("@/app/actions/notifications");
      const { data: actor } = await supabaseAdmin
        .from("profiles")
        .select("full_name, email")
        .eq("id", ctx.userId)
        .maybeSingle();
      const actorName =
        actor?.full_name || actor?.email?.split("@")[0] || "A teammate";
      const taskTitle =
        (updates.title as string) || existing?.title || "a task";
      await createNotification({
        recipientId: newAssignee,
        organizationId: ctx.organizationId,
        actorId: ctx.userId,
        type: "task_assigned",
        title: `${actorName} assigned you a task`,
        body: taskTitle.slice(0, 100),
        entityType: "task",
        entityId: id,
        actionUrl: `/workspace/tasks?taskId=${id}`,
      });
    } catch (err) {
      console.error("[updateTask] Notification send failed:", err);
    }
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
