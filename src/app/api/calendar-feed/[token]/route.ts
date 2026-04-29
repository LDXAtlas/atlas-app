import { supabaseAdmin } from "@/lib/supabase/admin";
import { createEvents } from "ics";
import type { EventAttributes, DateArray } from "ics";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  // Look up the feed token
  const { data: feedToken, error: tokenError } = await supabaseAdmin
    .from("calendar_feed_tokens")
    .select("*")
    .eq("token", token)
    .eq("is_active", true)
    .single();

  if (tokenError || !feedToken) {
    return new Response("Not found", { status: 404 });
  }

  // Update last_accessed_at
  await supabaseAdmin
    .from("calendar_feed_tokens")
    .update({ last_accessed_at: new Date().toISOString() })
    .eq("id", feedToken.id);

  const orgId = feedToken.organization_id;
  const feedType = feedToken.feed_type as string;
  const departmentId = feedToken.department_id as string | null;
  const userId = feedToken.user_id as string;

  // Build query: non-cancelled events, future + last 30 days
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  let query = supabaseAdmin
    .from("events")
    .select("*")
    .eq("organization_id", orgId)
    .neq("status", "cancelled")
    .gte("starts_at", thirtyDaysAgo.toISOString())
    .order("starts_at", { ascending: true });

  // Filter based on feed type
  if (feedType === "department" && departmentId) {
    query = query.eq("department_id", departmentId);
  }

  const { data: events, error: eventsError } = await query;

  if (eventsError) {
    return new Response("Error fetching events", { status: 500 });
  }

  let filteredEvents = events || [];

  // For personal feeds, filter to events where user is an attendee
  if (feedType === "personal") {
    const { data: attendeeRecords } = await supabaseAdmin
      .from("event_attendees")
      .select("event_id")
      .eq("user_id", userId);

    const attendeeEventIds = new Set(
      (attendeeRecords || []).map((r: { event_id: string }) => r.event_id)
    );

    // Include events user owns OR is an attendee of
    filteredEvents = filteredEvents.filter(
      (e: { id: string; owner_user_id: string | null }) =>
        attendeeEventIds.has(e.id) || e.owner_user_id === userId
    );
  }

  // Map events to ICS format
  const icsEvents: EventAttributes[] = filteredEvents.map(
    (event: {
      id: string;
      title: string;
      description: string | null;
      starts_at: string;
      ends_at: string | null;
      is_all_day: boolean;
      location: string | null;
      status: string;
      virtual_url: string | null;
    }) => {
      const start = new Date(event.starts_at);
      const startArray: DateArray = [
        start.getUTCFullYear(),
        start.getUTCMonth() + 1,
        start.getUTCDate(),
        start.getUTCHours(),
        start.getUTCMinutes(),
      ];

      const icsEvent: EventAttributes = {
        uid: event.id,
        title: event.title,
        description: event.description || undefined,
        start: startArray,
        startInputType: "utc" as const,
        startOutputType: "utc" as const,
        location: event.location || undefined,
        status: mapStatus(event.status),
        url: event.virtual_url || undefined,
        duration: { hours: 1 },
      };

      if (event.ends_at) {
        const end = new Date(event.ends_at);
        const endArray: DateArray = [
          end.getUTCFullYear(),
          end.getUTCMonth() + 1,
          end.getUTCDate(),
          end.getUTCHours(),
          end.getUTCMinutes(),
        ];
        // Replace duration with explicit end
        return {
          ...icsEvent,
          end: endArray,
          endInputType: "utc" as const,
          endOutputType: "utc" as const,
          duration: undefined,
        } as EventAttributes;
      }

      return icsEvent;
    }
  );

  const { error: icsError, value: icsValue } = createEvents(icsEvents, {
    productId: "atlas-church-solutions",
    calName: "Atlas Calendar",
  });

  if (icsError || !icsValue) {
    // Return an empty calendar if no events
    const emptyCalendar = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//atlas-church-solutions//EN",
      "X-WR-CALNAME:Atlas Calendar",
      "END:VCALENDAR",
    ].join("\r\n");

    return new Response(emptyCalendar, {
      status: 200,
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": 'inline; filename="atlas-calendar.ics"',
        "Cache-Control": "no-cache, no-store, must-revalidate",
      },
    });
  }

  return new Response(icsValue, {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="atlas-calendar.ics"',
      "Cache-Control": "no-cache, no-store, must-revalidate",
    },
  });
}

function mapStatus(
  status: string
): "TENTATIVE" | "CONFIRMED" | "CANCELLED" {
  switch (status) {
    case "tentative":
      return "TENTATIVE";
    case "cancelled":
      return "CANCELLED";
    default:
      return "CONFIRMED";
  }
}
