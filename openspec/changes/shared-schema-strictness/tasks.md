## 1. Tighten `reportPeriodSchema.publishedById` to `z.uuid()`

- [x] 1.1 `packages/shared/src/schemas/period.schema.ts`: change
      `publishedById: z.string().nullable().optional()` to
      `publishedById: z.uuid().nullable().optional()`, matching
      `reportSchema.publishedById` in `report.schema.ts`
- [x] 1.2 Add/extend a unit test asserting `reportPeriodSchema.parse` rejects
      a non-UUID `publishedById` string and accepts a valid UUID / `null` /
      absent
- [x] 1.3 Grep every producer of a `reportPeriodSchema`-shaped payload
      (admin snapshot export/import, period list/detail mappers) for a
      non-UUID `publishedById` source (e.g. a raw email or username) — none
      expected, but confirm before tightening

## 2. Bound `webVitalBeaconSchema.value`

- [x] 2.1 Pick a shared upper bound generous enough for every metric kind
      (LCP/FCP/INP/TTFB in ms, CLS as an unscaled score) — e.g. a documented
      constant such as `MAX_WEB_VITAL_VALUE = 300_000` (5 minutes in ms,
      several orders of magnitude above any real CLS score) — name it, don't
      inline the magic number
- [x] 2.2 `packages/shared/src/schemas/web-vitals.ts`: change
      `value: z.number().nonnegative()` to
      `value: z.number().nonnegative().max(MAX_WEB_VITAL_VALUE)` and extend
      the file-header comment to state why the bound exists (histogram
      `_sum` poisoning on a public unauthenticated endpoint)
- [x] 2.3 Add/extend a unit test asserting `webVitalBeaconSchema.parse`
      rejects a `value` above the new max and accepts realistic in-range
      values for each `name`

## 3. Gates

- [x] 3.1 `pnpm --filter @customreport/api db:generate` (skipped — no Prisma-client TS errors encountered; not needed for a shared-package-only change)
- [x] 3.2 `pnpm --filter @customreport/shared test` — 17 files, 391 tests passed
- [x] 3.3 scoped equivalents run: `pnpm --filter @customreport/shared typecheck` clean; `pnpm exec eslint packages/shared/src/schemas/period.schema.ts packages/shared/src/schemas/period.schema.test.ts packages/shared/src/schemas/web-vitals.ts packages/shared/src/schemas/web-vitals.test.ts --max-warnings 0` clean (full monorepo `pnpm lint`/`pnpm test` not run — out of scope for this shared working tree)
- [x] 3.4 `openspec validate shared-schema-strictness --strict` — valid
