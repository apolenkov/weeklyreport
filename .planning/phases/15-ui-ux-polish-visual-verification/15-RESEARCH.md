# Phase 15: UI/UX Polish & Visual Verification - Research

**Researched:** 2026-04-13
**Domain:** Frontend UI components, visual regression testing, Vitest jsdom configuration
**Confidence:** HIGH

## Summary

Phase 15 has six work areas: (1) reusable EmptyState component replacing Alert-based empty states across ~6 pages, (2) four deferred P3 fixes from the Phase 13 redesign cycle, (3) Playwright visual screenshot baselines for ~12 key pages, (4) fixing 24/27 failing web unit tests caused by missing React global in jsdom, (5) error state review across all pages, (6) general visual polish aligned with the "simple, light, flat, modern" design vision.

All work is frontend-only within `apps/web/` and `packages/ui/`. The backend already has `POST /auth/logout` (auth.routes.ts:109), so the logout P3 fix is purely a frontend change. The sidebar tooltip infrastructure already exists in the shadcn/ui Sidebar component (`SidebarMenuButton` accepts a `tooltip` prop and `RoleNav` already passes `tooltip={item.label}`). The visual screenshot test file already exists at `apps/web/e2e/visual/screenshots.spec.ts` with 8 baselines -- it needs expansion to ~12 pages.

**Primary recommendation:** Start with the Vitest fix (unblocks 24 tests with a single config change), then EmptyState component (dependency for page updates), then P3 sidebar fixes (all in the navigation module), then visual baselines (must capture final state after all changes).

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- D-01: Use illustrated empty state pattern across all pages: large centered Lucide icon (64px), heading, description text, and optional CTA button. Replaces current Alert-based empty state in head report page.
- D-02: Create reusable EmptyState component in apps/web/src/components/common/ with props: icon, title, description, action? (label + href).
- D-03: Pages needing empty states: head dashboard (no leads), head report (no submissions), lead report (first time), admin panel (no users/projects/periods), archive list (no published reports), history page (no reports).
- D-05: Sidebar tooltip on collapse -- show tooltip with page name when sidebar icon-only mode.
- D-06: Logout as POST -- change from GET link to POST form/button (CSRF protection).
- D-07: Nav grouping -- group navigation items by role/function with visual section separators.
- D-08: Collapsed padding fix -- fix inconsistent padding in sidebar expanded/collapsed transition.
- D-09: Key pages only -- ~12 Playwright screenshot baselines for critical states.
- D-10: Desktop viewport only (1280px) -- no mobile screenshot baselines.
- D-11: Screenshots stored in apps/web/e2e/visual/ as .png baselines.
- D-12: Fix 24/27 failing web unit tests -- add React auto-import to vitest jsdom config.
- D-13: Simple, light, flat, modern design with large elements.

### Claude's Discretion
- Error state pattern choice per page (D-04)
- Specific Lucide icons for each empty state
- Screenshot baseline threshold tolerance
- Vitest config approach for React auto-import (globals vs plugin)

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope.
</user_constraints>

## Standard Stack

### Core (already installed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| shadcn/ui | 4.x | Component primitives (Alert, Card, Button, Tooltip, Sidebar) | Already installed, 20 components in packages/ui |
| Lucide React | latest | Icon library for empty states | Already used across all navigation and page components |
| Tailwind CSS | 4.x | Styling with OKLCH design tokens | Already configured with @theme directive |
| Playwright | 1.59.1 | Visual screenshot testing (toHaveScreenshot) | Already installed, 8 baselines exist |
| Vitest | 4.1.4 | Unit testing with jsdom environment | Already installed, 27 tests (3 passing, 24 failing) |

### Supporting (needs install)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @vitejs/plugin-react | 6.0.1 | Vitest React JSX transform (auto-imports React) | Required to fix 24 failing tests -- adds automatic JSX runtime |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| @vitejs/plugin-react | `globals: true` in vitest config | globals:true exposes React globally but does NOT fix the JSX transform issue -- components use the new JSX transform without `import React` |
| @vitejs/plugin-react | Explicit `import React` in every component | Violates React 19 convention (automatic JSX runtime), creates maintenance burden across 30+ files |

