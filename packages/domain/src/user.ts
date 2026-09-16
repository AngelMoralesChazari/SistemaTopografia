import type { RenterStatus, UserRole } from './types';
import { ROLE_LABELS } from './types';

export type AppUser = {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  studentId?: string | null;
  employeeId?: string | null;
  /** Profesor asignado al alumno (desde Firestore). */
  teacherId?: string | null;
  teacherName?: string | null;
  groupIds?: string[];
  active: boolean;
  labId: string;
  /** Solo particulares: pending | approved | rejected */
  renterStatus?: RenterStatus | null;
  phone?: string | null;
  company?: string | null;
  ine?: string | null;
  rfc?: string | null;
  address?: string | null;
};

export function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

export function formatRole(role: UserRole): string {
  return ROLE_LABELS[role];
}

/** Admin operativo o superadministrador. */
export function isAdminRole(role: UserRole): boolean {
  return role === 'admin' || role === 'super_admin';
}

export function isSuperAdminRole(role: UserRole): boolean {
  return role === 'super_admin';
}

export type AcademicGroup = {
  id: string;
  code: string;
  name: string;
  career: string;
  labId: string;
};

export const TOPOGRAPHY_GROUPS = [
  '101', '102',
  '201', '202',
  '301', '302',
  '401', '402',
  '501', '502',
  '601', '602',
  '701', '702',
  '801', '802',
] as const;
