import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { TasksView } from "./tasks-view";
import type { Task, TeamMember, Department } from "./tasks-view";
import { MinistryFilterBanner } from "../../_components/ministry-filter-banner";
import { getMyUpcomingHuddles } from "@/app/actions/huddles";
import { YourHuddlesSection } from "./your-huddles-section";

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<{ ministry?: string }>;
}) {
  await connection();
  const { ministry: ministryId } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

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
    return <TasksView tasks={[]} teamMembers={[]} departments={[]} />;
  }

  // Fetch tasks, team members, and departments in parallel
  // When filtering by ministry, show all tasks for that department (not only mine).
  const tasksQuery = supabaseAdmin
    .from("tasks")
    .select(
      "id, title, description, status, priority, due_date, completed_at, assigned_to, assigned_by, department_id, position, created_at",
    )
    .eq("organization_id", orgId);

  if (ministryId) {
    tasksQuery.eq("department_id", ministryId);
  } else {
    tasksQuery.or(`assigned_to.eq.${user.id},assigned_by.eq.${user.id}`);
  }

  const [tasksRes, profilesRes, departmentsRes, myHuddlesRes] = await Promise.all([
    tasksQuery.order("position", { ascending: true }),
    supabaseAdmin
      .from("profiles")
      .select("id, full_name")
      .eq("organization_id", orgId)
      .order("full_name", { ascending: true }),
    supabaseAdmin
      .from("departments")
      .select("id, name, color, icon")
      .eq("organization_id", orgId)
      .order("name", { ascending: true }),
    // Huddles the current viewer is an attendee on — surfaced as a
    // separate rail above tasks so people see upcoming meetings
    // alongside their work without conflating the two object types.
    getMyUpcomingHuddles(),
  ]);
  const myHuddles =
    myHuddlesRes.success && myHuddlesRes.data ? myHuddlesRes.data : [];

  const rawTasks = tasksRes.data ?? [];
  const profiles = (profilesRes.data ?? []) as TeamMember[];
  const allDepartments = (departmentsRes.data ?? []) as (Department & { icon: string | null })[];
  const departments = allDepartments as Department[];
  const filterMinistry = ministryId
    ? allDepartments.find((d) => d.id === ministryId) ?? null
    : null;

  // Build lookups
  const profileMap: Record<string, string> = {};
  for (const p of profiles) {
    profileMap[p.id] = p.full_name;
  }

  const deptMap: Record<string, { name: string; color: string }> = {};
  for (const d of departments) {
    deptMap[d.id] = { name: d.name, color: d.color };
  }

  // Map to client-safe shape
  const tasks: Task[] = rawTasks.map(
    (t: {
      id: string;
      title: string;
      description: string | null;
      status: string;
      priority: string;
      due_date: string | null;
      completed_at: string | null;
      assigned_to: string | null;
      assigned_by: string | null;
      department_id: string | null;
      position: number;
      created_at: string;
    }) => ({
      id: t.id,
      title: t.title,
      description: t.description,
      status: t.status,
      priority: t.priority,
      due_date: t.due_date,
      completed_at: t.completed_at,
      assigned_to: t.assigned_to,
      assigned_by: t.assigned_by,
      department_id: t.department_id,
      position: t.position,
      created_at: t.created_at,
      assigned_to_name: t.assigned_to
        ? profileMap[t.assigned_to] || null
        : null,
      department_name: t.department_id
        ? deptMap[t.department_id]?.name || null
        : null,
      department_color: t.department_id
        ? deptMap[t.department_id]?.color || null
        : null,
    }),
  );

  return (
    <>
      {filterMinistry && (
        <MinistryFilterBanner
          ministry={{
            id: filterMinistry.id,
            name: filterMinistry.name,
            color: filterMinistry.color || "#5CE1A5",
            icon: filterMinistry.icon || "Building",
          }}
          basePath="/workspace/tasks"
        />
      )}
      {/* TasksView's root is `h-full overflow-y-auto bg-white`, which
          creates its own scroll context. Rendering the huddles rail as
          a plain sibling above it gets clipped by the app shell's
          fixed-height container. We wrap both in a controlled flex
          column so the rail sits above and TasksView gets the
          remaining space via flex-1 + min-h-0. */}
      <div className="h-full flex flex-col bg-white">
        {myHuddles.length > 0 && (
          <div className="shrink-0 border-b border-[#E5E7EB] px-4 sm:px-6 pt-4">
            <YourHuddlesSection huddles={myHuddles} />
          </div>
        )}
        <div className="flex-1 min-h-0">
          <TasksView
            tasks={tasks}
            teamMembers={profiles}
            departments={departments}
          />
        </div>
      </div>
    </>
  );
}
