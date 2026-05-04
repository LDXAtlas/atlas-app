import { Crown, ShieldCheck, Shield, HandHelping, User as UserIcon, type LucideIcon } from "lucide-react";
import type { Role } from "./permissions";

export const ROLE_COLORS = {
  admin: { bg: "#FEE2E2", text: "#DC2626", border: "#FECACA" },
  staff: { bg: "#DBEAFE", text: "#2563EB", border: "#BFDBFE" },
  leader: { bg: "#EDE9FE", text: "#7C3AED", border: "#DDD6FE" },
  volunteer: { bg: "#D1FAE5", text: "#059669", border: "#A7F3D0" },
  member: { bg: "#F3F4F6", text: "#6B7280", border: "#E5E7EB" },
} as const satisfies Record<Role, { bg: string; text: string; border: string }>;

export const ROLE_LABELS = {
  admin: "Admin",
  staff: "Staff",
  leader: "Leader",
  volunteer: "Volunteer",
  member: "Member",
} as const satisfies Record<Role, string>;

export const ROLE_ICONS: Record<Role, LucideIcon> = {
  admin: Crown,
  staff: ShieldCheck,
  leader: Shield,
  volunteer: HandHelping,
  member: UserIcon,
};

export function getRoleStyle(role: string) {
  return ROLE_COLORS[role as Role] ?? ROLE_COLORS.member;
}

export function getRoleLabel(role: string) {
  return ROLE_LABELS[role as Role] ?? ROLE_LABELS.member;
}

export function getRoleIcon(role: string): LucideIcon {
  return ROLE_ICONS[role as Role] ?? ROLE_ICONS.member;
}
