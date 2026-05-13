"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  createTaskComment,
  deleteTaskComment,
  getTaskComments,
  updateTaskComment,
  type TaskComment,
} from "@/app/actions/tasks";
import {
  CommentsSection,
  type CommentShape,
} from "@/app/(app)/workspace/projects/[id]/_components/comments-section";

// Wrapper that fetches task comments + viewer identity / role and feeds
// the same CommentsSection used by board cards. Reuses the @mention
// renderer, pill styling, and notification routing — only the action
// imports differ.

interface TaskCommentsProps {
  taskId: string;
}

export function TaskComments({ taskId }: TaskCommentsProps) {
  const [comments, setComments] = useState<TaskComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewerId, setViewerId] = useState<string | null>(null);
  const [viewerIsAdmin, setViewerIsAdmin] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data }) => {
      if (cancelled || !data.user) return;
      setViewerId(data.user.id);
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", data.user.id)
        .maybeSingle();
      if (!cancelled) setViewerIsAdmin(profile?.role === "admin");
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getTaskComments(taskId).then((res) => {
      if (cancelled) return;
      if (res.success) setComments(res.data);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [taskId]);

  if (loading) {
    return (
      <p
        className="text-[12px] text-[#9CA3AF] text-center py-3"
        style={{ fontFamily: "var(--font-source-sans)" }}
      >
        Loading comments…
      </p>
    );
  }

  return (
    <CommentsSection
      comments={comments as CommentShape[]}
      viewerId={viewerId ?? ""}
      viewerIsAdmin={viewerIsAdmin}
      onCreate={async (content) => {
        const res = await createTaskComment(taskId, content);
        return res.success ? (res.data as CommentShape) : null;
      }}
      onUpdate={async (id, content) => {
        const res = await updateTaskComment(id, content);
        return res.success ? (res.data as CommentShape) : null;
      }}
      onDelete={async (id) => {
        const res = await deleteTaskComment(id);
        return res.success;
      }}
    />
  );
}
