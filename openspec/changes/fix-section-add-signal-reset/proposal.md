# Fix Stale Add-Signal Dialog Reopen in Risks and Decisions Sections

## Why

On the lead report page, a lead who clicks "+ Add Risk" (or "+ Add
Decision"), cancels the dialog, views a snapshot, and clicks "Back to
current" gets the create dialog reopened uninvited. The 2026-06-10
architecture re-verification (dossier `dialog-lifecycle`, HEAD
`85541470`) confirmed this as a live violation of the durable spec
`openspec/specs/lead-report-controls-integrity/spec.md`: "A view-state
transition MUST NOT open any dialog" and imperative open signals "MUST
be reset when the surface enters a read-only view".

Two of the four section copies received the D1 fix in `ba3adf1d`; risks
and decisions did not:

- `risks-section.tsx:136-144` — addSignal effect keeps `readOnly` in
  its deps (`[addSignal, readOnly, firstProductId]`), no `readOnlyRef`;
  the readOnly false→true→false snapshot round-trip re-fires it with a
  stale non-zero signal.
- `decisions-section.tsx:160-164` — same bug, deps
  `[addSignal, readOnly]`.
- `lead-form.tsx:1593-1598` — the `onViewVersion` reset clears only the
  current/next-week counters; the risks/decisions counters (declared at
  lines 650-653) stay stale.
- Donor pattern already shipped: `current-week-section.tsx:137-143`
  (readOnlyRef) and `next-week-section.tsx:88-89`.

## What Changes

About 10 lines of production code, plus regression tests:

1. Replicate the D1 `readOnlyRef` pattern verbatim from
   `current-week-section.tsx` in `risks-section.tsx` and
   `decisions-section.tsx`: guard the effect body with
   `readOnlyRef.current`, drop `readOnly` from the dep arrays.
2. Extend the `onViewVersion` reset in `lead-form.tsx` with
   `setRisksAddSignal(0)` and `setDecisionsAddSignal(0)`.
3. Regression tests written first, mirroring the 4-step scenario of
   `current-week-section-add-signal.test.tsx`: fail at HEAD, pass after
   the fix.

No spec delta: this change RESTORES compliance with the existing
`lead-report-controls-integrity` requirement "View-state transitions
never open dialogs", which is the acceptance contract.

## Sequencing

Wave 0 — implement immediately: this is a live durable-spec violation
(returning from snapshot view with a stale non-zero addSignal reopens
the Risk/Decision create dialog). Coordinate with the active
`require-risk-stage` change: its tasks touch the `risks-section.tsx`
display block, while this fix is ~10 lines confined to the addSignal
effects — land this change first so `require-risk-stage` rebases
trivially.

## Non-goals

- Dialog-lifecycle consolidation (`useEditableListDialog` hook, D12
  dialog shells, key unification) — that is
  `refactor-lead-dialog-lifecycle`, a separate change.
- Closing the latent seed-deps re-fire channel (stale signal +
  products-list change re-firing via `firstProductId`) — an explicit,
  tested decision deferred to the refactor change.
- Any `lead-form.tsx` decomposition (gated by
  `architecture-refactor-backlog`); only ~4 lines touched there.

## Impact

- `apps/web/src/components/lead/risks-section.tsx`,
  `decisions-section.tsx` (addSignal effects only).
- `apps/web/src/components/lead/lead-form.tsx` (counter reset, ~4
  lines).
- Two new regression test files beside the sections.
