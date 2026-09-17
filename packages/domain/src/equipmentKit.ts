export const TOTAL_STATION_KIT_ITEMS = [
  'Estuche de Alto Impacto',
  'Batería',
  'Flexómetro',
  'Tapa de Sombra',
  'Brújula Tubular',
  'Cargador Rápido de Baterías',
  'Cable Serial. (Estación/PC)',
  'Tripié de',
  'Prisma Unitario',
  'Bastón de ___ m, ___ m.',
  'Bípode',
  'Brújula',
] as const;

export type LoanExtraItem = {
  equipmentId: string;
  name: string;
  internalCode: string;
  quantity: number;
};

/**
 * Determina si un equipo dado corresponde a una Estación Total
 * comprobando su nombre o código interno.
 */
export function isTotalStation(equipment?: {
  name?: string | null;
  internalCode?: string | null;
} | null): boolean {
  if (!equipment) return false;
  const name = (equipment.name ?? '').toLowerCase();
  const code = (equipment.internalCode ?? '').toUpperCase();
  return (
    name.includes('estación total') ||
    name.includes('estacion total') ||
    code.startsWith('ANG-ET') ||
    code.includes('-ET-')
  );
}
