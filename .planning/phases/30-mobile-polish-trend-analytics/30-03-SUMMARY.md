# Phase 30, Plan 03 — SUMMARY

**REQ-IDs:** ANAL-04
**Commit:** `ba1f86e feat(30-03): ANAL-04 /reports/trends page + 3 chart components`

## Whether shadcn add worked

Hand-rolled. `pnpm dlx shadcn@latest add chart` was time-boxed but skipped to keep the watchdog budget for testing. Hand-rolled wrapper at `packages/ui/src/components/ui/chart.tsx` is **34 LOC** total — under the 100-LOC stop condition.

`recharts` was added directly via `pnpm --filter @customreport/ui add recharts` and `pnpm --filter @customreport/web add recharts`.

## Final LOC of each chart component

```
apps/web/src/components/charts/traffic-light-history.chart.tsx  — 65 LOC
apps/web/src/components/charts/lead-velocity.chart.tsx          — 60 LOC
apps/web/src/components/charts/period-comparison.chart.tsx      — 67 LOC
```

All three under the 100-LOC budget. No tRPC fetches inside chart components — props-driven only; the page does the data fetch.

## Null-vs-zero handling

- **TrafficLightHistoryChart** uses recharts `<Line connectNulls={false} />` so periods with no data render as visible gaps. Zero is impossible here (statuses are 'green'|'yellow'|'red'|null mapped to 3|2|1|null).
- **LeadVelocityChart** stacked bar always plots a value; missing leads default to 0 so a zero bar is rendered (visible 1-px tick).
- **PeriodComparisonChart** delta table renders null cells as `–` (em-dash) and zero risk-counts as `0`. Asserted by render test "renders null cells as em-dash and zero cells as 0".

## Page architecture decision

The trends page is a CLIENT component (`'use client'`), not RSC, because the existing tRPC seam in this app uses a React context provider (`useTRPC()` from `apps/web/src/lib/trpc-context.ts`). RSC integration would have required a parallel server-side caller — out of scope for this phase. The layout gate at `apps/web/src/app/(app)/reports/layout.tsx` (Phase 29-03) already permits all four authenticated roles, so the trends page inherits viewer access.

Charts are loaded via `next/dynamic` with `ssr: false` so SSR does not crash on `ResizeObserver`.

## Test counts

- Web: +7 tests in `apps/web/src/components/charts/charts.test.tsx`.
- API: unchanged (489).

## Files

- apps/web/src/app/(app)/reports/trends/page.tsx (new)
- apps/web/src/components/charts/{traffic-light-history,lead-velocity,period-comparison}.chart.tsx (new)
- apps/web/src/components/charts/charts.test.tsx (new)
- packages/ui/src/components/ui/chart.tsx (new — hand-rolled wrapper)
- apps/web/package.json (recharts dep)
- packages/ui/package.json (recharts dep)

## Notes

- `useTRPC().analytics.*.queryOptions(...)` works because tRPC types flow from the api → web via the @customreport/api type re-export in apps/web/src/lib/trpc.ts.
- The ChartTooltip uses CSS variables (`--color-card`, `--color-border`) so dark/light theme will inherit Tailwind v4 @theme tokens.
