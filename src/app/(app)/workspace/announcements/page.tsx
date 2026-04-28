import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { AnnouncementsView } from "./announcements-view";
import type { Announcement } from "./announcements-view";

export default async function AnnouncementsPage() {
  await connection();

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return null;

  const slug = user.user_metadata?.organization_slug;
  let orgId: string | null = null;

  if (slug) {
    const { data: org } = await supabaseAdmin
      .from("organizations")
      .select("id")
      .eq("slug", slug)
      .single();
    orgId = org?.id ?? null;
  }

  if (!orgId) {
    return <AnnouncementsView announcements={[]} departments={[]} />;
  }

  // Fetch announcements + departments in parallel
  const [announcementsRes, departmentsRes] = await Promise.all([
    supabaseAdmin
      .from("announcements")
      .select("id, title, content, category, is_pinned, is_published, published_at, created_at, author_id, target_department_id")
      .eq("organization_id", orgId)
      .eq("is_published", true)
      .order("is_pinned", { ascending: false })
      .order("published_at", { ascending: false }),
    supabaseAdmin
      .from("departments")
      .select("id, name, color")
      .eq("organization_id", orgId)
      .order("name", { ascending: true }),
  ]);

  const announcements = announcementsRes.data ?? [];
  const departments = (departmentsRes.data ?? []) as { id: string; name: string; color: string }[];

  // Build department lookup
  const deptMap: Record<string, { name: string; color: string }> = {};
  for (const d of departments) {
    deptMap[d.id] = { name: d.name, color: d.color };
  }

  // Fetch read status
  const announcementIds = announcements.map((a: { id: string }) => a.id);
  let readIds: Set<string> = new Set();
  if (announcementIds.length > 0) {
    const { data: reads } = await supabaseAdmin
      .from("announcement_reads")
      .select("announcement_id")
      .eq("user_id", user.id)
      .in("announcement_id", announcementIds);
    readIds = new Set((reads ?? []).map((r: { announcement_id: string }) => r.announcement_id));
  }

  // Fetch author names
  const authorIds = [...new Set(announcements.map((a: { author_id: string }) => a.author_id))];
  let authorMap: Record<string, string> = {};
  if (authorIds.length > 0) {
    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name")
      .in("id", authorIds);
    authorMap = (profiles ?? []).reduce(
      (acc: Record<string, string>, p: { id: string; full_name: string | null }) => {
        acc[p.id] = p.full_name || "Unknown";
        return acc;
      },
      {} as Record<string, string>,
    );
  }

  // Map to client-safe shape
  // TODO: Once member-to-department assignments exist, filter announcements
  // so users only see announcements targeted to their department or to Everyone.
  // For now, show all announcements regardless of target_department_id.
  const mapped: Announcement[] = announcements.map(
    (a: {
      id: string;
      title: string;
      content: string;
      category: string;
      is_pinned: boolean;
      is_published: boolean;
      published_at: string;
      created_at: string;
      author_id: string;
      target_department_id: string | null;
    }) => ({
      id: a.id,
      title: a.title,
      content: a.content,
      category: a.category || "general",
      is_pinned: a.is_pinned,
      is_published: a.is_published,
      published_at: a.published_at,
      created_at: a.created_at,
      author_name: authorMap[a.author_id] || "Unknown",
      is_read: readIds.has(a.id),
      target_department_id: a.target_department_id,
      target_department_name: a.target_department_id ? deptMap[a.target_department_id]?.name || null : null,
      target_department_color: a.target_department_id ? deptMap[a.target_department_id]?.color || null : null,
    }),
  );

  return <AnnouncementsView announcements={mapped} departments={departments} />;
}
