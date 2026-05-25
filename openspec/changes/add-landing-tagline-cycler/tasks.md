# Tasks

## Tagline array + rotation logic

- **TAGLINE-T1** Audit product docs and copy for 4–6 hero taglines; add to
  `landing-page.constants.ts`
- **TAGLINE-T2** Implement `TaglineCycler` component: random pick on mount
  (or timed rotation with state + useEffect)
- **TAGLINE-T3** Add CSS fade-in/fade-out transition (250ms) for smooth
  rotation UX
- **TAGLINE-T4** Add unit test: verify taglines array length, verify
  component renders one tagline, mock useEffect timing
- **TAGLINE-T5** Integrate `TaglineCycler` into landing hero section;
  remove hardcoded tagline
- **TAGLINE-T6** Browser verification: landing page loads, tagline cycles
  smoothly (if timed), no console errors
- **TAGLINE-T7** Commit: `feat(landing): implement dynamic tagline cycler`

## Verification

```bash
pnpm --filter @customreport/web test -- \
  src/components/landing/tagline-cycler.test.tsx
pnpm --filter @customreport/web typecheck
```
