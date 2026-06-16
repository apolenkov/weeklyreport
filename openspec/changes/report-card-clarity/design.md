# Design: report-card-clarity

## Root causes (verified in code)

- **Chip dual-meaning** — `product-accordion.tsx` renders the chip text as
  `item.stageLead` (stage + initials) but colors it via
  `ITEM_STATUS_BADGE[item.status]` (completed → dark primary fill, in-progress →
  light success fill). Text says "stage", color says "workflow status" → the
  dark/light reads as unexplained.
- **Needs-Attention duplicate** — escalations are DERIVED from blocked items by
  `buildEscalationsFromReadSections` (one escalation per blocked item, carrying
  that item's text). `findNeedsAttention` surfaces it as the banner, so the banner
  is STRUCTURALLY the blocked item's text — not a seed wording accident. The fix
  lives here: suppress the banner when its text equals an item already rendered in
  the card, OR reshape the escalation into a non-duplicate summary (e.g.
  "Blocked · <stage> · <lead>"). Preferred: the dedup guard, optionally with a
  short summary form.
- **By-lead mixing** — `weekly-report-page.tsx` buckets each full product card
  under every lead in `authorIds`, so the whole cross-author card repeats.

## Approach

1. **Chip → identity.** Stop mapping `item.status` to the chip fill. The chip
   uses one uniform identity token treatment (stage + initials). Move the
   workflow-status signal to the row's left stripe / a small marker, driven by
   `item.status` through named tokens (red only for blocked, amber stripe for
   at-risk — consistent with the existing memo direction in the file).
2. **Needs-Attention dedup guard.** In the card, suppress the banner when its
   text equals a rendered item's text (belt-and-suspenders on top of the seed
   wording the escalation distinctly).
3. **By-lead slice.** In "by lead" scope, slice each product to the lead's own
   section: filter items/risks/decisions/stages to that lead's `authorId` before
   building the per-lead product card. "By product" keeps the aggregate path
   unchanged (cheap default).
4. **Stage options by product.** In the lead add-item / add-risk dialogs, derive
   the offered stage set from the selected product. There is no first-class
   ownership entity, so "owned stages on a product" is defined as the stages the
   lead has declared a `StageStatus` for on that product (their reported coverage);
   if the lead has none yet for that product, fall back to the full SDLC list.
5. **Scannability pass.** Apply the frontend-design guidance: hierarchy via
   typography/spacing, remove competing fills, keep red as the only alarm hue.

## Decisions

- The stage chip keeps the lead initials ("Stage · ВИ") — on a multi-lead product
  the contributor matters; only the color meaning is removed (user sign-off,
  this grill).
- No schema change; the by-lead slice is a mapper/filter concern, not a data
  model change.

## Verification & sign-off (status-color-semantics gate)

This change edits status-color application, so per `status-color-semantics` it
MUST cite the authorizing sign-off (this grill session, 2026-06-16) and attach
same-viewport before/after screenshots of a product card before archive.

## Out of scope

- Toolbar styling and the toggle→item bug (→ `toolbar-polish`).
- Seed content (→ `demo-seed-datasets`).
