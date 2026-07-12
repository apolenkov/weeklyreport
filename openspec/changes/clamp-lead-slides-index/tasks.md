## 1. Clamp the lead slide index

- [ ] 1.1 `apps/web/src/features/slides/ui/lead-slides-client.tsx`: import
      `useEffect` alongside the existing `useRef`/`useState` import
- [ ] 1.2 Add an effect keyed on `[selectedIndex, slides.length]` that
      returns early when `selectedIndex < slides.length`, otherwise calls
      `setSelectedIndex(0)` — the same shape as
      `apps/web/src/features/slides/ui/head-slides-client.tsx`'s existing
      clamp effect (lines 80-83)
- [ ] 1.3 Place the effect after `slides` is computed and before the
      loading/error early returns, matching the sibling file's ordering

## 2. Spec delta

- [ ] 2.1 `status-slide-rendering`: ADD a requirement that the lead slide
      deck clamps a now-out-of-range `selectedIndex` back into bounds instead
      of rendering a false empty state

## 3. Gates and verification

- [ ] 3.1 `pnpm --filter @customreport/web typecheck`
- [ ] 3.2 `pnpm --filter @customreport/web lint`
- [ ] 3.3 `cd apps/web && pnpm exec vitest run src/features/slides/ui/lead-slides-client.test.tsx` (add/extend a test asserting the clamp: shrink `slides` below a non-zero `selectedIndex` and assert the deck re-renders slide 0 instead of the empty state)
- [ ] 3.4 `npx openspec validate clamp-lead-slides-index --strict`
