import { collection, getDocs, query, where } from 'firebase/firestore';
import type { AppUser } from '@lab-topo/domain';
import { getLabId } from '@lab-topo/config';
import { getDb } from './firebase';

export async function listTeachers(labId = getLabId()): Promise<AppUser[]> {
  const q = query(
    collection(getDb(), 'users'),
    where('labId', '==', labId),
    where('role', '==', 'teacher'),
    where('active', '==', true)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => {
    const data = d.data();
    return {
      uid: d.id,
      email: String(data.email ?? ''),
      displayName: String(data.displayName ?? 'Maestro'),
      role: 'teacher' as const,
      studentId: null,
      employeeId: (data.employeeId as string | null) ?? null,
      groupIds: (data.groupIds as string[]) ?? [],
      active: data.active !== false,
      labId: String(data.labId ?? labId),
    };
  });
}
