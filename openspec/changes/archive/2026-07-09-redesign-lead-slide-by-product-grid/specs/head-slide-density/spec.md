# head-slide-density — delta

## REMOVED Requirements

### Requirement: The head status slide renders each section as a framed, floored card

**Reason**: The head's own slide moves to the unified by-product article (decision 2026-07-05); the 2×2 framed-card layout and `HeadSlideArticle` are deleted.
**Migration**: See `lead-slide-by-product-grid` — "One slide article renders every deck slide".

### Requirement: Head section headers are neutral with token-driven stripes

**Reason**: Section cards no longer exist on the head slide; column headers and product stripes are specified by the unified layout.
**Migration**: See `lead-slide-by-product-grid` — "Slide reading order is header, priorities, column headers, products" and "Product cards carry status by color only".

### Requirement: Head slide colors stay inside the existing token system

**Reason**: The rule survives but now applies through the unified article's token-only constraints; a head-specific restatement would duplicate it.
**Migration**: See `lead-slide-by-product-grid` — token-only constraints across its requirements.

### Requirement: The active head slide fills the viewport like the lead deck

**Reason**: Reversed by the auto-height canvas decision of 2026-07-05; slides grow with content and scroll in fullscreen.
**Migration**: See `lead-slide-by-product-grid` — "Canvas is auto-height with a bounded width".
