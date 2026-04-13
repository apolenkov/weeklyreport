# Phase 15: UI/UX Polish & Visual Verification - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-13
**Phase:** 15-ui-ux-polish-visual-verification
**Areas discussed:** Empty & error states, Deferred P3 resolution, Visual verification scope, Web test JSX fix

**User's general vision (stated upfront):** "Нужен простой, лёгкий, плоский, современный дизайн с крупными элементами, чтобы было легко и приятно формировать отчёт."

---

## Empty & Error States

### Empty State Pattern

| Option | Description | Selected |
|--------|-------------|----------|
| Illustrated empty state | Large centered Lucide icon (64px), heading, description, optional CTA | ✓ |
| Minimal text only | Muted paragraph, no icon, no wrapper | |
| Card with icon | Alert-like in a Card with softer styling | |

**User's choice:** Illustrated empty state (Recommended)
**Notes:** Matches user's "light & pleasant" vision. Replaces existing Alert pattern.

### Error State Pattern

| Option | Description | Selected |
|--------|-------------|----------|
| Current QueryError (keep) | Alert variant=destructive with Retry | |
| Full-page error illustration | Centered error with large icon + actions | |
| You decide | Claude picks per page context | ✓ |

**User's choice:** You decide
**Notes:** Claude has discretion to use inline or full-page based on context.

---

## Deferred P3 Resolution

| Option | Description | Selected |
|--------|-------------|----------|
| Sidebar tooltip on collapse | Tooltip with page name in icon-only mode | ✓ |
| Logout as POST | POST form/button instead of GET link | ✓ |
| Nav grouping | Group items by role/function | ✓ |
| Collapsed padding fix | Fix padding in expanded/collapsed transition | ✓ |

**User's choice:** All 4 P3 fixes
**Notes:** No P3 items dropped.

---

## Visual Verification Scope

### Coverage Level

| Option | Description | Selected |
|--------|-------------|----------|
| Key pages only | ~12 screenshot baselines for critical states | ✓ |
| Full matrix | Every page × every state × 2 viewports = 40+ | |
| No screenshots | Skip visual regression entirely | |

**User's choice:** Key pages only (Recommended)

### Viewport

| Option | Description | Selected |
|--------|-------------|----------|
| Desktop only (1280px) | One viewport per screenshot | ✓ |
| Desktop + mobile | Two viewports, doubles maintenance | |
| You decide | Claude picks per page | |

**User's choice:** Desktop only (1280px)
**Notes:** Internal corporate tool — mobile is secondary.

---

## Web Test JSX Fix

| Option | Description | Selected |
|--------|-------------|----------|
| Fix in Phase 15 | Add React auto-import to vitest config | ✓ |
| Defer to later | Focus on visual polish only | |
| Delete broken tests | Remove 24 failing tests, start fresh | |

**User's choice:** Fix in Phase 15 (Recommended)

---

## Claude's Discretion

- Error state pattern per page (inline vs full-page)
- Specific Lucide icons for each empty state
- Screenshot threshold tolerance
- Vitest config approach for React auto-import

## Deferred Ideas

None — discussion stayed within phase scope.