## Architecture Patterns

### Recommended Project Structure
```
apps/web/src/
  components/
    common/
      empty-state.tsx          # NEW: Reusable empty state component
      query-error.tsx          # EXISTING: Error state (keep as-is)
      page-skeleton.tsx        # EXISTING: Loading skeletons
    navigation/
      app-shell.tsx            # MODIFY: P3 fixes (padding, grouping)
      role-nav.tsx             # MODIFY: Nav grouping with SidebarGroupLabel
      nav-user.tsx             # MODIFY: Logout POST form
      mobile-nav.tsx           # NO CHANGE
  app/(app)/
    head/dashboard/page.tsx    # MODIFY: Replace empty check with EmptyState
    head/report/page.tsx       # MODIFY: Replace Alert with EmptyState
    lead/report/page.tsx       # MODIFY: Replace Alert with EmptyState
    admin/page.tsx             # MODIFY: Replace Alert with EmptyState
    reports/history/page.tsx   # MODIFY: Add empty state for no reports
  e2e/visual/
    screenshots.spec.ts        # MODIFY: Expand from 8 to ~12 baselines
```

### Pattern 1: EmptyState Component
**What:** Centered illustration with icon, heading, description, optional CTA
**When to use:** Every page that can have zero data
**Example:**
```typescript
// apps/web/src/components/common/empty-state.tsx
import type { LucideIcon } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@customreport/ui';

type EmptyStateProps = {
  readonly icon: LucideIcon;
  readonly title: string;
  readonly description: string;
  readonly action?: {
    readonly label: string;
    readonly href: string;
  };
};

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center px-4 py-16 text-center">
      <div className="mb-6 rounded-2xl bg-muted p-5">
        <Icon className="h-16 w-16 text-muted-foreground" strokeWidth={1.5} />
      </div>
      <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
      <p className="mt-2 max-w-sm text-base text-muted-foreground">{description}</p>
      {action ? (
        <Button asChild className="mt-6" size="lg">
          <Link href={action.href}>{action.label}</Link>
        </Button>
      ) : null}
    </div>
  );
}
```

### Pattern 2: Page Conditional Rendering Chain
**What:** Loading -> Error -> Empty -> Content
**When to use:** Every page with tRPC data fetching
**Example:**
```typescript
// Established pattern across all pages:
if (query.isLoading) return <AppShell><Skeleton /></AppShell>;
if (query.error) return <AppShell><QueryError error={query.error} onRetry={...} /></AppShell>;
if (!query.data || isEmpty) return <AppShell><EmptyState icon={...} title="..." description="..." /></AppShell>;
return <AppShell><Content data={query.data} /></AppShell>;
```

### Pattern 3: Logout POST Form
**What:** Replace GET anchor with a form that POSTs to /auth/logout
**When to use:** nav-user.tsx logout action
**Example:**
```typescript
// nav-user.tsx -- replace <a href> with form
<DropdownMenuItem asChild>
  <form action={`${API_URL}/auth/logout`} method="post">
    <button type="submit" className="flex w-full cursor-pointer items-center gap-2">
      <LogOut className="size-5" />
      <span>Log out</span>
    </button>
  </form>
</DropdownMenuItem>
```

### Pattern 4: Nav Grouping with SidebarGroupLabel
**What:** Group navigation items by function with labeled sections
**When to use:** role-nav.tsx when role has 3+ items
**Example:**
```typescript
// Already imported: SidebarGroup, SidebarGroupContent, SidebarGroupLabel
<SidebarGroup>
  <SidebarGroupLabel>Reports</SidebarGroupLabel>
  <SidebarGroupContent>
    <SidebarMenu>
      {reportItems.map(item => <SidebarMenuItem>...</SidebarMenuItem>)}
    </SidebarMenu>
  </SidebarGroupContent>
</SidebarGroup>
<SidebarGroup>
  <SidebarGroupLabel>Administration</SidebarGroupLabel>
  <SidebarGroupContent>
    <SidebarMenu>
      {adminItems.map(item => <SidebarMenuItem>...</SidebarMenuItem>)}
    </SidebarMenu>
  </SidebarGroupContent>
</SidebarGroup>
```

