# ADR 0003 — Lead slides may show co-owners' records in "Everyone"

- Status: Accepted
- Date: 2026-06-19
- Change: `slides-record-visibility`

## Context

`scope-lead-report-to-own-contribution` deliberately scoped the lead slide deck
to the lead's **own** records. Only the anonymized, risk-derived foreign
**status** was folded into product health (`applyForeignProductHealth`); no
foreign item/risk/decision text or counts ever reached the deck. The edit form
later gained a Mine/Everyone record-visibility toggle, but slides stayed
own-only, so the deck could not present the full team picture on shared
products.

Live-demo feedback (2026-06-18): when presenting, the lead wants the deck to read
as the full shared workload on co-owned products, not just their own rows.

## Decision

In the slide deck's **Everyone** state, merge co-owners' cross-author content
(items / risks / decisions on shared products) into the slide grids and KPI
counters. **Mine** keeps the own-only behavior. This reverses the slides-only
clause of `scope-lead-report-to-own-contribution`.

The reversal is made safe by four constraints:

1. **View-only.** Everyone in slides never feeds a draft, submission, published
   snapshot, or export/PDF. The merge happens at the **slide-model layer**
   (`mergeForeignSlideContent`), producing new `SlideProduct` / `SectionSlideModel`
   objects, and never mutates the cached `ReportSectionReadModel` that the
   lead-form draft serializes (`byPeriodQ.data.section`). A unit test pins that
   the input section is reference-unchanged after the merge.
2. **Own-deck only.** Everyone — and the cross-author health fold — apply only
   to the lead's own deck. On a foreign `authorId` deck the toggle is forced to
   Mine, the gated content fetch does not fire, and `applyForeignProductHealth`
   is skipped, so the current user's co-owner data is never mixed onto another
   author's deck.
3. **Gated + purged like edit.** The full-content read fires only after the
   persisted visibility hydrates, only in Everyone, only on the own deck; the
   cache is purged on leaving Everyone and on identity/report change.
4. **No new health-vs-count divergence.** Foreign records count by the exact
   same rules as own records; health stays risk-derived in both modes. Foreign
   rows are excluded from priority ranking (the client content mirror drops
   `priorityRank`), folding only into grids and the blocked/at-risk counters.

## Consequences

- The slide deck is a richer presentation surface on shared products without
  changing any persisted or exported data.
- The own-contribution scoping principle still holds for everything that leaves
  the view layer; only the live deck render is broadened, and only in Everyone.
- Foreign rows render as plain bullets (no per-row visual "foreign" marker): the
  slide grids are flat text arrays, and the spec contract requires only that the
  rows and counts appear, not that they are visually attributed. A per-row
  marker would require restructuring the slide row types and is deferred.
