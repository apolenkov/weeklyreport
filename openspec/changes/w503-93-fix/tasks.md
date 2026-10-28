# Tasks: Crawler hit testing and visibility in batch presses

- [ ] 1. Add RED regression tests in `scripts/ui-crawl/batch.browser.test.ts` for zero-area, clipped, translated offscreen, scale(0), and opacity:0 overlay.
- [ ] 2. Update `scripts/ui-crawl/batch.ts` and `scripts/ui-crawl/press.ts` to implement visibility checks, ignore opacity:0 overlays, and report `status: 'invisible'`.
- [ ] 3. Verify tests turn GREEN.
- [ ] 4. Run repository gates and generate RESULT file.
