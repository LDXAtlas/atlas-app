"use client";

import { useState } from "react";
import { Building, Plus, Edit3, Blocks, Trash2, X } from "lucide-react";
import { addDepartment, updateDepartment, deleteDepartment } from "@/app/actions/departments";
import type { Department } from "./page";

const COLORS = [
  "#5CE1A5", "#3B82F6", "#8B5CF6", "#EC4899", "#F59E0B",
  "#EF4444", "#10B981", "#6366F1", "#F97316", "#14B8A6",
];

interface StaffManagementViewProps {
  departments: Department[];
}

export function StaffManagementView({ departments }: StaffManagementViewProps) {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Department | null>(null);
  const [deleting, setDeleting] = useState<Department | null>(null);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="size-8 rounded-xl bg-[#F4F5F7] flex items-center justify-center">
            <Building className="size-4 text-[#6B7280]" />
          </div>
          <div>
            <h3
              className="text-[16px] font-semibold text-[#2D333A] leading-tight"
              style={{ fontFamily: "var(--font-poppins)" }}
            >
              Departments
            </h3>
            <p className="text-[12px] text-[#6B7280]" style={{ fontFamily: "var(--font-source-sans)" }}>
              {departments.length} active department{departments.length !== 1 ? "s" : ""}
            </p>
          </div>
        </div>
      </div>

      {/* Department Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {departments.map((dept) => (
          <div
            key={dept.id}
            onClick={() => { setEditing(dept); setShowForm(true); }}
            className="p-4 bg-white rounded-xl border border-[#E5E7EB] group hover:shadow-md hover:border-[#D1D5DB] transition-all cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <div
                className="size-9 rounded-xl flex items-center justify-center text-white shadow-sm shrink-0"
                style={{ backgroundColor: dept.color }}
              >
                <Building className="size-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p
                  className="text-[13px] font-semibold text-[#2D333A] leading-tight truncate"
                  style={{ fontFamily: "var(--font-poppins)" }}
                >
                  {dept.name}
                </p>
                <p className="text-[11px] text-[#6B7280]" style={{ fontFamily: "var(--font-source-sans)" }}>
                  {dept.member_count} member{dept.member_count !== 1 ? "s" : ""}
                </p>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); setEditing(dept); setShowForm(true); }}
                className="p-1.5 text-[#D1D5DB] hover:text-[#5CE1A5] transition-colors opacity-0 group-hover:opacity-100"
              >
                <Edit3 className="size-3.5" />
              </button>
            </div>

            {/* Ministry Hub toggle display */}
            <div className="flex items-center justify-between mt-3 pt-3 border-t border-[#F4F5F7]">
              <div className="flex items-center gap-1.5">
                <Blocks className="size-3 text-[#9CA3AF]" />
                <span className="text-[11px] text-[#9CA3AF] font-medium" style={{ fontFamily: "var(--font-source-sans)" }}>
                  Ministry Hub
                </span>
              </div>
              <div
                className="size-2 rounded-full"
                style={{ backgroundColor: dept.hub_enabled ? "#5CE1A5" : "#E5E7EB" }}
              />
            </div>
          </div>
        ))}

        {/* Add Department Card */}
        <button
          onClick={() => { setEditing(null); setShowForm(true); }}
          className="p-4 rounded-xl border-2 border-dashed border-[#E5E7EB] flex items-center gap-3 hover:border-[#5CE1A5] hover:bg-[#5CE1A5]/5 transition-all group min-h-[100px]"
        >
          <div className="size-9 rounded-xl bg-[#F4F5F7] flex items-center justify-center group-hover:bg-[#5CE1A5]/10 transition-colors shrink-0">
            <Plus className="size-4 text-[#9CA3AF] group-hover:text-[#5CE1A5] transition-colors" />
          </div>
          <span
            className="text-[13px] font-semibold text-[#6B7280] group-hover:text-[#5CE1A5] transition-colors"
            style={{ fontFamily: "var(--font-poppins)" }}
          >
            Add Department
          </span>
        </button>
      </div>

      {/* Empty state */}
      {departments.length === 0 && (
        <div className="text-center py-12">
          <div className="size-16 rounded-2xl bg-[#F4F5F7] flex items-center justify-center mx-auto mb-4">
            <Building className="size-8 text-[#9CA3AF]" />
          </div>
          <p className="text-[15px] text-[#6B7280] mb-1" style={{ fontFamily: "var(--font-source-sans)" }}>
            No departments yet
          </p>
          <p className="text-[13px] text-[#9CA3AF]" style={{ fontFamily: "var(--font-source-sans)" }}>
            Create your first department to organize your team.
          </p>
        </div>
      )}

      {/* Department Form Modal */}
      {showForm && (
        <DepartmentForm
          department={editing}
          onClose={() => { setShowForm(false); setEditing(null); }}
          onDelete={(dept) => { setShowForm(false); setEditing(null); setDeleting(dept); }}
        />
      )}

      {/* Delete Confirmation */}
      {deleting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-6 shadow-xl max-w-sm w-full mx-4">
            <h3 className="text-[16px] font-semibold text-[#2D333A] mb-2" style={{ fontFamily: "var(--font-poppins)" }}>
              Delete {deleting.name}?
            </h3>
            <p className="text-[14px] text-[#6B7280] mb-6" style={{ fontFamily: "var(--font-source-sans)" }}>
              This will permanently remove this department. This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleting(null)}
                className="flex-1 h-10 rounded-xl border border-[#E5E7EB] text-[13px] font-semibold text-[#2D333A] hover:bg-[#F4F5F7] transition-all"
                style={{ fontFamily: "var(--font-poppins)" }}
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  await deleteDepartment(deleting.id);
                  setDeleting(null);
                }}
                className="flex-1 h-10 rounded-xl bg-[#EF4444] text-white text-[13px] font-semibold hover:bg-[#DC2626] transition-all"
                style={{ fontFamily: "var(--font-poppins)" }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Department Form ───────────────────────────────────
function DepartmentForm({
  department,
  onClose,
  onDelete,
}: {
  department: Department | null;
  onClose: () => void;
  onDelete: (dept: Department) => void;
}) {
  const [name, setName] = useState(department?.name || "");
  const [color, setColor] = useState(department?.color || "#5CE1A5");
  const [description, setDescription] = useState(department?.description || "");
  const [hubEnabled, setHubEnabled] = useState(department?.hub_enabled || false);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    if (!name.trim()) return;
    setSaving(true);
    setError(null);

    const data = {
      name: name.trim(),
      color,
      description: description.trim() || undefined,
      hub_enabled: hubEnabled,
    };

    const result = department
      ? await updateDepartment(department.id, data)
      : await addDepartment(data);

    setSaving(false);

    if (result.error) {
      console.error("[DepartmentForm] Error:", result.error);
      setError(result.error);
      return;
    }

    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E5E7EB]">
          <h3 className="text-[16px] font-semibold text-[#2D333A]" style={{ fontFamily: "var(--font-poppins)" }}>
            {department ? "Edit Department" : "Create Department"}
          </h3>
          <button onClick={onClose} className="p-1 text-[#6B7280] hover:text-[#2D333A] transition-colors">
            <X className="size-5" />
          </button>
        </div>

        {/* Form */}
        <div className="p-6 space-y-5">
          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-[13px] text-red-600" style={{ fontFamily: "var(--font-source-sans)" }}>
              {error}
            </div>
          )}
          {/* Name */}
          <div>
            <label className="text-[13px] font-medium text-[#2D333A] mb-1.5 block" style={{ fontFamily: "var(--font-poppins)" }}>
              Department Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Worship Team"
              className="w-full h-10 px-4 rounded-xl border border-[#E5E7EB] bg-[#F4F5F7] text-[14px] text-[#2D333A] placeholder-[#9CA3AF] outline-none focus:border-[#5CE1A5] transition-colors"
              style={{ fontFamily: "var(--font-source-sans)" }}
            />
          </div>

          {/* Color */}
          <div>
            <label className="text-[13px] font-medium text-[#2D333A] mb-1.5 block" style={{ fontFamily: "var(--font-poppins)" }}>
              Color
            </label>
            <div className="flex flex-wrap gap-2">
              {COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className={`size-8 rounded-lg transition-all ${color === c ? "ring-2 ring-offset-2 ring-[#2D333A] scale-110" : "hover:scale-105"}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="text-[13px] font-medium text-[#2D333A] mb-1.5 block" style={{ fontFamily: "var(--font-poppins)" }}>
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What does this department do?"
              rows={2}
              className="w-full px-4 py-2.5 rounded-xl border border-[#E5E7EB] bg-[#F4F5F7] text-[14px] text-[#2D333A] placeholder-[#9CA3AF] outline-none focus:border-[#5CE1A5] transition-colors resize-none"
              style={{ fontFamily: "var(--font-source-sans)" }}
            />
          </div>

          {/* Ministry Hub toggle */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[13px] font-medium text-[#2D333A]" style={{ fontFamily: "var(--font-poppins)" }}>
                Show in Ministry Hub
              </p>
              <p className="text-[11px] text-[#6B7280]" style={{ fontFamily: "var(--font-source-sans)" }}>
                Make visible in the Ministry Hub module
              </p>
            </div>
            <button
              onClick={() => setHubEnabled(!hubEnabled)}
              className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200"
              style={{ backgroundColor: hubEnabled ? "#5CE1A5" : "#E5E7EB" }}
            >
              <span
                className="inline-block size-5 rounded-full bg-white shadow-sm transition-transform duration-200"
                style={{ transform: hubEnabled ? "translateX(22px)" : "translateX(2px)" }}
              />
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-[#E5E7EB]">
          <div>
            {department && (
              <button
                onClick={() => onDelete(department)}
                className="flex items-center gap-1 text-[12px] text-[#EF4444] hover:text-[#DC2626] transition-colors"
                style={{ fontFamily: "var(--font-source-sans)" }}
              >
                <Trash2 className="size-3" />
                Delete
              </button>
            )}
          </div>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="h-10 px-5 rounded-xl border border-[#E5E7EB] text-[13px] font-semibold text-[#2D333A] hover:bg-[#F4F5F7] transition-all"
              style={{ fontFamily: "var(--font-poppins)" }}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!name.trim() || saving}
              className="h-10 px-5 rounded-xl bg-[#5CE1A5] text-white text-[13px] font-semibold hover:bg-[#4BD694] transition-all disabled:opacity-50"
              style={{ fontFamily: "var(--font-poppins)" }}
            >
              {saving ? "Saving..." : department ? "Save Changes" : "Create Department"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
