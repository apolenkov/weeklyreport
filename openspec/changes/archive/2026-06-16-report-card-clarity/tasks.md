# Tasks: report-card-clarity

## 1. Stage chip → identity; status → stripe

- [x] 1.1 Remove `ITEM_STATUS_BADGE`-driven fill from the stage chip; render the
      chip with one uniform identity treatment (stage + initials).
- [x] 1.2 Add the workflow-status signal on the row (left stripe / marker) driven
      by `item.status` via named `--color-*` tokens (red = blocked only).
- [x] 1.3 Update/refresh any chip snapshot/tests to the identity treatment.

## 2. Needs-Attention dedup guard

- [x] 2.1 Suppress the banner when its text matches a rendered item's text.
- [x] 2.2 Test: duplicate escalation → no banner; distinct escalation → banner.

## 3. By-lead per-lead slice

- [x] 3.1 In "by lead" scope, slice each product to the lead's own
      items/risks/decisions/stages before building the card.
- [x] 3.2 Keep "by product" aggregate path unchanged.
- [x] 3.3 Test: lead with two products → two scoped cards; multi-author product →
      no cross-author mixing under a lead.

## 4. Stage options scoped to product

- [x] 4.1 In add-item / add-risk dialogs, derive stage options from the selected
      product (author's owned stages), not the full SDLC list.
- [x] 4.2 Test: single-stage product → one option; two-stage product → both.

## 5. Scannability pass (frontend-design)

- [x] 5.1 Apply the frontend-design guidance: hierarchy via typography/spacing,
      remove competing fills, red as the only alarm hue.
- [x] 5.2 Verify against the `small` demo dataset.

## 6. Sign-off gate + verify

- [x] 6.1 Attach same-viewport before/after product-card screenshots; cite this
      grill sign-off (status-color-semantics requirement).
- [x] 6.2 Full gate green (`prisma generate && typecheck && lint && test && build`).
