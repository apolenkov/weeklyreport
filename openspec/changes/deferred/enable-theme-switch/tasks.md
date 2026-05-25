# Tasks

## Research phase (BLOCKED — awaiting approval)

- **THEME-R1** (BLOCKED) Audit Tailwind color tokens in `tailwind.config.ts`
  and UI components
- **THEME-R2** (BLOCKED) Design dark palette: derive dark versions of primary,
  accent, bg, text, border colors
- **THEME-R3** (BLOCKED) Produce mockups (Figma or HTML) showing light + dark
  versions of: landing hero, report list, report detail, nav bar
- **THEME-R4** (BLOCKED) Write research memo to
  `.planning/research/theme-dark-exploration.md` with palette, mockups, and
  implementation recommendations
- **THEME-R5** (BLOCKED) User review + approval required before proceeding

## Implementation phase (DEFERRED — awaits R5 approval)

- **THEME-T1** (DEFERRED) Add dark Tailwind config to `tailwind.config.ts`
- **THEME-T2** (DEFERRED) Replace `ThemeComingSoonControl` with real theme
  toggle button in nav bar
- **THEME-T3** (DEFERRED) Update component tree with `dark:` prefixed
  utilities for dark mode
- **THEME-T4** (DEFERRED) Persist theme choice to localStorage; restore on
  page load
- **THEME-T5** (DEFERRED) Test light/dark mode across all UI surfaces
- **THEME-T6** (DEFERRED) Commit: `feat(ui): enable theme switcher with dark
mode support`

## Verification (deferred)

```bash
# After research approval
pnpm --filter @customreport/web test -- theme-switcher.test.tsx
```

**Blocking issue**: Awaiting research memo approval at
`.planning/research/theme-dark-exploration.md`.
