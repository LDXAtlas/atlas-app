"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { can, getRoleFromProfile } from "@/lib/permissions";
import type { Role } from "@/lib/permissions";

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

// ─── Task comments ──────────────────────────────────────
//
// Mirrors the card comment pattern from boards.ts — same @mention token
// format (@[Full Name](profile-uuid)), same notification routing rules,
// same author-or-admin delete gate. The notification type is
// `task_comment` (already in the type union with email opt-in disabled
// by default).

const TASK_MENTION_RE = /@\[[^\]]+\]\(([0-9a-fA-F-]{36})\)/g;
function parseTaskMentions(content: string): string[] {
  const ids = new Set<string>();
  let match: RegExpExecArray | null;
  while ((match = TASK_MENTION_RE.exec(content)) !== null) ids.add(match[1]);
  return Array.from(ids);
}

export type TaskCommentAuthor = {
  id: string;
  full_name: string;
  avatar_color: string;
  role: Role | null;
};

export type TaskComment = {
  id: string;
  task_id: string;
  author_id: string;
  content: string;
  created_at: string;
  updated_at: string;
  author: TaskCommentAuthor | null;
};

async function joinTaskCommentAuthors(
  rows: {
    id: string;
    task_id: string;
    author_id: string;
    content: string;
    created_at: string;
    updated_at: string;
  }[],
): Promise<TaskComment[]> {
  if (rows.length === 0) return [];
  const ids = Array.from(new Set(rows.map((r) => r.author_id)));
  const { data: profiles } = await supabaseAdmin
    .from("profiles")
    .select("id, full_name, avatar_color, role")
    .in("id", ids);
  const byId = new Map<string, TaskCommentAuthor>();
  (profiles ?? []).forEach(
    (p: {
      id: string;
      full_name: string | null;
      avatar_color: string | null;
      role: Role | null;
    }) => {
      byId.set(p.id, {
        id: p.id,
        full_name: p.full_name || "Teammate",
        avatar_color: p.avatar_color || "#5CE1A5",
        role: p.role ?? null,
      });
    },
  );
  return rows.map((r) => ({ ...r, author: byId.get(r.author_id) ?? null }));
}

async function loadTaskForViewer(
  taskId: string,
  organizationId: string,
): Promise<{ ok: true; task: { id: string; title: string; assigned_to: string | null; created_by: string | null } } | { ok: false; error: string }> {
  const { data: task } = await supabaseAdmin
    .from("tasks")
    .select("id, title, assigned_to, created_by, organization_id")
    .eq("id", taskId)
    .maybeSingle();
  if (!task) return { ok: false, error: "Task not found." };
  if (task.organization_id !== organizationId)
    return { ok: false, error: "Task not found." };
  return {
    ok: true,
    task: {
      id: task.id,
      title: task.title,
      assigned_to: task.assigned_to,
      created_by: task.created_by,
    },
  };
}

export async function getTaskComments(
  taskId: string,
): Promise<{ success: true; data: TaskComment[] } | { success: false; error: string }> {
  const ctx = await getAuthContext();
  if (!ctx) return { success: false, error: "Not authenticated." };
  const access = await loadTaskForViewer(taskId, ctx.organizationId);
  if (!access.ok) return { success: false, error: access.error };

  const { data, error } = await supabaseAdmin
    .from("task_comments")
    .select("id, task_id, author_id, content, created_at, updated_at")
    .eq("task_id", taskId)
    .order("created_at", { ascending: true });
  if (error) {
    console.error("[getTaskComments] Select error:", error.message);
    return { success: false, error: error.message };
  }
  const comments = await joinTaskCommentAuthors(data ?? []);
  return { success: true, data: comments };
}

export async function createTaskComment(
  taskId: string,
  content: string,
): Promise<
  | { success: true; data: TaskComment }
  | { success: false; error: string }
