## Why

BL-01 (P0), `docs/reviews/repo-excellence-review-2026-07-14.md`, "Orchestrator
amendments" section (normative, overrides the earlier BL-01 table row).

The review's original BL-01 write-up bundled two claims under one "silent
data loss" headline. The amendments correct the framing:

- **In-flight reseed race (P0, the actual headline).** In
  `useLeadFormDraftOrchestration`
  (`apps/web/src/features/report-sections/ui/use-lead-form-draft-orchestration.ts`),
  the reseed effect (lines 39-55) calls `setDraftSection(serverSection)`
  whenever the server's stable draft-payload key differs from the last one
  seen — with no check for local unsaved edits. Sequence: lead is typing,
  autosave's debounced mutation fires and starts saving what was typed _so
  far_; the lead keeps typing during the round trip; the mutation's
  `onSuccess` (`apps/web/src/hooks/use-lead-form-autosave.ts` lines 143-160)
  stamps `lastSavedRef` to the in-flight payload and invalidates
  `leadForm.byPeriod`, triggering a refetch; the refetched `serverSection`
  reflects only the in-flight (pre-keystroke) payload, so its draft-payload
  key differs from `lastServerDraftKeyRef.current` and the reseed effect
  overwrites `draftSection` with that stale server content — discarding the
  keystrokes typed during the round trip. Because `lastSavedRef` in the
  autosave hook was already stamped to that same (now-restored) content,
  `dirty` reads `false` afterward, so no follow-up autosave ever recovers the
  discarded edits. Nothing in the UI signals this — no toast, no dirty
  indicator, no diff.
- **Risk-impact filter gap (hardening, not headline).** In
  `sectionToDraftPayload`
  (`apps/web/src/features/report-sections/model/lead-section-draft-payload.ts`),
  the `risks` filter (line 60) checks `hasText(r.risk) && hasText(r.mitigation)`
  but omits `hasText(r.impact)`, unlike the `decisions` filter (line 73) which
  checks all three of its required fields. A risk with a whitespace-only
  `impact` rides the all-or-nothing draft-save payload; the server's
  `safeText({min:1})` refinement rejects the whole section save. This IS
  surfaced: the mutation's `onError` path (`use-lead-form-autosave.ts` lines
  182-195) sets `state: "error"` and shows a `toast.error`, and the draft
  stays dirty (unsaved edits are never silently discarded by this path — the
  save simply fails loudly and repeatedly until the bad row is fixed or
  removed). This is a save-availability / annoyance bug (a whole section
  becomes unsavable because of one abandoned risk row), not a silent-loss
  bug. It ships as a small hardening fix alongside the P0, not as a second
  headline claim.

## What Changes

- The draft-reseed effect MUST NOT silently discard local unsaved edits. When
  the local draft has unsaved edits (autosave-dirty) and the incoming server
  section differs only because it echoes back the save that is currently (or
  was very recently) in flight, the hook MUST reconcile the optimistic-lock
  `version` from the server response without replacing the `draftSection`
  the lead is actively editing. A genuinely external change (edited by
  someone else) arriving while the draft is dirty MUST NOT silently
  overwrite the draft either — it MUST route through the existing
  conflict/reload toast instead, so the lead is told, not left to discover
  missing edits later. A clean (non-dirty) draft still reseeds silently, as
  before — this change narrows the reseed's blind spot for dirty drafts, it
  does not remove reseeding altogether.
- Server-assigned identifiers (e.g. a newly-persisted item's real `id`
  replacing a client-temp id) MUST still reach the local draft after a save,
  even when the reseed is otherwise suppressed for dirty state — the guard
  protects unsaved _content_, not id reconciliation.
- `sectionToDraftPayload`'s `risks` filter gains `&& hasText(r.impact)`,
  matching the `decisions` filter's three-field check, so a risk with a
  blank-looking impact is dropped from the payload (kept only in local UI
  state) instead of poisoning the whole section save.

## Claim disposition

