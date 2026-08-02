import type { EquipmentStatus } from './types';

export type TrackMode = 'unit' | 'bulk';

export type Equipment = {
  id: string;
  internalCode: string;
  name: string;
  model: string | null;
  brand: string | null;
  serialNumber: string | null;
  categoryId: string;
  categoryName: string;
  status: EquipmentStatus;
  trackMode: TrackMode;
  qtyTotal: number;
  qtyAvailable: number;
  qtyReserved: number;
  qtyLoaned: number;
  acquisitionDate: string | null;
  photoUrl: string | null;
  manualUrl: string | null;
  notes: string | null;
  labId: string;
  active: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
};

export type EquipmentInput = {
  internalCode: string;
  name: string;
  model?: string | null;
  brand?: string | null;
  serialNumber?: string | null;
  categoryId: string;
  categoryName: string;
  status: EquipmentStatus;
  trackMode?: TrackMode;
  qtyTotal: number;
  qtyAvailable: number;
  notes?: string | null;
  labId: string;
  active?: boolean;
};

export function isEquipmentBorrowable(equipment: Equipment): boolean {
  return (
    equipment.active &&
    equipment.status === 'available' &&
    equipment.qtyAvailable > 0
  );
}

export function equipmentAvailabilityLabel(equipment: Equipment): string {
  if (!equipment.active) return 'Baja';
  if (equipment.status === 'available') {
    return `${equipment.qtyAvailable} disp.`;
  }
  return EQUIPMENT_SHORT_STATUS[equipment.status];
}

const EQUIPMENT_SHORT_STATUS: Record<EquipmentStatus, string> = {
  available: 'Disponible',
  reserved: 'Reservado',
  loaned: 'Prestado',
  maintenance: 'Mantenimiento',
  damaged: 'Dañado',
  out_of_service: 'Fuera de servicio',
  lost: 'Perdido',
};
