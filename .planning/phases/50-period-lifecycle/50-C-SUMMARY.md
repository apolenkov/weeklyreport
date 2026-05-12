---
phase: 50
plan: C
subsystem: api/lib
tags: [business-date, luxon, workingDays, deadline, dst]
provides:
  - apps/api/src/lib/business-date.ts (isBusinessDay, nextBusinessDay, addBusinessDays, computeDeadline)
requires:
  - luxon (already installed in apps/api via Phase 44-03)
  - WorkingDays type from @customreport/shared
affects:
  - none yet (consumers wire through in Phase 50-A and 50-B)
tech-stack:
  added: []
  patterns: [luxon-zone-aware-arithmetic]
key-files:
  created:
    - apps/api/src/lib/business-date.ts
    - apps/api/src/lib/business-date.test.ts
  modified: []
decisions:
  - Place utility in apps/api/src/lib (server-only). Shared package not needed
    until UI computes deadlines client-side; deferred to avoid touching
    @customreport/shared in parallel with 50-A.
  - Negative-n supported symmetrically (addBusinessDays(-1) walks backward).
    Cheap to add now, useful for "X business days before deadline" reminder
    math without forcing callers to invert their own loop.
  - n=0 returns the instant as-is (no snap to next business day). Caller
    that wants "snap" uses nextBusinessDay() explicitly. Avoids a hidden
    branch where Saturday input silently moves to Monday.
  - deadlineHour validated as integer 0..23 — defensive bound that closes
    a footgun where a future caller passes a float or 25.
  - Integration with Period.create deferred. Phase 50-A is touching the
    Period creation path in parallel; replacing date math there would
    create a guaranteed merge conflict. The utility is ready to wire;
    50-A or a follow-up plan picks it up.
metrics:
  duration: ~25min
  completed: 2026-05-11
---

# Phase 50 Plan C: business-date utility (Luxon, workingDays-aware) Summary

Promotes `workingDays` from cosmetic metadata to actual logic. Adds a pure,
side-effect-free utility module that performs business-day arithmetic
respecting DST, three workingDays policies (`mon-fri` / `mon-sat` / `mon-sun`),
and arbitrary IANA timezones. Backed by 36 unit tests covering weekend
skipping, week/month/year boundaries, DST spring-forward (Europe/Berlin) and
fall-back (America/New_York), negative arithmetic, n=0 semantics, and
`computeDeadline` UTC-stability.

## What ships

- `apps/api/src/lib/business-date.ts` — four exports (`isBusinessDay`,
  `nextBusinessDay`, `addBusinessDays`, `computeDeadline`) + an internal
  `workingDaySet` helper exposed only for tests. Full JSDoc on every public
  function: semantics, edge cases, throw conditions, and the Phase 51-A
  forward-compatibility note for holiday calendars.
- `apps/api/src/lib/business-date.test.ts` — 36 unit cases organized by
  surface (`workingDaySet`, `isBusinessDay`, `addBusinessDays × 3 policies`,
  `n=0/negative`, boundaries, `nextBusinessDay`, `computeDeadline`).

## Design notes

- All arithmetic routes through Luxon's `DateTime.setZone(tz).plus({ days: 1 })`.
  This is a wall-clock day step, not a 24h-millisecond step — DST transitions
  are handled correctly even when the input is a UTC `Date`.
- Function signatures accept `tz: string` as a required parameter (no
  process-default fallback). Callers must thread the org's `defaultTimezone`
  in explicitly; this prevents the silent UTC-default class of bugs.
- `WorkingDays` is imported as a type from `@customreport/shared` so the enum
  stays single-sourced (defined alongside the Zod schema). No duplicate enum.
- Iteration safety: `addBusinessDays` enforces `MAX_ITER = 366 × 10` (≈ ten
  years of daily steps). Any sane `n` finishes in O(n); the cap only fires if
  a bug feeds in `Number.POSITIVE_INFINITY` or similar.

## What was deliberately NOT done

- **Period.create integration** — deferred. 50-A is touching Period creation
  in parallel; doing the wiring here guarantees a merge conflict. The
  utility is consumer-ready; whichever plan lands second picks it up. This
  is documented in the plan as scope guard ("50-C is supposed to be new
  files only").
- **Settings UI copy update** — plan step 5 ("workingDays help text shifts
  from 'метаданные, не влияет' to 'влияет на deadline-математику'") deferred
  to the same follow-up that wires the utility. Without an actual consumer
  yet, the copy would be a lie.
- **Holiday calendar parameter** — plan correctly defers this to Phase 51-A.
  API kept narrow; JSDoc flags the forward-compat hook.
- **Shared-package placement** — utility lives in `apps/api/src/lib` (server-
  only) rather than `packages/shared`. The web client doesn't compute
  deadlines today; promoting to shared can happen when (if) it does.

## Verification

```
$ cd apps/api && npx vitest run src/lib/business-date.test.ts
Test Files  1 passed (1)
     Tests  36 passed (36)
  Duration  173ms

$ pnpm --filter @customreport/api lint
> tsc --noEmit -p tsconfig.json && eslint .
(exit 0)
```

- 36 unit tests pass (>20 plan minimum).
- TypeScript strict + ESLint flat-config: clean.
- DST coverage proves wall-clock-day semantics for Europe/Berlin spring-
  forward (2026-03-29) and America/New_York fall-back (2026-11-01).
- Russia (Europe/Moscow) used as default tz in policy tests since the org
  default is MSK; DST tests use Berlin/NYC since Russia doesn't observe DST.

## Deviations from Plan

### Rule 4 (architectural) deferral, with caller consent

**Period.create wiring (plan step 4) and Settings UI copy (plan step 5)
deferred** to avoid a merge conflict with Phase 50-A running in parallel.
The orchestrator prompt explicitly stated: "50-C is supposed to be new
files only (`business-date.ts` + its test)". Honored that constraint; the
utility is fully implemented and tested, the wiring is a follow-up.

No auto-fixed bugs, no Rule 1/2/3 deviations — the plan's reference
skeleton was clean and applied with only narrow hardening (input
validation on `deadlineHour`, iteration safety on `addBusinessDays`,
explicit n=0/negative semantics, additional timezone-aware test).

## Files

**Created:**

- `apps/api/src/lib/business-date.ts` (≈150 LOC including JSDoc)
- `apps/api/src/lib/business-date.test.ts` (36 cases)

**Modified:** none.

## Commits

- `feat(api): UFB-050 — business-date utility (Luxon, workingDays-aware) (50-C)`

## Self-Check: PASSED

- `apps/api/src/lib/business-date.ts` — exists.
- `apps/api/src/lib/business-date.test.ts` — exists, 36 tests pass.
- Commit landed on `main` (verified via `git log`).
