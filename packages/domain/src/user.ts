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
  /** Fecha límite de permiso temporal para editar gestión de equipos (formato YYYY-MM-DD o ISO) */
  equipmentEditUntil?: string | null;
  /** Nombre o correo del administrador que otorgó el permiso */
  equipmentEditGrantedBy?: string | null;
  /** Timestamp de cuándo se otorgó el permiso */
  equipmentEditGrantedAt?: string | null;
  /** Notas o justificación del permiso asignado */
  equipmentEditNotes?: string | null;
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

/**
 * Determina si el usuario tiene permiso activo para editar en Gestión de Equipos.
 * - Los administradores (super_admin y admin) siempre tienen permiso.
 * - Los encargados de laboratorio (lab_manager) tienen permiso si un administrador les
 *   otorgó un periodo temporal y la fecha límite aún no ha expirado.
 */
export function hasEquipmentEditPermission(user: AppUser | null | undefined): boolean {
  if (!user) return false;
  if (isAdminRole(user.role)) return true;
  if (user.role !== 'lab_manager') return false;
  if (!user.equipmentEditUntil) return false;

  const untilDate = new Date(
    user.equipmentEditUntil.includes('T')
      ? user.equipmentEditUntil
      : `${user.equipmentEditUntil}T23:59:59`
  );
  return !Number.isNaN(untilDate.getTime()) && untilDate.getTime() >= Date.now();
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
