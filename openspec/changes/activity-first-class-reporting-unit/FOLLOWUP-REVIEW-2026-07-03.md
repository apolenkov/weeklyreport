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

## Fixed — #5 core (2026-07-03)

- **#5 (HIGH, rare) — activity-only-period empty-state.** DONE (Gate 1). The
  "truly empty period" gate `hasAnyContent` now folds in activity content:
  `fullProducts.some(reportHasContent) || leadSections.some(sectionHasActivityContent)`
  (`weekly-report-page.tsx`). `sectionHasActivityContent` mirrors
  `reportHasContent`'s strictness — a section has activity content only when a
  lead TOUCHED an attached activity (non-null derived-or-stored status, or ≥1
  owned record), never a merely-attached, untouched activity (that would make
  the empty-state dead in production). This fixes the reported bug — an
  all-activity SUBMITTED period ("cannot publish" ⇒ submitted) now renders the
  activity strip and unblocks Publish & Lock (`canPublishReport = submitted > 0
&& hasAnyContent`). New regression test asserts: no empty-state, strip renders,
  publish enabled. Full `weekly-report-page.test.tsx` (31) green — the earlier
  23-test break did NOT recur.

## Known minor edge — Gate 2 (deferred, NOT archive-blocking)

- The draft-signal (`draftCount` / `mapWeeklyReportLeadGroups`) is unchanged, so
  an activity-only DRAFT period viewed under the submitted-only default shows a
  sparse body (no strip, no "N in draft — Show all") rather than the signal.
  This is doubly-rare (activity-only AND all-draft AND submitted-view), produces
  only a sparse body — never a wrong publish or data loss — and touching the
  `draftCount` coupling is exactly where the 23-test break lived. Left as a
  documented follow-up: fold activity content into the draft-signal branch with
  its own §7 fixture/test, separately from the archive.
