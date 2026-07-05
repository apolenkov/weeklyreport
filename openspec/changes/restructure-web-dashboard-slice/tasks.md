## 1. Relocate the dashboard slice (behavior-neutral)

- [x] 1.1 `git mv` the eleven dashboard components + their co-located `*.test.tsx` + the `__snapshots__/` directory from `apps/web/src/components/dashboard/` to
      `apps/web/src/features/dashboard/ui/` (preserve rename detection; filenames
      unchanged). `git reset` after each move so nothing sits in the shared index.
      Remove the emptied `components/dashboard/` directory.
- [x] 1.2 `git mv` `mock-data.ts` to
      `apps/web/src/shared/lib/dashboard-mock-data.ts` (rule-of-2 (web) graduation;
      renamed to avoid colliding with admin's `mock-data.ts`). `git reset` after.
- [x] 1.3 Fix every moved file's upward relative imports: the slice sits one
      directory deeper than the legacy tree, so `../../lib/*` → `../../../lib/*`
      and `../<sibling>/*` → `../../../components/<sibling>/*`. Intra-slice sibling
      imports stay `./`-relative (no barrel). `kpi-cards`'s `./mock-data` becomes
      `../../../shared/lib/dashboard-mock-data`.
- [x] 1.4 Add the `features/dashboard/index.ts` barrel exporting exactly
      `DashboardPage` (the only symbol the `/head/dashboard` route consumes);
      reroute that route from `components/dashboard/dashboard-page` to the barrel.
- [x] 1.5 Reroute the remaining `mock-data` consumers to the new
      `shared/lib/dashboard-mock-data` path: `weekly-report-page`,
      `product-accordion` (+ test), `portfolio-overview-table` (+ test), and the
      print template. Grep `components/dashboard` and `dashboard/mock-data`
      repo-wide to confirm no other code consumer remains.
- [x] 1.6 Append `dashboard` to the `webSlices` array in `eslint.config.ts`; the
      `webCrossSliceZones` builder derives the cross-slice zone. Update the five
      path-pinned lint exemptions referencing `components/dashboard/*` (mock-data
      x2 → `shared/lib/dashboard-mock-data.ts`; dashboard-page x2 and
      remind-lead-button → `features/dashboard/ui/*`).

## 2. Verify (behavior-neutral, fail-closed)

- [x] 2.1 Focused `pnpm exec eslint` over every moved/rerouted file
      (`--max-warnings 0`) green — this proves the five exemptions carried and no
      new violation surfaced from the deeper path. Run `pnpm typecheck` (the reroute
      touches type-only imports vitest/esbuild strips without resolving).
- [x] 2.2 Run the dashboard slice tests plus every consumer's tests
      (weekly-report `product-accordion` + `portfolio-overview-table`, the route)
      via `cd apps/web && pnpm exec vitest run <paths>` (never wrap vitest in rtk).
      Full web unit gate green.
- [x] 2.3 Prove the cross-slice zone fails closed: add a synthetic import from
      `features/dashboard` into another slice's internals, confirm eslint errors on
      it, then delete the probe.
