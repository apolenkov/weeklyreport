# status-slide-rendering — delta

## REMOVED Requirements

### Requirement: Decisions Slide Must Constrain Vertical Overflow

**Reason**: The auto-height canvas decision of 2026-07-05 removes internal max-height scroll containers; the slide grows with content and every decision renders in flow.
**Migration**: See `lead-slide-by-product-grid` — "Canvas is auto-height with a bounded width" (no clipping, no truncation; fullscreen scrolls).

### Requirement: Slide Card Density Tokens Are Consistent Across the Deck

**Reason**: The separate status/summary/decision slide cards are superseded by
the unified by-product `SlideArticle`; article density is now governed by
`lead-slide-by-product-grid`.
**Migration**: See `lead-slide-by-product-grid` — "One slide article renders
every deck slide".

### Requirement: Slide Cards Use Tight Density Defaults

**Reason**: The old per-card density defaults targeted deleted
`SummarySlide`/`DecisionSlide` surfaces. The current deck renders one article
layout across lead, head, and viewer surfaces.
**Migration**: See `lead-slide-by-product-grid` — "Canvas is auto-height with a
bounded width".

### Requirement: Product Separators Must Share a Common Baseline

**Reason**: Product separator rows are replaced by product cards inside the
shared by-product article.
**Migration**: See `lead-slide-by-product-grid` — "Product cards carry status
by color only" and "Subsections share one four-column grid".

### Requirement: The lead slide hero sits at the same inset in every scope

**Reason**: The old Summary/Product lead scope split is removed. Shell-owned
scope controls now feed the same article layout rather than toggling between a
quadrant article and a Product grid.
**Migration**: See `lead-slide-by-product-grid` — "Product and lead scopes reuse
the same article layout".
