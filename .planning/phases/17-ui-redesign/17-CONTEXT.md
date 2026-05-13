# Phase 17: UI Redesign - Context

**Gathered:** 2026-04-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 17 now proceeds API-first from the approved mockups. The active Next.js app shell is intentionally reduced to a Hello World + API placeholder while backend contracts, workflow states, archive/versioning semantics, and publication flow are completed end-to-end. Once API parity is reached, the polished UI can be rebuilt on stable contracts.

</domain>

<decisions>
## Implementation Decisions

### Design System (from DESIGN.md — Starbucks-inspired)

- **D-01:** Warm cream canvas (#f2f0eb) — single theme, no dark/light toggle. White cards on cream. Starbucks-inspired per DESIGN.md.
- **D-02:** Status chips: fixed-width 120px pill buttons with icon+text (✓ On Track / ! At Risk / ✕ Blocked). NOT traffic light circles.
- **D-03:** API-first sequencing — pause real authenticated app UI behind a placeholder until the backend matches the approved mockups end-to-end.
- **D-04:** Teal primary (#006241/#00754A) instead of indigo. Gold (#cba258) for priorities only. Per DESIGN.md color system.
- **D-05:** Mockup semantics must become explicit contracts: product status pipeline, current week items, next week items, blockers/risks, decisions, priorities, head review, publish approval, archive, and version history.

### Layout & Navigation

- **D-18:** Top navigation bar (not sidebar). Role-aware: Lead sees "My Report, History"; Head sees "Dashboard, Assembled, Published, Archive, Admin".
- **D-19:** Pill buttons (50px radius), scale(0.95) on press. 12px card radius. Soft shadows (0.14/0.24 alpha).
- **D-20:** Lexend headings + Source Sans 3 body. Both with excellent Cyrillic. Tight letter-spacing (-0.01em).

### Product-Centric Data Model

- **D-21:** "Product Status" (not "Project Status"). Products grouped by product lines: CRM Platform, Data Analytics Suite, Mobile Applications, Cloud Infrastructure.
- **D-22:** Each product displays SDLC pipeline: Analysis → Design → Dev → Testing → DevOps. Each stage has a responsible person and a traffic light status.
- **D-23:** One person can fill status for multiple SDLC stages across multiple products.
- **D-24:** Current Week / Next Week items displayed as Kanban board with product columns (not flat list).
- **D-25:** Items, Risks, Decisions tagged with product badges showing which product they relate to.

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

_Phase: 17-ui-redesign_
_Context gathered: 2026-04-21 via Smart Discuss (autonomous)_
