"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Mail,
  Phone,
  MapPin,
  Calendar,
  User,
  Shield,
  Users,
  FileText,
  Pencil,
  Trash2,
  Loader2,
} from "lucide-react";
import { deleteMember } from "@/app/actions/members";
import { AddMemberPanel } from "../add-member-panel";
import type { Member } from "../types";

// ─── Status badge colors ────────────────────────────────
const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  active: { bg: "#DCFCE7", text: "#15803D" },
  inactive: { bg: "#F3F4F6", text: "#6B7280" },
  visitor: { bg: "#DBEAFE", text: "#1D4ED8" },
  new: { bg: "#FEF3C7", text: "#B45309" },
};

const MEMBER_TYPE_LABELS: Record<string, string> = {
  member: "Member",
  regular_attender: "Regular Attender",
  visitor: "Visitor",
  staff: "Staff",
};

const GENDER_LABELS: Record<string, string> = {
  male: "Male",
  female: "Female",
  prefer_not_to_say: "Prefer not to say",
};

// ─── Component ──────────────────────────────────────────
export function MemberDetail({ member }: { member: Member }) {
  const router = useRouter();
  const [showEdit, setShowEdit] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const initials =
    (member.first_name[0] ?? "") + (member.last_name[0] ?? "");
  const statusStyle =
    STATUS_COLORS[member.membership_status] ?? STATUS_COLORS.active;

  const fullAddress = [
    member.address_line_1,
    member.address_line_2,
    [member.city, member.state].filter(Boolean).join(", "),
    member.zip,
  ]
    .filter(Boolean)
    .join("\n");

  const handleDelete = async () => {
    setDeleting(true);
    const result = await deleteMember(member.id);
    if (result.success) {
      router.push("/directory");
    } else {
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto">
      {/* Back link */}
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
            className="size-20 rounded-full flex items-center justify-center text-white text-2xl font-bold shrink-0"
            style={{
              backgroundColor: "#5CE1A5",
              fontFamily: "var(--font-poppins)",
            }}
          >
            {initials.toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <h1
              className="text-2xl font-semibold text-[#2D333A]"
              style={{ fontFamily: "var(--font-poppins)" }}
            >
              {member.first_name} {member.last_name}
            </h1>
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <span
                className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[12px] font-semibold capitalize"
                style={{
                  backgroundColor: statusStyle.bg,
                  color: statusStyle.text,
                  fontFamily: "var(--font-poppins)",
                }}
              >
                {member.membership_status}
              </span>
              <span
                className="text-[13px] text-[#6B7280]"
                style={{ fontFamily: "var(--font-source-sans)" }}
              >
                {MEMBER_TYPE_LABELS[member.member_type] ?? member.member_type}
              </span>
            </div>
            {/* Tags */}
            {member.tags && member.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-3">
                {member.tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[12px] font-medium bg-[#EDE9FE] text-[#7C3AED]"
                    style={{ fontFamily: "var(--font-source-sans)" }}
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setShowEdit(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#5CE1A5] text-white text-sm font-medium hover:bg-[#4FD498] transition-colors shadow-sm"
              style={{ fontFamily: "var(--font-poppins)" }}
            >
              <Pencil className="size-4" />
              Edit
            </button>
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-red-200 text-red-600 text-sm font-medium hover:bg-red-50 transition-colors"
              style={{ fontFamily: "var(--font-poppins)" }}
            >
              <Trash2 className="size-4" />
              Delete
            </button>
          </div>
        </div>
      </div>

      {/* Info sections */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Contact */}
        <InfoCard title="Contact Information">
          <InfoRow
            icon={<Mail className="size-4" />}
            label="Email"
            value={member.email}
            href={member.email ? `mailto:${member.email}` : undefined}
          />
          <InfoRow
            icon={<Phone className="size-4" />}
            label="Phone"
            value={member.phone}
            href={member.phone ? `tel:${member.phone}` : undefined}
          />
          <InfoRow
            icon={<MapPin className="size-4" />}
            label="Address"
            value={fullAddress || null}
            multiline
          />
        </InfoCard>

        {/* Personal */}
        <InfoCard title="Personal Details">
          <InfoRow
            icon={<User className="size-4" />}
            label="Gender"
            value={
              member.gender
                ? (GENDER_LABELS[member.gender] ?? member.gender)
                : null
            }
          />
          <InfoRow
            icon={<Calendar className="size-4" />}
            label="Birthdate"
            value={
              member.birthdate
                ? new Date(member.birthdate + "T00:00:00").toLocaleDateString(
                    "en-US",
                    { month: "long", day: "numeric", year: "numeric" },
                  )
                : null
            }
          />
          <InfoRow
            icon={<Shield className="size-4" />}
            label="Status"
            value={member.membership_status}
          />
          <InfoRow
            icon={<Users className="size-4" />}
            label="Type"
            value={
              MEMBER_TYPE_LABELS[member.member_type] ?? member.member_type
            }
          />
        </InfoCard>
      </div>

      {/* Notes */}
      {member.notes && (
        <div className="bg-white rounded-2xl border border-[#E5E7EB] p-6 mt-4">
          <div className="flex items-center gap-2 mb-3">
            <FileText className="size-4 text-[#9CA3AF]" />
            <h3
              className="text-[13px] font-semibold text-[#6B7280] uppercase tracking-wide"
              style={{ fontFamily: "var(--font-poppins)" }}
            >
              Notes
            </h3>
          </div>
          <p
            className="text-sm text-[#2D333A] whitespace-pre-wrap"
            style={{ fontFamily: "var(--font-source-sans)" }}
          >
            {member.notes}
          </p>
        </div>
      )}

      {/* Edit panel */}
      {showEdit && (
        <AddMemberPanel
          member={member}
          onClose={() => {
            setShowEdit(false);
            router.refresh();
          }}
        />
      )}

      {/* Delete confirmation */}
      {showDeleteConfirm && (
        <>
          <div
            className="fixed inset-0 bg-black/30 z-50"
            onClick={() => !deleting && setShowDeleteConfirm(false)}
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
              <h3
                className="text-lg font-semibold text-[#2D333A] mb-2"
                style={{ fontFamily: "var(--font-poppins)" }}
              >
                Delete Member
              </h3>
              <p
                className="text-sm text-[#6B7280] mb-6"
                style={{ fontFamily: "var(--font-source-sans)" }}
              >
                Are you sure you want to delete{" "}
                <strong>
                  {member.first_name} {member.last_name}
                </strong>
                ? This action cannot be undone.
              </p>
              <div className="flex items-center justify-end gap-3">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={deleting}
                  className="px-4 py-2.5 rounded-xl border border-[#E5E7EB] text-sm font-medium text-[#6B7280] hover:bg-[#F4F5F7] transition-colors"
                  style={{ fontFamily: "var(--font-poppins)" }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition-colors disabled:opacity-50"
                  style={{ fontFamily: "var(--font-poppins)" }}
                >
                  {deleting && <Loader2 className="size-4 animate-spin" />}
                  Delete
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Shared components ──────────────────────────────────
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
  multiline,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | null;
  href?: string;
  multiline?: boolean;
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
              className={`text-sm text-[#2D333A] ${multiline ? "whitespace-pre-line" : ""}`}
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
