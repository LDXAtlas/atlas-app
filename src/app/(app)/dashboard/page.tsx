import { redirect } from "next/navigation";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getAllocationsForTier } from "@/lib/tier-allocations";
import { DashboardClient } from "./_components/dashboard-client";

export default async function DashboardPage() {
  await connection();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const userName =
    user.user_metadata?.full_name || user.email || "User";
  const organizationSlug = user.user_metadata?.organization_slug;

  // Default data in case org is not found
  let orgName = "Your Organization";
  let subscriptionTier = "workspace";
  let seatLimit = 5;
  let aiCreditsLimit = 500;
  let totalMembers = 0;
  let activeMembers = 0;
  let departmentCount = 0;
  let departments: { id: string; name: string; color: string; member_count: number }[] = [];
  let recentMembers: {
    id: string;
    first_name: string;
    last_name: string;
    email: string | null;
    membership_status: string;
    created_at: string;
  }[] = [];
  let recentAnnouncements: {
    id: string;
    title: string;
    content: string;
    category: string;
    is_pinned: boolean;
    published_at: string;
    author_name: string;
    is_read: boolean;
    target_department_name: string | null;
    target_department_color: string | null;
    cover_image_url: string | null;
  }[] = [];
  let upcomingEvents: {
    id: string;
    title: string;
    event_type: string;
    starts_at: string;
    is_all_day: boolean;
    location: string | null;
    color: string;
  }[] = [];

  if (organizationSlug) {
    // Fetch org first to get ID
    const { data: org } = await supabaseAdmin
      .from("organizations")
      .select("id, name, subscription_tier, slug")
      .eq("slug", organizationSlug)
      .single();

    if (org) {
      orgName = org.name || orgName;
      subscriptionTier = (org.subscription_tier || "workspace")
        .trim()
        .toLowerCase();

      const allocations = getAllocationsForTier(subscriptionTier);
      seatLimit = allocations.seat_limit;
      aiCreditsLimit = allocations.ai_credits_limit;

      // Fetch in parallel
      const [
        totalMembersRes,
        activeMembersRes,
        departmentsRes,
        recentMembersRes,
        announcementsRes,
        eventsRes,
      ] = await Promise.all([
        supabaseAdmin
          .from("members")
          .select("id", { count: "exact", head: true })
          .eq("organization_id", org.id),
        supabaseAdmin
          .from("members")
          .select("id", { count: "exact", head: true })
          .eq("organization_id", org.id)
          .eq("membership_status", "active"),
        supabaseAdmin
          .from("departments")
          .select("id, name, color")
          .eq("organization_id", org.id)
          .order("name", { ascending: true })
          .limit(5),
        supabaseAdmin
          .from("members")
          .select("id, first_name, last_name, email, membership_status, created_at")
          .eq("organization_id", org.id)
          .order("created_at", { ascending: false })
          .limit(5),
        supabaseAdmin
          .from("announcements")
          .select("id, title, content, category, is_pinned, published_at, author_id, target_department_id, cover_image_url")
          .eq("organization_id", org.id)
          .eq("is_published", true)
          .order("is_pinned", { ascending: false })
          .order("published_at", { ascending: false })
          .limit(3),
        supabaseAdmin
          .from("events")
          .select("id, title, event_type, starts_at, is_all_day, location, color, status")
          .eq("organization_id", org.id)
          .neq("status", "cancelled")
          .gte("starts_at", new Date().toISOString())
          .order("starts_at", { ascending: true })
          .limit(3),
      ]);

      totalMembers = totalMembersRes.count ?? 0;
      activeMembers = activeMembersRes.count ?? 0;
      departmentCount = departmentsRes.data?.length ?? 0;

      // For department count, we may need the full count
      const { count: fullDeptCount } = await supabaseAdmin
        .from("departments")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", org.id);
      departmentCount = fullDeptCount ?? 0;

      departments = (departmentsRes.data ?? []).map((d) => ({
        id: d.id,
        name: d.name,
        color: d.color || "#5CE1A5",
        member_count: 0,
      }));

      recentMembers = (recentMembersRes.data ?? []).map((m) => ({
        id: m.id,
        first_name: m.first_name,
        last_name: m.last_name,
        email: m.email,
        membership_status: m.membership_status || "active",
        created_at: m.created_at,
      }));

      // Process announcements — resolve author names and department info
      const annData = announcementsRes.data ?? [];
      for (const ann of annData) {
        let authorName = "Unknown";
        if (ann.author_id) {
          const { data: profile } = await supabaseAdmin
            .from("profiles")
            .select("full_name")
            .eq("id", ann.author_id)
            .single();
          authorName = profile?.full_name || "Unknown";
        }

        let deptName: string | null = null;
        let deptColor: string | null = null;
        if (ann.target_department_id) {
          const { data: dept } = await supabaseAdmin
            .from("departments")
            .select("name, color")
            .eq("id", ann.target_department_id)
            .single();
          deptName = dept?.name || null;
          deptColor = dept?.color || null;
        }

        // Check read status
        const { data: readData } = await supabaseAdmin
          .from("announcement_reads")
          .select("id")
          .eq("announcement_id", ann.id)
          .eq("user_id", user.id)
          .limit(1);

        recentAnnouncements.push({
          id: ann.id,
          title: ann.title,
          content: ann.content,
          category: ann.category,
          is_pinned: ann.is_pinned,
          published_at: ann.published_at,
          author_name: authorName,
          is_read: (readData?.length ?? 0) > 0,
          target_department_name: deptName,
          target_department_color: deptColor,
          cover_image_url: ann.cover_image_url || null,
        });
      }

      // Process upcoming events
      upcomingEvents = (eventsRes.data ?? []).map((e) => ({
        id: e.id,
        title: e.title,
        event_type: e.event_type,
        starts_at: e.starts_at,
        is_all_day: e.is_all_day,
        location: e.location,
        color: e.color,
      }));
    }
  }

  return (
    <DashboardClient
      userName={userName}
      orgName={orgName}
      subscriptionTier={subscriptionTier}
      seatLimit={seatLimit}
      aiCreditsLimit={aiCreditsLimit}
      totalMembers={totalMembers}
      activeMembers={activeMembers}
      departmentCount={departmentCount}
      departments={departments}
      recentMembers={recentMembers}
      recentAnnouncements={recentAnnouncements}
      upcomingEvents={upcomingEvents}
    />
  );
}