### Anti-Patterns to Avoid
- **Hardcoded OKLCH values:** All colors must use semantic tokens from globals.css (--color-muted, --color-muted-foreground, etc.)
- **Missing empty state:** Every page that can have zero data MUST show EmptyState, not a blank page
- **GET for logout:** State-changing actions must use POST (CSRF protection)
- **Animations without reduced-motion support:** globals.css already has `@media (prefers-reduced-motion: reduce)` -- any new animations must be covered

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Tooltip on collapsed sidebar | Custom tooltip component | `SidebarMenuButton tooltip={item.label}` prop | Already built into shadcn/ui Sidebar, already passed in role-nav.tsx. Just needs verification that TooltipProvider wraps correctly. |
| Icon library | Custom SVG icons | Lucide React | Already used across all components, consistent stroke width and sizing |
| Form POST for logout | Custom fetch + redirect | HTML `<form method="post" action="...">` | Native browser form submission handles CSRF, works without JavaScript, simplest approach |
| Nav section separators | Custom dividers | `SidebarGroupLabel` from shadcn/ui Sidebar | Built into the sidebar component, handles collapsed state automatically (hidden when icon-only) |
| Screenshot threshold comparison | Custom pixel-diff | Playwright `toHaveScreenshot({ maxDiffPixelRatio })` | Built-in, handles animation disabling, viewport sizing, and CI vs local differences |

## Common Pitfalls

### Pitfall 1: Vitest JSX Transform Missing React Global
**What goes wrong:** All 24 component tests fail with "ReferenceError: React is not defined"
**Why it happens:** React 19 components use the automatic JSX transform (`jsx-runtime`) and do NOT import React. Vitest 4 with jsdom needs @vitejs/plugin-react to inject the React import for JSX. Without it, the JSX transform emits `React.createElement()` calls but React is not in scope.
**How to avoid:** Install `@vitejs/plugin-react` and add it to `vitest.config.ts`:
```typescript
import react from '@vitejs/plugin-react';
export default defineConfig({
  plugins: [react()],
  test: { environment: 'jsdom', ... },
});
```
**Warning signs:** All component tests fail with the exact same error on the first JSX return.

### Pitfall 2: Playwright Screenshot Baseline OS Differences
**What goes wrong:** Screenshots taken on macOS (development) have different font rendering than Linux (CI)
**Why it happens:** Font anti-aliasing, subpixel rendering, and system fonts differ between macOS and Linux. Geist font may render at slightly different metrics.
**How to avoid:** Use platform-specific snapshot directories (Playwright default: `{testFileName}-snapshots/{testName}-{projectName}-{platform}.png`). The existing baselines already use this convention (e.g., `admin-panel-chromium-darwin.png`). Set `maxDiffPixelRatio: 0.01` (1%) to absorb minor rendering differences. Generate CI baselines separately on the CI runner.
**Warning signs:** Screenshots pass locally but fail in CI with pixel difference errors.

### Pitfall 3: Sidebar Tooltip Already Working But Not Visible
**What goes wrong:** Developer adds a custom tooltip but the built-in one was already there
**Why it happens:** `SidebarMenuButton` already wraps the button in a Tooltip when `tooltip` prop is provided AND sidebar is collapsed. The `hidden={state !== "collapsed" || isMobile}` logic (sidebar.tsx:541) ensures tooltip only shows in collapsed state. `RoleNav` already passes `tooltip={item.label}` (role-nav.tsx:102).
**How to avoid:** Before implementing D-05, test the existing behavior by collapsing the sidebar and hovering over an icon. The tooltip may already work -- the P3 finding might have been from an earlier version before the tooltip prop was added. If it works, D-05 is already done. If not, the issue is likely that `TooltipProvider` needs `delayDuration={0}` (already set in SidebarProvider at sidebar.tsx:131).
**Warning signs:** Adding a second tooltip layer causes double-tooltips or positioning conflicts.

