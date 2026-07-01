/**
 * Stable priority-rank ordering shared by the head accordion and the slide
 * decks: ranked rows float to the top in ascending rank (1, 2, …), unranked
 * rows keep their source order and follow last. `Array.prototype.sort` is
 * stable (ES2019+), so equal / unranked rows never reshuffle.
 */
export function sortByPriorityRank<T extends { priorityRank?: number | null }>(
  items: readonly T[],
): T[] {
  return [...items].sort(
    (a, b) =>
      (a.priorityRank ?? Number.MAX_SAFE_INTEGER) -
      (b.priorityRank ?? Number.MAX_SAFE_INTEGER),
  );
}
