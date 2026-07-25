// Ranked rows float ascending; unranked keep source order last.
// Array.prototype.sort is stable (ES2019+), so equal/unranked rows never reshuffle.
export function sortByPriorityRank<T extends { priorityRank?: number | null }>(
  items: readonly T[],
): T[] {
  return [...items].sort(
    (a, b) =>
      (a.priorityRank ?? Number.MAX_SAFE_INTEGER) -
      (b.priorityRank ?? Number.MAX_SAFE_INTEGER),
  );
}
