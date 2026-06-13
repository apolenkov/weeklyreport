# Replace Drifted flushAll Test-Timer Helpers

## Why

Four lead-surface test files each carry a private copy of a hand-rolled
`flushAll` helper that "waits" for React Query by counting promise
ticks. The copies have drifted — 10 microtask ticks in
`use-lead-form-autosave.test.tsx:46-50` versus 3×30 ticks plus two
`setTimeout(0)` hops in `lead-form.test.tsx:97-107`,
`lead-form-addressable.test.tsx:88-94`, and
`lead-form-viewmode.snapshot.test.tsx:172-178` — because TanStack Query
v5 notifies subscribers via `setTimeout(0)`, not microtasks. Any
internal scheduling change in React Query or React can flip all 37
call sites false-red, and the magic tick counts need hand re-tuning.
Inventory verified at HEAD 85541470 (arch dossiers `flush-all` +
`vitest-timers`; vitest 4.1.7, RTL 16.3.2, TanStack Query 5.100.14; a
scratch migration of the hook test passed 3/3 in-repo).

## What Changes

The 4 copies serve two different jobs, so two fixes — and deliberately
NO new shared helper (the complexity vanishes into framework
primitives; a central copy would preserve the shallow abstraction):

1. Hook test (`use-lead-form-autosave.test.tsx`, genuine fake-timer
   debounce test): keep `vi.useFakeTimers()`; each
   `advanceTimersByTime(n)` + `flushAll` pair becomes one
   `await vi.advanceTimersByTimeAsync(n)` inside the existing `act()`
   wrappers — bounded advances keep coalescing windows and "not fired
   yet" negatives deterministic. forceSave/held-promise settles use
   `await vi.advanceTimersByTimeAsync(0)`; `vi.runAllTimersAsync()`
   only as a terminal drain.
2. Three component tests (real timers; their flushAll is a hand-rolled
   "wait for the query cascade"): delete it; wait with Testing Library
   `findBy*` / `waitFor` anchored on observable end states; negative
   assertions get a positive readiness anchor first.

Hard constraint: never TL `waitFor`/`findBy` under fake timers here —
`globals: false` plus no `jest` shim in `vitest.setup.ts` means TL's
polling timer is itself faked and the test hangs.

## Sequencing

Wave 1 — land BEFORE `refactor-web-trpc-test-harness` (same 4 test
files; this change first keeps the harness diffs clean) and before the
Wave-2 lead cluster (`hoist-query-error-policy` →
`refactor-lead-mappers` → `refactor-lead-dialog-lifecycle`). The
Wave-0 bug fix `fix-section-add-signal-reset` is independent: its
small `lead-form.tsx` edit touches no timer helpers and may land in
either order.

## Non-goals

- No production code changes (`use-lead-form-autosave.ts`,
  `lead-form.tsx` and friends untouched).
- No shared test helper or test-util module.
- No assertion weakening, deletions, or `.skip` — sole allowed
  assertion diff: two hedged matchers tightened (task 1.1).
- No `jest` shim and no `globals: true` flip in vitest config/setup.
- No real-timer conversion of the hook test (rejected as flake-prone).

## Capabilities

### New Capabilities

- `web-test-timer-discipline`: web tests wait via framework
  primitives — async Vitest timer APIs under fake timers, Testing
  Library waits under real timers; no hand-rolled tick-flush helpers;
  negatives anchored on positive signals.

### Modified Capabilities

<!-- none: lead-report-controls-integrity scenarios pinned by these
tests are preserved by the assertions-unchanged contract -->

## Impact

- EDIT (tests only): the 4 test files cited in Why.
- READ-ONLY references: `apps/web/src/hooks/use-lead-form-autosave.ts`
  (hook under test), `apps/web/vitest.setup.ts` (no-jest-shim
  constraint). Both MUST NOT change.
