# Phase 17: UI Redesign - Context

**Gathered:** 2026-04-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Every page has a professional, polished UI — AssembledReport functional defect fixed, dark theme consistent, a11y complete, responsive. Lead form redesigned first for user approval before proceeding to other pages.

</domain>

<decisions>
## Implementation Decisions

### Design Direction & Layout
- **D-01:** Lead form uses collapsible accordion sections — each category (items, risks, decisions, priorities) in a collapsible card, all closed by default except first. Reduces scroll.
- **D-02:** Traffic light selector: circular colored buttons with ring on hover, inline row of 3 (green/yellow/red). Per audit feedback — "colorful circular buttons, not plain radio text."
- **D-03:** AssembledReport (UI-01): Fix data mapping — ensure router returns ALL sections/items from all leads, then render with expandable lead sections.
- **D-04:** Dark theme: Slate-based OKLCH palette — deepen contrast, add surface-hover states. Extend existing globals.css tokens.

### Component Interactions & UX
- **D-05:** Delete confirmation: shadcn AlertDialog — "Delete this item?" with destructive red button. Prevents accidental data loss (P0 from audit).
- **D-06:** Add item: auto-focus new item's first text field + smooth scroll into view. New items should be immediately editable.
- **D-07:** Head dashboard: compact status cards with submission count, deadline countdown timer, portfolio traffic light summary.
- **D-08:** Animations: CSS transitions only (transform, opacity) — no extra deps, works with SSR. Fade in/out on add/remove, hover effects on cards.

### Accessibility & Responsive
- **D-09:** Focus rings: Tailwind `focus-visible:ring-2 focus-visible:ring-ring` on ALL interactive elements globally via CSS layer.
- **D-10:** Mobile-first: stack cards vertically <768px, sidebar → bottom nav or hamburger.
- **D-11:** Print/PDF: shared `@media print` styles in globals.css — hide nav, force light theme, `print-color-adjust: exact`.
- **D-12:** Archive page: card grid with month group headers, status badge pills (green/yellow/red).

### Claude's Discretion
- Exact OKLCH token values for dark surfaces/borders/hover states
- Accordion component choice (shadcn Collapsible vs Accordion vs custom)
- Responsive sidebar/hamburger implementation details
- Card shadow/spacing exact values
- Section header accent colors
- Micro-animation timing and easing curves
- Admin panel CRUD styling details
- Status badge pill design
- Deadline countdown display format

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Design System
- `packages/ui/src/styles/globals.css` — OKLCH design tokens, CSS custom properties
- `packages/ui/src/components/ui/` — shadcn/ui component library
- `apps/web/tailwind.config.ts` — Tailwind theme extensions

### Pages to Redesign
- `apps/web/src/app/(app)/lead/[reportId]/page.tsx` — Lead form (redesign FIRST)
- `apps/web/src/app/(app)/head/dashboard/page.tsx` — Head dashboard
- `apps/web/src/app/(app)/head/report/[reportId]/review/page.tsx` — Assembled report review
- `apps/web/src/app/(app)/admin/page.tsx` — Admin panel
- `apps/web/src/app/(app)/history/page.tsx` — Archive/history
- `apps/web/src/app/(app)/published/[reportId]/page.tsx` — Published report

### Navigation
- `apps/web/src/components/navigation/` — Sidebar, nav-user, nav-main

### Prior Audit
- `.planning/phases/15-ui-ux-polish-visual-verification/15-CONTEXT.md` — Phase 15 design decisions
- UX Audit (memory: project_ux_audit.md) — P0-P2 issue list, visual overhaul priorities

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- shadcn/ui components: Card, Button, Badge, Dialog, AlertDialog, Collapsible, Accordion, Tabs, Input, Select, Tooltip
- EmptyState component (added in Phase 15)
- ThemeProvider wired in layout.tsx (Phase 16) — dark/light toggle in nav-user
- OKLCH design tokens in globals.css — primitive + semantic layers

### Established Patterns
- Server Components by default, client components only for interactivity
- tRPC for data fetching with superjson serialization
- Tailwind utility-first styling with CSS custom properties
- next-themes for dark mode

### Integration Points
- TrafficLight selector → lead form items
- AssembledReport → tRPC router (must return all sections/items)
- Print/PDF → globals.css @media print
- Focus rings → global CSS layer utility

</code_context>

<specifics>
## Specific Ideas

- User said "куцо, как 90-е" — UI looks bare, outdated (audit 2026-04-20)
- Wants modern flat design with colorful circular traffic light buttons
- Less "wall of cards", more visual hierarchy
- Subtle shadows, better spacing, micro-animations
- Section headers with colored accents
- Inputs with subtle backgrounds and clear focus states
- SC1 requires user approval of lead form BEFORE other pages

</specifics>

<deferred>
## Deferred Ideas

- Dark mode OKLCH token fine-tuning (may need iteration after initial implementation)
- Complex animation sequences (framer-motion) — CSS transitions first, upgrade if needed
- Mobile-specific component variants beyond responsive layout
- Admin role granularity for Bull Board (Phase 16 deferred)

</deferred>

---

*Phase: 17-ui-redesign*
*Context gathered: 2026-04-21 via Smart Discuss (autonomous)*
