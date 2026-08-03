import {
  collection,
  getDocs,
  onSnapshot,
  query,
  where,
  type Unsubscribe,
} from 'firebase/firestore';
import type { AppUser, RenterStatus, UserRole } from '@lab-topo/domain';
import { getLabId } from '@lab-topo/config';
import { getDb } from './firebase';

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
