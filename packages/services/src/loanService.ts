import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  updateDoc,
  where,
  type Unsubscribe,
} from 'firebase/firestore';
import {
  canTransitionLoan,
  generateLoanFolio,
  type CreateLoanInput,
  type Loan,
  type LoanStatus,
} from '@lab-topo/domain';
import { getLabId } from '@lab-topo/config';
import { getDb } from './firebase';

function toIso(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === 'string') return value;
  if (typeof value === 'object' && value !== null && 'toDate' in value) {
    const date = (value as { toDate: () => Date }).toDate();
    return date.toISOString();
  }
  return null;
}

function mapLoan(id: string, data: Record<string, unknown>): Loan {
  return {
    id,
    folio: String(data.folio ?? ''),
    labId: String(data.labId ?? getLabId()),
    loanType: data.loanType === 'rental' ? 'rental' : 'academic',
    status: (data.status as LoanStatus) ?? 'pending',
    equipmentId: String(data.equipmentId ?? ''),
    equipmentName: String(data.equipmentName ?? ''),
    equipmentCode: String(data.equipmentCode ?? ''),
    studentId: String(data.studentId ?? ''),
    studentName: String(data.studentName ?? ''),
    studentNumber: (data.studentNumber as string | null) ?? null,
    teacherId: String(data.teacherId ?? ''),
    teacherName: String(data.teacherName ?? ''),
    groupId: (data.groupId as string | null) ?? null,
    requestedAt: toIso(data.requestedAt),
    approvedAt: toIso(data.approvedAt),
    rejectedAt: toIso(data.rejectedAt),
    rejectionReason: (data.rejectionReason as string | null) ?? null,
    dueAt: toIso(data.dueAt),
    deliveredAt: toIso(data.deliveredAt),
    returnedAt: toIso(data.returnedAt),
    paymentRequired: Boolean(data.paymentRequired),
    paymentConfirmed: Boolean(data.paymentConfirmed),
    isOverdue: Boolean(data.isOverdue),
    returnCondition: (data.returnCondition as Loan['returnCondition']) ?? null,
    damageNotes: (data.damageNotes as string | null) ?? null,
    notes: (data.notes as string | null) ?? null,
    approvedBy: (data.approvedBy as string | null) ?? null,
    deliveredBy: (data.deliveredBy as string | null) ?? null,
    returnedBy: (data.returnedBy as string | null) ?? null,
  };
}

