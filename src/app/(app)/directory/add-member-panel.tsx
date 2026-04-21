"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { X, Loader2 } from "lucide-react";
import { addMember, updateMember } from "@/app/actions/members";
import type { Member } from "./types";

// ─── Types ──────────────────────────────────────────────
type Props = {
  onClose: () => void;
  member?: Member; // if provided, we're editing
};

const MEMBERSHIP_STATUSES = [
  { label: "Active", value: "active" },
  { label: "Inactive", value: "inactive" },
  { label: "Visitor", value: "visitor" },
  { label: "New", value: "new" },
];

const MEMBER_TYPES = [
  { label: "Member", value: "member" },
  { label: "Regular Attender", value: "regular_attender" },
  { label: "Visitor", value: "visitor" },
  { label: "Staff", value: "staff" },
];

const GENDERS = [
  { label: "Male", value: "male" },
  { label: "Female", value: "female" },
  { label: "Prefer not to say", value: "prefer_not_to_say" },
];

// ─── Component ──────────────────────────────────────────
export function AddMemberPanel({ onClose, member }: Props) {
  const router = useRouter();
  const isEditing = !!member;

  const [form, setForm] = useState({
    first_name: member?.first_name ?? "",
    last_name: member?.last_name ?? "",
    email: member?.email ?? "",
    phone: member?.phone ?? "",
    address_line_1: member?.address_line_1 ?? "",
    address_line_2: member?.address_line_2 ?? "",
    city: member?.city ?? "",
    state: member?.state ?? "",
    zip: member?.zip ?? "",
    gender: member?.gender ?? "",
    birthdate: member?.birthdate ?? "",
    membership_status: member?.membership_status ?? "active",
    member_type: member?.member_type ?? "member",
    notes: member?.notes ?? "",
  });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const update = (field: string, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!form.first_name.trim() || !form.last_name.trim()) {
      setError("First name and last name are required.");
      return;
    }

    setSaving(true);
    try {
      const data = {
        ...form,
        email: form.email || null,
        phone: form.phone || null,
        address_line_1: form.address_line_1 || null,
        address_line_2: form.address_line_2 || null,
        city: form.city || null,
        state: form.state || null,
        zip: form.zip || null,
        gender: form.gender || null,
        birthdate: form.birthdate || null,
        notes: form.notes || null,
      };

      const result = isEditing
        ? await updateMember(member!.id, data)
        : await addMember(data);

      if (!result.success) {
        setError(result.error ?? "Something went wrong.");
        return;
      }

      router.refresh();
      onClose();
    } catch {
      setError("An unexpected error occurred.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/20 z-50"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="fixed inset-y-0 right-0 w-full max-w-lg bg-white z-50 shadow-2xl flex flex-col animate-slide-in-right">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-[#E5E7EB]">
          <h2
            className="text-lg font-semibold text-[#2D333A]"
            style={{ fontFamily: "var(--font-poppins)" }}
          >
            {isEditing ? "Edit Member" : "Add Member"}
          </h2>
          <button
            onClick={onClose}
            className="size-9 rounded-lg flex items-center justify-center text-[#6B7280] hover:bg-[#F4F5F7] transition-colors"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Form */}
        <form
          onSubmit={handleSubmit}
          className="flex-1 overflow-y-auto px-6 py-5 space-y-5"
        >
          {error && (
            <div
              className="px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm"
              style={{ fontFamily: "var(--font-source-sans)" }}
            >
              {error}
            </div>
          )}

          {/* Name */}
          <div className="grid grid-cols-2 gap-3">
            <Field
              label="First Name *"
              value={form.first_name}
              onChange={(v) => update("first_name", v)}
              placeholder="John"
            />
            <Field
              label="Last Name *"
              value={form.last_name}
              onChange={(v) => update("last_name", v)}
              placeholder="Doe"
            />
          </div>

          {/* Contact */}
          <Field
            label="Email"
            value={form.email}
            onChange={(v) => update("email", v)}
            type="email"
            placeholder="john@example.com"
          />
          <Field
            label="Phone"
            value={form.phone}
            onChange={(v) => update("phone", v)}
            type="tel"
            placeholder="(555) 123-4567"
          />

          {/* Address */}
          <SectionLabel>Address</SectionLabel>
          <Field
            label="Address Line 1"
            value={form.address_line_1}
            onChange={(v) => update("address_line_1", v)}
            placeholder="123 Main St"
          />
          <Field
            label="Address Line 2"
            value={form.address_line_2}
            onChange={(v) => update("address_line_2", v)}
            placeholder="Apt 4B"
          />
          <div className="grid grid-cols-3 gap-3">
            <Field
              label="City"
              value={form.city}
              onChange={(v) => update("city", v)}
              placeholder="Austin"
            />
            <Field
              label="State"
              value={form.state}
              onChange={(v) => update("state", v)}
              placeholder="TX"
            />
            <Field
              label="Zip"
              value={form.zip}
              onChange={(v) => update("zip", v)}
              placeholder="78701"
            />
          </div>

          {/* Personal */}
          <SectionLabel>Personal Info</SectionLabel>
          <div className="grid grid-cols-2 gap-3">
            <SelectField
              label="Gender"
              value={form.gender}
              onChange={(v) => update("gender", v)}
              options={GENDERS}
              placeholder="Select..."
            />
            <Field
              label="Birthdate"
              value={form.birthdate}
              onChange={(v) => update("birthdate", v)}
              type="date"
            />
          </div>

          {/* Status */}
          <div className="grid grid-cols-2 gap-3">
            <SelectField
              label="Membership Status"
              value={form.membership_status}
              onChange={(v) => update("membership_status", v)}
              options={MEMBERSHIP_STATUSES}
            />
            <SelectField
              label="Member Type"
              value={form.member_type}
              onChange={(v) => update("member_type", v)}
              options={MEMBER_TYPES}
            />
          </div>

          {/* Notes */}
          <div>
            <label
              className="block text-[12px] font-semibold text-[#6B7280] uppercase tracking-wide mb-1.5"
              style={{ fontFamily: "var(--font-poppins)" }}
            >
              Notes
            </label>
            <textarea
              value={form.notes}
              onChange={(e) => update("notes", e.target.value)}
              rows={3}
              placeholder="Any additional notes..."
              className="w-full px-3.5 py-2.5 rounded-xl border border-[#E5E7EB] bg-white text-sm text-[#2D333A] placeholder-[#9CA3AF] outline-none focus:border-[#5CE1A5] transition-colors resize-none"
              style={{ fontFamily: "var(--font-source-sans)" }}
            />
          </div>
        </form>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[#E5E7EB] flex items-center justify-end gap-3 bg-white">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl border border-[#E5E7EB] text-sm font-medium text-[#6B7280] hover:bg-[#F4F5F7] transition-colors"
            style={{ fontFamily: "var(--font-poppins)" }}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#5CE1A5] text-white text-sm font-medium hover:bg-[#4FD498] transition-colors shadow-sm disabled:opacity-50"
            style={{ fontFamily: "var(--font-poppins)" }}
          >
            {saving && <Loader2 className="size-4 animate-spin" />}
            {isEditing ? "Save Changes" : "Add Member"}
          </button>
        </div>
      </div>
    </>
  );
}

// ─── Shared form fields ─────────────────────────────────
function Field({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <div>
      <label
        className="block text-[12px] font-semibold text-[#6B7280] uppercase tracking-wide mb-1.5"
        style={{ fontFamily: "var(--font-poppins)" }}
      >
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3.5 py-2.5 rounded-xl border border-[#E5E7EB] bg-white text-sm text-[#2D333A] placeholder-[#9CA3AF] outline-none focus:border-[#5CE1A5] transition-colors"
        style={{ fontFamily: "var(--font-source-sans)" }}
      />
    </div>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { label: string; value: string }[];
  placeholder?: string;
}) {
  return (
    <div>
      <label
        className="block text-[12px] font-semibold text-[#6B7280] uppercase tracking-wide mb-1.5"
        style={{ fontFamily: "var(--font-poppins)" }}
      >
        {label}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3.5 py-2.5 rounded-xl border border-[#E5E7EB] bg-white text-sm text-[#2D333A] outline-none focus:border-[#5CE1A5] transition-colors appearance-none"
        style={{ fontFamily: "var(--font-source-sans)" }}
      >
        {placeholder && (
          <option value="">{placeholder}</option>
        )}
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p
      className="text-[13px] font-semibold text-[#2D333A] pt-2"
      style={{ fontFamily: "var(--font-poppins)" }}
    >
      {children}
    </p>
  );
}
