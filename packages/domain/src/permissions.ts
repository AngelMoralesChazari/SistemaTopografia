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
  | 'loans.read_all'
  | 'loans.read_group'
  | 'loans.read_own'
  | 'reports.global'
  | 'audit.read';

const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  admin: [
    'users.manage',
    'settings.manage',
    'equipment.read',
    'equipment.write',
    'loans.create',
    'loans.approve',
    'loans.deliver',
    'loans.return',
    'loans.read_all',
    'loans.read_group',
    'loans.read_own',
    'reports.global',
    'audit.read',
  ],
  lab_manager: [
    'equipment.read',
    'equipment.write',
    'loans.approve',
    'loans.deliver',
    'loans.return',
    'loans.read_all',
    'reports.global',
  ],
  teacher: ['equipment.read', 'loans.read_group'],
  student: ['equipment.read', 'loans.create', 'loans.read_own'],
};

export function can(role: UserRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}

export function assertPermission(role: UserRole, permission: Permission): void {
  if (!can(role, permission)) {
    throw new Error(`Permiso denegado: ${permission}`);
  }
}

/** Transiciones válidas de préstamo (máquina de estados Fase 3). */
const LOAN_TRANSITIONS: Record<LoanStatus, LoanStatus[]> = {
  pending: ['approved', 'rejected', 'cancelled'],
  approved: ['delivered', 'cancelled'],
  rejected: [],
  delivered: ['returned', 'returned_late', 'damaged', 'lost'],
  returned: [],
  returned_late: [],
  damaged: [],
  lost: [],
  cancelled: [],
};

export function canTransitionLoan(from: LoanStatus, to: LoanStatus): boolean {
  return LOAN_TRANSITIONS[from].includes(to);
}
