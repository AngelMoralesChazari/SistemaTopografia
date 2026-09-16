import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  where,
  type Unsubscribe,
} from 'firebase/firestore';
import type { AppUser, RenterStatus, UserRole } from '@lab-topo/domain';
import { getLabId } from '@lab-topo/config';
import { getDb } from './firebase';
import { writeAuditLog } from './auditService';

function mapUser(id: string, data: Record<string, unknown>, labId: string): AppUser {
  return {
    uid: id,
    email: String(data.email ?? ''),
    displayName: String(data.displayName ?? 'Usuario'),
    role: (data.role as UserRole) ?? 'student',
    studentId: (data.studentId as string | null) ?? null,
    employeeId: (data.employeeId as string | null) ?? null,
    teacherId: (data.teacherId as string | null) ?? null,
    teacherName: (data.teacherName as string | null) ?? null,
    groupIds: (data.groupIds as string[]) ?? [],
    active: data.active !== false,
    labId: String(data.labId ?? labId),
    renterStatus: (data.renterStatus as RenterStatus | null) ?? null,
    phone: (data.phone as string | null) ?? null,
    company: (data.company as string | null) ?? null,
    ine: (data.ine as string | null) ?? null,
    rfc: (data.rfc as string | null) ?? null,
    address: (data.address as string | null) ?? null,
  };
}

export async function listTeachers(labId = getLabId()): Promise<AppUser[]> {
  const q = query(
    collection(getDb(), 'users'),
    where('labId', '==', labId),
    where('role', '==', 'teacher'),
    where('active', '==', true)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => mapUser(d.id, d.data(), labId));
}

/** Todos los usuarios del laboratorio (admin). */
export function watchLabUsers(
  onChange: (users: AppUser[]) => void,
  onError?: (error: Error) => void,
  labId = getLabId()
): Unsubscribe {
  const q = query(collection(getDb(), 'users'), where('labId', '==', labId));
  return onSnapshot(
    q,
    (snap) => {
      const users = snap.docs
        .map((d) => mapUser(d.id, d.data(), labId))
        .sort((a, b) => a.displayName.localeCompare(b.displayName, 'es'));
      onChange(users);
    },
    (error) => onError?.(error)
  );
}

export type CreateTeacherInput = {
  firstName: string;
  lastName: string;
  email?: string | null;
  phone?: string | null;
  groupIds: string[];
  employeeId?: string | null;
  labId?: string;
};

/** Crea un nuevo maestro en Firestore y registra el evento en auditoría */
export async function createTeacher(
  input: CreateTeacherInput,
  actor?: { uid: string; email?: string | null; displayName?: string | null; role?: UserRole }
): Promise<string> {
  const labId = input.labId || getLabId();
  const displayName = `${input.firstName.trim()} ${input.lastName.trim()}`.trim();
  const db = getDb();
  const userRef = doc(collection(db, 'users'));
  const uid = userRef.id;

  const data = {
    uid,
    displayName,
    email: input.email?.trim().toLowerCase() || '',
    phone: input.phone?.trim() || null,
    role: 'teacher' as UserRole,
    groupIds: input.groupIds ?? [],
    employeeId: input.employeeId?.trim() || null,
    studentId: null,
    teacherId: null,
    teacherName: null,
    active: true,
    labId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  await setDoc(userRef, data);

  if (actor) {
    try {
      await writeAuditLog({
        labId,
        actorId: actor.uid,
        actorEmail: actor.email ?? '',
        actorName: actor.displayName ?? 'Administrador',
        actorRole: actor.role ?? 'admin',
        action: 'USER_CREATE',
        targetType: 'user',
        targetId: uid,
        summary: `Alta de maestro: ${displayName} (${(input.groupIds ?? []).length} grupos asignados: ${(input.groupIds ?? []).join(', ') || 'ninguno'})`,
      });
    } catch {
      // Ignorar fallo de auditoría secundaria
    }
  }

  return uid;
}
