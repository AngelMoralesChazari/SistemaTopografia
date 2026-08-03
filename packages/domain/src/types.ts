export type UserRole = 'admin' | 'lab_manager' | 'teacher' | 'student' | 'renter';

/** Estado de aprobación para particulares (renta a terceros). */
export type RenterStatus = 'pending' | 'approved' | 'rejected';

export type EquipmentStatus =
  | 'available'
  | 'reserved'
  | 'loaned'
  | 'maintenance'
  | 'damaged'
  | 'out_of_service'
  | 'lost';

export type LoanStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'delivered'
  | 'returned'
  | 'returned_late'
  | 'damaged'
  | 'lost'
  | 'cancelled';

export type LoanType = 'academic' | 'rental';

export type ReturnCondition = 'ok' | 'damaged' | 'lost';

export const LOAN_STATUS_LABELS: Record<LoanStatus, string> = {
  pending: 'Pendiente',
  approved: 'Aprobada',
  rejected: 'Rechazada',
  delivered: 'Material entregado',
  returned: 'Devuelto',
  returned_late: 'Devuelto con retraso',
  damaged: 'Material dañado',
  lost: 'Perdido',
  cancelled: 'Cancelado',
};

export const EQUIPMENT_STATUS_LABELS: Record<EquipmentStatus, string> = {
  available: 'Disponible',
  reserved: 'Reservado',
  loaned: 'Prestado',
  maintenance: 'En mantenimiento',
  damaged: 'Dañado',
  out_of_service: 'Fuera de servicio',
  lost: 'Perdido',
};

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Administrador',
  lab_manager: 'Encargado de laboratorio',
  teacher: 'Maestro',
  student: 'Alumno',
  renter: 'Particular (renta)',
};

export const RENTER_STATUS_LABELS: Record<RenterStatus, string> = {
  pending: 'Pendiente de aprobación',
  approved: 'Aprobado',
  rejected: 'Rechazado',
};

/** Marcadores en préstamos de renta (sin profesor académico). */
export const RENTAL_TEACHER_ID = 'lab-rental';
export const RENTAL_TEACHER_NAME = 'Laboratorio (renta)';
