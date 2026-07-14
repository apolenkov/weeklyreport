## 1. Clear stale "Saved" on any exit from the saved state

- [ ] 1.1 `apps/web/src/shared/ui/report-shell/save-now-button.tsx`: in the
      `useEffect` at lines 59-70 (keyed `[state, isInFlight]`), add an
      `else` branch (or a second effect) that runs when `state !== "saved"`:
      `setShowSaved(false)` and, if `revertTimerRef.current !== null`,
      `clearTimeout` it and null the ref
- [ ] 1.2 Confirm this closes the archived `web-polish-lows` task 5.1 gap
      generically (covers both a new edit → `"pending"` and a save failure →
      `"error"`, not only the failure case its scenario illustrated)

## 2. Preservation test for the refuted "stuck Pending" claim

- [ ] 2.1 `apps/web/src/hooks/use-lead-form-autosave.test.tsx` (verified
      present) (or the
      relevant `LeadForm` integration test if the priming effect is easier
      to exercise there): add a test that renders with `initialSavedKey`
      already equal to the first computed `payloadKey`, and asserts the
      resulting `state`/`dirty` is `idle`/`false` on the very first render —
      never `pending`
- [ ] 2.2 Do NOT modify `use-lead-form-autosave.ts`'s priming effect
      (lines 132-139) or `dirty` derivation in this change — task 2.1 exists
      to catch a future accidental "fix" here, not to change current
      behavior

## 3. Regression test for the confirmed stale-"Saved" bug

- [ ] 3.1 `apps/web/src/shared/ui/report-shell/save-now-button.test.tsx`:
      add a test — render with `autosave.state: "saved"`, advance past the
      point `showSaved` becomes `true`, then re-render with
      `autosave.state: "pending"` before `SAVED_REVERT_MS` elapses; assert
      the check icon/"Saved" label is gone synchronously (no need to advance
      fake timers further)
- [ ] 3.2 Confirm the existing idle/pending/saving/error/saved render
      assertions in the same file still pass unmodified

## 4. Spec delta

- [ ] 4.1 `web-polish-lows`: MODIFIED — tighten "The save-now button clears a
      stale 'Saved' state immediately on exit" to state the general trigger
      (any transition away from `"saved"`, edit or failure) explicitly, and
      add the clean-load non-regression scenario so the refuted sub-claim (a)
      stays pinned alongside the fix for (b)

## 5. Gates and verification

- [ ] 5.1 `pnpm --filter @customreport/api db:generate`
- [ ] 5.2 `pnpm typecheck && pnpm lint && pnpm test`
- [ ] 5.3 Confirm task 2.1's preservation test fails if someone reverts the
      `initialSavedKey` priming effect — run it against a deliberately
      broken local copy once, then restore, to prove it actually pins the
      behavior (do not commit the broken copy)
- [ ] 5.4 `openspec validate lead-form-save-indicator-truth --strict`
