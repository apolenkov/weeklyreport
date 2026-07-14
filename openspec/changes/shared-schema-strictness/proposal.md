## Why

BL-25 (P2, `docs/reviews/repo-excellence-review-2026-07-14.md`, "P2/P3 —
сжато"): the repo-excellence review found two latent contract-strictness gaps
in `packages/shared/src/schemas/`, the shared Zod boundary every write and every
public-facing beacon parses through. Both are validation gaps that accept
input a sibling/peer schema already rejects, and both are currently latent
(no known caller sends the invalid shape today) — this change tightens the
contract before something depends on the gap.

This is the **shared-schema half** of BL-25's two-way split. The other half
(P2002 substring matching, search `excludeTypes` contract gap — both
apps/api-side matching/contract logic, not Zod schema shape) is
`api-contract-matching-strictness`, filed separately. See that proposal's Why
for the split rationale.

## What Changes

- `packages/shared/src/schemas/period.schema.ts`: `reportPeriodSchema.publishedById`
  is `z.string().nullable().optional()`. Its sibling field on the same
  logical column — `reportSchema.publishedById` in
  `packages/shared/src/schemas/report.schema.ts:71` — is already
  `z.uuid().nullable().default(null)`. Tighten `reportPeriodSchema`'s copy to
  `z.uuid()` so both schemas reject the same malformed-id input on the
  snapshot-restore path (`admin-snapshot-restore`), instead of one accepting
  what the other rejects.
- `packages/shared/src/schemas/web-vitals.ts`: `webVitalBeaconSchema.value` is
  `z.number().nonnegative()` with no upper bound, on a public,
  unauthenticated `POST /api/web-vitals` beacon. Add a documented `.max()` so
  one adversarial or buggy client sample cannot poison the Prometheus
  histogram's `_sum` (quantile buckets are unaffected, but `_sum`/derived
  averages are not).

## Claim disposition

| Claim (BL-25 sub-item)                                                   | Verdict                                                                                                                                     | Action                |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- |
| `reportPeriodSchema.publishedById` is `z.string()` vs sibling `z.uuid()` | CONFIRMED — read both schemas; `report.schema.ts:71` uses `z.uuid()`, `period.schema.ts:49` uses `z.string()` for the same conceptual field | Tighten to `z.uuid()` |
| `webVitalBeaconSchema.value` has no upper bound                          | CONFIRMED — `z.number().nonnegative()` only; no `.max()` anywhere in the file                                                               | Add `.max()`          |

## Non-goals

- Not touching `apps/api/src/lib/prisma-unique-violation.ts` (P2002 matching)
  or `apps/api/src/modules/search/search.prisma-repository.ts` (`excludeTypes`)
  — those are `api-contract-matching-strictness`, a different seam (matching
  logic, not Zod schema shape).
- Not changing `reportSchema.publishedById` itself — it is already the
  stricter, correct copy; only the period schema's copy moves to match it.
- Not adding a `.max()` bound per-metric-name (CLS's unscaled score and
  LCP/FCP/INP/TTFB's millisecond values have different realistic ranges) —
  one generous shared ceiling is enough to stop histogram poisoning without
  over-engineering a per-`name` schema.
- Not changing how `resolveNavigationType` bounds `navigationType` — already
  correctly bounded via `WEB_VITAL_NAVIGATION_TYPES`.

## File manifest

- `packages/shared/src/schemas/period.schema.ts` — `publishedById` field
  (line 49)
- `packages/shared/src/schemas/period.schema.test.ts` (create if absent, or
  extend existing `period.schema` test coverage) — reject a non-UUID
  `publishedById`
- `packages/shared/src/schemas/web-vitals.ts` — `value` field (line 21) +
  updated file-header comment explaining the bound
- `packages/shared/src/schemas/web-vitals.test.ts` (create if absent, or
  extend) — reject a `value` above the new max

## Verification

P2 contract-strictness bar: full gate + affected unit suites.

- `pnpm --filter @customreport/api db:generate`
- `pnpm --filter @customreport/shared test` (per
  `shared-vitest-excludes-stale-dist` — run scoped, not bare `vitest`, so the
  new/updated tests execute against source, not stale `dist`)
- `pnpm typecheck && pnpm lint && pnpm test`
- `openspec validate shared-schema-strictness --strict`

## Sequencing

Independent of every other change in this batch — no shared files, no
import-order dependency. Can land in any order relative to
`api-contract-matching-strictness`, `latent-robustness-gaps`, `cleanup-tail`,
`audit-target-coverage`, `cursor-pagination-enabled-merge`.
