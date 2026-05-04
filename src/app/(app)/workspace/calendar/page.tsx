import { redirect } from "next/navigation";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { CalendarView, type CalendarEvent } from "./calendar-view";
import { MinistryFilterBanner } from "../../_components/ministry-filter-banner";

export default async function CalendarPage({
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

  if (!user) {
    redirect("/login");
  }

  const organizationSlug = user.user_metadata?.organization_slug;
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();

  let events: CalendarEvent[] = [];
  let departments: { id: string; name: string; color: string }[] = [];
  let customEventTypes: { id: string; name: string; color: string }[] = [];
  let filterMinistry: { id: string; name: string; color: string; icon: string } | null = null;

  if (organizationSlug) {
    const { data: org } = await supabaseAdmin
      .from("organizations")
      .select("id")
      .eq("slug", organizationSlug)
      .single();

    if (org) {
      // Fetch events for a wide range around the current month (prev 2 + current + next 2)
      const rangeStart = new Date(currentYear, currentMonth - 2, 1).toISOString();
      const rangeEnd = new Date(currentYear, currentMonth + 3, 0).toISOString();

      const eventsQuery = supabaseAdmin
        .from("events")
        .select(
          "id, title, description, event_type, starts_at, ends_at, is_all_day, location, location_type, virtual_url, color, status, department_id, recurrence_rule",
        )
        .eq("organization_id", org.id)
        .gte("starts_at", rangeStart)
        .lte("starts_at", rangeEnd);

      if (ministryId) {
        // Either the primary department matches OR there's a row in event_departments
        const { data: linkedRows } = await supabaseAdmin
          .from("event_departments")
          .select("event_id")
          .eq("department_id", ministryId);
        const linkedIds = (linkedRows ?? []).map((r: { event_id: string }) => r.event_id);
        if (linkedIds.length > 0) {
          eventsQuery.or(`department_id.eq.${ministryId},id.in.(${linkedIds.join(",")})`);
        } else {
          eventsQuery.eq("department_id", ministryId);
        }
      }

      const [eventsRes, departmentsRes, customTypesRes] = await Promise.all([
        eventsQuery.order("starts_at", { ascending: true }),
        supabaseAdmin
          .from("departments")
          .select("id, name, color, icon")
          .eq("organization_id", org.id)
          .order("name", { ascending: true }),
        supabaseAdmin
          .from("custom_event_types")
          .select("id, name, color")
          .eq("organization_id", org.id)
          .order("name", { ascending: true }),
      ]);

      if (ministryId) {
        const dept = (departmentsRes.data ?? []).find(
          (d: { id: string }) => d.id === ministryId,
        );
        if (dept) {
          filterMinistry = {
            id: dept.id,
            name: dept.name,
            color: dept.color || "#5CE1A5",
            icon: dept.icon || "Building",
          };
        }
      }

      departments = (departmentsRes.data ?? []).map((d) => ({
        id: d.id,
        name: d.name,
        color: d.color || "#5CE1A5",
      }));

      customEventTypes = (customTypesRes.data ?? []).map((ct) => ({
        id: ct.id,
        name: ct.name,
        color: ct.color,
      }));

      // Build department lookup
      const deptMap = new Map(
        departments.map((d) => [d.id, { name: d.name, color: d.color }]),
      );

      // Fetch event_departments for all events
      const eventIds = (eventsRes.data ?? []).map((e) => e.id);
      let eventDeptMap = new Map<string, { id: string; name: string; color: string }[]>();

      if (eventIds.length > 0) {
        const { data: edRows } = await supabaseAdmin
          .from("event_departments")
          .select("event_id, department_id")
          .in("event_id", eventIds);

        for (const row of edRows ?? []) {
          const dept = deptMap.get(row.department_id);
          if (!dept) continue;
          const list = eventDeptMap.get(row.event_id) ?? [];
          list.push({ id: row.department_id, name: dept.name, color: dept.color });
          eventDeptMap.set(row.event_id, list);
        }
      }

      events = (eventsRes.data ?? []).map((e) => {
        const primaryDept = e.department_id ? deptMap.get(e.department_id) : null;
        const multiDepts = eventDeptMap.get(e.id) ?? [];
        // Merge primary + multi, dedup by id
        const allDepts = primaryDept
          ? [{ id: e.department_id!, name: primaryDept.name, color: primaryDept.color }, ...multiDepts]
          : multiDepts;
        const uniqueDepts = Array.from(new Map(allDepts.map((d) => [d.id, d])).values());

        return {
          id: e.id,
          title: e.title,
          description: e.description ?? null,
          event_type: e.event_type,
          starts_at: e.starts_at,
          ends_at: e.ends_at,
          is_all_day: e.is_all_day,
          location: e.location,
          location_type: e.location_type ?? "in_person",
          virtual_url: e.virtual_url ?? null,
          color: e.color,
          status: e.status,
          department_id: e.department_id ?? null,
          departments: uniqueDepts,
          recurrence_rule: e.recurrence_rule ?? null,
        };
      });
    }
  }

  return (
    <>
      {filterMinistry && (
        <MinistryFilterBanner ministry={filterMinistry} basePath="/workspace/calendar" />
      )}
      <CalendarView
        events={events}
        departments={departments}
        customEventTypes={customEventTypes}
        initialYear={currentYear}
        initialMonth={currentMonth}
      />
    </>
  );
}
