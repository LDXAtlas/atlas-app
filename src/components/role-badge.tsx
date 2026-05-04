import { type Role } from "@/lib/permissions";
import { ROLE_COLORS, ROLE_LABELS } from "@/lib/roles";

export function RoleBadge({ role }: { role: Role }) {
  const style = ROLE_COLORS[role] ?? ROLE_COLORS.member;
  const label = ROLE_LABELS[role] ?? ROLE_LABELS.member;
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] uppercase tracking-wide border"
      style={{
        fontFamily: "var(--font-poppins)",
        fontWeight: 600,
        backgroundColor: style.bg,
        color: style.text,
        borderColor: style.border,
      }}
    >
      {label}
    </span>
  );
}
