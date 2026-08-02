import type { Equipment } from '@lab-topo/domain';

export type CategoryGroup = {
  id: string;
  name: string;
  availableCount: number;
  totalItems: number;
  mark: string;
  hint: string;
};

export const CATEGORY_META: Record<string, { mark: string; hint: string; order: number }> = {
  'cat-medicion': { mark: 'ME', hint: 'Cintas, estadales y ruedas', order: 1 },
  'cat-niveles': { mark: 'NV', hint: 'Niveles ópticos y digitales', order: 2 },
  'cat-angulos': { mark: 'AE', hint: 'Teodolitos y estaciones', order: 3 },
  'cat-gnss': { mark: 'GN', hint: 'Receptores GPS / GNSS', order: 4 },
  'cat-soporte': { mark: 'SA', hint: 'Trípodes, jalones y prismas', order: 5 },
  'cat-gabinete': { mark: 'DG', hint: 'Escuadras y planímetros', order: 6 },
  'cat-topografia': { mark: 'TO', hint: 'Equipos de topografía', order: 7 },
  'cat-accesorios': { mark: 'AC', hint: 'Accesorios diversos', order: 8 },
};

export function categoryIdOf(item: Equipment): string {
  return item.categoryId || `cat-${item.categoryName.toLowerCase().replace(/\s+/g, '-')}`;
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