> {
  const ctx = await getAuthContext();
  if (!ctx) return { success: false, error: "Not authenticated." };
  const trimmed = content.trim();
  if (!trimmed) return { success: false, error: "Comment is empty." };

  const access = await loadTaskForViewer(taskId, ctx.organizationId);
  if (!access.ok) return { success: false, error: access.error };

  const { data: row, error } = await supabaseAdmin
    .from("task_comments")
    .insert({ task_id: taskId, author_id: ctx.userId, content: trimmed })
    .select("id, task_id, author_id, content, created_at, updated_at")
    .single();
  if (error || !row) {
    console.error("[createTaskComment] Insert error:", error?.message);
    return { success: false, error: error?.message || "Couldn't post comment." };
  }
  const [comment] = await joinTaskCommentAuthors([row]);

  // Notification fan-out — assignee + creator + mentioned profiles. Best
  // effort; never block on a failure.
  try {
    const { createNotification } = await import("@/app/actions/notifications");
    const actorName = comment?.author?.full_name || "A teammate";
    const taskTitle = access.task.title || "a task";
    const actionUrl = `/workspace/tasks?task=${taskId}`;
    const sent = new Set<string>([ctx.userId]);

    for (const recipientId of parseTaskMentions(trimmed)) {
      if (sent.has(recipientId)) continue;
      sent.add(recipientId);
      await createNotification({
        recipientId,
        organizationId: ctx.organizationId,
        actorId: ctx.userId,
        type: "mention",
        title: `${actorName} mentioned you`,
        body: `On "${taskTitle}" — ${trimmed.slice(0, 140)}`,
        entityType: "task",
        entityId: taskId,
        actionUrl,
      });
    }

    const baseRecipients = [access.task.assigned_to, access.task.created_by]
      .filter((id): id is string => !!id);
    for (const recipientId of baseRecipients) {
      if (sent.has(recipientId)) continue;
      sent.add(recipientId);
      await createNotification({
        recipientId,
        organizationId: ctx.organizationId,
        actorId: ctx.userId,
        type: "task_comment",
        title: `${actorName} commented on "${taskTitle}"`,
        body: trimmed.slice(0, 180),
        entityType: "task",
        entityId: taskId,
        actionUrl,
      });
    }
  } catch (err) {
    console.error("[createTaskComment] Notification send failed:", err);
  }

  revalidatePath("/workspace/tasks");
  return { success: true, data: comment };
}

export async function updateTaskComment(
  commentId: string,
  content: string,
): Promise<
  | { success: true; data: TaskComment }
  | { success: false; error: string }
> {
  const ctx = await getAuthContext();
  if (!ctx) return { success: false, error: "Not authenticated." };
  const trimmed = content.trim();
  if (!trimmed) return { success: false, error: "Comment is empty." };

  const { data: existing } = await supabaseAdmin
    .from("task_comments")
    .select("id, task_id, author_id")
    .eq("id", commentId)
    .maybeSingle();
  if (!existing) return { success: false, error: "Comment not found." };
  if (existing.author_id !== ctx.userId)
    return { success: false, error: "You can only edit your own comments." };

  const { data: row, error } = await supabaseAdmin
    .from("task_comments")
    .update({ content: trimmed, updated_at: new Date().toISOString() })
    .eq("id", commentId)
    .select("id, task_id, author_id, content, created_at, updated_at")
    .single();
  if (error || !row) {
    console.error("[updateTaskComment] Update error:", error?.message);
    return { success: false, error: error?.message || "Couldn't save." };
  }
  const [comment] = await joinTaskCommentAuthors([row]);
  revalidatePath("/workspace/tasks");
  return { success: true, data: comment };
}

export async function deleteTaskComment(
  commentId: string,
): Promise<ActionResult> {
  const ctx = await getAuthContext();
  if (!ctx) return { success: false, error: "Not authenticated." };

  // Re-resolve the viewer's role since our local auth context doesn't
  // carry it (older module than boards.ts). One small select is fine.
  const { data: viewer } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", ctx.userId)
    .maybeSingle();
  const viewerRole: Role | null = (viewer?.role as Role | undefined) ?? null;

  const { data: existing } = await supabaseAdmin
    .from("task_comments")
    .select("id, task_id, author_id")
    .eq("id", commentId)
    .maybeSingle();
  if (!existing) return { success: false, error: "Comment not found." };
  if (existing.author_id !== ctx.userId && viewerRole !== "admin")
    return { success: false, error: "You can't delete this comment." };

  const { error } = await supabaseAdmin
    .from("task_comments")
    .delete()
    .eq("id", commentId);
  if (error) {
    console.error("[deleteTaskComment] Delete error:", error.message);
    return { success: false, error: error.message };
  }
  revalidatePath("/workspace/tasks");
  return { success: true };
}
