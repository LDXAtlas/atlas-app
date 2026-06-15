"use client";

import {
  Calendar,
  CheckSquare,
  Clock,
  ExternalLink,
  ListChecks,
  MapPin,
  MessageSquare,
  Users,
} from "lucide-react";
import type { HuddleDetail } from "@/app/actions/huddles";
import { AttendeeList } from "./attendee-list";
import { MeetingSourceBadge } from "./meeting-source-badge";

interface OverviewTabProps {
  huddle: HuddleDetail;
  onAttendeesChange: (attendees: HuddleDetail["attendees"]) => void;
}

// Default tab when opening a huddle. The "dossier" view — meeting
// details up top, attendee management in the middle, quick stats
// below. Mirrors the Overview pattern used in Project Boards.
export function OverviewTab({ huddle, onAttendeesChange }: OverviewTabProps) {
  return (
    <div className="space-y-3">
      <MeetingDetails huddle={huddle} />
      <AttendeeList
        huddleId={huddle.id}
        attendees={huddle.attendees}
        canManage={huddle.viewer_can_manage}
        onChange={onAttendeesChange}
      />
      <QuickStats huddle={huddle} />
    </div>
  );
}

// ─── Meeting details block ────────────────────────────────

function MeetingDetails({ huddle }: { huddle: HuddleDetail }) {
  const durationMin = computeDurationMinutes(
    huddle.scheduled_start,
    huddle.scheduled_end,
  );
  return (
    <section className="bg-white border border-[#E5E7EB] rounded-2xl p-5">
      <header className="mb-3">
        <h2
          className="text-[15px] text-[#0F172A]"
          style={{ fontFamily: "var(--font-poppins)", fontWeight: 700 }}
        >
          Meeting details
        </h2>
      </header>

      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {huddle.scheduled_start && (
          <Detail
            icon={<Calendar className="size-3.5 text-[#6B7280]" />}
            label="When"
            value={formatWhen(huddle.scheduled_start, huddle.scheduled_end)}
          />
        )}
        {durationMin !== null && (
          <Detail
            icon={<Clock className="size-3.5 text-[#6B7280]" />}
            label="Duration"
            value={`${durationMin} min`}
          />
        )}
        <Detail
          icon={<Users className="size-3.5 text-[#6B7280]" />}
          label="Format"
          value={
            <MeetingSourceBadge
              source={huddle.meeting_source}
              detail={huddle.location || null}
              size="md"
            />
          }
        />
        {huddle.location && huddle.meeting_source === "in_person" && (
          <Detail
            icon={<MapPin className="size-3.5 text-[#6B7280]" />}
            label="Location"
            value={huddle.location}
          />
        )}
        {huddle.external_meeting_url && (
          <Detail
            icon={<ExternalLink className="size-3.5 text-[#6B7280]" />}
            label="Meeting link"
            value={
              <a
                href={huddle.external_meeting_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[#3B82F6] hover:text-[#2563EB] truncate"
                style={{
                  fontFamily: "var(--font-poppins)",
                  fontWeight: 600,
                }}
              >
                <ExternalLink className="size-3" />
                Join meeting
              </a>
            }
          />
        )}
      </dl>

      {huddle.description && (
        <div className="mt-4 pt-3 border-t border-[#F1F5F9]">
          <p
            className="text-[11px] uppercase tracking-wider text-[#9CA3AF] mb-1"
            style={{ fontFamily: "var(--font-poppins)", fontWeight: 600 }}
          >
            Description
          </p>
          <p
            className="text-[13.5px] text-[#2D333A] whitespace-pre-wrap"
            style={{ fontFamily: "var(--font-source-sans)" }}
          >
            {huddle.description}
          </p>
        </div>
      )}
    </section>
  );
}

function Detail({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-2">
      <span className="mt-0.5">{icon}</span>
      <div className="min-w-0 flex-1">
        <dt
          className="text-[10px] uppercase tracking-wider text-[#9CA3AF]"
          style={{ fontFamily: "var(--font-poppins)", fontWeight: 600 }}
        >
          {label}
        </dt>
        <dd
          className="text-[13px] text-[#2D333A] mt-0.5"
          style={{ fontFamily: "var(--font-source-sans)" }}
        >
          {value}
        </dd>
      </div>
    </div>
  );
}

// ─── Quick stats ──────────────────────────────────────────

function QuickStats({ huddle }: { huddle: HuddleDetail }) {
  const promoted = huddle.action_items.filter((a) => a.task_id).length;
  return (
    <section className="bg-white border border-[#E5E7EB] rounded-2xl p-5">
      <header className="mb-3">
        <h2
          className="text-[15px] text-[#0F172A]"
          style={{ fontFamily: "var(--font-poppins)", fontWeight: 700 }}
        >
          At a glance
        </h2>
      </header>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <StatTile
          icon={<ListChecks className="size-3.5 text-[#5CE1A5]" />}
          label="Agenda items"
          value={huddle.agenda.length}
        />
        <StatTile
          icon={<CheckSquare className="size-3.5 text-[#F59E0B]" />}
          label="Action items"
          value={huddle.action_items.length}
          sub={promoted > 0 ? `${promoted} promoted` : undefined}
        />
        <StatTile
          icon={<MessageSquare className="size-3.5 text-[#3B82F6]" />}
          label="Decisions"
          value={huddle.decisions.length}
        />
        <StatTile
          icon={<Users className="size-3.5 text-[#8B5CF6]" />}
          label="Attending"
          value={huddle.attendees.filter((a) => a.attended).length}
          sub={`of ${huddle.attendees.length}`}
        />
      </div>
    </section>
  );
}

function StatTile({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  sub?: string;
}) {
  return (
    <div className="bg-[#F8FAFC] border border-[#F1F5F9] rounded-xl px-3 py-2.5">
      <div className="flex items-center gap-1.5 text-[#6B7280] mb-1">
        {icon}
        <span
          className="text-[10.5px] uppercase tracking-wider"
          style={{ fontFamily: "var(--font-poppins)", fontWeight: 600 }}
        >
          {label}
        </span>
      </div>
      <div className="flex items-baseline gap-1.5">
        <span
          className="text-[18px] text-[#0F172A] tabular-nums"
          style={{ fontFamily: "var(--font-poppins)", fontWeight: 700 }}
        >
          {value}
        </span>
        {sub && (
          <span
            className="text-[11px] text-[#9CA3AF]"
            style={{ fontFamily: "var(--font-source-sans)" }}
          >
            {sub}
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────

function formatWhen(start: string, end: string | null): string {
  try {
    const s = new Date(start);
    const date = s.toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
    const sT = s.toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
    });
    if (!end) return `${date}, ${sT}`;
    const e = new Date(end);
    const eT = e.toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
    });
    return `${date}, ${sT} – ${eT}`;
  } catch {
    return start;
  }
}

function computeDurationMinutes(
  start: string | null,
  end: string | null,
): number | null {
  if (!start || !end) return null;
  try {
    const s = new Date(start).getTime();
    const e = new Date(end).getTime();
    if (!Number.isFinite(s) || !Number.isFinite(e) || e <= s) return null;
    return Math.round((e - s) / 60000);
  } catch {
    return null;
  }
}
