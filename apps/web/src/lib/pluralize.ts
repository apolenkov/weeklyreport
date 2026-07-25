// English-only: callers pass both literal forms; this helper owns no vocabulary.
export function pluralize(
  value: number,
  singular: string,
  plural: string,
): string {
  return value === 1 ? singular : plural;
}
