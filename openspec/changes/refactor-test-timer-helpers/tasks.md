# Tasks — Replace Drifted flushAll Test-Timer Helpers

NOT STARTED — captured 2026-06-10. Test-only change: NO production code
is touched; the contract is strict preservation (all 34 tests across
the 4 files keep passing with assertion expressions unchanged, except
the two hedged matchers explicitly listed in 1.1).

**Execution note: Sequential single-writer edits only; parallel agents
only for read-only analysis (repo lesson: parallel mechanical edits
pass gates but break behavior).** One file per commit; read the full
diff and re-run the 4-file suite before starting the next file. A
parallel session edits `apps/web/src/components/lead/` — before every
commit, `git status --short` must show the 4 test files clean of
foreign edits.

Baseline (verified at HEAD 85541470): 4 `flushAll` definitions
(lines 46 / 97 / 88 / 172) + 37 call sites (16 + 15 + 5 + 1); 4-file
suite green 34/34 (12 + 16 + 5 + 1 tests). Re-run
`grep -rn flushAll apps/web/src` and the suite first; if counts or
lines moved, update the refs below before editing.

No shared/ui or api work in this change — web tests only.

## 1. Web — test-file migrations

- [ ] 1.1 `apps/web/src/hooks/use-lead-form-autosave.test.tsx` —
      fake-timer file; `vi.*` primitives ONLY. Never TL
      `waitFor`/`findBy` here: `vitest.config.ts` sets
      `globals: false` and `vitest.setup.ts` has no `jest` shim, so
      TL's polling timer is itself faked → hang until test timeout.

  - Delete `flushAll` (lines 46–50) and its JSDoc (lines 41–45).
  - 16 call sites (lines 138–489): replace each
    `vi.advanceTimersByTime(n); await flushAll();` with
    `await vi.advanceTimersByTimeAsync(n);` — every advance stays
    inside its existing `await act(async () => { ... })` wrapper.
  - Partial advances in the coalescing test (~lines 160–171): convert
    to `await vi.advanceTimersByTimeAsync(1000)` too, and delete the
    two now-stale `@typescript-eslint/require-await` suppressions
    (lines 160, 167) — the act bodies now genuinely await. Bounded
    advances keep the `expect(calls).toHaveLength(0)` negatives valid.
  - forceSave / held-promise settles (~lines 335–490):
    `void result.current.forceSave(); await vi.advanceTimersByTimeAsync(0);`
    (proven in-repo idiom — drains microtasks plus TanStack's
    `setTimeout(0)` notify). `vi.runAllTimersAsync()` is allowed only
    as a terminal drain where no later assertion depends on
    un-elapsed time. NEVER re-introduce tick counting; if a residual
    edge appears, escalate to `vi.runAllTimersAsync()` or `vi.waitFor`
    on the asserted condition.
  - `afterEach`: `vi.runOnlyPendingTimers()` then `vi.useRealTimers()`
    (keep in this test file — LIFO hook order must put it before the
    setup-file `cleanup()`).
  - Tighten the two hedged matchers (lines 141–142 and 341–342):
    `expect(["saving", "saved"]).toContain(result.current.state)` →
    `expect(result.current.state).toBe("saved")` — now deterministic
    under the full drain. This is the ONLY assertion-text change in
    the whole change; everything else stays byte-identical.
  - Add a 3-line recipe comment at the top of the file: fake timers ⇒
    `vi.*` only; TL waitFor deadlocks under fake timers in this repo
    (globals:false, no jest shim); why.
  - Run the file, read the diff, run the 4-file suite. Commit:
    `refactor(test): replace flushAll with async timer APIs in autosave hook test`.

