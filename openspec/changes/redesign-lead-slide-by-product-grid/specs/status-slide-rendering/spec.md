# status-slide-rendering — delta

## REMOVED Requirements

### Requirement: Decisions Slide Must Constrain Vertical Overflow

**Reason**: The auto-height canvas decision of 2026-07-05 removes internal max-height scroll containers; the slide grows with content and every decision renders in flow.
**Migration**: See `lead-slide-by-product-grid` — "Canvas is auto-height with a bounded width" (no clipping, no truncation; fullscreen scrolls).
