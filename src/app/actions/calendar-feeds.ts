"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

// ─── Types ──────────────────────────────────────────────

export type FeedToken = {
  id: string;
  token: string;
  feed_type: string;
  department_id: string | null;
  is_active: boolean;
  created_at: string;
  last_accessed_at: string | null;
  department_name?: string;
};

type ActionResult = {
  success: boolean;
  error?: string;
  url?: string;
};

// ─── Helpers ────────────────────────────────────────────

async function getAuthContext() {
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

  return { userId: user.id, organizationId: org.id };
}

// ─── Create Feed Token ─────────────────────────────────

export async function createFeedToken(
  feedType: string,
  departmentId?: string
): Promise<ActionResult> {
  const ctx = await getAuthContext();
  if (!ctx) {
    return { success: false, error: "Not authenticated." };
  }

  const token = crypto.randomUUID();

  const { error } = await supabaseAdmin
    .from("calendar_feed_tokens")
    .insert({
      user_id: ctx.userId,
      organization_id: ctx.organizationId,
      token,
      feed_type: feedType,
      department_id: departmentId || null,
      is_active: true,
    });

  if (error) {
    console.error("[createFeedToken] Error:", error.message);
    return { success: false, error: error.message };
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(".supabase.co", "");
  const feedUrl = `${baseUrl}/api/calendar-feed/${token}`;

  revalidatePath("/settings/calendar-feeds");
  return { success: true, url: feedUrl };
}

// ─── Revoke Feed Token ─────────────────────────────────

export async function revokeFeedToken(tokenId: string): Promise<ActionResult> {
  const ctx = await getAuthContext();
  if (!ctx) {
    return { success: false, error: "Not authenticated." };
  }

  const { error } = await supabaseAdmin
    .from("calendar_feed_tokens")
    .update({ is_active: false })
    .eq("id", tokenId)
    .eq("user_id", ctx.userId);

  if (error) {
    console.error("[revokeFeedToken] Error:", error.message);
    return { success: false, error: error.message };
  }

  revalidatePath("/settings/calendar-feeds");
  return { success: true };
}

// ─── Get Feed Tokens ───────────────────────────────────

export async function getFeedTokens(): Promise<FeedToken[]> {
  const ctx = await getAuthContext();
  if (!ctx) return [];

  const { data: tokens, error } = await supabaseAdmin
    .from("calendar_feed_tokens")
    .select("id, token, feed_type, department_id, is_active, created_at, last_accessed_at")
    .eq("user_id", ctx.userId)
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  if (error || !tokens) return [];

  // Fetch department names for department-type feeds
  const deptIds = tokens
    .filter((t: { department_id: string | null }) => t.department_id)
    .map((t: { department_id: string | null }) => t.department_id!);

  let deptMap: Record<string, string> = {};
  if (deptIds.length > 0) {
    const { data: depts } = await supabaseAdmin
      .from("departments")
      .select("id, name")
      .in("id", deptIds);

    if (depts) {
      deptMap = Object.fromEntries(
        depts.map((d: { id: string; name: string }) => [d.id, d.name])
      );
    }
  }

  return tokens.map((t: {
    id: string;
    token: string;
    feed_type: string;
    department_id: string | null;
    is_active: boolean;
    created_at: string;
    last_accessed_at: string | null;
  }) => ({
    ...t,
    department_name: t.department_id ? deptMap[t.department_id] : undefined,
  }));
}
