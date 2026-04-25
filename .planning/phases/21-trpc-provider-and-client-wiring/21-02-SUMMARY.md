---
plan: 21-02
phase: 21-trpc-provider-and-client-wiring
subsystem: web/lead/history
tags: [trpc, mapper, skeleton, toast, migration, proof-of-life]
status: complete
completed: 2026-04-25
requires:
  - 21-01 (TRPCProvider, useTRPC, queryOptions proxy)
  - 20-XX (Phase 20 mapper layer + seed)
provides:
  - mapHistoryEntries(api, now?) -> HistoryEntry[]
  - LeadHistorySkeleton (presentational)
  - /lead/history converted to client container reading reports.myHistory
affects:
  - apps/web/src/lib/mappers/index.ts (barrel: +HistoryEntry +mapHistoryEntries)
tech_stack:
  added: []
  patterns:
    - composite-mapper-with-zero-stub-defaults
    - useEffect-on-isError-for-toast
    - skeleton-on-isLoading
key_files:
  created:
    - apps/web/src/lib/mappers/lead-history.ts
    - apps/web/src/lib/mappers/lead-history.test.ts
    - apps/web/src/components/lead/lead-history-skeleton.tsx
  modified:
    - apps/web/src/lib/mappers/index.ts
    - apps/web/src/components/lead/lead-history-list.tsx
    - apps/web/src/app/(app)/lead/history/page.tsx
decisions:
  - D-08-applied: mapper-only date formatting (Apr 14-20, 2 min ago) keeps E2E green
  - D-09: zero-stub aggregate counts (trafficLights/itemCount/riskCount/decisionCount) until router projects them
  - D-10: weekLabel always computed from periodStart (router does not yet expose weekLabel on myHistory)
  - D-11: periodId derived from reportId (no separate periodId in MyHistoryEntry; routing path /lead/report?period=... still works)
metrics:
  duration_seconds: 0
  tasks_completed: 2
  files_changed: 6
requirements:
  - TRPC-04
  - TRPC-05
  - TRPC-06
---

# Plan 21-02: Lead History Real-Data Migration — SUMMARY

## One-liner

Lead History page now reads from `reports.myHistory` via tRPC + `useQuery` with a 3-col skeleton on load and `toast.error` on failure — proof-of-life for the provider+mapper+skeleton+toast stack from 21-01.

## What was built

### Mapper layer (`apps/web/src/lib/mappers/lead-history.ts`)

Pure, fully unit-tested module that translates the API `MyHistoryEntry` (Zod-inferred from `myHistoryEntrySchema` in `packages/shared/src/schemas/report.ts`) to the existing `HistoryEntry` presentation shape. The mapper owns its own type alias re-declaration so consumers depend on the mapper barrel rather than `mock-data.ts`.

Exports:
- `mapHistoryEntries(api, now?)` — composite mapper
- `formatDateRange(start, end)` — `Apr 14-20` / `Apr 28-May 4`
- `formatSubmittedAt(submittedAt, now?)` — `just now` / `N min ago` / `N hour(s) ago` / `Apr 18`
- `isoWeekNumber(d)` — Mon-anchored ISO 8601 week
- `type HistoryEntry`

All exports are also re-exported from `apps/web/src/lib/mappers/index.ts`.

### Skeleton (`apps/web/src/components/lead/lead-history-skeleton.tsx`)

Presentational `<LeadHistorySkeleton count?: number>` mirroring the 3-col card grid: outer rounded card, header row (week label + status badge), date-range bar, three round traffic dots, three small metric bars, submitted-timestamp bar. Uses the existing `Skeleton` from `@customreport/ui/components/ui/skeleton`. No `'use client'` (no hooks).

### Page (`apps/web/src/app/(app)/lead/history/page.tsx`)

Converted from synchronous server component reading `MOCK_HISTORY` to a `'use client'` container:
- `const trpc = useTRPC()`
- `const { data, isLoading, isError, error } = useQuery(trpc.reports.myHistory.queryOptions())`
- `useEffect` on `[isError, error]` calls `toast.error(error?.message ?? 'Failed to load report history.')`
- Renders `<LeadHistorySkeleton />` while loading, `<LeadHistoryList entries={mapHistoryEntries(data)} />` once data arrives.
- Subtitle reads `Loading…` while loading, `${entries.length} past submissions` afterwards.

### List component (`apps/web/src/components/lead/lead-history-list.tsx`)

Single-line change: type import rewired from `./mock-data` to `../../lib/mappers`. JSX untouched (container/presentation split preserved).

## API shape clarification

The plan's `<interfaces>` block was speculative ("verify exact field names by reading the file"). The real `myHistoryEntrySchema` exposes:

```ts
{ sectionId, reportId, periodStart, periodEnd, reportStatus, sectionStatus, submittedAt, publishedAt }
```

