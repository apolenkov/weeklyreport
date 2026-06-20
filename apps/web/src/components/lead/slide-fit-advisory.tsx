import { SLIDE_SECTION_SOFT_CAP } from "@customreport/shared";

/**
 * add-slide-capacity-signals: a quiet, non-blocking advisory shown when a
 * single product's record count in a report section exceeds
 * `SLIDE_SECTION_SOFT_CAP`. Advisory only — it NEVER blocks adding records and
 * NEVER disables a control. Self-gates: renders nothing at or under the cap.
 *
 * Wording note: the slide overflow direction is scroll-only (decided
 * 2026-06-21), so a dense section is still reachable by scroll but reads as
 * cramped — "may not fit cleanly" frames that visual-density cost, not data
 * loss. Keep this copy in one place so the wording is easy to revisit.
 */
export function SlideFitAdvisory({ count }: { readonly count: number }) {
  if (count <= SLIDE_SECTION_SOFT_CAP) return null;
  return (
    <p
      role="note"
      data-testid="slide-fit-advisory"
      className="mt-1 text-[11px] font-medium text-[var(--color-status-at-risk-fg)]"
    >
      {count} records may not fit cleanly on the slide
    </p>
  );
}

/**
 * For FLAT (ungrouped) sections — risks and decisions render one card per row
 * with no per-product column — find the FIRST row id of each over-cap product
 * group so the advisory renders exactly once per group, plus the per-group
 * counts. Rows whose group key is `undefined` are skipped (e.g. an unscoped
 * decision). Pure: safe to call inside `useMemo`.
 */
export function firstOverCapRowIds<T extends { id: string }>(
  rows: readonly T[],
  keyOf: (row: T) => string | undefined,
): { firstIds: Set<string>; countByKey: Map<string, number> } {
  const countByKey = new Map<string, number>();
  for (const row of rows) {
    const key = keyOf(row);
    if (key === undefined) continue;
    countByKey.set(key, (countByKey.get(key) ?? 0) + 1);
  }
  const firstIds = new Set<string>();
  const seen = new Set<string>();
  for (const row of rows) {
    const key = keyOf(row);
    if (key === undefined || seen.has(key)) continue;
    seen.add(key);
    if ((countByKey.get(key) ?? 0) > SLIDE_SECTION_SOFT_CAP) {
      firstIds.add(row.id);
    }
  }
  return { firstIds, countByKey };
}
