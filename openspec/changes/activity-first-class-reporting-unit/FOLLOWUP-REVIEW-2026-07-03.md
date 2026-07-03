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

## Deferred to a follow-up (documented so they are not lost)

- **#1 (HIGH) — decision authoring parity.** The Decision edit dialog
  (`decision-edit-dialog.tsx`) still offers only product parents, so a lead
  cannot scope a NEW decision to an activity. The capability exists end-to-end
  otherwise (backend persists activity-parented decisions via the widened
  `decisionsToSave`; the seed creates them; the head report renders them). Only
  the lead-authoring UI is missing. FIX: wire the same `ParentPicker` +
  activity-parent handling that `item-edit-dialog.tsx` / `risk-edit-dialog.tsx`
  already use (thread the section's `activities`, hide stages + emit `activityId`
  for an activity parent). This completes Decision 0.4 (full parity).

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

- **#6 (LOW) — slide-pill ARIA.** `slide-activity-pills.tsx` groups pills under a
  role-less `<div>`, so `role="listitem"` pills are no longer direct children of
  `role="list"` (trips aria-required-children). FIX: give each status group its
  own `role="list"` + aria-label, or flatten.

- **#7 (LOW) — feedback label.** `mapLeadReviewFeedback` (`lib/mappers/lead-form.ts`)
  labels an activity-parented record "Unknown" (resolves via product name only).
  FIX: branch on the activity parent and use the activity name.
