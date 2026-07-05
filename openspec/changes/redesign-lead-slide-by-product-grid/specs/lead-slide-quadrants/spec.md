# lead-slide-quadrants — delta

## REMOVED Requirements

### Requirement: The lead "Own" slide renders a strict 2×2 quadrant grid of framed cards

**Reason**: The quadrant layout is superseded by the by-product grid (`lead-slide-by-product-grid`); the fixed-aspect frame and internal quadrant scrolling give way to an auto-height canvas.
**Migration**: See `lead-slide-by-product-grid` — "Canvas is auto-height with a bounded width" and "Subsections share one four-column grid".

### Requirement: Records group under a single product heading within each quadrant

**Reason**: Grouping inverts: the product is now the primary card and sections are columns inside it, so per-quadrant product headings disappear.
**Migration**: See `lead-slide-by-product-grid` — "Product cards carry status by color only" and "Subsections share one four-column grid". The no-truncation rule carries over into "Canvas is auto-height with a bounded width".

### Requirement: The lead slide reads lead, then priorities, then product

**Reason**: The reading order survives but is re-specified for the new anatomy (header → priority strip → products).
**Migration**: See `lead-slide-by-product-grid` — "Slide reading order is header, priorities, column headers, products" and "Priority strip shows all ranked items".

### Requirement: Quadrant colors stay inside the existing status system

**Reason**: Quadrants no longer exist; the token-only color rule is restated for the new surface.
**Migration**: See `lead-slide-by-product-grid` — token-only constraints in "Header summarizes the owner's period" and "Product cards carry status by color only".

### Requirement: Product chips scope the slide and content refills the frame

**Reason**: Chip scoping survives as Product mode of the new layout; the "refills the fixed frame" half is obsolete under auto-height.
**Migration**: See `lead-slide-by-product-grid` — "Summary and Product modes share one layout".

### Requirement: The framed lead slide fills its frame on any content change

**Reason**: Reversed by decision of 2026-07-05: the canvas is auto-height; there is no fixed frame to fill.
**Migration**: See `lead-slide-by-product-grid` — "Canvas is auto-height with a bounded width".
