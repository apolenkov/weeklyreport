---
phase: 09-design-system-foundation
plan: 01
subsystem: ui
tags: [tailwindcss, shadcn-ui, design-tokens, oklch, postcss, monorepo]

requires:
  - phase: 08-tooling-upgrades
    provides: Next.js 16 with Turbopack, ESLint 10, pnpm 10 monorepo structure

provides:
  - Tailwind v4 design tokens (OKLCH colors, spacing, typography, radius)
  - 20 shadcn/ui components in packages/ui barrel export
  - Traffic light domain colors (green/yellow/red/unset) with print fallbacks
  - cn() utility (clsx + tailwind-merge)
  - PostCSS + transpilePackages monorepo wiring
  - Inter font with Cyrillic subset (weights 400, 600)
  - Sonner Toaster global integration
  - TooltipProvider global wrapper

affects: [09-02, 09-03, 10-navigation-shell, 11-page-styling, 12-pdf-export]

tech-stack:
  added: [tailwindcss@4.2, tw-animate-css@1.4, class-variance-authority@0.7, clsx@2.1, tailwind-merge@3.5, lucide-react@0.500, radix-ui@1.4, sonner@2.0, next-themes@0.4, "@tailwindcss/postcss@4.2", postcss@8.5]
  patterns: [CSS-first Tailwind v4 config via @theme, @source directive for monorepo class scanning, OKLCH color space, package.json exports map for styles/lib/components/hooks]

