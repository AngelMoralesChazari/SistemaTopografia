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
  folio?: string;
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

export type RequestBatch = {
  id: string;
  folio: string;
  studentId: string;
  studentName: string;
  studentNumber: string | null;
  teacherId: string;
  teacherName: string;
  requestedAt: string | null;
  dueAt: string | null;
  status: LoanStatus;
  loans: Loan[];
};

export const BATCH_TIME_GAP_MS = 60 * 1000; // 60 segundos entre solicitudes consecutivas
export const BATCH_MAX_SPAN_MS = 8 * 60 * 1000; // 8 minutos máximo por lote

/**
 * Agrupa préstamos de un mismo alumno solicitados en el mismo momento/sesión o bajo el mismo folio
 * evitando mostrar nombres duplicados y consolidando la solicitud global.
 */
export function buildRequestBatches(
  loans: Loan[],
  options?: { gapMs?: number; maxSpanMs?: number }
): RequestBatch[] {
  const gapMs = options?.gapMs ?? BATCH_TIME_GAP_MS;
  const maxSpanMs = options?.maxSpanMs ?? BATCH_MAX_SPAN_MS;

  const sorted = [...loans].sort((a, b) => {
    const ta = a.requestedAt ? new Date(a.requestedAt).getTime() : 0;
    const tb = b.requestedAt ? new Date(b.requestedAt).getTime() : 0;
    return tb - ta;
  });

  const batches: RequestBatch[] = [];

  for (const loan of sorted) {
    const loanTime = loan.requestedAt ? new Date(loan.requestedAt).getTime() : 0;

    const match = batches.find((batch) => {
      // 1. Si comparten exactamente el mismo folio de solicitud y estado, pertenecen al mismo lote
      if (
        Boolean(batch.folio) &&
        Boolean(loan.folio) &&
        batch.folio === loan.folio &&
        batch.status === loan.status
      ) {
        return true;
      }

      // 2. Si son del mismo alumno y estado en el rango de tiempo de sesión (retrocompatibilidad)
      const sameStudent =
        (Boolean(batch.studentId) && Boolean(loan.studentId) && batch.studentId === loan.studentId) ||
        (Boolean(loan.studentName) &&
          Boolean(batch.studentName) &&
          batch.studentName.trim().toLowerCase() === loan.studentName.trim().toLowerCase());
      if (!sameStudent) return false;
      if (batch.status !== loan.status) return false;

      const times = batch.loans
        .map((l) => (l.requestedAt ? new Date(l.requestedAt).getTime() : 0))
        .filter((t) => t > 0);

      if (times.length === 0 || loanTime === 0) {
        return times.length === 0 && loanTime === 0;
      }

      const minTime = Math.min(...times);
      const maxTime = Math.max(...times);
      if (Math.abs(loanTime - minTime) > maxSpanMs || Math.abs(loanTime - maxTime) > maxSpanMs) {
        return false;
      }

      return times.some((t) => Math.abs(t - loanTime) <= gapMs);
    });

    if (match) {
      match.loans.push(loan);
      const matchTime = match.requestedAt ? new Date(match.requestedAt).getTime() : 0;
      if (loanTime > matchTime) {
        match.requestedAt = loan.requestedAt;
      }
    } else {
      batches.push({
        id: loan.folio ? `batch-${loan.folio}-${loan.status}` : loan.id,
        folio: loan.folio,
        studentId: loan.studentId,
        studentName: loan.studentName,
        studentNumber: loan.studentNumber,
        teacherId: loan.teacherId,
        teacherName: loan.teacherName,
        requestedAt: loan.requestedAt,
        dueAt: loan.dueAt,
        status: loan.status,
        loans: [loan],
      });
    }
  }

  for (const batch of batches) {
    batch.loans.sort((a, b) => {
      const ta = a.requestedAt ? new Date(a.requestedAt).getTime() : 0;
      const tb = b.requestedAt ? new Date(b.requestedAt).getTime() : 0;
      if (ta !== tb) return ta - tb;
      return a.folio.localeCompare(b.folio);
    });
  }

  return batches;
}

