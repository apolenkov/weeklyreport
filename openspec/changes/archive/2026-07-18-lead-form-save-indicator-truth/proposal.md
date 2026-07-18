## Why

BL-08 (P1), `docs/reviews/repo-excellence-review-2026-07-14.md`, "Orchestrator
amendments" section (normative, overrides the earlier BL-08 table row and the
raw JSON finding, both of which still carry the unrefined two-part claim).

**Important finding surfaced while researching this change**: sub-claim (b)
is not a fresh gap. `openspec/specs/web-polish-lows/spec.md` already carries
a requirement — "The save-now button clears a stale 'Saved' state immediately
on exit" — added by the archived change `2026-07-13-web-polish-lows`, whose
own `tasks.md` item 5.1 ("add an effect... that sets `showSaved` to `false`
synchronously whenever `state` is no longer `"saved"`") was **left unchecked
(`- [ ]`)** at archive time. Reading the live source
(`apps/web/src/shared/ui/report-shell/save-now-button.tsx`, lines 59-70)
confirms the effect was never added: there is no branch that clears
`showSaved` or the revert timer when `state` transitions away from `"saved"`.
The spec was archived as accepted with its implementing task incomplete — a
spec-vs-code regression, not a new discovery. This change closes that gap
rather than re-proposing a duplicate requirement.

## What Changes

- `apps/web/src/shared/ui/report-shell/save-now-button.tsx`: in the existing
  `useEffect` keyed on `[state, isInFlight]`, add the missing branch — when
  `state !== "saved"`, synchronously `setShowSaved(false)` and clear
  `revertTimerRef` if a timer is pending. This closes the gap generically
  (any transition away from `"saved"` — a new edit going to `"pending"`, or a
  failure going to `"error"`), matching the existing spec's general wording
  rather than only its save-failure illustration.
- No change to `use-lead-form-autosave.ts`'s `initialSavedKey` /
  `lastSavedRef` priming effect (lines 132-139) — see Non-goals.

## Claim disposition

| Sub-claim                                                                       | Disposition                                | Notes                                                                                                                                                                                                                                                                                                                                        |
| ------------------------------------------------------------------------------- | ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| (a) freshly-primed lead form shows false "Pending" on clean load                | **Refuted** (GLM, orchestrator amendments) | `initialSavedKey` primes `lastSavedRef` in its own effect before `dirty` is read; `dirty = payloadKey !== lastSavedRef.current` evaluates `false` once primed, in the same effect batch. No stuck-pending state exists in the current code.                                                                                                  |
| (b) stale "Saved" persists over a new edit made within the 1500ms revert window | Confirmed                                  | `save-now-button.tsx`'s revert effect has no branch clearing `showSaved`/the timer when `state` leaves `"saved"`; `deriveSaveView`'s `showSaved` branch renders the green check even while `state` is actually `"pending"` with unsaved edits. Also the un-implemented half of the already-archived `web-polish-lows` requirement — see Why. |

## Non-goals

- **Do not touch `use-lead-form-autosave.ts`'s priming effect** (the
  `initialSavedKey` → `lastSavedRef` effect, lines 132-139, or the `dirty`
  derivation). Sub-claim (a) is refuted; "fixing" a non-bug here risks
  reintroducing a real stuck-pending state where none exists today. A
  preservation test (task 2.x) pins the current clean-load behavior so a
  future edit cannot silently regress it while working on sub-claim (b).
- No change to the 1500ms `SAVED_REVERT_MS` timer duration, and no change to
  `deriveSaveView`'s branching order.
- No change to `lead-form-header-actions.tsx` — it consumes `AutosaveSnapshot`
  read-only and is not implicated by either sub-claim.

## File manifest

- `apps/web/src/shared/ui/report-shell/save-now-button.tsx` (source, verified present, 206 lines — effect at lines 59-70)
- `apps/web/src/shared/ui/report-shell/save-now-button.test.tsx` (test, verified present — existing suite covers idle/pending/saving/saved/error render states but has no assertion for "edit interrupts the saved-revert window")
- `apps/web/src/hooks/use-lead-form-autosave.ts` (read-only reference for the priming effect being preserved, not edited — 332 lines)
- `apps/web/src/hooks/use-lead-form-autosave.test.tsx` (test, verified present — preservation-only; add the clean-load pin here if the existing suite doesn't already cover it)

## Verification

- Full gate: `pnpm --filter @customreport/api db:generate && pnpm typecheck && pnpm lint && pnpm test`
- Unit tests (jsdom, fake timers):
  1. **Regression test for (b)**: render `SaveNowButton` with `state: "saved"`
     (showSaved becomes `true`), then re-render with `state: "pending"`
     before the 1500ms timer fires — assert `showSaved` becomes `false`
     synchronously (button no longer shows the check icon / "Saved" label)
     without waiting for the timer.
  2. **Preservation test for refuted (a)**: render the autosave hook (or
     `LeadForm` integration) with `initialSavedKey` equal to the first
     computed `payloadKey` — assert `state` is `"idle"`/`dirty: false` on the
     very first render, never `"pending"`. This pins GLM's refutation so a
     future edit cannot silently "fix" a non-bug and reintroduce a real
     stuck-pending regression.
  3. Existing state-render assertions (idle/pending/saving/error/saved) in
     `save-now-button.test.tsx` continue to pass unmodified.
- Pure view-model/effect logic — no live-browser drive step required beyond
  the standard unit suite; this is timer + state-derivation logic, not
  popup/focus/scroll/route behavior.

## Sequencing

Independent — touches only `save-now-button.tsx` and its test file, and a
preservation test in the (untouched) autosave hook's suite. No dependency on
`lead-draft-save-integrity` (BL-01, different file:
`use-lead-form-draft-orchestration.ts`'s reseed effect) or any other backlog
item. Can land in any order relative to the rest of this batch.
