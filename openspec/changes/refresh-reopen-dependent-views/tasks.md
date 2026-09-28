## Implementation

- [x] 1. Refresh dependent live report reads after reopen decisions on both surfaces.
- [x] 2. Add regression coverage for settled success and failure without losing response drafts.

## Verification

- [x] 3. Verify the original native dashboard reproduction and the lead's editable report after approval.
      Evidence: `acceptance-current-20260913.json` records the local submit →
      reopen request → head dashboard approval without navigation; the dashboard
      changed from `3/8, 1 pending, Submitted/Review` to `2/8, 0 pending,
In progress/Open`, and lead1 then observed `Draft saved` with Save/Add/
      Submit controls and no Request Reopen action.
- [ ] 4. Complete independent review and final format, lint, typecheck, test, build, and spec checks on the resulting sources. Historical evidence: `refresh-reopen-dependent-views-review.json` records a fresh independent read-only review (accept with findings; P0/P1 = 0, three P2 with dispositions: one documented limitation, one rejected because `openspec/changes/archive` is a forbidden path, one residual coverage risk) and points at the repo-wide `ACTIVITY-TITLE-FINAL-GATES.json` for the format/lint/typecheck/test/build/spec proof on the same staged source identity, including the change's own three test files at 29 tests passing. Current 2026-09-16 status is open: `pnpm spec:reticle` fails deterministic proof, so the historical `pnpm spec:check` evidence is not current acceptance.
