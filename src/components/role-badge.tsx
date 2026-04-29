import { type Role } from "@/lib/permissions";

const ROLE_STYLES: Record<Role, { bg: string; text: string; label: string }> = {
  admin: { bg: "rgba(92, 225, 165, 0.1)", text: "#5CE1A5", label: "Admin" },
  staff: { bg: "rgba(59, 130, 246, 0.1)", text: "#3B82F6", label: "Staff" },
  leader: { bg: "rgba(139, 92, 246, 0.1)", text: "#8B5CF6", label: "Leader" },
  volunteer: { bg: "rgba(107, 114, 128, 0.1)", text: "#6B7280", label: "Volunteer" },
  member: { bg: "rgba(156, 163, 175, 0.08)", text: "#9CA3AF", label: "Member" },
};

export function RoleBadge({ role }: { role: Role }) {
  const style = ROLE_STYLES[role] || ROLE_STYLES.member;
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] uppercase tracking-wide"
      style={{
        fontFamily: "var(--font-poppins)",
        fontWeight: 600,
        backgroundColor: style.bg,
        color: style.text,
      }}
    >
      {style.label}
    </span>
  );
}
