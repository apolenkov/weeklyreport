## 1. Rolling window helper

- [ ] 1.1 Add `apps/web/src/lib/trends-window.ts` exporting a pure
      `deriveTrendsWindow(now: Date): { periodFrom: string; periodTo: string }`
      that returns a rolling 12-month span: `periodFrom` is `now` minus 12
      calendar months, `periodTo` is `now`, both formatted as `YYYY-MM-DD`
      (same format the existing `PERIOD_FROM`/`PERIOD_TO` constants used)
- [ ] 1.2 Write `apps/web/src/lib/trends-window.test.ts`: assert the span is
      exactly 12 months for a fixed `now`, assert correct handling across a
      year boundary (e.g. `now = 2027-03-15` → `periodFrom = 2026-03-15`),
      and assert the output format matches what
      `trpc.analytics.trafficLightHistory.queryOptions` expects

## 2. Wire the page to the derived window

- [ ] 2.1 `apps/web/src/app/(app)/reports/trends/page.tsx`: remove the
      hardcoded `PERIOD_FROM`/`PERIOD_TO` constants; call
      `deriveTrendsWindow(new Date())` once per render and pass its
      `periodFrom`/`periodTo` to both the `trafficLightHistory` and
      `leadVelocity` query options
- [ ] 2.2 Update the comparison query's fallback bounds (currently
      `periodPair?.periodA ?? PERIOD_FROM` / `periodPair?.periodB ?? PERIOD_TO`)
      to fall back to the same derived window instead of the deleted
      constants
- [ ] 2.3 Confirm the existing empty-state paths in
      `traffic-light-history.chart.tsx` and `lead-velocity.chart.tsx` are
      unchanged and still reachable (a workspace with zero reports in the
      rolling window must still show "No published periods in range." /
      "No velocity data in range.", not a crash)

## 3. Spec delta

- [ ] 3.1 Add `trends-query-window` capability spec: an ADDED requirement
      that the Trends page's analytics query window is derived from the
      current date rather than pinned to fixed calendar bounds

## 4. Gates and verification

- [ ] 4.1 `pnpm --filter @customreport/web test src/lib/trends-window.test.ts`
- [ ] 4.2 `pnpm typecheck && pnpm lint && pnpm test`
- [ ] 4.3 Live-check: load `/reports/trends` as any of the four roles, confirm
      the three charts render with the current dev/UAT seed data (which is
      run-date-relative) exactly as they did before this change
- [ ] 4.4 `openspec validate dynamic-trends-window --strict`
