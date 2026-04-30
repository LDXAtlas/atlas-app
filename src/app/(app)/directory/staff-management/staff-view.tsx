"use client";

import { useState, useMemo } from "react";
import {
  Building,
  Plus,
  Trash2,
  X,
  Check,
  Search,
  MoreHorizontal,
  ChevronDown,
  ChevronUp,
  Blocks,
  UserPlus,
  Shield,
  ShieldCheck,
  Crown,
  HandHelping,
  User as UserIcon,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import {
  addDepartment,
  updateDepartment,
  deleteDepartment,
} from "@/app/actions/departments";
import {
  bulkUpdateAssignments,
  removeProfileFromDepartment,
  setPrimaryDepartment,
} from "@/app/actions/profile-departments";
import { getIconByName, MINISTRY_ICON_NAMES } from "@/lib/icons";
import { can } from "@/lib/permissions";
import type { Role } from "@/lib/permissions";
import type {
  Department,
  StaffProfile,
  ProfileDepartmentAssignment,
} from "./page";

// ─── Constants ────────────────────────────────────────
const PRESET_COLORS = [
  "#EF4444", "#F97316", "#F59E0B", "#FBBF24", "#EAB308", "#84CC16",
  "#5CE1A5", "#10B981", "#14B8A6", "#06B6D4", "#0EA5E9", "#3B82F6",
  "#6366F1", "#8B5CF6", "#A855F7", "#D946EF", "#EC4899", "#F43F5E",
  "#64748B", "#6B7280", "#71717A", "#78716C", "#292524", "#18181B",
];

const ROLE_BADGE_CONFIG: Record<string, { bg: string; text: string; border: string; icon: typeof Shield }> = {
  admin: { bg: "rgba(92, 225, 165, 0.1)", text: "#5CE1A5", border: "rgba(92, 225, 165, 0.3)", icon: Crown },
  staff: { bg: "#EFF6FF", text: "#2563EB", border: "#BFDBFE", icon: ShieldCheck },
  leader: { bg: "#F5F3FF", text: "#7C3AED", border: "#DDD6FE", icon: Shield },
  volunteer: { bg: "#F9FAFB", text: "#6B7280", border: "#E5E7EB", icon: HandHelping },
  member: { bg: "#F9FAFB", text: "#9CA3AF", border: "#E5E7EB", icon: UserIcon },
};

const ROLE_DEFINITIONS = [
  { role: "Admin", description: "Full access to all settings, billing, and team management. Can delete departments, remove members, and manage subscriptions." },
  { role: "Staff", description: "Can create and edit departments, manage member assignments, create announcements, tasks, and events. Cannot delete departments or manage billing." },
  { role: "Leader", description: "Can view members, create tasks and events, and manage volunteer schedules. Cannot create departments or manage assignments." },
  { role: "Volunteer", description: "Limited access. Can view their assignments, respond to tasks, and access Ministry Hubs they belong to." },
  { role: "Member", description: "Basic access only. Can view their own profile and public information." },
];

// ─── Main Component ───────────────────────────────────
interface StaffManagementViewProps {
  departments: Department[];
  profiles: StaffProfile[];
  assignments: ProfileDepartmentAssignment[];
  currentUserRole: Role;
}

export function StaffManagementView({
  departments,
  profiles,
  assignments,
  currentUserRole,
}: StaffManagementViewProps) {
  const [showDeptModal, setShowDeptModal] = useState(false);
  const [editingDept, setEditingDept] = useState<Department | null>(null);
  const [deletingDept, setDeletingDept] = useState<Department | null>(null);
  const [assignModal, setAssignModal] = useState<StaffProfile | null>(null);
  const [addToDeptModal, setAddToDeptModal] = useState<Department | null>(null);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [rolesExpanded, setRolesExpanded] = useState(false);

  const canManage = can.manageDepartmentAssignments(currentUserRole);
  const canCreateDept = can.createDepartment(currentUserRole);
  const canDeleteDept = can.deleteDepartment(currentUserRole);

  // Build lookup maps
  const profileMap = useMemo(() => {
    const map = new Map<string, StaffProfile>();
    profiles.forEach((p) => map.set(p.id, p));
    return map;
  }, [profiles]);

  const assignmentsByDept = useMemo(() => {
    const map = new Map<string, (ProfileDepartmentAssignment & { profile: StaffProfile })[]>();
    assignments.forEach((a) => {
      const profile = profileMap.get(a.profile_id);
      if (!profile) return;
      const arr = map.get(a.department_id) || [];
      arr.push({ ...a, profile });
      map.set(a.department_id, arr);
    });
    return map;
  }, [assignments, profileMap]);

  const assignmentsByProfile = useMemo(() => {
    const map = new Map<string, ProfileDepartmentAssignment[]>();
    assignments.forEach((a) => {
      const arr = map.get(a.profile_id) || [];
      arr.push(a);
      map.set(a.profile_id, arr);
    });
    return map;
  }, [assignments]);

  function openEditDept(dept: Department) {
    setEditingDept(dept);
    setShowDeptModal(true);
  }

  function openCreateDept() {
    setEditingDept(null);
    setShowDeptModal(true);
  }

  return (
    <div className="space-y-8">
      {/* ─── Departments Grid ─── */}
      <section>
        <div className="flex items-center justify-between mb-4">
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
              <p
                className="text-[12px] text-[#6B7280]"
                style={{ fontFamily: "var(--font-source-sans)" }}
              >
                {departments.length} active department
                {departments.length !== 1 ? "s" : ""}
              </p>
            </div>
          </div>
          {canCreateDept && (
            <button
              onClick={openCreateDept}
              className="flex items-center gap-2 h-9 px-4 rounded-xl bg-[#18181B] text-white text-[13px] font-semibold hover:bg-[#292524] transition-all"
              style={{ fontFamily: "var(--font-poppins)" }}
            >
              <Plus className="size-4" />
              Create Department
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {departments.map((dept) => {
            const DeptIcon = getIconByName(dept.icon);
            return (
              <div
                key={dept.id}
                onClick={() => openEditDept(dept)}
                className="p-4 bg-white rounded-2xl border border-[#E5E7EB] group hover:shadow-md hover:border-[#D1D5DB] transition-all cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div
                    className="size-9 rounded-xl flex items-center justify-center text-white shadow-sm shrink-0"
                    style={{ backgroundColor: dept.color }}
                  >
                    <DeptIcon className="size-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p
                      className="text-[13px] font-semibold text-[#2D333A] leading-tight truncate"
                      style={{ fontFamily: "var(--font-poppins)" }}
                    >
                      {dept.name}
                    </p>
                    <p
                      className="text-[11px] text-[#6B7280]"
                      style={{ fontFamily: "var(--font-source-sans)" }}
                    >
                      {dept.member_count} member
                      {dept.member_count !== 1 ? "s" : ""}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between mt-3 pt-3 border-t border-[#F4F5F7]">
                  <div className="flex items-center gap-1.5">
                    <Blocks className="size-3 text-[#9CA3AF]" />
                    <span
                      className="text-[11px] text-[#9CA3AF] font-medium"
                      style={{ fontFamily: "var(--font-source-sans)" }}
                    >
                      Ministry Hub
                    </span>
                  </div>
                  <div
                    className="size-2 rounded-full"
                    style={{
                      backgroundColor: dept.hub_enabled ? "#5CE1A5" : "#E5E7EB",
                    }}
                  />
                </div>
              </div>
            );
          })}

          {/* Add Department Card */}
          {canCreateDept && (
            <button
              onClick={openCreateDept}
              className="p-4 rounded-2xl border-2 border-dashed border-[#E5E7EB] flex items-center gap-3 hover:border-[#5CE1A5] hover:bg-[#5CE1A5]/5 transition-all group min-h-[100px]"
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
          )}
        </div>

        {departments.length === 0 && (
          <div className="text-center py-12">
            <div className="size-16 rounded-2xl bg-[#F4F5F7] flex items-center justify-center mx-auto mb-4">
              <Building className="size-8 text-[#9CA3AF]" />
            </div>
            <p
              className="text-[15px] text-[#6B7280] mb-1"
              style={{ fontFamily: "var(--font-source-sans)" }}
            >
              No departments yet
            </p>
            <p
              className="text-[13px] text-[#9CA3AF]"
              style={{ fontFamily: "var(--font-source-sans)" }}
            >
              Create your first department to organize your team.
            </p>
          </div>
        )}
      </section>

      {/* ─── Department Sections ─── */}
      {departments.map((dept) => {
        const DeptIcon = getIconByName(dept.icon);
        const members = assignmentsByDept.get(dept.id) || [];

        return (
          <section key={dept.id}>
            {/* Section Header */}
            <div className="flex items-center gap-3 mb-4">
              <div
                className="size-10 rounded-2xl flex items-center justify-center text-white shadow-sm"
                style={{ backgroundColor: dept.color }}
              >
                <DeptIcon className="size-5" />
              </div>
              <div>
                <h4
                  className="text-xl text-[#2D333A] leading-tight"
                  style={{ fontFamily: "var(--font-poppins)", fontWeight: 600 }}
                >
                  {dept.name}
                </h4>
                {dept.description && (
                  <p
                    className="text-[13px] text-[#6B7280] mt-0.5"
                    style={{ fontFamily: "var(--font-source-sans)" }}
                  >
                    {dept.description}
                  </p>
                )}
              </div>
            </div>

            {/* Members Table */}
            {members.length > 0 ? (
              <div className="bg-white rounded-2xl border border-[#E5E7EB] overflow-visible">
                {/* Table Header */}
                <div className="grid grid-cols-[1fr_120px_1fr_48px] gap-4 px-5 py-3 border-b border-[#E5E7EB] bg-[#F9FAFB]">
                  <span
                    className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider"
                    style={{ fontFamily: "var(--font-poppins)" }}
                  >
                    Team Member
                  </span>
                  <span
                    className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider"
                    style={{ fontFamily: "var(--font-poppins)" }}
                  >
                    Role
                  </span>
                  <span
                    className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider"
                    style={{ fontFamily: "var(--font-poppins)" }}
                  >
                    Ministry Tags
                  </span>
                  <span />
                </div>

                {/* Table Rows */}
                {members.map((m) => {
                  const profile = m.profile;
                  const roleCfg = ROLE_BADGE_CONFIG[profile.role] || ROLE_BADGE_CONFIG.member;
                  const RoleIcon = roleCfg.icon;
                  const profileAssignments = assignmentsByProfile.get(profile.id) || [];
                  const menuKey = `${dept.id}-${profile.id}`;

                  return (
                    <div
                      key={profile.id}
                      className="grid grid-cols-[1fr_120px_1fr_48px] gap-4 px-5 py-3 border-b border-[#F4F5F7] last:border-b-0 items-center hover:bg-[#FAFBFC] transition-colors"
                    >
                      {/* Member */}
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="size-8 rounded-full bg-[#F4F5F7] flex items-center justify-center shrink-0 text-[12px] font-semibold text-[#6B7280]" style={{ fontFamily: "var(--font-poppins)" }}>
                          {profile.full_name
                            .split(" ")
                            .map((n) => n[0])
                            .join("")
                            .slice(0, 2)
                            .toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p
                            className="text-[13px] font-semibold text-[#2D333A] truncate"
                            style={{ fontFamily: "var(--font-poppins)" }}
                          >
                            {profile.full_name}
                          </p>
                          <p
                            className="text-[11px] text-[#9CA3AF] truncate"
                            style={{ fontFamily: "var(--font-source-sans)" }}
                          >
                            {profile.email}
                          </p>
                        </div>
                      </div>

                      {/* Role */}
                      <div>
                        <span
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold capitalize"
                          style={{
                            fontFamily: "var(--font-poppins)",
                            backgroundColor: roleCfg.bg,
                            color: roleCfg.text,
                            border: `1px solid ${roleCfg.border}`,
                          }}
                        >
                          <RoleIcon className="size-3" />
                          {profile.role}
                        </span>
                      </div>

                      {/* Ministry Tags */}
                      <div className="flex flex-wrap gap-1.5">
                        {profileAssignments.map((pa) => {
                          const tagDept = departments.find(
                            (d) => d.id === pa.department_id
                          );
                          if (!tagDept) return null;
                          const TagIcon = getIconByName(tagDept.icon);

                          if (pa.is_primary) {
                            return (
                              <span
                                key={pa.department_id}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold text-white"
                                style={{
                                  fontFamily: "var(--font-poppins)",
                                  backgroundColor: tagDept.color,
                                }}
                              >
                                <TagIcon className="size-3" />
                                {tagDept.name}
                              </span>
                            );
                          }

                          return (
                            <span
                              key={pa.department_id}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold"
                              style={{
                                fontFamily: "var(--font-poppins)",
                                backgroundColor: "#FFFFFF",
                                color: "#6B7280",
                                border: `1px solid ${tagDept.color}`,
                              }}
                            >
                              <TagIcon
                                className="size-3"
                                style={{ color: tagDept.color }}
                              />
                              {tagDept.name}
                            </span>
                          );
                        })}
                      </div>

                      {/* Actions */}
                      <div className="relative flex justify-end">
                        {canManage && (
                          <>
                            <button
                              onClick={() =>
                                setOpenMenu(
                                  openMenu === menuKey ? null : menuKey
                                )
                              }
                              className="p-1.5 rounded-lg text-[#9CA3AF] hover:text-[#2D333A] hover:bg-[#F4F5F7] transition-colors"
                            >
                              <MoreHorizontal className="size-4" />
                            </button>

                            <AnimatePresence>
                              {openMenu === menuKey && (
                                <motion.div
                                  initial={{ opacity: 0, scale: 0.95, y: -4 }}
                                  animate={{ opacity: 1, scale: 1, y: 0 }}
                                  exit={{ opacity: 0, scale: 0.95, y: -4 }}
                                  transition={{ duration: 0.15 }}
                                  className="absolute right-0 top-full mt-1 z-[100] bg-white rounded-xl border border-[#E5E7EB] shadow-xl py-1.5 w-52"
                                  style={{ boxShadow: "0 8px 30px rgba(0,0,0,0.12)" }}
                                >
                                  {!m.is_primary && (
                                    <button
                                      onClick={async () => {
                                        setOpenMenu(null);
                                        await setPrimaryDepartment(
                                          profile.id,
                                          dept.id
                                        );
                                      }}
                                      className="w-full text-left px-3 py-2 text-[13px] text-[#2D333A] hover:bg-[#F4F5F7] transition-colors"
                                      style={{
                                        fontFamily: "var(--font-source-sans)",
                                      }}
                                    >
                                      Set as Primary
                                    </button>
                                  )}
                                  <button
                                    onClick={() => {
                                      setOpenMenu(null);
                                      setAssignModal(profile);
                                    }}
                                    className="w-full text-left px-3 py-2 text-[13px] text-[#2D333A] hover:bg-[#F4F5F7] transition-colors"
                                    style={{
                                      fontFamily: "var(--font-source-sans)",
                                    }}
                                  >
                                    Edit Assignments
                                  </button>
                                  <button
                                    onClick={async () => {
                                      setOpenMenu(null);
                                      await removeProfileFromDepartment(
                                        profile.id,
                                        dept.id
                                      );
                                    }}
                                    className="w-full text-left px-3 py-2 text-[13px] text-[#EF4444] hover:bg-[#FEF2F2] transition-colors"
                                    style={{
                                      fontFamily: "var(--font-source-sans)",
                                    }}
                                  >
                                    Remove from Ministry
                                  </button>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-[#E5E7EB] p-8 text-center">
                <p
                  className="text-[14px] text-[#9CA3AF] mb-3"
                  style={{ fontFamily: "var(--font-source-sans)" }}
                >
                  No members assigned
                </p>
                {canManage && (
                  <button
                    onClick={() => setAddToDeptModal(dept)}
                    className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-[#F4F5F7] text-[12px] font-semibold text-[#6B7280] hover:bg-[#E5E7EB] transition-colors"
                    style={{ fontFamily: "var(--font-poppins)" }}
                  >
                    <UserPlus className="size-3.5" />
                    Add Member
                  </button>
                )}
              </div>
            )}
          </section>
        );
      })}

      {/* ─── Role Definitions Accordion ─── */}
      <section className="bg-white rounded-2xl border border-[#E5E7EB] overflow-hidden">
        <button
          onClick={() => setRolesExpanded(!rolesExpanded)}
          className="w-full flex items-center justify-between px-5 py-4 hover:bg-[#FAFBFC] transition-colors"
        >
          <div className="flex items-center gap-2">
            <Shield className="size-4 text-[#6B7280]" />
            <span
              className="text-[14px] font-semibold text-[#2D333A]"
              style={{ fontFamily: "var(--font-poppins)" }}
            >
              Role Definitions
            </span>
          </div>
          {rolesExpanded ? (
            <ChevronUp className="size-4 text-[#9CA3AF]" />
          ) : (
            <ChevronDown className="size-4 text-[#9CA3AF]" />
          )}
        </button>

        <AnimatePresence>
          {rolesExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="overflow-hidden"
            >
              <div className="px-5 pb-4 space-y-3">
                {ROLE_DEFINITIONS.map((rd) => {
                  const key = rd.role.toLowerCase();
                  const cfg = ROLE_BADGE_CONFIG[key] || ROLE_BADGE_CONFIG.member;
                  return (
                    <div
                      key={rd.role}
                      className="flex items-start gap-3 py-2"
                    >
                      <span
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold shrink-0 mt-0.5"
                        style={{
                          fontFamily: "var(--font-poppins)",
                          backgroundColor: cfg.bg,
                          color: cfg.text,
                          border: `1px solid ${cfg.border}`,
                        }}
                      >
                        {rd.role}
                      </span>
                      <p
                        className="text-[13px] text-[#6B7280] leading-relaxed"
                        style={{ fontFamily: "var(--font-source-sans)" }}
                      >
                        {rd.description}
                      </p>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </section>

      {/* ─── Modals ─── */}
      <AnimatePresence>
        {showDeptModal && (
          <DepartmentModal
            department={editingDept}
            onClose={() => {
              setShowDeptModal(false);
              setEditingDept(null);
            }}
            onDelete={(dept) => {
              setShowDeptModal(false);
              setEditingDept(null);
              setDeletingDept(dept);
            }}
            canDelete={canDeleteDept}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {deletingDept && (
          <DeleteConfirmModal
            department={deletingDept}
            onClose={() => setDeletingDept(null)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {assignModal && (
          <AssignmentsModal
            profile={assignModal}
            departments={departments}
            currentAssignments={
              assignmentsByProfile.get(assignModal.id) || []
            }
            onClose={() => setAssignModal(null)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {addToDeptModal && (
          <AddToDepartmentModal
            department={addToDeptModal}
            profiles={profiles}
            existingAssignments={assignments}
            onClose={() => setAddToDeptModal(null)}
          />
        )}
      </AnimatePresence>

      {/* Click-away for open menus */}
      {openMenu && (
        <div
          className="fixed inset-0 z-10"
          onClick={() => setOpenMenu(null)}
        />
      )}
    </div>
  );
}

// ─── Department Modal ─────────────────────────────────
function DepartmentModal({
  department,
  onClose,
  onDelete,
  canDelete,
}: {
  department: Department | null;
  onClose: () => void;
  onDelete: (dept: Department) => void;
  canDelete: boolean;
}) {
  const [name, setName] = useState(department?.name || "");
  const [color, setColor] = useState(department?.color || "#5CE1A5");
  const [icon, setIcon] = useState(department?.icon || "Building");
  const [description, setDescription] = useState(
    department?.description || ""
  );
  const [hubEnabled, setHubEnabled] = useState(
    department?.hub_enabled || false
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [iconSearch, setIconSearch] = useState("");
  const [customHex, setCustomHex] = useState("");

  const PreviewIcon = getIconByName(icon);

  const filteredIcons = useMemo(() => {
    if (!iconSearch.trim()) return MINISTRY_ICON_NAMES;
    const q = iconSearch.toLowerCase();
    return MINISTRY_ICON_NAMES.filter((n) => n.toLowerCase().includes(q));
  }, [iconSearch]);

  async function handleSave() {
    if (!name.trim()) return;
    setSaving(true);
    setError(null);

    const data = {
      name: name.trim(),
      color,
      icon,
      description: description.trim() || undefined,
      hub_enabled: hubEnabled,
    };

    const result = department
      ? await updateDepartment(department.id, data)
      : await addDepartment(data);

    setSaving(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    onClose();
  }

  function handleCustomHex() {
    const hex = customHex.trim();
    if (/^#[0-9A-Fa-f]{6}$/.test(hex)) {
      setColor(hex);
    } else if (/^[0-9A-Fa-f]{6}$/.test(hex)) {
      setColor(`#${hex}`);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 8 }}
        transition={{ duration: 0.2 }}
        className="bg-white rounded-2xl shadow-xl max-w-lg w-full mx-4 overflow-hidden max-h-[90vh] flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E5E7EB] shrink-0">
          <h3
            className="text-[16px] font-semibold text-[#2D333A]"
            style={{ fontFamily: "var(--font-poppins)" }}
          >
            {department ? "Edit Department" : "Create Department"}
          </h3>
          <button
            onClick={onClose}
            className="p-1 text-[#6B7280] hover:text-[#2D333A] transition-colors"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-6 space-y-5 overflow-y-auto flex-1">
          {error && (
            <div
              className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-[13px] text-red-600"
              style={{ fontFamily: "var(--font-source-sans)" }}
            >
              {error}
            </div>
          )}

          {/* Live Preview */}
          <div>
            <label
              className="text-[13px] font-medium text-[#2D333A] mb-1.5 block"
              style={{ fontFamily: "var(--font-poppins)" }}
            >
              Preview
            </label>
            <div className="p-4 bg-[#F9FAFB] rounded-xl border border-[#E5E7EB]">
              <div className="flex items-center gap-3">
                <div
                  className="size-9 rounded-xl flex items-center justify-center text-white shadow-sm shrink-0 transition-colors"
                  style={{ backgroundColor: color }}
                >
                  <PreviewIcon className="size-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p
                    className="text-[13px] font-semibold text-[#2D333A] leading-tight truncate"
                    style={{ fontFamily: "var(--font-poppins)" }}
                  >
                    {name || "Department Name"}
                  </p>
                  <p
                    className="text-[11px] text-[#6B7280]"
                    style={{ fontFamily: "var(--font-source-sans)" }}
                  >
                    0 members
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Name */}
          <div>
            <label
              className="text-[13px] font-medium text-[#2D333A] mb-1.5 block"
              style={{ fontFamily: "var(--font-poppins)" }}
            >
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

          {/* Color Picker */}
          <div>
            <label
              className="text-[13px] font-medium text-[#2D333A] mb-1.5 block"
              style={{ fontFamily: "var(--font-poppins)" }}
            >
              Color
            </label>
            <div className="grid grid-cols-6 gap-2 mb-2">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className="size-8 rounded-lg transition-all flex items-center justify-center hover:scale-105"
                  style={{
                    backgroundColor: c,
                    boxShadow:
                      color === c
                        ? `0 0 0 2px white, 0 0 0 4px ${c}`
                        : undefined,
                  }}
                >
                  {color === c && (
                    <Check className="size-4 text-white drop-shadow-sm" />
                  )}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={customHex}
                onChange={(e) => setCustomHex(e.target.value)}
                onBlur={handleCustomHex}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCustomHex();
                }}
                placeholder="#HEXCODE"
                className="flex-1 h-8 px-3 rounded-lg border border-[#E5E7EB] bg-[#F4F5F7] text-[12px] text-[#2D333A] placeholder-[#9CA3AF] outline-none focus:border-[#5CE1A5] transition-colors"
                style={{ fontFamily: "var(--font-source-sans)" }}
              />
              <div
                className="size-8 rounded-lg border border-[#E5E7EB]"
                style={{ backgroundColor: color }}
              />
            </div>
          </div>

          {/* Icon Picker */}
          <div>
            <label
              className="text-[13px] font-medium text-[#2D333A] mb-1.5 block"
              style={{ fontFamily: "var(--font-poppins)" }}
            >
              Icon
            </label>
            <div className="relative mb-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-[#9CA3AF]" />
              <input
                type="text"
                value={iconSearch}
                onChange={(e) => setIconSearch(e.target.value)}
                placeholder="Search icons..."
                className="w-full h-8 pl-8 pr-3 rounded-lg border border-[#E5E7EB] bg-[#F4F5F7] text-[12px] text-[#2D333A] placeholder-[#9CA3AF] outline-none focus:border-[#5CE1A5] transition-colors"
                style={{ fontFamily: "var(--font-source-sans)" }}
              />
            </div>
            <div className="grid grid-cols-6 gap-1.5 max-h-[160px] overflow-y-auto p-1">
              {filteredIcons.map((iconName) => {
                const Ico = getIconByName(iconName);
                const isSelected = icon === iconName;
                return (
                  <button
                    key={iconName}
                    onClick={() => setIcon(iconName)}
                    className="size-8 rounded-lg flex items-center justify-center transition-all hover:bg-[#F4F5F7]"
                    style={{
                      backgroundColor: isSelected
                        ? "#ECFDF5"
                        : undefined,
                      color: isSelected ? "#059669" : "#6B7280",
                    }}
                    title={iconName}
                  >
                    <Ico className="size-4" />
                  </button>
                );
              })}
              {filteredIcons.length === 0 && (
                <p
                  className="col-span-6 text-center text-[12px] text-[#9CA3AF] py-4"
                  style={{ fontFamily: "var(--font-source-sans)" }}
                >
                  No icons found
                </p>
              )}
            </div>
          </div>

          {/* Description */}
          <div>
            <label
              className="text-[13px] font-medium text-[#2D333A] mb-1.5 block"
              style={{ fontFamily: "var(--font-poppins)" }}
            >
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
              <p
                className="text-[13px] font-medium text-[#2D333A]"
                style={{ fontFamily: "var(--font-poppins)" }}
              >
                Show in Ministry Hub
              </p>
              <p
                className="text-[11px] text-[#6B7280]"
                style={{ fontFamily: "var(--font-source-sans)" }}
              >
                Make visible in the Ministry Hub module
              </p>
            </div>
            <button
              onClick={() => setHubEnabled(!hubEnabled)}
              className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200"
              style={{
                backgroundColor: hubEnabled ? "#5CE1A5" : "#E5E7EB",
              }}
            >
              <span
                className="inline-block size-5 rounded-full bg-white shadow-sm transition-transform duration-200"
                style={{
                  transform: hubEnabled
                    ? "translateX(22px)"
                    : "translateX(2px)",
                }}
              />
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-[#E5E7EB] shrink-0">
          <div>
            {department && canDelete && (
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
              {saving
                ? "Saving..."
                : department
                ? "Save Changes"
                : "Create Department"}
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Delete Confirm Modal ─────────────────────────────
function DeleteConfirmModal({
  department,
  onClose,
}: {
  department: Department;
  onClose: () => void;
}) {
  const [deleting, setDeleting] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.2 }}
        className="bg-white rounded-2xl p-6 shadow-xl max-w-sm w-full mx-4"
      >
        <h3
          className="text-[16px] font-semibold text-[#2D333A] mb-2"
          style={{ fontFamily: "var(--font-poppins)" }}
        >
          Delete {department.name}?
        </h3>
        <p
          className="text-[14px] text-[#6B7280] mb-6"
          style={{ fontFamily: "var(--font-source-sans)" }}
        >
          This will permanently remove this department and all member
          assignments. This action cannot be undone.
        </p>
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 h-10 rounded-xl border border-[#E5E7EB] text-[13px] font-semibold text-[#2D333A] hover:bg-[#F4F5F7] transition-all"
            style={{ fontFamily: "var(--font-poppins)" }}
          >
            Cancel
          </button>
          <button
            onClick={async () => {
              setDeleting(true);
              await deleteDepartment(department.id);
              setDeleting(false);
              onClose();
            }}
            disabled={deleting}
            className="flex-1 h-10 rounded-xl bg-[#EF4444] text-white text-[13px] font-semibold hover:bg-[#DC2626] transition-all disabled:opacity-50"
            style={{ fontFamily: "var(--font-poppins)" }}
          >
            {deleting ? "Deleting..." : "Delete"}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Assignments Modal ────────────────────────────────
function AssignmentsModal({
  profile,
  departments,
  currentAssignments,
  onClose,
}: {
  profile: StaffProfile;
  departments: Department[];
  currentAssignments: ProfileDepartmentAssignment[];
  onClose: () => void;
}) {
  const [localAssignments, setLocalAssignments] = useState<
    { department_id: string; is_primary: boolean }[]
  >(
    currentAssignments.map((a) => ({
      department_id: a.department_id,
      is_primary: a.is_primary,
    }))
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const roleCfg =
    ROLE_BADGE_CONFIG[profile.role] || ROLE_BADGE_CONFIG.member;

  function toggleDepartment(deptId: string) {
    const existing = localAssignments.find(
      (a) => a.department_id === deptId
    );
    if (existing) {
      setLocalAssignments(
        localAssignments.filter((a) => a.department_id !== deptId)
      );
    } else {
      setLocalAssignments([
        ...localAssignments,
        {
          department_id: deptId,
          is_primary: localAssignments.length === 0,
        },
      ]);
    }
  }

  function setPrimary(deptId: string) {
    setLocalAssignments(
      localAssignments.map((a) => ({
        ...a,
        is_primary: a.department_id === deptId,
      }))
    );
  }

  async function handleSave() {
    setSaving(true);
    setError(null);

    const result = await bulkUpdateAssignments(
      profile.id,
      localAssignments
    );

    setSaving(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    onClose();
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 8 }}
        transition={{ duration: 0.2 }}
        className="bg-white rounded-2xl shadow-xl max-w-md w-full mx-4 overflow-hidden max-h-[90vh] flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E5E7EB] shrink-0">
          <h3
            className="text-[16px] font-semibold text-[#2D333A]"
            style={{ fontFamily: "var(--font-poppins)" }}
          >
            Manage Assignments
          </h3>
          <button
            onClick={onClose}
            className="p-1 text-[#6B7280] hover:text-[#2D333A] transition-colors"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Profile Info */}
        <div className="px-6 py-3 border-b border-[#F4F5F7] flex items-center gap-3 shrink-0">
          <div className="size-9 rounded-full bg-[#F4F5F7] flex items-center justify-center text-[13px] font-semibold text-[#6B7280]" style={{ fontFamily: "var(--font-poppins)" }}>
            {profile.full_name
              .split(" ")
              .map((n) => n[0])
              .join("")
              .slice(0, 2)
              .toUpperCase()}
          </div>
          <div>
            <p
              className="text-[14px] font-semibold text-[#2D333A]"
              style={{ fontFamily: "var(--font-poppins)" }}
            >
              {profile.full_name}
            </p>
            <span
              className="inline-flex items-center gap-1 px-1.5 py-0 rounded text-[10px] font-semibold capitalize"
              style={{
                fontFamily: "var(--font-poppins)",
                backgroundColor: roleCfg.bg,
                color: roleCfg.text,
                border: `1px solid ${roleCfg.border}`,
              }}
            >
              {profile.role}
            </span>
          </div>
        </div>

        {/* Department List */}
        <div className="flex-1 overflow-y-auto">
          {error && (
            <div
              className="mx-6 mt-3 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-[13px] text-red-600"
              style={{ fontFamily: "var(--font-source-sans)" }}
            >
              {error}
            </div>
          )}

          <div className="px-6 py-2">
            <div className="grid grid-cols-[auto_1fr_auto] gap-x-3 items-center">
              {/* Column headers */}
              <span
                className="text-[10px] font-semibold text-[#9CA3AF] uppercase tracking-wider py-2"
                style={{ fontFamily: "var(--font-poppins)" }}
              >
                Assign
              </span>
              <span
                className="text-[10px] font-semibold text-[#9CA3AF] uppercase tracking-wider py-2"
                style={{ fontFamily: "var(--font-poppins)" }}
              >
                Department
              </span>
              <span
                className="text-[10px] font-semibold text-[#9CA3AF] uppercase tracking-wider py-2"
                style={{ fontFamily: "var(--font-poppins)" }}
              >
                Primary
              </span>

              {departments.map((dept) => {
                const DeptIcon = getIconByName(dept.icon);
                const isAssigned = localAssignments.some(
                  (a) => a.department_id === dept.id
                );
                const isPrimary = localAssignments.some(
                  (a) => a.department_id === dept.id && a.is_primary
                );

                return (
                  <div key={dept.id} className="contents">
                    {/* Checkbox */}
                    <div className="py-2 flex justify-center">
                      <button
                        onClick={() => toggleDepartment(dept.id)}
                        className="size-5 rounded border flex items-center justify-center transition-all"
                        style={{
                          backgroundColor: isAssigned
                            ? dept.color
                            : "#FFFFFF",
                          borderColor: isAssigned
                            ? dept.color
                            : "#D1D5DB",
                        }}
                      >
                        {isAssigned && (
                          <Check className="size-3 text-white" />
                        )}
                      </button>
                    </div>

                    {/* Department Info */}
                    <div className="py-2 flex items-center gap-2 min-w-0">
                      <div
                        className="size-6 rounded-lg flex items-center justify-center text-white shrink-0"
                        style={{ backgroundColor: dept.color }}
                      >
                        <DeptIcon className="size-3" />
                      </div>
                      <span
                        className="text-[13px] font-medium text-[#2D333A] truncate"
                        style={{ fontFamily: "var(--font-source-sans)" }}
                      >
                        {dept.name}
                      </span>
                    </div>

                    {/* Primary Radio */}
                    <div className="py-2 flex justify-center">
                      {isAssigned && (
                        <button
                          onClick={() => setPrimary(dept.id)}
                          className="size-5 rounded-full border-2 flex items-center justify-center transition-all"
                          style={{
                            borderColor: isPrimary
                              ? dept.color
                              : "#D1D5DB",
                          }}
                        >
                          {isPrimary && (
                            <div
                              className="size-2.5 rounded-full"
                              style={{ backgroundColor: dept.color }}
                            />
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-6 py-4 border-t border-[#E5E7EB] shrink-0">
          <button
            onClick={onClose}
            className="flex-1 h-10 rounded-xl border border-[#E5E7EB] text-[13px] font-semibold text-[#2D333A] hover:bg-[#F4F5F7] transition-all"
            style={{ fontFamily: "var(--font-poppins)" }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 h-10 rounded-xl bg-[#5CE1A5] text-white text-[13px] font-semibold hover:bg-[#4BD694] transition-all disabled:opacity-50"
            style={{ fontFamily: "var(--font-poppins)" }}
          >
            {saving ? "Saving..." : "Save Assignments"}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Add to Department Modal (Search + Select) ──────────
function AddToDepartmentModal({
  department,
  profiles,
  existingAssignments,
  onClose,
}: {
  department: Department;
  profiles: StaffProfile[];
  existingAssignments: ProfileDepartmentAssignment[];
  onClose: () => void;
}) {
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState<string | null>(null);
  const DeptIcon = getIconByName(department.icon);

  // Filter profiles that are NOT already in this department
  const alreadyAssigned = new Set(
    existingAssignments
      .filter((a) => a.department_id === department.id)
      .map((a) => a.profile_id)
  );

  const available = profiles.filter((p) => {
    if (alreadyAssigned.has(p.id)) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      p.full_name.toLowerCase().includes(q) ||
      p.email.toLowerCase().includes(q) ||
      p.role.toLowerCase().includes(q)
    );
  });

  const assigned = profiles.filter((p) => alreadyAssigned.has(p.id));

  async function handleAdd(profileId: string) {
    setSaving(profileId);
    // Get existing assignments for this profile
    const existingForProfile = existingAssignments.filter(
      (a) => a.profile_id === profileId
    );
    const newAssignments = [
      ...existingForProfile.map((a) => ({
        department_id: a.department_id,
        is_primary: a.is_primary,
      })),
      {
        department_id: department.id,
        is_primary: existingForProfile.length === 0, // Primary if first assignment
      },
    ];
    await bulkUpdateAssignments(profileId, newAssignments);
    setSaving(null);
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 8 }}
        transition={{ duration: 0.2 }}
        className="bg-white rounded-2xl shadow-xl max-w-lg w-full mx-4 overflow-hidden max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#E5E7EB] shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className="size-9 rounded-xl flex items-center justify-center text-white shrink-0"
                style={{ backgroundColor: department.color }}
              >
                <DeptIcon className="size-4" />
              </div>
              <div>
                <h3
                  className="text-[16px] font-semibold text-[#2D333A]"
                  style={{ fontFamily: "var(--font-poppins)" }}
                >
                  Add to {department.name}
                </h3>
                <p
                  className="text-[12px] text-[#6B7280]"
                  style={{ fontFamily: "var(--font-source-sans)" }}
                >
                  Search and select team members to add
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1 text-[#6B7280] hover:text-[#2D333A] transition-colors"
            >
              <X className="size-5" />
            </button>
          </div>

          {/* Search */}
          <div className="relative mt-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-[#9CA3AF]" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, email, or role..."
              autoFocus
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-[#E5E7EB] bg-[#F4F5F7] text-[14px] text-[#2D333A] placeholder-[#9CA3AF] outline-none focus:border-[#5CE1A5] transition-colors"
              style={{ fontFamily: "var(--font-source-sans)" }}
            />
          </div>
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto px-4 py-3">
          {/* Already assigned */}
          {assigned.length > 0 && !search && (
            <div className="mb-4">
              <p
                className="text-[11px] uppercase tracking-wider text-[#9CA3AF] px-2 mb-2"
                style={{ fontFamily: "var(--font-poppins)", fontWeight: 600 }}
              >
                Already in {department.name} ({assigned.length})
              </p>
              {assigned.map((p) => {
                const roleCfg = ROLE_BADGE_CONFIG[p.role] || ROLE_BADGE_CONFIG.member;
                const initials = p.full_name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
                return (
                  <div key={p.id} className="flex items-center gap-3 px-2 py-2 rounded-xl opacity-50">
                    <div className="size-8 rounded-full flex items-center justify-center text-[11px] font-semibold text-white shrink-0" style={{ backgroundColor: "#5CE1A5" }}>
                      {initials}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] text-[#2D333A] truncate" style={{ fontFamily: "var(--font-poppins)", fontWeight: 600 }}>{p.full_name}</p>
                      <p className="text-[11px] text-[#9CA3AF] truncate" style={{ fontFamily: "var(--font-source-sans)" }}>{p.email}</p>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded-md" style={{ fontFamily: "var(--font-poppins)", fontWeight: 600, backgroundColor: roleCfg.bg, color: roleCfg.text }}>
                      {p.role.charAt(0).toUpperCase() + p.role.slice(1)}
                    </span>
                    <span className="text-[11px] text-[#5CE1A5]" style={{ fontFamily: "var(--font-source-sans)", fontWeight: 600 }}>Added</span>
                  </div>
                );
              })}
            </div>
          )}

          {/* Available to add */}
          {available.length > 0 ? (
            <div>
              {!search && assigned.length > 0 && (
                <p
                  className="text-[11px] uppercase tracking-wider text-[#9CA3AF] px-2 mb-2"
                  style={{ fontFamily: "var(--font-poppins)", fontWeight: 600 }}
                >
                  Available ({available.length})
                </p>
              )}
              {available.map((p) => {
                const roleCfg = ROLE_BADGE_CONFIG[p.role] || ROLE_BADGE_CONFIG.member;
                const initials = p.full_name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
                const isSaving = saving === p.id;
                return (
                  <div key={p.id} className="flex items-center gap-3 px-2 py-2.5 rounded-xl hover:bg-[#F9FAFB] transition-colors">
                    <div className="size-8 rounded-full flex items-center justify-center text-[11px] font-semibold text-white shrink-0" style={{ backgroundColor: "#5CE1A5" }}>
                      {initials}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] text-[#2D333A] truncate" style={{ fontFamily: "var(--font-poppins)", fontWeight: 600 }}>{p.full_name}</p>
                      <p className="text-[11px] text-[#9CA3AF] truncate" style={{ fontFamily: "var(--font-source-sans)" }}>{p.email}</p>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded-md" style={{ fontFamily: "var(--font-poppins)", fontWeight: 600, backgroundColor: roleCfg.bg, color: roleCfg.text }}>
                      {p.role.charAt(0).toUpperCase() + p.role.slice(1)}
                    </span>
                    <button
                      onClick={() => handleAdd(p.id)}
                      disabled={isSaving}
                      className="h-7 px-3 rounded-lg bg-[#5CE1A5] text-white text-[11px] font-semibold hover:bg-[#4BD694] transition-all disabled:opacity-50 shrink-0"
                      style={{ fontFamily: "var(--font-poppins)" }}
                    >
                      {isSaving ? "..." : "+ Add"}
                    </button>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="py-8 text-center">
              <p className="text-[14px] text-[#9CA3AF]" style={{ fontFamily: "var(--font-source-sans)" }}>
                {search ? `No team members match "${search}"` : "All team members are already assigned"}
              </p>
              <p className="text-[12px] text-[#D1D5DB] mt-1" style={{ fontFamily: "var(--font-source-sans)" }}>
                Invite new team members from Settings → Organization
              </p>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
