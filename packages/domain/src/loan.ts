import type { LoanStatus, LoanType, ReturnCondition } from './types';
import { LOAN_STATUS_LABELS } from './types';

export type Loan = {
  id: string;
  folio: string;
  labId: string;
  loanType: LoanType;
  status: LoanStatus;
  equipmentId: string;
  equipmentName: string;
  equipmentCode: string;
  studentId: string;
  studentName: string;
  studentNumber: string | null;
  teacherId: string;
  teacherName: string;
  groupId: string | null;
  requestedAt: string | null;
  approvedAt: string | null;
  rejectedAt: string | null;
  rejectionReason: string | null;
  dueAt: string | null;
  deliveredAt: string | null;
  returnedAt: string | null;
  paymentRequired: boolean;
  paymentConfirmed: boolean;
  isOverdue: boolean;
  returnCondition: ReturnCondition | null;
  deliveryNotes: string | null;
  damageNotes: string | null;
  notes: string | null;
  kitItems?: string[] | null;
  extraItems?: import('./equipmentKit').LoanExtraItem[] | null;
  approvedBy: string | null;
  deliveredBy: string | null;
  returnedBy: string | null;
};

export type CreateLoanInput = {
  labId: string;
  equipmentId: string;
  equipmentName: string;
  equipmentCode: string;
  studentId: string;
  studentName: string;
  studentNumber?: string | null;
  teacherId: string;
  teacherName: string;
  /** Fecha límite propuesta (ISO). Por defecto 24 h desde la solicitud. */
  dueAt: string;
  loanType?: LoanType;
  notes?: string | null;
  kitItems?: string[] | null;
  extraItems?: import('./equipmentKit').LoanExtraItem[] | null;
};

export function loanStatusLabel(status: LoanStatus): string {
  return LOAN_STATUS_LABELS[status];
}

export function generateLoanFolio(now = new Date()): string {
  const year = now.getFullYear();
  const tail = String(now.getTime()).slice(-6);
  return `SOL-${year}-${tail}`;
}
