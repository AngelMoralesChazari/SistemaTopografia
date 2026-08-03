export const DEFAULT_PAGE_SIZE = 10;

export function buildPageWindow(current: number, total: number): number[] {
  if (total <= 1) return total === 1 ? [1] : [];
  if (total <= 10) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }
  const half = 4;
  let start = Math.max(1, current - half);
  let end = Math.min(total, start + 9);
  start = Math.max(1, end - 9);
  return Array.from({ length: end - start + 1 }, (_, i) => start + i);
}

export function paginate<T>(items: T[], page: number, pageSize = DEFAULT_PAGE_SIZE) {
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize) || 1);
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * pageSize;
  return {
    page: safePage,
    totalPages,
    pageItems: items.slice(start, start + pageSize),
    total,
    from: total === 0 ? 0 : start + 1,
    to: Math.min(start + pageSize, total),
    pageNumbers: buildPageWindow(safePage, totalPages),
  };
}
