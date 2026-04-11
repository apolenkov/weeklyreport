# Phase 9: Design System Foundation - Context

**Gathered:** 2026-04-11
**Status:** Ready for planning
**Mode:** Auto-generated (design system infrastructure — discuss skipped)

<domain>
## Phase Boundary

A working component library exists in packages/ui with design tokens and shadcn/ui primitives; any page can import and render styled components. Tailwind v4 with @theme directive, responsive navigation shell, DataTable, Card, Dialog, Toast, Loading Skeletons.

Requirements: DS-01, DS-02, DS-03, DS-04, DS-05, DS-06, DS-07, DS-08, DS-09

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices are at Claude's discretion. Use the UI-SPEC (09-UI-SPEC.md) as the binding design contract for all visual decisions — colors, spacing, typography, copywriting, component specifications.

Key pitfalls from research:
- P1: Tailwind @source directive MUST scan packages/ui — without it all components invisible
- P11: Use tw-animate-css (NOT tailwindcss-animate — deprecated)
- transpilePackages required in next.config.ts for monorepo package consumption
- Font weight 500 needs to be loaded or replaced with 400 for labels

</decisions>

<code_context>
## Existing Code Insights

Codebase context gathered from UI-SPEC and research.

</code_context>

<specifics>
## Specific Ideas

- shadcn/ui official registry only (no third-party)
- Inter font with Cyrillic subset
- OKLCH colors with hex fallbacks for PDF
- 8-point spacing grid

</specifics>

<deferred>
## Deferred Ideas

- Dark mode (deferred to later phase)
- Custom theme toggle

</deferred>
