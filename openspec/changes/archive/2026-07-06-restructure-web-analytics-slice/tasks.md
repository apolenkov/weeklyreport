## 1. Relocate the analytics slice (behavior-neutral)

- [x] 1.1 `git mv` the three chart components + the co-located `charts.test.tsx`
      from `apps/web/src/components/charts/` to `apps/web/src/features/analytics/ui/`
      (preserve rename detection; filenames unchanged; remove the emptied
      `components/charts/` directory). The `./`-relative test imports stay valid.
- [x] 1.2 Add the `features/analytics/index.ts` barrel exporting exactly the three
      components consumed by the `/reports/trends` route (`LeadVelocityChart`,
      `PeriodComparisonChart`, `TrafficLightHistoryChart`); reroute that route's
      three `next/dynamic` imports from `components/charts/*` to the barrel. Grep
      `components/charts` repo-wide to confirm no other code consumer remains.
- [x] 1.3 Append `analytics` to the `webSlices` array in `eslint.config.ts`; the
      `webCrossSliceZones` builder derives the cross-slice zone. No chart file
      carries a size/complexity exemption entry, so no exemption edit is needed.

## 2. Verify (behavior-neutral, fail-closed)

- [x] 2.1 Focused `pnpm exec eslint` over the moved slice + the rerouted route
      (`--max-warnings 0`) green; run the charts unit suite plus the trends-route
      test via `cd apps/web && pnpm exec vitest run <paths>` (never wrap vitest in
      rtk). Full web unit gate green.
- [x] 2.2 Prove the cross-slice zone fails closed: add a synthetic import from
      `features/analytics` into another slice's internals, confirm eslint errors on
      it, then delete the probe. Live-verify `/reports/trends` renders the three
      charts from source (the shared-src webpack module-resolution 500 that
      tsc/vitest miss) if the dev app is available.
