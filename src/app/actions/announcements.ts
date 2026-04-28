"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

// ─── Types ──────────────────────────────────────────────
export type AnnouncementInput = {
  title: string;
  content: string;
  category: "general" | "staff" | "ministry";
  target_department_id?: string | null;
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

  // Get the profile id (same as auth user id)
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .eq("id", user.id)
    .single();

  if (!profile?.id) return null;

  return { userId: profile.id, organizationId: org.id };
}

// ─── Create Announcement ────────────────────────────────
export async function createAnnouncement(
  data: AnnouncementInput,
): Promise<ActionResult> {
  const ctx = await getAuthContext();
  if (!ctx) return { success: false, error: "Not authenticated or no organization found." };

  if (!data.title?.trim()) {
    return { success: false, error: "Title is required." };
  }
  if (!data.content?.trim()) {
    return { success: false, error: "Content is required." };
  }

  const { data: announcement, error } = await supabaseAdmin
    .from("announcements")
    .insert({
      organization_id: ctx.organizationId,
      author_id: ctx.userId,
      title: data.title.trim(),
      content: data.content.trim(),
      category: data.category || "general",
      target_department_id: data.target_department_id || null,
      is_pinned: false,
      is_published: true,
      published_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (error) {
    console.error("[createAnnouncement] Error:", error.message);
    return { success: false, error: error.message };
  }

  revalidatePath("/workspace/announcements");
  revalidatePath("/dashboard");
  return { success: true, id: announcement?.id };
}

// ─── Delete Announcement ────────────────────────────────
export async function deleteAnnouncement(id: string): Promise<ActionResult> {
  const ctx = await getAuthContext();
  if (!ctx) return { success: false, error: "Not authenticated or no organization found." };

  const { error } = await supabaseAdmin
    .from("announcements")
    .delete()
    .eq("id", id)
    .eq("organization_id", ctx.organizationId);

  if (error) {
    console.error("[deleteAnnouncement] Error:", error.message);
    return { success: false, error: error.message };
  }

  revalidatePath("/workspace/announcements");
  return { success: true };
}

// ─── Toggle Pin ─────────────────────────────────────────
export async function togglePin(id: string): Promise<ActionResult> {
  const ctx = await getAuthContext();
  if (!ctx) return { success: false, error: "Not authenticated or no organization found." };

  // Fetch current pin status
  const { data: current, error: fetchError } = await supabaseAdmin
    .from("announcements")
    .select("is_pinned")
    .eq("id", id)
    .eq("organization_id", ctx.organizationId)
    .single();

  if (fetchError || !current) {
    return { success: false, error: "Announcement not found." };
  }

  const { error } = await supabaseAdmin
    .from("announcements")
    .update({ is_pinned: !current.is_pinned })
    .eq("id", id)
    .eq("organization_id", ctx.organizationId);

  if (error) {
    console.error("[togglePin] Error:", error.message);
    return { success: false, error: error.message };
  }

  revalidatePath("/workspace/announcements");
  return { success: true };
}

// ─── Mark as Read ───────────────────────────────────────
export async function markAsRead(
  announcementId: string,
): Promise<ActionResult> {
  const ctx = await getAuthContext();
  if (!ctx) return { success: false, error: "Not authenticated." };

  const { error } = await supabaseAdmin
    .from("announcement_reads")
    .upsert(
      {
        announcement_id: announcementId,
        user_id: ctx.userId,
        read_at: new Date().toISOString(),
      },
      { onConflict: "announcement_id,user_id" },
    );

  if (error) {
    console.error("[markAsRead] Error:", error.message);
    return { success: false, error: error.message };
  }

  return { success: true };
}