export async function createLoanRequest(input: CreateLoanInput): Promise<string> {
  const db = getDb();
  const equipmentRef = doc(db, 'equipment', input.equipmentId);
  const loanRef = doc(collection(db, 'loans'));

  await runTransaction(db, async (tx) => {
    const equipmentSnap = await tx.get(equipmentRef);
    if (!equipmentSnap.exists()) {
      throw new Error('El equipo no existe.');
    }
    const equipment = equipmentSnap.data();
    const qtyAvailable = Number(equipment.qtyAvailable ?? 0);
    if (!equipment.active || qtyAvailable <= 0 || equipment.status !== 'available') {
      throw new Error('El equipo no está disponible para préstamo.');
    }

    tx.set(loanRef, {
      folio: generateLoanFolio(),
      labId: input.labId || getLabId(),
      loanType: input.loanType ?? 'academic',
      status: 'pending',
      equipmentId: input.equipmentId,
      equipmentName: input.equipmentName,
      equipmentCode: input.equipmentCode,
      studentId: input.studentId,
      studentName: input.studentName,
      studentNumber: input.studentNumber ?? null,
      teacherId: input.teacherId,
      teacherName: input.teacherName,
      groupId: null,
      requestedAt: serverTimestamp(),
      approvedAt: null,
      rejectedAt: null,
      rejectionReason: null,
      dueAt: null,
      deliveredAt: null,
      returnedAt: null,
      paymentRequired: (input.loanType ?? 'academic') === 'rental',
      paymentConfirmed: false,
      isOverdue: false,
      returnCondition: null,
      damageNotes: null,
      notes: input.notes ?? null,
      approvedBy: null,
      deliveredBy: null,
      returnedBy: null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  });

  return loanRef.id;
}

export function watchLoansForStudent(
  studentId: string,
  onChange: (loans: Loan[]) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  const q = query(
    collection(getDb(), 'loans'),
    where('studentId', '==', studentId),
    orderBy('requestedAt', 'desc')
  );
  return onSnapshot(
    q,
    (snap) => onChange(snap.docs.map((d) => mapLoan(d.id, d.data()))),
    (error) => onError?.(error)
  );
}

export function watchLabQueue(
  labId: string,
  onChange: (loans: Loan[]) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  const q = query(
    collection(getDb(), 'loans'),
    where('labId', '==', labId),
    where('status', 'in', ['pending', 'approved', 'delivered']),
    orderBy('requestedAt', 'desc')
  );
  return onSnapshot(
    q,
    (snap) => onChange(snap.docs.map((d) => mapLoan(d.id, d.data()))),
    (error) => onError?.(error)
  );
}

export function watchLoansForTeacher(
  teacherId: string,
  onChange: (loans: Loan[]) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  const q = query(
    collection(getDb(), 'loans'),
    where('teacherId', '==', teacherId),
    where('status', 'in', ['pending', 'approved', 'delivered']),
    orderBy('requestedAt', 'desc')
  );
  return onSnapshot(
    q,
    (snap) => onChange(snap.docs.map((d) => mapLoan(d.id, d.data()))),
    (error) => onError?.(error)
  );
}

export async function rejectLoan(
  loanId: string,
  actorId: string,
  reason: string
): Promise<void> {
  const ref = doc(getDb(), 'loans', loanId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error('Solicitud no encontrada.');
  const current = mapLoan(snap.id, snap.data());
  if (!canTransitionLoan(current.status, 'rejected')) {
    throw new Error('No se puede rechazar en este estado.');
  }
  await updateDoc(ref, {
    status: 'rejected',
    rejectedAt: serverTimestamp(),
    rejectionReason: reason.trim() || 'Sin motivo',
    updatedAt: serverTimestamp(),
    approvedBy: actorId,
  });
}

/** Atajo del bosquejo: pendiente → entregado (aprueba + entrega). */
export async function deliverLoan(
  loanId: string,
  actorId: string,
  dueAtIso: string
): Promise<void> {
  const db = getDb();
  const loanRef = doc(db, 'loans', loanId);

  await runTransaction(db, async (tx) => {
    const loanSnap = await tx.get(loanRef);
    if (!loanSnap.exists()) throw new Error('Solicitud no encontrada.');
    const loan = mapLoan(loanSnap.id, loanSnap.data());

    if (loan.status !== 'pending' && loan.status !== 'approved') {
      throw new Error('Solo se puede entregar una solicitud pendiente o aprobada.');
    }

    const equipmentRef = doc(db, 'equipment', loan.equipmentId);
    const equipmentSnap = await tx.get(equipmentRef);
    if (!equipmentSnap.exists()) throw new Error('Equipo no encontrado.');
    const equipment = equipmentSnap.data();
    const qtyAvailable = Number(equipment.qtyAvailable ?? 0);
    const qtyLoaned = Number(equipment.qtyLoaned ?? 0);

    if (qtyAvailable <= 0) {
      throw new Error('No hay existencia disponible para entregar.');
    }

    const dueDate = new Date(dueAtIso);
    if (Number.isNaN(dueDate.getTime())) {
      throw new Error('Fecha límite inválida. Usa formato AAAA-MM-DD.');
    }

    tx.update(loanRef, {
      status: 'delivered',
      approvedAt: loan.approvedAt ? loanSnap.data().approvedAt : serverTimestamp(),
      deliveredAt: serverTimestamp(),
      dueAt: dueDate,
      approvedBy: loan.approvedBy ?? actorId,
      deliveredBy: actorId,
      isOverdue: false,
      updatedAt: serverTimestamp(),
    });

    const nextAvailable = qtyAvailable - 1;
    tx.update(equipmentRef, {
      qtyAvailable: nextAvailable,
      qtyLoaned: qtyLoaned + 1,
      status: nextAvailable <= 0 ? 'loaned' : equipment.status,
      updatedAt: serverTimestamp(),
    });
  });
}

export async function returnLoan(
  loanId: string,
  actorId: string,
  options?: { late?: boolean; notes?: string }
): Promise<void> {
  const db = getDb();
  const loanRef = doc(db, 'loans', loanId);

  await runTransaction(db, async (tx) => {
    const loanSnap = await tx.get(loanRef);
    if (!loanSnap.exists()) throw new Error('Solicitud no encontrada.');
    const loan = mapLoan(loanSnap.id, loanSnap.data());
    if (loan.status !== 'delivered') {
      throw new Error('Solo se puede devolver material entregado.');
    }

    const nextStatus: LoanStatus = options?.late || loan.isOverdue ? 'returned_late' : 'returned';
    const equipmentRef = doc(db, 'equipment', loan.equipmentId);
    const equipmentSnap = await tx.get(equipmentRef);
    if (!equipmentSnap.exists()) throw new Error('Equipo no encontrado.');
    const equipment = equipmentSnap.data();
    const qtyAvailable = Number(equipment.qtyAvailable ?? 0);
    const qtyLoaned = Math.max(0, Number(equipment.qtyLoaned ?? 0) - 1);

    tx.update(loanRef, {
      status: nextStatus,
      returnedAt: serverTimestamp(),
      returnedBy: actorId,
      returnCondition: 'ok',
      notes: options?.notes ?? loan.notes,
      isOverdue: false,
      updatedAt: serverTimestamp(),
    });

    tx.update(equipmentRef, {
      qtyAvailable: qtyAvailable + 1,
      qtyLoaned,
      status: 'available',
      updatedAt: serverTimestamp(),
    });
  });
}
