# Tasks

## 1. Characterization / regression pins (write first, against current behavior)

- [ ] 1.1 In `apps/web/src/hooks/use-lead-form-autosave.test.ts` (create if it
      does not exist), add a test that calls `stableStringify` with two
      payloads identical except for one `Date`-typed field (e.g.
      `{ deadline: new Date("2026-01-01") }` vs
      `{ deadline: new Date("2026-02-01") }`) and asserts the two keys are
      **different**. Run it against the current code first to confirm it
      fails (proves the `{}` collapse), then leave it in place as the
      post-fix regression pin.
- [ ] 1.2 In `lead-form-draft-reconcile.test.ts`, add a test building two
      decisions with identical `text` but different `deadline` `Date`s and
      assert `reconcileSavedIdentities` does not swap their identities (each
      keeps the `id`/`stableId` matching its own deadline). Confirm it fails
      on current code, then keep as the regression pin.

## 2. Missing coverage (independent of the fix, fill the gap the review found)

- [ ] 2.1 Add a test for `findSavedRecord`'s `stableId`-match branch: a
      persisted record carrying a `stableId` resolves directly via
      `saved.find(candidate => candidate.stableId === record.stableId)`,
      bypassing the content-key path.
- [ ] 2.2 Add a test for the duplicate-occurrence indexing: two persisted
      records sharing the same content key (no `stableId`) resolve to
      distinct saved records by occurrence order (first persisted -> first
      saved match, second persisted -> second saved match).
- [ ] 2.3 Add `reconcileSavedIdentities` coverage for the `risks` and
      `decisions` collections (currently only `items` is exercised), mirroring
      the existing items test shape.

## 3. Fix

- [ ] 3.1 In `stableStringify` (apps/web/src/hooks/use-lead-form-autosave.ts),
      add a branch before the generic object case: if `value instanceof Date`,
      return `JSON.stringify(value.toISOString())`. Keep the rest of the
      function (array handling, sorted-key object handling) unchanged.
- [ ] 3.2 Re-run the tests from Task 1 — both should now pass (keys differ,
      no identity swap). No production code change is expected in
      `lead-form-draft-reconcile.ts` itself; `recordContentKey` inherits the
      fix through `stableStringify`.
- [ ] 3.3 Re-check `initialSavedKey` callers (anywhere a caller pre-computes
      a baseline key with its own serialization) for parity with the new
      `Date` handling — grep `stableStringify(` call sites and confirm no
      caller does its own ad hoc Date-to-string conversion that would now
      disagree with the hook's key.

## Gates

- pnpm typecheck
- pnpm lint
- pnpm test
