import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  where,
  type Unsubscribe,
} from 'firebase/firestore';
import {
  TOPOGRAPHY_GROUPS,
  type AcademicGroup,
} from '@lab-topo/domain';
import { getLabId } from '@lab-topo/config';
import { getDb } from './firebase';

function mapGroup(id: string, data: Record<string, unknown>, labId: string): AcademicGroup {
  return {
    id,
    code: String(data.code ?? id),
    name: String(data.name ?? `Grupo ${id}`),
    career: String(data.career ?? 'Topografía'),
    labId: String(data.labId ?? labId),
  };
}

/** Obtiene la lista de grupos académicos registrados para el laboratorio */
export async function listGroups(labId = getLabId()): Promise<AcademicGroup[]> {
  const q = query(
    collection(getDb(), 'groups'),
    where('labId', '==', labId),
    orderBy('code', 'asc')
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => mapGroup(d.id, d.data(), labId));
}

/**
 * Asegura que los 16 grupos de Topografía (101 a 802) existan en Firestore.
 * Si no existen o faltan algunos, los siembra automáticamente en la BD.
 */
export async function ensureDefaultGroups(labId = getLabId()): Promise<AcademicGroup[]> {
  try {
    const existing = await listGroups(labId);
    const existingCodes = new Set(existing.map((g) => g.code));

    const missing = TOPOGRAPHY_GROUPS.filter((code) => !existingCodes.has(code));
    if (missing.length > 0) {
      const db = getDb();
      await Promise.all(
        missing.map((code) =>
          setDoc(doc(db, 'groups', code), {
            id: code,
            code,
            name: `Grupo ${code}`,
            career: 'Topografía',
            labId,
            createdAt: serverTimestamp(),
          })
        )
      );
      return listGroups(labId);
    }

    return existing;
  } catch {
    return listGroups(labId).catch(() => []);
  }
}

/** Escucha en tiempo real los grupos académicos del laboratorio */
export function watchGroups(
  onChange: (groups: AcademicGroup[]) => void,
  onError?: (error: Error) => void,
  labId = getLabId()
): Unsubscribe {
  const q = query(
    collection(getDb(), 'groups'),
    where('labId', '==', labId),
    orderBy('code', 'asc')
  );
  return onSnapshot(
    q,
    (snap) => {
      const groups = snap.docs.map((d) => mapGroup(d.id, d.data(), labId));
      onChange(groups);
    },
    (err) => onError?.(err)
  );
}
