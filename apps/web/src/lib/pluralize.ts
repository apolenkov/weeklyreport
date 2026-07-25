// English-only: callers pass both literal forms; this helper owns no vocabulary.
/**
 * Pluralize.
 * @param value - The value argument.
 * @param singular - The singular argument.
 * @param plural - The plural argument.
 */
export function pluralize(
  value: number,
  singular: string,
  plural: string,
): string {
  return value === 1 ? singular : plural;
}
