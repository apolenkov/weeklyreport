# Tasks — Refactor Web tRPC Test Harness

Decisions D1-D5: `design.md`. Evidence anchors: `proposal.md`.
NOT STARTED — captured 2026-06-10. All work lives in `apps/web`; no
shared/ui/api tasks exist for this change.

**Standing execution note:** Sequential single-writer edits only;
parallel agents only for read-only analysis (repo lesson: parallel
mechanical edits pass gates but break behavior).

**Sequencing gates:** start after `refactor-test-timer-helpers` lands.
Group 3 (lead area) is BLOCKED until `fix-lead-stripe-and-archived-badges`
is archived — re-run `git status --short` and `openspec list` before
starting any group-3 task (a parallel session edits lead files).

## 1. Factory (web)

- [x] 1.1 Add `apps/web/src/test-utils/mock-trpc.ts` —
      `createMockTRPC(descriptors)` per design D1-D3: derive
      `queryOptions()` / bare `queryKey()` /
      `pathFilter() => ({ queryKey: [path] })` / `mutationOptions()`
      from each descriptor's single `path`; query stub variants data |
      fn | `"pending"` (never-resolving); mutation capture registry
      keyed by dotted path (`{ calls, lastOptions, mutationFn }`); one
      internal `as unknown as TRPCProxy` cast
      (`import type { TRPCProxy } from "../lib/trpc"`); queryFn stubs
      as `() => Promise.resolve(data)`.
- [x] 1.2 Add `apps/web/src/test-utils/mock-trpc.test.ts` — contract
      pins: (a) `pathFilter()` returns an object whose `queryKey`
      equals `[splitPath]` (this exact assertion fails under the old
      `{ tag }` shape); (b) seed a query via proxy `queryOptions`,
      then `qc.invalidateQueries(proxy.x.y.pathFilter())` marks ONLY
      that query stale (negative assertion on an unrelated seeded
      query); (c) a `"pending"` descriptor keeps `useQuery`
      `isPending`; (d) mutation capture records `mutationFn` input and
      caller-passed `onSuccess`/`onError`.

## 2. Admin-tab + weekly-report conversions (web; may start immediately)

- [ ] 2.1 Convert
      `apps/web/src/components/admin/settings-tab.test.tsx`: replace
      `makeMockTRPC` (:50-105) with factory descriptors; drop all
      `{ tag }` pathFilter stubs (:68, :90-103) and the per-file
      `as never` cast; ADD one non-vacuous assertion — after Save
      success the `admin.getOrganization` query is invalidated by its
      specific key; preserve the toast and captured mutation-args
      assertions verbatim. Run the web suite before committing.
- [ ] 2.2 Convert `users-tab.test.tsx` — same transformation for the
      `{ tag }` stubs at :55-64; ADD the matching invalidateAdmin-path
      invalidation assertion. Run the web suite before committing.
- [ ] 2.3 Convert `jobs-tab.test.tsx` — collapse `makeMockTRPC`
      (:54-82) and `makePendingMockTRPC` (:114-142) into two factory
      calls differing only in the `listFailed` descriptor (data vs
      `"pending"`); cover the bare `queryKey()` at `admin.dlqCount`
      (:77-79, :137-139); keep the skeleton-while-pending test green.
- [ ] 2.4 Convert `periods-tab.test.tsx` — largest stub surface (14
      pathFilter stubs within :97-195, query/mutation captures
      :97-232); its key-dialect inconsistency vs products-tab
      (`["admin", "settings"]` :109 vs `["admin", "getSettings"]`
      :107) disappears by construction.
- [ ] 2.5 Convert `groups-tab.test.tsx` (:54-88),
      `products-tab.test.tsx` (:80-121), `reminders-tab.test.tsx`
      (:85-126) — three small mechanical conversions in one commit;
      still single-writer, each file converted and the web suite run
      green before moving to the next file.
- [ ] 2.6 Convert
      `apps/web/src/components/weekly-report/weekly-report-page.test.tsx`
      — only `makeMockTRPC` (:170-276) moves to the factory; KEEP the
      header decision comment (:1-7, "We DO NOT extend MSW handlers")
      and the `vi.mock` of cache-keys (:24-28) — the invalidation
      cascade stays asserted via the mocked helpers.

## 3. Lead-area conversions (web; BLOCKED — see sequencing gates)

- [ ] 3.1 Convert `apps/web/src/components/lead/lead-form.test.tsx` —
      dotted-string queryKey dialect (:141-322). Preserve verbatim:
      the `invalidateSpy` >= 3 assertions (:352-376 submit success,
      :455-474 fillFrom success) and every
      `lead-report-controls-integrity` behavioral pin (snapshot-return
      opens no dialog; archive-toggle scenarios). A red test after
      conversion is a conversion bug — never adjust an assertion to
      pass.
- [ ] 3.2 Convert `lead-form-addressable.test.tsx` (:115-283) and
      `lead-form-viewmode.snapshot.test.tsx` (:60-166) — same dialect;
      one commit, one file at a time with a web-suite run between.
- [ ] 3.3 Convert `apps/web/src/hooks/use-lead-form-autosave.test.tsx`
      — move the `buildHarness` trpcMock to the factory, preserving
      the `saveDraft` mutation-capture calls-array semantics; verify
      the `invalidatedKeys.some((k) => k.includes("leadForm"))`
      assertion still passes with the nested
      `[["leadForm", "byPeriod"]]` key shape (the stringified key
      mapping covers it — confirm). NOTE:
      `refactor-test-timer-helpers` reworks this file's timer handling
      and lands BEFORE this change (sequencing gate above), so the
      dossier line refs (trpcMock :65-84, invalidatedKeys :472-496,
      stringify :493) describe the pre-rework file — re-verify all
      three anchors against the post-timer-helpers file before
      converting.

## 4. Auth-redirect link seam (web; independent of groups 2-3)

- [x] 4.1 In `apps/web/src/lib/trpc.ts`: change
      `function createAuthRedirectLink` (:66) to `export function`;
      append "@internal — exported for unit tests; production wiring
      stays via makeTRPCClient" to its existing JSDoc. No other
      production edits.
- [x] 4.2 In `apps/web/src/lib/trpc.test.ts`: add describe block
      "createAuthRedirectLink — observable seam" with EXACTLY 3 cases.
      Reuse `makeUnauthorizedError` / `makeServerError` /
      `stubLocation` / `assignSpy` unchanged; build
      `opLink = createAuthRedirectLink()({})` and a minimal Operation
      stub; stub upstream `next` with `observable()` from
      `@trpc/server/observable`; subscribe with `vi.fn()`
      next/error/complete spies. Cases: (1) 401 from `/lead/report` →
      `assignSpy` called once with `"/?next=%2Flead%2Freport"`,
      errorSpy NOT called, completeSpy NOT called; (2) 500 → errorSpy
      called once with the SAME error instance, no redirect; (3) one
      result envelope then complete → nextSpy receives the envelope,
      completeSpy fires once, errorSpy never. The 6 existing handler
      tests pass unchanged. Non-goal: upstream-unsubscribe teardown.

## 5. Verification

- [ ] 5.1 Straggler grep: `grep -rn "pathFilter: () =>" apps/web/src`
      and `grep -rn "makeMockTRPC" apps/web/src` return only the
      factory and its contract test; record the 19 hook-level
      `vi.mock(trpc-context)` files here as observed, NOT converted.
- [ ] 5.2 Gates after every commit and at the end:
      `pnpm typecheck && pnpm lint && pnpm test && pnpm build`.
      Web-scoped runs between files within a commit:
      `pnpm --filter @customreport/web test`. Record results here.
