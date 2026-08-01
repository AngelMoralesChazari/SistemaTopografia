import type { UserRole } from './types';
import { ROLE_LABELS } from './types';

export type AppUser = {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  studentId?: string | null;
  employeeId?: string | null;
  groupIds?: string[];
  active: boolean;
  labId: string;
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
