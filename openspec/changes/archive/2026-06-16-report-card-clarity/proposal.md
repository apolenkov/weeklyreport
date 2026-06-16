# Proposal: report-card-clarity

## Why

On the head report, a product card is hard to scan: the stage chip carries two
meanings at once (its text is the SDLC stage + lead, its fill encodes the item's
workflow status — completed renders dark, in-progress light), so the dark/light
difference reads as unexplained. The "Needs Attention" banner repeats a blocked
item verbatim. And grouping "by lead" shows the full cross-author product card
under every lead who touched it, mixing authors. The presenter's bar: "look at a
product card and understand everything," not garish.

## What Changes

- **Stage chip becomes an identity label only** — uniform treatment naming the
  stage (and contributing lead's initials). The item's **workflow status** moves
  to a separate, explicit signal (the row's left stripe / a dedicated marker),
  so one control carries one meaning.
- **Needs Attention is de-duplicated** — the banner is suppressed (or condensed)
  when its text matches an item already shown in the card; the escalation concept
  stays as a distinct head-facing call-out.
- **"By lead" scope slices each product to that lead's own contribution**
  (their items / risks / decisions / stages); "by product" stays the full
  cross-lead aggregate.
- **Add-item / add-risk stage options depend on the selected product** — only the
  stages relevant to that product (the author's owned stages) are offered.
- **Visual pass for scannability** via the frontend-design guidance — less
  garish, clear hierarchy, the card readable at a glance.

## Capabilities

- `report-card-clarity` (new) — card dedup, by-lead slice, stage-scoped add,
  scannable layout.
- `status-color-semantics` (modified) — the stage chip is an identity surface,
  not a status surface; item workflow status renders on the row stripe.

## Impact

- `apps/web/src/components/weekly-report/product-accordion.tsx` — chip → identity;
  status → stripe; needs-attention dedup guard.
- `apps/web/src/components/weekly-report/weekly-report-page.tsx` +
  `lib/mappers/weekly-report-groupers.ts` — by-lead per-lead product slice.
- Lead add-item / add-risk dialogs — stage options scoped to the selected product.
- `openspec/specs/status-color-semantics/spec.md` — modified requirement.
- Depends on `demo-seed-datasets` (small tier) for realistic verification data.
- Palette-application change → per `status-color-semantics`, cite this grill
  sign-off and attach before/after screenshots before archive.
