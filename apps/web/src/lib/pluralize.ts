/**
 * Pick the singular or plural noun form for a count.
 *
 * Lifted from `components/admin/reminders-tab-format.ts` so multiple
 * components (reminders tab, product accordion) share one rule instead of
 * each guarding `value === 1` inline. English-only: callers pass the two
 * literal forms; this helper does not own any vocabulary.
 */
export function pluralize(
  value: number,
  singular: string,
  plural: string,
): string {
  return value === 1 ? singular : plural;
}
