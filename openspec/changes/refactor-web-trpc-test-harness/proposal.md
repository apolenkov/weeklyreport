# Refactor Web tRPC Test Harness

## Why

Twelve web test files hand-roll the same tRPC proxy mock and silence
types with `as never` (7 admin tabs, `weekly-report-page`, the
lead-form trio, `use-lead-form-autosave`). The copies have drifted into
three incompatible key dialects, and two carry a confirmed latent bug:
`settings-tab.test.tsx:68` and `users-tab.test.tsx:55-64` stub
`pathFilter()` as `{ tag: "..." }`, while the installed
`@trpc/tanstack-react-query@11.17.0` types `pathFilter` as
`WithRequired<QueryFilters, "queryKey">` and TanStack's `matchQuery`
ignores unknown keys — a `{ tag }` filter matches every query. In
tests, production `cache-keys.ts` invalidation silently degrades to
invalidate-all, and the tag assertions are tautologies.

Separately, the auth-redirect link's swallow branch (`trpc.ts:74-78`)
— the one place every client error could be silently masked — has no
test; only the inner pure handler is covered.

## What Changes

1. New factory `createMockTRPC(descriptors)` in
   `apps/web/src/test-utils/mock-trpc.ts` plus a contract test. Each
   procedure is declared once as a path descriptor;
   `queryOptions().queryKey`, `queryKey()`, and
   `pathFilter() => ({ queryKey: [path] })` all derive from that
   single path, so the shapes can never diverge again. Headline win:
   the vacuous-filter bug is fixed and pinned.
2. Convert the 12 files sequentially; `settings-tab` and `users-tab`
   each gain one non-vacuous invalidation assertion.
3. Export `createAuthRedirectLink` from `apps/web/src/lib/trpc.ts`
   (`@internal` JSDoc, behavior unchanged) and add exactly 3
   observable-seam cases to the existing `trpc.test.ts`, including
   asserting `complete` is NOT called after a 401 redirect.
   (`ui-role-route-access` governs the 403 ForbiddenPage no-redirect
   path — a different concern; no spec link.)

Inventories: dossiers `trpc-mock-factory` (verdict Strong) and
`auth-link-test`; research memo `trpc-testing` (bug confirmed against
installed package sources).

**Non-goals:** no MSW migration (in-code decision at
`weekly-report-page.test.tsx:1-7` stands); no production behavior
change (one `export` keyword only); no conversion of the 19 hook-level
`vi.mock(trpc-context)` test files; no upstream-unsubscribe teardown
case for the link; no assertion weakening — the lead tests pin
`lead-report-controls-integrity` behaviors verbatim.

## Sequencing

Wave 1 — starts after `refactor-test-timer-helpers`. Admin-tab test
conversions may start immediately; the lead-area conversions
(lead-form trio + autosave tests) wait until the active
`fix-lead-stripe-and-archived-badges` lands.
`use-lead-form-autosave.test.tsx` is also reworked by
`refactor-test-timer-helpers`, which lands first — re-verify that
file's line anchors after the timer rework before converting (task
3.3).

## Capabilities

### New Capabilities

- `web-trpc-test-harness` — shared tRPC mock-factory contract
  (`createMockTRPC` descriptors), non-vacuous `pathFilter`
  `{ queryKey }` shape, and auth-redirect link seam coverage. Delta:
  `specs/web-trpc-test-harness/spec.md` (3 ADDED requirements); syncs
  into `openspec/specs/` on archive.

### Modified Capabilities

<!-- none: lead-report-controls-integrity behavioral pins are
preserved verbatim, not modified -->

## Impact

- NEW: `apps/web/src/test-utils/mock-trpc.ts` + `mock-trpc.test.ts`.
- CONVERT: the 12 test files listed above.
- `apps/web/src/lib/trpc.ts` (export keyword only) and
  `apps/web/src/lib/trpc.test.ts` (+3 cases).
