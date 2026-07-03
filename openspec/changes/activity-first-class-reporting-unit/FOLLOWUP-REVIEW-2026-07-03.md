# Deferred review findings — activity-first-class (2026-07-03)

The epic landed green + live-verified (head report renders activities as
product-like cards with records + linked products + risk-derived status;
dashboard shows the severity-free Activities count). Two adversarial review
Workflows (backend + UI, each finding verified) surfaced 9 findings. Fixed:

- Backend: `fillFromSection` did not preserve `activityId` → an activity record
  tripped the XOR CHECK and 500'd the whole Fill From (fixed in the epic commit).
- UI #3/#4 (HIGH): the activity pill gated a manual lower on `derivedStatus`
  (which folds in the lead's own stored choice) → a lead who set an activity red
  with no covering risk was falsely refused. Fixed via a record-only `alarmFloor`
  (commit `cdf2b4a`).
- UI #2 (MEDIUM): the risk dialog's "Already flagged in SDLC pipeline" strip
  showed the seed product's stages, mislabelled with the activity name, after
  switching the parent to an activity. Fixed (commit `bb9219d`).

## Fixed in the follow-up (2026-07-03, commit — see git log)

- **#1 (HIGH) — decision authoring parity.** DONE. The Decision dialog now
  threads the section's `activities` and offers them in the `ParentPicker`;
  choosing an activity hides the stage step and emits an activity-parented
  payload (empty `productId`, `activityId` set, no stage). Shared helpers
  extracted to remove the three-way duplication the review would flag:
  `resolveRecordParent` (record-parent.ts, used by item/risk/decision) and
  `RecordStageStep` (record-stage-step.tsx, used by item/decision). Covered by
  a new activity-parent test mirroring the item dialog's. `decision-edit-dialog`
  joined the justified-permanent max-lines exempt (parity with item/risk — all
  three are one cohesive create/edit dialog; a single-use split would fragment
  it). Completes Decision 0.4.
- **#6 (LOW) — slide-pill ARIA.** DONE. Each status cluster in
  `slide-activity-pills.tsx` is now its own `role="list"` (aria-labelled by
  status); the outer wrapper is `role="group"`. `role="listitem"` pills are
  again direct children of a list (fixes aria-required-children).
- **#7 (LOW) — feedback label.** DONE. `mapLeadReviewFeedback` builds an
  activity-name index and resolves an activity-parented record's label from it
  (product name wins when present, else activity name, else "Unknown").

## Still deferred (documented so they are not lost)

- **#5 (HIGH, rare) — activity-only-period empty-state.** A reporting period with
  activity content but ZERO product content anywhere is swallowed by the head
  report's "No submissions yet" empty-state and cannot publish, because
  `hasAnyContent = fullProducts.some(reportHasContent)`
  (`weekly-report-page.tsx` `buildAccordionModel`) counts only product content.
  A naive `|| hasActivityContent` OR broke 23 weekly-report tests — the fix must
  respect the submitted-only filter and the draft-signal state machine (the
  §7 "Submitted/All filter + anti-empty-state" tests encode it). FIX PROPERLY:
  compute activity content per the SAME submitted filter as products (submitted
  sections' attached activities), fold it into `hasAnyContent` AND the
  draft-signal branch, and update the §7 fixtures/tests. Only triggers on an
  all-activity report, so low practical urgency but a real gap in Decision 0.2.
  This is the LAST finding blocking the epic's archive.