### Pitfall 4: Logout POST Cross-Origin Issue
**What goes wrong:** The form POST to `API_URL/auth/logout` fails because the frontend and backend are on different ports (3000 vs 3001)
**Why it happens:** HTML forms submit to the action URL but cross-origin POST may be blocked by CORS or same-origin policies depending on the response type.
**How to avoid:** The backend auth.routes.ts:115 responds with `res.redirect('/')` which redirects back to the frontend. This works with HTML form submission because the browser follows the 302. No CORS issue because the redirect goes to the same origin. Test manually after implementing.
**Warning signs:** Logout button does nothing or shows CORS error in console.

### Pitfall 5: Empty State Overriding Actual Data States
**What goes wrong:** EmptyState shows when data is loading or when data exists but is an empty array vs null
**Why it happens:** Confusion between `!data` (null/undefined -- no data fetched yet) and `data.length === 0` (data fetched, genuinely empty)
**How to avoid:** The rendering chain must be: Loading -> Error -> Empty -> Content. The empty check must distinguish between "no data from API" (use EmptyState) and "data loaded but empty array" (also use EmptyState). Currently the head dashboard has `const rows = dashboardQuery.data ?? [];` and shows the dashboard even with 0 rows. Decision: show EmptyState when `rows.length === 0`.
**Warning signs:** EmptyState flashes before content loads, or content area is blank without EmptyState.

### Pitfall 6: Screenshot Tests Blocking CI
**What goes wrong:** Visual screenshot tests fail in CI because baselines were generated on a different platform
**Why it happens:** Playwright stores snapshots with platform suffix (e.g., `chromium-darwin.png`). CI runs on Linux, so it needs `chromium-linux.png` baselines.
**How to avoid:** Generate baselines on CI by running `--update-snapshots` on the CI runner once, or configure `snapshotPathTemplate` to be platform-independent. For this project, D-10 specifies desktop only (1280px) but does not specify platform-independent baselines. Recommendation: keep platform-specific baselines (current convention) and generate Linux baselines separately if CI visual regression is desired. Initially, visual tests can be informational-only in CI.
**Warning signs:** CI fails with "missing baseline" for every screenshot test.

## Code Examples

### EmptyState Usage in Head Report Page
```typescript
// apps/web/src/app/(app)/head/report/page.tsx
// BEFORE:
<Alert>
  <AlertTitle>No data yet</AlertTitle>
  <AlertDescription>...</AlertDescription>
</Alert>

// AFTER:
import { FileStack } from 'lucide-react';
import { EmptyState } from '../../../../components/common/empty-state';

<EmptyState
  icon={FileStack}
  title="No data yet"
  description="No assembled report available. It will appear here once leads begin submitting their sections."
  action={{ label: 'View Dashboard', href: '/head/dashboard' }}
/>
```

### Vitest Config Fix
```typescript
// apps/web/vitest.config.ts
import { createRequire } from 'module';
import path from 'path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

const require = createRequire(
  path.resolve(__dirname, '../../packages/shared/package.json'),
);

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    globals: false,
    exclude: ['e2e/**', 'node_modules/**'],
  },
  resolve: {
    alias: {
      '@customreport/shared': path.resolve(__dirname, '../../packages/shared/src'),
      '@customreport/api': path.resolve(__dirname, '../../apps/api/src'),
      zod: path.dirname(require.resolve('zod/package.json')),
    },
  },
});
```

### Expanded Screenshot Test
```typescript
// apps/web/e2e/visual/screenshots.spec.ts
// Add to headPages array:
const headPages = [
  { name: 'head-dashboard', path: '/head/dashboard' },
  { name: 'head-report', path: '/head/report' },
  { name: 'admin-panel', path: '/admin' },
] as const;

// Add to each toHaveScreenshot call for consistent viewport:
await expect(page).toHaveScreenshot(`${entry.name}.png`, {
  fullPage: true,
  animations: 'disabled',
  maxDiffPixelRatio: 0.01,
});
```