key-files:
  created:
    - packages/ui/src/styles/globals.css
    - packages/ui/src/styles/traffic-lights.css
    - packages/ui/src/lib/utils.ts
    - packages/ui/components.json
    - packages/ui/src/components/ui/*.tsx (20 files)
    - packages/ui/src/hooks/use-mobile.ts
    - apps/web/postcss.config.mjs
  modified:
    - packages/ui/package.json
    - packages/ui/tsconfig.json
    - packages/ui/src/index.ts
    - apps/web/next.config.ts
    - apps/web/package.json
    - apps/web/src/app/layout.tsx
    - apps/web/src/app/page.tsx

key-decisions:
  - "Removed shadcn CLI-generated HSL sidebar variables, kept OKLCH tokens in @theme block for consistency"
  - "Moved clsx, tailwind-merge, class-variance-authority, lucide-react to dependencies (not devDependencies) since components import them at runtime"
  - "Set baseUrl to . in packages/ui tsconfig to fix @customreport/ui/* path resolution conflict with inherited monorepo root baseUrl"

patterns-established:
  - "CSS import pattern: apps/web imports @customreport/ui/styles/globals.css in root layout"
  - "@source directive pattern: globals.css scans both packages/ui/src and apps/web/src for Tailwind class detection"
  - "Component import pattern: import { Button } from '@customreport/ui' (barrel export)"
  - "Package exports map: ./styles/globals.css, ./lib/*, ./components/*, ./hooks/*"

requirements-completed: [DS-01, DS-02]

duration: 21min
completed: 2026-04-11
---

# Phase 9 Plan 1: Design System Foundation Summary

**Tailwind v4 with OKLCH design tokens, 20 shadcn/ui components in packages/ui barrel, Inter font with Cyrillic, and validated monorepo build pipeline**

## Performance

- **Duration:** 21 min
- **Started:** 2026-04-11T18:40:30Z
- **Completed:** 2026-04-11T19:01:48Z
- **Tasks:** 2
- **Files modified:** 30

## Accomplishments

- Tailwind v4 design system with OKLCH color tokens, 8-point spacing grid, and typography scale matching UI-SPEC
- All 20 shadcn/ui components (button, card, table, sidebar, dialog, sheet, tabs, sonner, skeleton, separator, dropdown-menu, tooltip, label, avatar, progress, alert, input, select, textarea, badge) installed and barrel-exported
- Traffic light domain colors (green/yellow/red/unset) defined as CSS custom properties with hex print fallbacks for PDF generation
- Full monorepo wiring validated: @source directive scans packages/ui + apps/web, PostCSS plugin configured, transpilePackages set, build succeeds end-to-end

## Task Commits

Each task was committed atomically:

1. **Task 1: Install Tailwind v4 + shadcn/ui dependencies and initialize component library** - `9b96dc8` (feat)
2. **Task 2: Wire barrel exports, layout CSS import, Inter font, and validate rendering pipeline** - `43f76d9` (feat)

## Files Created/Modified

- `packages/ui/src/styles/globals.css` - Tailwind v4 @theme tokens, @source directives, base layer, print fallbacks
- `packages/ui/src/styles/traffic-lights.css` - Domain traffic light CSS custom properties with print fallbacks
- `packages/ui/src/lib/utils.ts` - cn() helper (clsx + tailwind-merge)
- `packages/ui/components.json` - shadcn/ui CLI config for monorepo (new-york style, lucide icons)
- `packages/ui/src/components/ui/*.tsx` - 20 shadcn/ui component files
- `packages/ui/src/hooks/use-mobile.ts` - Mobile detection hook (installed by sidebar component)
- `packages/ui/src/index.ts` - Barrel export of all components, hooks, and utilities
- `packages/ui/package.json` - Dependencies, exports map, sideEffects
- `packages/ui/tsconfig.json` - Path aliases with baseUrl fix
- `apps/web/postcss.config.mjs` - @tailwindcss/postcss plugin
- `apps/web/next.config.ts` - transpilePackages for @customreport/ui
- `apps/web/src/app/layout.tsx` - CSS import, Inter font, Toaster, TooltipProvider
- `apps/web/src/app/page.tsx` - Styled landing page with Button pipeline validation

## Decisions Made

1. **Removed shadcn CLI HSL sidebar variables** - The CLI injected `:root` and `.dark` blocks with HSL sidebar colors plus a `@theme inline` block. These conflicted with our OKLCH sidebar tokens already defined in the `@theme` block. Removed the HSL duplicates, kept OKLCH for consistency with the rest of the design system.

2. **Fixed dependency classification** - shadcn CLI placed `class-variance-authority`, `clsx`, and `tailwind-merge` as devDependencies. Since components import these at runtime, moved them to regular dependencies to avoid missing-module errors in consuming apps.

3. **Fixed tsconfig baseUrl for path resolution** - The inherited `baseUrl: "."` from `tsconfig.base.json` resolved relative to the monorepo root, causing `@customreport/ui/*` paths in component imports to fail. Overriding `baseUrl: "."` in the local tsconfig made paths resolve from `packages/ui/` as expected.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] shadcn CLI added conflicting HSL sidebar variables**
- **Found during:** Task 1 (shadcn component installation)
- **Issue:** shadcn CLI appended `:root`, `.dark`, and `@theme inline` blocks with HSL sidebar variables that conflicted with our OKLCH `--color-sidebar-*` tokens in the `@theme` block
- **Fix:** Removed the CLI-generated HSL blocks, preserving only the OKLCH tokens from our design spec
- **Files modified:** packages/ui/src/styles/globals.css
- **Verification:** TypeScript check passes, build succeeds
- **Committed in:** 9b96dc8 (Task 1 commit)

**2. [Rule 3 - Blocking] TypeScript path resolution failed for @customreport/ui/***
- **Found during:** Task 1 (TypeScript verification)
- **Issue:** All component imports like `from '@customreport/ui/lib/utils'` failed with TS2307 because the inherited `baseUrl` pointed to monorepo root, not packages/ui
- **Fix:** Added explicit `baseUrl: "."` to packages/ui/tsconfig.json to override the inherited monorepo root baseUrl
- **Files modified:** packages/ui/tsconfig.json
- **Verification:** `tsc --noEmit` passes with 0 errors
- **Committed in:** 9b96dc8 (Task 1 commit)

**3. [Rule 1 - Bug] Runtime dependencies classified as devDependencies**
- **Found during:** Task 1 (package.json review)
- **Issue:** shadcn CLI placed clsx, tailwind-merge, and class-variance-authority as devDependencies, but components import them at runtime
- **Fix:** Moved to regular dependencies in package.json
- **Files modified:** packages/ui/package.json
- **Verification:** Build pipeline succeeds end-to-end
- **Committed in:** 9b96dc8 (Task 1 commit)

---

**Total deviations:** 3 auto-fixed (2 blocking, 1 bug)
**Impact on plan:** All auto-fixes necessary for correctness. No scope creep.

## Issues Encountered

None beyond the auto-fixed deviations above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Design system foundation complete: Tailwind v4 tokens, 20 components, Inter font, Toaster, TooltipProvider
- Ready for Phase 9 Plan 2 (navigation shell) and Plan 3 (page styling)
- All consuming apps can `import { Component } from '@customreport/ui'` and get fully styled output
- Build pipeline verified: `pnpm turbo build --filter=@customreport/web` succeeds

## Self-Check: PASSED

- All 12 key files verified present on disk
- Both commit hashes (9b96dc8, 43f76d9) found in git log
- 20 component files confirmed in packages/ui/src/components/ui/

---
*Phase: 09-design-system-foundation*
*Completed: 2026-04-11*