| Sub-claim                                                                | Disposition                  | Note                                                                                                     |
| ------------------------------------------------------------------------ | ---------------------------- | -------------------------------------------------------------------------------------------------------- |
| In-flight reseed race discards keystrokes typed during a save round-trip | **Confirmed**                | P0 — the change's primary contract                                                                       |
| Reseed effect has no unsaved-edits guard at all                          | **Confirmed**                | mechanism behind the race above                                                                          |
| Blank-impact risk causes a "silent" full-section data loss               | **Refuted** (per amendments) | rejected save surfaces `toast.error` + `state:"error"`; draft stays dirty; nothing is silently discarded |
| Blank-impact risk should still be filtered out of the payload            | **Hardening-only**           | prevents an unrelated-edits save failure; not itself a silent-loss bug                                   |
| Fix scope includes reworking the whole autosave debounce/queue design    | **Non-goal**                 | see below                                                                                                |

## Non-goals

- Not reframing the risk-impact filter fix as "silent data loss" prevention
  in code comments, tests, or commit messages — it is a save-availability
  hardening fix. A test MUST pin that the rejected-blank-impact-risk path
  still produces a visible error toast and a dirty draft (see Verification),
  so a future edit cannot accidentally make that path silent and call it a
  regression fix for this change.
- Not touching `use-lead-form-autosave.ts`'s debounce, queue-drain, or
  version-bump machinery beyond what the reseed guard requires — those are
  working as designed per BL-08's (separate, already-narrowed) disposition.
- Not adding a merge/diff UI for conflicting edits — the fix is "don't
  discard," not "reconcile field-by-field." A genuine external edit still
  triggers the existing reload toast via `handleConflict`.
- Not changing the version tracking, submit, or fill-from write paths.

## File manifest

- `apps/web/src/features/report-sections/ui/use-lead-form-draft-orchestration.ts`
  — reseed guard against dirty local state.
- `apps/web/src/features/report-sections/ui/use-lead-form-draft-orchestration.test.ts(x)`
  — new/updated tests for the guard (create if it does not already exist;
  check first).
- `apps/web/src/features/report-sections/model/lead-section-draft-payload.ts`
  — add `hasText(r.impact)` to the risks filter.
- `apps/web/src/features/report-sections/model/lead-section-draft-payload.test.ts`
  — updated/added coverage for the risks filter (mirror the existing
  decisions-filter test).
- `apps/web/src/hooks/use-lead-form-autosave.ts` — read-only reference; only
  touch if the reconciliation needs a new signal (e.g. exposing `dirty` or
  the in-flight payload key) that the orchestration hook does not already
  have access to.
- `apps/web/src/hooks/use-lead-form-autosave.test.tsx` — add/confirm a case
  asserting a rejected blank-impact-style save produces a visible error
  toast and leaves the draft dirty (preservation test for the refuted
  "silent" framing).

## Verification

- `pnpm --filter @customreport/api db:generate`
- `pnpm typecheck && pnpm lint && pnpm test`
- Live browser drive (P0 bar — real React timing, not fake timers): from
  source (see project CLAUDE.md "Runtime" — docker images are stale), log in
  as a lead, open a report section with unsaved-changes potential, type a
  field, wait past the debounce so autosave starts, and _keep typing during
  the in-flight save_. After the save's refetch resolves, confirm the
  keystrokes typed during the round trip are still present in the field —
  not reverted. Repeat with a risk row whose impact is left whitespace-only:
  confirm the row is silently excluded from the network payload (inspect the
  request body) and the rest of the section still saves.
- `cd apps/api && pnpm test:integration` — not required by this change alone
  (no DB write-path or schema change), but run it if `saveDraft`'s Zod
  contract shape is touched incidentally.

## Sequencing

This change MUST land and be merged before any other change that touches the
lead-form draft pipeline (`use-lead-form-draft-orchestration.ts`,
`use-lead-form-autosave.ts`, `lead-section-draft-payload.ts`, or their
tests) — including `record-comment-save-coordination` (BL-09) and
`weekly-report-view-gaps` (BL-18), and any future `lead-form-*` refactor. Rationale: the
reseed-guard's precise placement (which state changes it must ignore vs.
honor) is the load-bearing invariant those changes will build on; landing
them first risks baking in assumptions this change then has to unwind.
