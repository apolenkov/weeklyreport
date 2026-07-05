# slide-capacity-signals — delta

## REMOVED Requirements

### Requirement: Record sections surface an advisory when a section may not fit the slide

**Reason**: The slide canvas is auto-height as of 2026-07-05 — nothing can fail to fit, so the advisory warns about a condition that no longer exists. `SlideFitAdvisory` and `SLIDE_SECTION_SOFT_CAP` are deleted. This also resolves the reported vertical-alignment breakage the advisory caused on the lead form.
**Migration**: None needed — see `lead-slide-by-product-grid` "Canvas is auto-height with a bounded width". The admin per-lead product-count advisory in this capability is unaffected.
