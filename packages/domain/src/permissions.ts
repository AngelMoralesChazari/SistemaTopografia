import type { LoanStatus, UserRole } from './types';

export type Permission =
  | 'users.manage'
  | 'settings.manage'
  | 'equipment.read'
  | 'equipment.write'
  | 'loans.create'
  | 'loans.approve'
  | 'loans.deliver'
  | 'loans.return'
  | 'loans.override'
  | 'loans.read_all'
  | 'loans.read_group'
  | 'loans.read_own'
  | 'reports.global'
  | 'audit.read'
  | 'renters.approve';

const ADMIN_PERMS: Permission[] = [
  'users.manage',
  'settings.manage',
  'equipment.read',
  'equipment.write',
  'loans.create',
  'loans.approve',
  'loans.deliver',
  'loans.return',
  'loans.override',
  'loans.read_all',
  'loans.read_group',
  'loans.read_own',
  'reports.global',
  'renters.approve',
];

const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  super_admin: [...ADMIN_PERMS, 'audit.read'],
  admin: ADMIN_PERMS,
  lab_manager: [
    'equipment.read',
    'equipment.write',
    'loans.approve',
    'loans.deliver',
    'loans.return',
    'loans.read_all',
    'reports.global',
    'renters.approve',
  ],
  teacher: ['equipment.read', 'loans.read_group', 'loans.create', 'loans.read_own'],
  student: ['equipment.read', 'loans.create', 'loans.read_own'],
  renter: ['equipment.read', 'loans.create', 'loans.read_own'],
};

export function can(role: UserRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}

export function assertPermission(role: UserRole, permission: Permission): void {
  if (!can(role, permission)) {
    throw new Error(`Permiso denegado: ${permission}`);
  }
}

/** Transiciones válidas de préstamo */
const LOAN_TRANSITIONS: Record<LoanStatus, LoanStatus[]> = {
  pending: ['approved', 'rejected', 'cancelled'],
  approved: ['delivered', 'cancelled', 'rejected', 'pending'],
  rejected: ['pending', 'approved'],
  delivered: ['returned', 'returned_late', 'damaged', 'lost'],
  returned: [],
  returned_late: [],
  damaged: [],
  lost: [],
  cancelled: ['pending'],
};

/** Overrides administrativos (aceptar/rechazar/reabrir). */
export const ADMIN_OVERRIDE_STATUSES: LoanStatus[] = ['pending', 'approved', 'rejected'];

export function canTransitionLoan(from: LoanStatus, to: LoanStatus): boolean {
  return LOAN_TRANSITIONS[from].includes(to);
}

export function canAdminOverrideLoan(from: LoanStatus, to: LoanStatus): boolean {
  return (
    ADMIN_OVERRIDE_STATUSES.includes(from) &&
    ADMIN_OVERRIDE_STATUSES.includes(to) &&
    from !== to
  );
}
