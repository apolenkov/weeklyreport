export function responsiveBoardGridClassName(columnCount: number): string {
  if (columnCount <= 1) return "grid gap-4 grid-cols-1";
  if (columnCount === 2) return "grid gap-4 grid-cols-1 md:grid-cols-2";
  return "grid gap-4 grid-cols-1 md:grid-cols-2 xl:grid-cols-3";
}
