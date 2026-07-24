/**
 * Stable JSON serialization with sorted keys so payload diffs are deterministic
 * regardless of object construction order. Exported so callers can compute
 * the same baseline key when priming `initialSavedKey`.
 */
export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (value instanceof Date) return JSON.stringify(value.toISOString());
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }
  const obj = value as Record<string, unknown>;
  // eslint-disable-next-line sonarjs/no-alphabetical-sort -- stable serialization for dirty-state comparison; localeCompare would break payload hashing
  const keys = Object.keys(obj).sort();
  return `{${keys
    .map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`)
    .join(",")}}`;
}
