/**
 * Pick the singular or plural noun form for a count.
 *
 * Shared by multiple components (reminders tab, product accordion) so each
 * does not guard `value === 1` inline. English-only: callers pass the two
 * literal forms; this helper does not own any vocabulary.
 */
export function pluralize(
  value: number,
  singular: string,
  plural: string,
): string {
  return value === 1 ? singular : plural;
}
