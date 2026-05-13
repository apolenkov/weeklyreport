# Phase 15: UI/UX Polish & Visual Verification - Context

**Gathered:** 2026-04-13
**Status:** Ready for planning

<domain>
## Phase Boundary

All pages visually polished with consistent design system, every screen verified via Playwright screenshots, deferred P3 findings resolved, empty states and error states properly styled. The overall vision: **simple, light, flat, modern design with large elements that make report creation easy and pleasant.**

</domain>

<decisions>
## Implementation Decisions

### Empty States

- **D-01:** Use illustrated empty state pattern across all pages: large centered Lucide icon (64px), heading, description text, and optional CTA button. Replaces current Alert-based empty state in head report page.
- **D-02:** Create reusable `EmptyState` component in `apps/web/src/components/common/` with props: `icon`, `title`, `description`, `action?` (label + href).
- **D-03:** Pages needing empty states: head dashboard (no leads), head report (no submissions), lead report (first time), admin panel (no users/projects/periods), archive list (no published reports), history page (no reports).

### Error States

- **D-04:** Claude's Discretion — choose inline QueryError (Alert) for partial errors, full-page centered error for critical failures, per page context.

### Deferred P3 Fixes (all 4 from Phase 13 redesign)

- **D-05:** Sidebar tooltip on collapse — show tooltip with page name when sidebar icon-only mode.
- **D-06:** Logout as POST — change from GET link to POST form/button (CSRF protection).
- **D-07:** Nav grouping — group navigation items by role/function with visual section separators.
- **D-08:** Collapsed padding fix — fix inconsistent padding in sidebar expanded/collapsed transition.

### Visual Verification

- **D-09:** Key pages only — ~12 Playwright screenshot baselines for critical states: login, lead form (empty/filled/submitted), head dashboard (empty/populated), assembled report, published report, admin panel, archive list, print view.
- **D-10:** Desktop viewport only (1280px) — no mobile screenshot baselines.
- **D-11:** Screenshots stored in `apps/web/e2e/visual/` as `.png` baselines.

### Web Test Fix

- **D-12:** Fix 24/27 failing web unit tests — add React auto-import to vitest jsdom config (globals: true or @vitejs/plugin-react). Restore all component tests to green.

### Design Vision (from user)

- **D-13:** Simple, light, flat, modern design with large elements. Report creation should feel easy and pleasant. Prioritize readability and whitespace over information density.

### Claude's Discretion

- Error state pattern choice per page (D-04)
- Specific Lucide icons for each empty state
- Screenshot baseline threshold tolerance
- Vitest config approach for React auto-import (globals vs plugin)

</decisions>

<canonical_refs>

## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Design System

- `packages/ui/src/styles/globals.css` — Design tokens (OKLCH palette, Geist fonts, semantic colors)
- `packages/ui/src/styles/traffic-lights.css` — Domain-specific traffic light colors
- `apps/web/src/styles/app.css` — Tailwind v4 config, @source paths, utility safelist

### UI Components

- `packages/ui/src/components/ui/` — 20 shadcn/ui primitives (alert, card, button, etc.)
- `packages/ui/src/components/` — 4 composition components (data-table, confirm-dialog, crud-sheet, traffic-light-badge)
- `apps/web/src/components/common/page-skeleton.tsx` — 8 skeleton loading patterns
- `apps/web/src/components/common/query-error.tsx` — Error state component (Alert-based)

### Navigation

- `apps/web/src/components/navigation/app-shell.tsx` — Main layout shell (sidebar + header)
- `apps/web/src/components/navigation/role-nav.tsx` — Role-aware navigation items
- `apps/web/src/components/navigation/mobile-nav.tsx` — Mobile navigation drawer
- `apps/web/src/components/navigation/nav-user.tsx` — User avatar + logout menu

### Pages (all need empty state review)

- `apps/web/src/app/(app)/head/dashboard/page.tsx` — Head submission dashboard
- `apps/web/src/app/(app)/head/report/page.tsx` — Assembled report review (has Alert empty state)
- `apps/web/src/app/(app)/lead/report/page.tsx` — Lead report entry form
- `apps/web/src/app/(app)/admin/page.tsx` — Admin panel (users, projects, periods)
- `apps/web/src/app/(app)/reports/history/page.tsx` — Report history/archive
- `apps/web/src/app/(app)/reports/[reportId]/page.tsx` — Published report viewer
- `apps/web/src/app/(app)/reports/[reportId]/print/page.tsx` — Print/PDF layout

### E2E Tests

- `apps/web/playwright.config.ts` — Playwright configuration
- `apps/web/e2e/` — E2E test files (8 specs, visual/, a11y/, responsive/ dirs)

### Prior Phase Context

- `.planning/phases/13-quality-assurance-polish/13-CONTEXT.md` — Bug fixes, P3 deferred items
- `.planning/STATE.md` § UI/UX Redesign Summary — Cycle 3 findings (35 total, 8 P3 deferred)

</canonical_refs>

<code_context>

## Existing Code Insights

### Reusable Assets

- `QueryError` component (query-error.tsx): Alert variant=destructive with retry button — used across 5 pages
- `PageSkeleton` patterns (page-skeleton.tsx): PageTitleSkeleton, SectionCardSkeleton, CardSkeleton, TableSkeleton — used on all loading states
- `AppShell` (app-shell.tsx): Wraps all pages with sidebar + header — P3 fixes will modify this
- 20 shadcn/ui primitives in @customreport/ui — fully available for empty state components

### Established Patterns

- Pages are `'use client'` with tRPC hooks for data fetching
- Loading → Error → Empty → Content conditional rendering chain
- OKLCH semantic tokens for all colors (no hardcoded values since P2 fixes)
- Geist font family, 8-point spacing system

### Integration Points

- New `EmptyState` component will be imported by ~6 pages
- P3 sidebar fixes modify `app-shell.tsx`, `role-nav.tsx`, `nav-user.tsx`
- Visual screenshot tests add to existing `apps/web/e2e/visual/` directory
- Web test fix modifies `apps/web/vitest.config.ts`

</code_context>

<specifics>
## Specific Ideas

- User wants report creation to feel "easy and pleasant" — prioritize whitespace, large touch targets, clear visual hierarchy
- Empty states should be welcoming, not clinical — use friendly language and helpful CTAs
- The tool is for 6 team leads filling weekly reports — UX should minimize friction for repeat usage

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

_Phase: 15-ui-ux-polish-visual-verification_
_Context gathered: 2026-04-13_
