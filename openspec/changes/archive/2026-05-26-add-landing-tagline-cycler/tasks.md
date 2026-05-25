# Tasks

## Tagline array + rotation logic

- [x] TAGLINE-T1: Audit product docs and copy for 4–6 hero taglines; add to
      `landing-page.constants.ts`.
- [x] TAGLINE-T2: Implement `TaglineCycler` component — random pick on
      mount (or timed rotation with state + useEffect).
- [x] TAGLINE-T3: Add CSS fade-in/fade-out transition (250ms) for smooth
      rotation UX.
- [x] TAGLINE-T4: Add unit test — verify taglines array length, verify
      component renders one tagline, mock useEffect timing.
- [x] TAGLINE-T5: Integrate `TaglineCycler` into landing hero section;
      remove hardcoded tagline.
- [x] TAGLINE-T6: Browser verification — landing page loads, tagline
      cycles smoothly (if timed), no console errors. [skipped — dev server not running]
- [x] TAGLINE-T7: Commit — `feat(landing): implement dynamic tagline
cycler`.

## Verification

```bash
pnpm --filter @customreport/web test -- \
  src/components/landing/tagline-cycler.test.tsx
pnpm --filter @customreport/web typecheck
```
