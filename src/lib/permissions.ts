export type Role = 'admin' | 'staff' | 'leader' | 'volunteer' | 'member';

export const ROLES = {
  ADMIN: 'admin',
  STAFF: 'staff',
  LEADER: 'leader',
  VOLUNTEER: 'volunteer',
  MEMBER: 'member',
} as const;

export const ROLE_HIERARCHY: Record<Role, number> = {
  admin: 5,
  staff: 4,
  leader: 3,
  volunteer: 2,
  member: 1,
};

export const isAtLeast = (userRole: Role, minRole: Role): boolean => {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[minRole];
};

export const can = {
  manageBilling: (role: Role) => role === 'admin',
  manageSubscription: (role: Role) => role === 'admin',
  inviteTeam: (role: Role) => role === 'admin',
  removeTeamMember: (role: Role) => role === 'admin',
  changeUserRole: (role: Role) => role === 'admin',
  editOrganization: (role: Role) => role === 'admin',
  deleteOrganization: (role: Role) => role === 'admin',
  createDepartment: (role: Role) => ['admin', 'staff'].includes(role),
  editDepartment: (role: Role) => ['admin', 'staff'].includes(role),
  deleteDepartment: (role: Role) => role === 'admin',
  viewMembers: (role: Role) => isAtLeast(role, 'leader'),
  createMember: (role: Role) => ['admin', 'staff'].includes(role),
  editMember: (role: Role) => ['admin', 'staff'].includes(role),
  deleteMember: (role: Role) => role === 'admin',
  importMembers: (role: Role) => ['admin', 'staff'].includes(role),
  createAnnouncement: (role: Role) => ['admin', 'staff', 'leader'].includes(role),
  editAnyAnnouncement: (role: Role) => role === 'admin',
  deleteAnyAnnouncement: (role: Role) => role === 'admin',
  pinAnnouncement: (role: Role) => ['admin', 'staff'].includes(role),
  createTask: (role: Role) => ['admin', 'staff', 'leader'].includes(role),
  assignTaskToAnyone: (role: Role) => ['admin', 'staff'].includes(role),
  deleteAnyTask: (role: Role) => role === 'admin',
  createEvent: (role: Role) => ['admin', 'staff', 'leader'].includes(role),
  editAnyEvent: (role: Role) => role === 'admin',
  deleteAnyEvent: (role: Role) => role === 'admin',
  createCustomEventType: (role: Role) => ['admin', 'staff'].includes(role),
  editCustomEventType: (role: Role) => ['admin', 'staff'].includes(role),
  deleteCustomEventType: (role: Role) => role === 'admin',
  viewCareNotes: (role: Role) => ['admin', 'staff'].includes(role),
  createCareNote: (role: Role) => ['admin', 'staff'].includes(role),
  deleteCareNote: (role: Role) => role === 'admin',
  manageVolunteerSchedule: (role: Role) => ['admin', 'staff', 'leader'].includes(role),
  approveVolunteerSwap: (role: Role) => ['admin', 'staff', 'leader'].includes(role),
  createWorkflow: (role: Role) => ['admin', 'staff'].includes(role),
  runWorkflow: (role: Role) => ['admin', 'staff', 'leader'].includes(role),
  deleteWorkflow: (role: Role) => role === 'admin',
};

export const getRoleFromProfile = (profile: { role?: string | null } | null): Role => {
  if (!profile?.role) return 'member';
  if (['admin', 'staff', 'leader', 'volunteer', 'member'].includes(profile.role)) {
    return profile.role as Role;
  }
  return 'member';
};
