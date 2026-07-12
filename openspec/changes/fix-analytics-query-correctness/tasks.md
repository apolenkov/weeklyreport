## 1. Lead filter reaches section aggregation

- [ ] 1.1 In `analytics.prisma-repository.ts`'s `trafficLightHistory`, spread
      `leadFilter` into `include.sections.where` alongside `scope` (currently
      only `scope` is spread there; `leadFilter` is only used in
      `where.sections.some`)
- [ ] 1.2 Add a unit test: call `trafficLightHistory` with a `leadId` set and
      assert the returned rows include only projects from that lead's
      sections, not every in-scope lead's

## 2. leadVelocity groups by period label

- [ ] 2.1 Extract a shared "group reports by `isoDateOnly(periodEnd)` label"
      helper (in `analytics-period-math.ts`, alongside the other period
      helpers) from `trafficLightHistory`'s existing `reportsByLabel` reduce
- [ ] 2.2 Update `trafficLightHistory` to use the extracted helper in place
      of its inline reduce
- [ ] 2.3 Update `leadVelocity` to group `reports` through the same helper
      before mapping, merging every report sharing a `periodLabel` into one
      output row (concatenate their `leads` arrays) instead of emitting one
      row per report
- [ ] 2.4 Add a unit test: two reports with `periodEnd` values on the same
      calendar day produce exactly one `leadVelocity` row for that
      `periodLabel`, with both reports' leads present in that row

## 3. Recursive stable cache-key hashing

- [ ] 3.1 In `analytics.service.ts`, replace `stableHash`'s
      `JSON.stringify(value, keys)` (top-level keys used as a replacer,
      which whitelists at every depth) with a recursive stable-stringify
      that sorts keys at each nesting level independently
- [ ] 3.2 Add a unit test: two objects that are deep-equal except for a
      differently-ordered nested object produce the same hash; two objects
      that differ only in a nested key's value produce different hashes

## 4. Spec delta

- [ ] 4.1 `analytics-query-correctness`: ADD requirements for the
      lead-scoped filter, the period-label grouping in `leadVelocity`, and
      the recursive stable cache-key hash

## 5. Gates and verification

- [ ] 5.1 `pnpm --filter @customreport/api db:generate`
- [ ] 5.2 `pnpm typecheck && pnpm lint && pnpm test`
- [ ] 5.3 `openspec validate fix-analytics-query-correctness --strict`