It does **not** carry `weekLabel`, `trafficLights`, `itemCount`, `riskCount`, or `decisionCount`. The mapper handles this with:
- `weekLabel` ← computed via `isoWeekNumber(periodStart)`
- `id` ← `sectionId`
- `periodId` ← `reportId` (acceptable for routing; downstream resolution by reportId works equally well)
- `status` ← `sectionStatus` (passthrough; same enum)
- Aggregates ← zero-defaults (see Known Stubs)

## Known Stubs

**Aggregate counts on history cards are stubbed to zero** until the `reports.myHistory` router is extended to project them:

- `trafficLights: { green: 0, yellow: 0, red: 0 }` — file `apps/web/src/lib/mappers/lead-history.ts`, `mapHistoryEntries`
- `itemCount: 0` — same file
- `riskCount: 0` — same file
- `decisionCount: 0` — same file

**Why intentional:** Plan 21-02 is the proof-of-life smallest-container migration. Extending the router would require Prisma `_count` joins, project-status aggregation, and a shared-schema bump — explicit scope creep on a "validate the pattern" plan. The truth that matters per `must_haves.truths` ("Visiting `/lead/history` fetches data from PostgreSQL via `reports.myHistory` (no mock import)") is fully achieved.

**Resolution path:** A follow-up plan should extend `myHistoryEntrySchema` and the router query in `apps/api/src/infrastructure/trpc/trpc.router.ts:66` with the four aggregate fields (Prisma `_count` for items/risks/decisions; project-status grouping for traffic lights). Mapper change at that point is a one-line passthrough swap.

## Verification

- `pnpm --filter @customreport/web typecheck` — clean ✓
- `pnpm vitest run src/lib/mappers/lead-history.test.ts` — 18/18 tests passing ✓
- `pnpm --filter @customreport/web build` — successful, `/lead/history` route compiled ✓
- Static plan assertions on `page.tsx`: no `MOCK_HISTORY`, contains `queryOptions` + `toast.error` + `LeadHistorySkeleton` ✓
- Static plan assertion on `lead-history-list.tsx`: imports `HistoryEntry` from `../../lib/mappers` (not `./mock-data`) ✓

## Deviations

### [Rule 3 - Blocking issue] API shape mismatch with plan interfaces

The plan assumed `myHistoryEntrySchema` carried `weekLabel`, `trafficLights`, `itemCount`, `riskCount`, `decisionCount`, plus a `status` field and a separate `periodId`. The actual schema (verified at `packages/shared/src/schemas/report.ts:401-410` and the router at `apps/api/src/infrastructure/trpc/trpc.router.ts:66-87`) carries 8 fields with `sectionStatus`/`sectionId`/`reportId` instead.

**Resolution:** Mapper supplies sensible derived/zero-stub defaults; documented as Known Stubs above (resolvable in a follow-up plan that extends the router rather than blocking the proof-of-life). Tests adjusted accordingly: instead of separate "weekLabel passthrough vs fallback" cases, we test "weekLabel always computed from periodStart" — the field is currently never API-supplied.

### [No deviation] Authentication

The page issues a `protectedProcedure` query. The page itself does no auth gating; if the user is unauthenticated, the query rejects and the toast surfaces the error message. No auth automation needed for this plan (Phase 24 owns auth wiring).

## Verifier-relevant notes

- The actual exported Zod schema is `myHistoryEntrySchema` (camelCase, no `report` prefix); the inferred type alias is `MyHistoryEntry`.
- Existing `apps/web/src/lib/format-date.ts` was **not** reused. Its helpers use `ru-RU` locale (`Date.toLocaleDateString('ru-RU', { dateStyle: 'medium' })`) which produces `14.04.2026`-style output, incompatible with the mock display strings the E2E suite asserts. The mapper module owns its own `MONTHS` constant and pure formatters that produce the exact mock format (`Apr 14-20`, `2 min ago`).
- `pathFilter()` from `@trpc/tanstack-react-query` is used in `apps/web/src/lib/cache-keys.ts` (set up in 21-01) but is **not invoked** in this plan — no mutations wired yet (Phase 22). Verified at typecheck time only.

## Self-Check: PASSED

- FOUND: `apps/web/src/lib/mappers/lead-history.ts`
- FOUND: `apps/web/src/lib/mappers/lead-history.test.ts`
- FOUND: `apps/web/src/components/lead/lead-history-skeleton.tsx`
- FOUND modified: `apps/web/src/lib/mappers/index.ts` (re-exports `mapHistoryEntries`, `HistoryEntry`)
- FOUND modified: `apps/web/src/components/lead/lead-history-list.tsx` (imports from `../../lib/mappers`)
- FOUND modified: `apps/web/src/app/(app)/lead/history/page.tsx` (`'use client'`, `useQuery`, no `MOCK_HISTORY`)
- FOUND commit: `53bbc11` — Task 1 mapper + tests
- FOUND commit: `7304b10` — Task 2 page migration

## Commits

- `53bbc11` feat(21-02): add lead-history composite mapper
- `7304b10` feat(21-02): migrate Lead History page to useQuery + skeleton + toast
