## Why

Wave 2 / P2 from the 2026-07-12 repo-excellence review (docs/reviews/repo-excellence-review-2026-07-12.md).

`lead-slides-client.tsx` holds `selectedIndex` in a plain `useState(0)` with
no effect to resync it when `leadSlides.slides` shrinks — an active-period
rollover or a background refetch that drops the lead's own-section pages
below the currently-viewed page. The sole call site
(`apps/web/src/features/report-sections/ui/lead-form.tsx`) passes no `key`,
so the component never remounts to reset the index either. Once
`selectedIndex >= slides.length`, `selectedSlide()` resolves to `undefined`
and `status-slide-deck.tsx` renders the empty-state "No slides available"
message with no control to recover, even though the deck still has valid
slides at lower indexes. The sibling `head-slides-client.tsx` already carries
the fix: an effect keyed on `[selectedIndex, slides.length]` that resets the
index back to `0` whenever it falls out of range.

## What Changes

- `apps/web/src/features/slides/ui/lead-slides-client.tsx`: add a
  `useEffect` (mirroring `head-slides-client.tsx`) that resets
  `selectedIndex` to `0` whenever `selectedIndex >= slides.length`, keyed on
  `[selectedIndex, slides.length]`.