### Nav Grouping for Head Role
```typescript
// Grouping logic for head role (5 nav items):
// Group "Reports": Review Dashboard, Assembled Report, Published Report, Report History
// Group "Admin": Admin

// For lead role (1 item): No grouping needed (single item)
// For viewer role (2 items): No grouping needed (both are report-related)
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Alert-based empty state | Illustrated EmptyState with icon + CTA | Phase 15 | More welcoming UX, consistent across all pages |
| GET anchor for logout | POST form for logout | Phase 15 | CSRF protection, follows HTTP semantics |
| Flat nav list | Grouped nav with SidebarGroupLabel | Phase 15 | Better information hierarchy for head role (5 items) |
| vitest without react plugin | @vitejs/plugin-react in vitest.config | Phase 15 | Fixes 24/27 failing tests |

## Open Questions

1. **Sidebar tooltip (D-05) may already work**
   - What we know: `SidebarMenuButton` in sidebar.tsx already has tooltip logic, `RoleNav` passes `tooltip={item.label}`, `TooltipProvider` wraps the sidebar.
   - What's unclear: Whether the tooltip actually displays on hover in collapsed mode (may have been a pre-redesign finding that is now resolved).
   - Recommendation: Test existing behavior first. If tooltip works, mark D-05 as "already resolved" and skip.

2. **Collapsed padding specifics (D-08)**
   - What we know: `app-shell.tsx` has `group-data-[collapsible=icon]:px-2` on header and `group-data-[collapsible=icon]:px-0` on footer. The Sidebar component itself has complex responsive padding in sidebar.tsx.
   - What's unclear: Exactly which padding is "inconsistent" -- need visual inspection in collapsed state.
   - Recommendation: Visually inspect collapsed sidebar, identify specific padding issues, fix in app-shell.tsx classes.

3. **Platform-specific baselines in CI**
   - What we know: Current baselines have `-darwin` suffix. CI runs on Linux.
   - What's unclear: Whether CI should run visual regression tests at all, or only local.
   - Recommendation: Keep visual tests runnable locally only for now (Phase 15 scope is desktop baselines). Add `test.skip(process.env.CI)` condition or separate CI baseline generation as a future task.

## Project Constraints (from CLAUDE.md)

- **Tech stack locked:** Next.js 16 + shadcn/ui 4.x + Tailwind CSS 4.x + Vitest 4.x + Playwright
- **Monorepo:** Turborepo with pnpm, packages/ui holds shared components, apps/web holds pages
- **Styling:** OKLCH tokens in globals.css, Geist font, no hardcoded color values
- **TypeScript strict mode:** All files must pass strict typecheck
- **Testing:** Vitest for unit, Playwright for E2E, `vitest run` and `playwright test` commands
- **Quality gates:** ESLint + Prettier + Husky + lint-staged
- **RTK usage:** All bash commands must be prefixed with `rtk`

## Sources

### Primary (HIGH confidence)
- Codebase inspection: `apps/web/vitest.config.ts`, `vitest.setup.ts`, `playwright.config.ts` -- current configuration
- Codebase inspection: `packages/ui/src/components/ui/sidebar.tsx` lines 498-546 -- tooltip infrastructure already built in
- Codebase inspection: `apps/api/src/modules/auth/auth.routes.ts` lines 108-116 -- POST /auth/logout already implemented
- Codebase inspection: `apps/web/e2e/visual/screenshots.spec.ts` -- existing visual test structure with 8 baselines
- Codebase inspection: `apps/web/src/components/navigation/role-nav.tsx` line 102 -- tooltip prop already passed
- npm registry: `@vitejs/plugin-react@6.0.1` current, `vitest@4.1.4` installed

### Secondary (MEDIUM confidence)
- React 19 automatic JSX transform -- established pattern, components do not import React
- Playwright toHaveScreenshot API -- stable since Playwright 1.22, well-documented

### Tertiary (LOW confidence)
- None -- all findings verified against codebase and installed packages

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all libraries already installed and configured in the project
- Architecture: HIGH -- patterns verified by reading existing page implementations
- Pitfalls: HIGH -- all pitfalls derived from actual codebase inspection (e.g., the 24 failing tests, the existing tooltip prop)

**Research date:** 2026-04-13
**Valid until:** 2026-05-13 (stable -- all work is within existing codebase patterns)
