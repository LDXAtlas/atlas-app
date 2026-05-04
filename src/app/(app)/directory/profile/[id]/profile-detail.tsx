"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  ArrowLeft,
  Mail,
  Calendar,
  Shield,
  Building,
  Pencil,
  Trash2,
  Loader2,
} from "lucide-react";
import { ROLE_COLORS, ROLE_LABELS } from "@/lib/roles";
import type { Role } from "@/lib/permissions";
import { can } from "@/lib/permissions";
import { getIconByName } from "@/lib/icons";
import { removeMember } from "@/app/actions/invitations";

export type ProfileDetailDepartment = {
  id: string;
  name: string;
  color: string;
  icon: string;
};

interface ProfileDetailProps {
  profile: {
    id: string;
    full_name: string;
    email: string | null;
    avatar_url: string | null;
    role: Role;
    created_at: string;
  };
  primaryDepartment: ProfileDetailDepartment | null;
  secondaryDepartments: ProfileDetailDepartment[];
  viewerRole: Role;
}

export function ProfileDetail({
  profile,
  primaryDepartment,
  secondaryDepartments,
  viewerRole,
}: ProfileDetailProps) {
  const router = useRouter();
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const canEditRole = can.changeUserRole(viewerRole);
  const canRemove = can.removeTeamMember(viewerRole);

  const initials = profile.full_name
    .split(" ")
    .map((n) => n[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const avatarColor = primaryDepartment?.color || "#5CE1A5";
  const roleStyle = ROLE_COLORS[profile.role];

  function handleRemove() {
    setError(null);
    startTransition(async () => {
      const result = await removeMember(profile.id);
      if (result.error) {
        setError(result.error);
      } else {
        router.push("/directory");
      }
    });
  }

  return (
    <div className="max-w-3xl mx-auto">
      <Link
        href="/directory"
        className="inline-flex items-center gap-1.5 text-sm text-[#6B7280] hover:text-[#5CE1A5] transition-colors mb-6"
        style={{ fontFamily: "var(--font-source-sans)" }}
      >
        <ArrowLeft className="size-4" />
        Back to Directory
      </Link>

      {/* Profile header card */}
      <div className="bg-white rounded-2xl border border-[#E5E7EB] p-6 mb-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-5">
          <div
            className="size-20 rounded-full flex items-center justify-center text-white text-2xl shrink-0"
            style={{
              backgroundColor: avatarColor,
              fontFamily: "var(--font-poppins)",
              fontWeight: 700,
            }}
          >
            {initials || "?"}
          </div>
          <div className="flex-1 min-w-0">
            <h1
              className="text-2xl text-[#2D333A]"
              style={{ fontFamily: "var(--font-poppins)", fontWeight: 700 }}
            >
              {profile.full_name}
            </h1>
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <span
                className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold uppercase tracking-wide border"
                style={{
                  fontFamily: "var(--font-poppins)",
                  backgroundColor: roleStyle.bg,
                  color: roleStyle.text,
                  borderColor: roleStyle.border,
                }}
              >
                {ROLE_LABELS[profile.role]}
              </span>
              {profile.email && (
                <a
                  href={`mailto:${profile.email}`}
                  className="text-[13px] text-[#6B7280] hover:text-[#5CE1A5] transition-colors flex items-center gap-1.5"
                  style={{ fontFamily: "var(--font-source-sans)" }}
                >
                  <Mail className="size-3.5" />
                  {profile.email}
                </a>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {canEditRole && (
              <Link
                href="/settings/organization"
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[#E5E7EB] text-[13px] font-semibold text-[#2D333A] hover:bg-[#F4F5F7] transition-colors"
                style={{ fontFamily: "var(--font-poppins)" }}
              >
                <Pencil className="size-4" />
                Manage Role
              </Link>
            )}
            <Link
              href="/directory/staff-management"
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#5CE1A5] text-[#060C09] text-[13px] font-semibold hover:shadow-md transition-all"
              style={{ fontFamily: "var(--font-poppins)" }}
            >
              <Building className="size-4" />
              Edit Ministries
            </Link>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Account info */}
        <InfoCard title="Account">
          <InfoRow
            icon={<Mail className="size-4" />}
            label="Email"
            value={profile.email}
            href={profile.email ? `mailto:${profile.email}` : undefined}
          />
          <InfoRow
            icon={<Shield className="size-4" />}
            label="Role"
            value={ROLE_LABELS[profile.role]}
          />
          <InfoRow
            icon={<Calendar className="size-4" />}
            label="Joined"
            value={new Date(profile.created_at).toLocaleDateString("en-US", {
              month: "long",
              day: "numeric",
              year: "numeric",
            })}
          />
        </InfoCard>

        {/* Ministries */}
        <InfoCard title="Ministry Assignments">
          {primaryDepartment ? (
            <DepartmentRow dept={primaryDepartment} primary />
          ) : (
            <p
              className="text-[13px] text-[#9CA3AF]"
              style={{ fontFamily: "var(--font-source-sans)" }}
            >
              No primary ministry assigned.
            </p>
          )}
          {secondaryDepartments.map((d) => (
            <DepartmentRow key={d.id} dept={d} />
          ))}
        </InfoCard>
      </div>

      {/* Admin actions */}
      {canRemove && (
        <div className="mt-4">
          <button
            onClick={() => setShowRemoveConfirm(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-red-200 text-red-600 text-sm font-medium hover:bg-red-50 transition-colors"
            style={{ fontFamily: "var(--font-poppins)" }}
          >
            <Trash2 className="size-4" />
            Remove from Organization
          </button>
        </div>
      )}

      {showRemoveConfirm && (
        <>
          <div
            className="fixed inset-0 bg-black/30 z-50"
            onClick={() => !isPending && setShowRemoveConfirm(false)}
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
              <h3
                className="text-lg font-semibold text-[#2D333A] mb-2"
                style={{ fontFamily: "var(--font-poppins)" }}
              >
                Remove team member
              </h3>
              <p
                className="text-sm text-[#6B7280] mb-4"
                style={{ fontFamily: "var(--font-source-sans)" }}
              >
                {profile.full_name} will lose access to your organization. This cannot be undone from this screen.
              </p>
              {error && (
                <p
                  className="text-sm text-red-600 mb-3 px-3 py-2 rounded-lg bg-red-50 border border-red-100"
                  style={{ fontFamily: "var(--font-source-sans)" }}
                >
                  {error}
                </p>
              )}
              <div className="flex items-center justify-end gap-3">
                <button
                  onClick={() => setShowRemoveConfirm(false)}
                  disabled={isPending}
                  className="px-4 py-2.5 rounded-xl border border-[#E5E7EB] text-sm font-medium text-[#6B7280] hover:bg-[#F4F5F7] transition-colors"
                  style={{ fontFamily: "var(--font-poppins)" }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleRemove}
                  disabled={isPending}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition-colors disabled:opacity-50"
                  style={{ fontFamily: "var(--font-poppins)" }}
                >
                  {isPending && <Loader2 className="size-4 animate-spin" />}
                  Remove
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function InfoCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-2xl border border-[#E5E7EB] p-6">
      <h3
        className="text-[13px] font-semibold text-[#6B7280] uppercase tracking-wide mb-4"
        style={{ fontFamily: "var(--font-poppins)" }}
      >
        {title}
      </h3>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function InfoRow({
  icon,
  label,
  value,
  href,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | null;
  href?: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="text-[#9CA3AF] mt-0.5 shrink-0">{icon}</div>
      <div className="min-w-0">
        <p
          className="text-[11px] font-semibold text-[#9CA3AF] uppercase tracking-wide"
          style={{ fontFamily: "var(--font-poppins)" }}
        >
          {label}
        </p>
        {value ? (
          href ? (
            <a
              href={href}
              className="text-sm text-[#5CE1A5] hover:underline break-all"
              style={{ fontFamily: "var(--font-source-sans)" }}
            >
              {value}
            </a>
          ) : (
            <p
              className="text-sm text-[#2D333A]"
              style={{ fontFamily: "var(--font-source-sans)" }}
            >
              {value}
            </p>
          )
        ) : (
          <p
            className="text-sm text-[#9CA3AF]"
            style={{ fontFamily: "var(--font-source-sans)" }}
          >
            Not provided
          </p>
        )}
      </div>
    </div>
  );
}

function DepartmentRow({
  dept,
  primary,
}: {
  dept: ProfileDetailDepartment;
  primary?: boolean;
}) {
  const Icon = getIconByName(dept.icon);
  return (
    <div className="flex items-center gap-3">
      <div
        className="size-9 rounded-xl flex items-center justify-center text-white shrink-0"
        style={{ backgroundColor: dept.color }}
      >
        <Icon className="size-4" />
      </div>
      <div className="flex-1 min-w-0">
        <p
          className="text-[14px] text-[#2D333A] truncate"
          style={{ fontFamily: "var(--font-poppins)", fontWeight: 600 }}
        >
          {dept.name}
        </p>
        <p
          className="text-[11px] text-[#9CA3AF] uppercase tracking-wide"
          style={{ fontFamily: "var(--font-poppins)" }}
        >
          {primary ? "Primary" : "Secondary"}
        </p>
      </div>
    </div>
  );
}
