import type { Equipment } from './equipment';

export type CategoryGroup = {
  id: string;
  name: string;
  availableCount: number;
  totalItems: number;
  mark: string;
  hint: string;
};

export const CATEGORY_META: Record<string, { mark: string; hint: string; order: number }> = {
  'cat-medicion': { mark: 'ME', hint: 'Cintas métricas, estadales y odómetros', order: 1 },
  'cat-niveles': { mark: 'NV', hint: 'Niveles ópticos y digitales', order: 2 },
  'cat-angulos': { mark: 'AE', hint: 'Estaciones totales y teodolitos', order: 3 },
  'cat-gnss': { mark: 'GN', hint: 'Receptores base/móvil y GPS', order: 4 },
  'cat-soporte': { mark: 'SA', hint: 'Trípodes, bastones y prismas', order: 5 },
  'cat-gabinete': { mark: 'DG', hint: 'Planímetros y estereoscopios', order: 6 },
  'cat-energia': { mark: 'RA', hint: 'Radios módem y baterías GNSS', order: 7 },
  'cat-computo': { mark: 'CP', hint: 'Computadoras, plotter y audiovisual', order: 8 },
  'cat-mobiliario': { mark: 'MO', hint: 'Mesas, escritorios y mobiliario', order: 9 },
  'cat-topografia': { mark: 'TO', hint: 'Equipos de topografía', order: 10 },
  'cat-accesorios': { mark: 'AC', hint: 'Accesorios diversos', order: 11 },
};

export function categoryIdOf(item: Equipment): string {
  if (item.categoryId) return item.categoryId;
  const name = item.categoryName.toLowerCase();
  if (name.includes('energ') || name.includes('radio') || name.includes('alimentac')) return 'cat-energia';
  if (name.includes('cómputo') || name.includes('computo') || name.includes('audio')) return 'cat-computo';
  if (name.includes('mobiliario') || name.includes('auxiliar')) return 'cat-mobiliario';
  if (name.includes('gnss') || name.includes('gps')) return 'cat-gnss';
  if (name.includes('ángulo') || name.includes('angulo') || name.includes('estaci')) return 'cat-angulos';
  if (name.includes('nivel')) return 'cat-niveles';
  if (name.includes('medici')) return 'cat-medicion';
  if (name.includes('soporte')) return 'cat-soporte';
  if (name.includes('gabinete') || name.includes('dibujo')) return 'cat-gabinete';
  return `cat-${name.replace(/\s+/g, '-')}`;
}

export function metaFor(categoryId: string, categoryName: string) {
  return (
    CATEGORY_META[categoryId] ?? {
      mark: categoryName.slice(0, 2).toUpperCase(),
      hint: 'Material del laboratorio',
      order: 99,
    }
  );
}

export function buildCategoryGroups(items: Equipment[]): CategoryGroup[] {
  const map = new Map<string, CategoryGroup>();
  for (const item of items) {
    const id = categoryIdOf(item);
    const meta = metaFor(id, item.categoryName);
    const current = map.get(id);
    if (current) {
      current.totalItems += 1;
      current.availableCount += item.qtyAvailable;
    } else {
      map.set(id, {
        id,
        name: item.categoryName,
        availableCount: item.qtyAvailable,
        totalItems: 1,
        mark: meta.mark,
        hint: meta.hint,
      });
    }
  }
  return Array.from(map.values()).sort((a, b) => {
    const oa = metaFor(a.id, a.name).order;
    const ob = metaFor(b.id, b.name).order;
    return oa - ob || a.name.localeCompare(b.name, 'es');
  });
}
