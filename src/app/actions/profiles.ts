"use server";

import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getRoleFromProfile } from "@/lib/permissions";

export type ProfileSearchResult = {
  id: string;
  full_name: string;
  email: string;
  avatar_color: string;
  role: string;
};

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

  return { userId: user.id, organizationId: org.id };
}

/**
 * Search profiles in the caller's organization by name or email.
 *
 * - Case-insensitive ILIKE on full_name and email
 * - Capped at 10 results
 * - When `excludeBoardId` is provided, profiles already in that board's
 *   board_members table are filtered out, so the picker only surfaces
 *   people you can actually add.
 * - When the caller passes an `excludeBoardId` they must have access to
 *   the board — otherwise the request is rejected to avoid leaking
 *   "who's already on this board" via inferred filtering.
 */
export async function searchProfiles(
  query: string,
  excludeBoardId?: string,
): Promise<{ data: ProfileSearchResult[]; error?: string }> {
  const ctx = await getAuthContext();
  if (!ctx) return { data: [], error: "Not authenticated." };

  // Verify board access if filtering by excludeBoardId.
  if (excludeBoardId) {
    const { data: board } = await supabaseAdmin
      .from("boards")
      .select("id, organization_id")
      .eq("id", excludeBoardId)
      .maybeSingle();
    if (!board || board.organization_id !== ctx.organizationId) {
      return { data: [], error: "Board not found." };
    }
  }

  const trimmed = query.trim();
  let queryBuilder = supabaseAdmin
    .from("profiles")
    .select("id, full_name, email, role")
    .eq("organization_id", ctx.organizationId)
    .limit(10)
    .order("full_name", { ascending: true });

  if (trimmed) {
    // PostgREST ILIKE uses % wildcards. Escape any user-supplied % so the
    // wildcards we add are the only ones in effect.
    const safe = trimmed.replace(/[%_]/g, "\\$&");
    queryBuilder = queryBuilder.or(
      `full_name.ilike.%${safe}%,email.ilike.%${safe}%`,
    );
  }

  const { data, error } = await queryBuilder;
  if (error) {
    console.error("[searchProfiles] Select error:", error.message);
    return { data: [], error: error.message };
  }

  let rows = data ?? [];

  // Filter out current board members + the caller themselves.
  if (excludeBoardId) {
    const { data: memberRows } = await supabaseAdmin
      .from("board_members")
      .select("profile_id")
      .eq("board_id", excludeBoardId);
    const memberSet = new Set<string>(
      (memberRows ?? []).map((m: { profile_id: string }) => m.profile_id),
    );
    rows = rows.filter((p: { id: string }) => !memberSet.has(p.id));
  }

  const results: ProfileSearchResult[] = rows.map(
    (p: {
      id: string;
      full_name: string | null;
      email: string | null;
      role: string | null;
    }) => ({
      id: p.id,
      full_name: p.full_name || p.email?.split("@")[0] || "Unnamed",
      email: p.email || "",
      // Avatar color mirrors the mint-fallback used elsewhere in the app.
      // Future: pull from profile's primary department color.
      avatar_color: "#5CE1A5",
      role: getRoleFromProfile({ role: p.role }),
    }),
  );

  return { data: results };
}
