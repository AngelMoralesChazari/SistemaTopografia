import {
  addDoc,
  collection,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
  type Unsubscribe,
} from 'firebase/firestore';
import type { Equipment, EquipmentInput, EquipmentStatus } from '@lab-topo/domain';
import { getLabId } from '@lab-topo/config';
import { getDb } from './firebase';

function mapEquipment(id: string, data: Record<string, unknown>): Equipment {
  return {
    id,
    internalCode: String(data.internalCode ?? ''),
    name: String(data.name ?? ''),
    model: (data.model as string | null) ?? null,
    brand: (data.brand as string | null) ?? null,
    serialNumber: (data.serialNumber as string | null) ?? null,
    categoryId: String(data.categoryId ?? ''),
    categoryName: String(data.categoryName ?? 'General'),
    status: (data.status as EquipmentStatus) ?? 'available',
    trackMode: data.trackMode === 'bulk' ? 'bulk' : 'unit',
    qtyTotal: Number(data.qtyTotal ?? 0),
    qtyAvailable: Number(data.qtyAvailable ?? 0),
    qtyReserved: Number(data.qtyReserved ?? 0),
    qtyLoaned: Number(data.qtyLoaned ?? 0),
    acquisitionDate: (data.acquisitionDate as string | null) ?? null,
    photoUrl: (data.photoUrl as string | null) ?? null,
    manualUrl: (data.manualUrl as string | null) ?? null,
    notes: (data.notes as string | null) ?? null,
    labId: String(data.labId ?? getLabId()),
    active: data.active !== false,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  };
}

export async function listEquipment(options?: {
  labId?: string;
  onlyActive?: boolean;
}): Promise<Equipment[]> {
  const labId = options?.labId ?? getLabId();
  const q = query(
    collection(getDb(), 'equipment'),
    where('labId', '==', labId),
    orderBy('name', 'asc')
  );
  const snap = await getDocs(q);
  let items = snap.docs.map((d) => mapEquipment(d.id, d.data()));
  if (options?.onlyActive) {
    items = items.filter((item) => item.active);
  }
  return items;
}

export function watchEquipment(
  onChange: (items: Equipment[]) => void,
  onError?: (error: Error) => void,
  options?: { labId?: string; onlyActive?: boolean }
): Unsubscribe {
  const labId = options?.labId ?? getLabId();
  const q = query(
    collection(getDb(), 'equipment'),
    where('labId', '==', labId),
    orderBy('name', 'asc')
  );

  return onSnapshot(
    q,
    (snap) => {
      let items = snap.docs.map((d) => mapEquipment(d.id, d.data()));
      if (options?.onlyActive) {
        items = items.filter((item) => item.active);
      }
      onChange(items);
    },
    (error) => onError?.(error)
  );
}

export async function createEquipment(input: EquipmentInput): Promise<string> {
  const qtyTotal = Math.max(0, input.qtyTotal);
  const qtyAvailable = Math.min(Math.max(0, input.qtyAvailable), qtyTotal);

  const ref = await addDoc(collection(getDb(), 'equipment'), {
    internalCode: input.internalCode.trim(),
    name: input.name.trim(),
    model: input.model?.trim() || null,
    brand: input.brand?.trim() || null,
    serialNumber: input.serialNumber?.trim() || null,
    categoryId: input.categoryId,
    categoryName: input.categoryName,
    status: input.status,
    trackMode: input.trackMode ?? 'unit',
    qtyTotal,
    qtyAvailable,
    qtyReserved: 0,
    qtyLoaned: 0,
    acquisitionDate: null,
    photoUrl: null,
    manualUrl: null,
    notes: input.notes?.trim() || null,
    labId: input.labId || getLabId(),
    active: input.active ?? true,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return ref.id;
}

export async function updateEquipment(
  id: string,
  patch: Partial<
    Pick<
      Equipment,
      | 'name'
      | 'model'
      | 'brand'
      | 'serialNumber'
      | 'status'
      | 'qtyTotal'
      | 'qtyAvailable'
      | 'notes'
      | 'active'
      | 'categoryName'
      | 'categoryId'
      | 'internalCode'
    >
  >
): Promise<void> {
  await updateDoc(doc(getDb(), 'equipment', id), {
    ...patch,
    updatedAt: serverTimestamp(),
  });
}

export async function setEquipmentStatus(id: string, status: EquipmentStatus): Promise<void> {
  const patch: Record<string, unknown> = {
    status,
    updatedAt: serverTimestamp(),
  };

  if (status === 'available') {
    // No forzamos qty aquí; el encargado puede ajustar en edición.
  } else if (status === 'loaned' || status === 'reserved') {
    // Dejado para el módulo de préstamos.
  }

  await updateDoc(doc(getDb(), 'equipment', id), patch);
}