- [ ] 1.2 `apps/web/src/components/lead/lead-form.test.tsx` —
      real-timer container test; Testing Library primitives.

  - Delete `flushAll` (lines 97–107) including the 3-round cascade
    comment; if the cascade explanation is still useful, move it to
    the harness JSDoc.
  - 15 call sites (lines 364–711): post-render drains →
    `await screen.findByText("Autosaved")` or
    `await waitFor(() => expect(cap.<x>Opts).toBeDefined())`;
    post-interaction drains → `waitFor` on the exact condition the
    next line asserts; negative DOM checks only AFTER a positive
    anchor has settled the UI.
  - Drop `act()` wrappers that contained only the drain; keep `act()`
    around clicks.
  - Assertions unchanged. Run file + 4-file suite, read the diff.
    Commit:
    `refactor(test): replace flushAll with findBy/waitFor in lead-form container test`.

- [ ] 1.3 `apps/web/src/components/lead/lead-form-addressable.test.tsx`
      — real-timer routing test.

  - Delete `flushAll` (lines 88–94).
  - 5 call sites (lines 319, 339, 363, 402, 427). Redirect tests →
    `await waitFor(() => expect(replace).toHaveBeenCalledWith(...))`.
    The 2 NEGATIVE sites need a positive anchor FIRST (a bare or
    waitFor-wrapped negative is vacuous): "addressed route, no
    redirect" (negative at line 367) → `findByText` on rendered
    section content (e.g. project name), then
    `expect(replace).not.toHaveBeenCalled()`; "head session redirect"
    (negative at line 406) → `waitFor` on `replace` called with the
    `/head/...` path, then
    `expect(byPeriodQuery).not.toHaveBeenCalled()`.
    `document.title` test (line 427 site) →
    `await waitFor(() => expect(document.title).toContain("Week 15"))`
    then the remaining `toContain` lines unchanged.
  - Run + suite + diff. Commit:
    `refactor(test): replace flushAll with anchored waits in lead-form addressable test`.

- [ ] 1.4 `apps/web/src/components/lead/lead-form-viewmode.snapshot.test.tsx`
      — pre-extract snapshot for the future lead-form decomposition;
      assertions and snapshot stay byte-identical.
  - Delete `flushAll` (lines 172–178). Replace `await act(flushAll)`
    (line 205) by making the first query a findBy:
    `const editLink = await screen.findByRole("link", { name: /^Edit$/i });`
    (findBy is act-wrapped by RTL — no `act` wrapper needed);
    subsequent `getBy`/`queryBy` calls unchanged.
  - Remove the now-unused `act` import (`unused-imports` is
    error-level and will enforce this).
  - Run + suite + diff. Commit:
    `refactor(test): replace flushAll in view-mode snapshot test; drop unused act`.

## 2. Verification (record exact commands + results inline)

- [ ] 2.1 Structural: `grep -rn "flushAll" apps/web/src` → zero
      matches; `grep -rn "await Promise.resolve" apps/web/src
--include="*.test.*"` → no tick loops remain.
- [ ] 2.2 Suite stability: from `apps/web`, run
      `npx vitest run src/hooks/use-lead-form-autosave.test.tsx src/components/lead/lead-form.test.tsx src/components/lead/lead-form-addressable.test.tsx src/components/lead/lead-form-viewmode.snapshot.test.tsx`
      3x consecutively → 34 pass / 0 fail each run (real-timer waitFor
      flake check). Scan vitest stderr: no NEW "not wrapped in act"
      warnings.
- [ ] 2.3 Negative-assertion integrity spot-check (manual, NOT
      committed): temporarily invert one migrated negative site (e.g.
      make the head-session test's `byPeriodQuery` fire) and confirm
      the test FAILS — proves the anchored wait still guards the
      behavior; revert.
- [ ] 2.4 No production code touched: `git diff --stat` across the
      change's commits shows only the 4 test files plus
      `openspec/changes/refactor-test-timer-helpers/**`;
      `apps/web/src/hooks/use-lead-form-autosave.ts` and
      `apps/web/vitest.setup.ts` unchanged.
- [ ] 2.5 Full gates:
      `pnpm typecheck && pnpm lint && pnpm test && pnpm build` —
      all green; record results here.
