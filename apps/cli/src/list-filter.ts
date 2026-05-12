/** Case-insensitive substring filter; empty query returns a shallow copy of `items`. */
export function filterBySubstring<T>(
  items: readonly T[],
  query: string,
  getSearchText: (item: T) => string,
): T[] {
  const q = query.trim().toLowerCase();
  if (!q) return [...items];
  return items.filter((item) => getSearchText(item).toLowerCase().includes(q));
}
