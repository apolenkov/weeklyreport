interface SearchParamsReader {
  readonly getAll: (name: string) => string[];
}

export function getScalarSearchParam(
  searchParams: SearchParamsReader,
  name: string,
): string | null {
  const values = searchParams.getAll(name);
  return values.length === 1 ? (values[0] ?? null) : null;
}

export function copyScalarSearchParams(
  searchParams: Pick<URLSearchParams, "toString">,
  scalarKeys: readonly string[],
): URLSearchParams {
  const next = new URLSearchParams(searchParams.toString());
  for (const key of scalarKeys) {
    if (next.getAll(key).length > 1) next.delete(key);
  }
  return next;
}
