# Phase 11: PDF Styling - Context

**Gathered:** 2026-04-12
**Status:** Ready for planning
**Mode:** Auto-generated (infrastructure phase — discuss skipped)

<domain>
## Phase Boundary

The exported PDF report is a professional document that matches the web view quality. Print-specific CSS, color fallbacks, visual fidelity.

Requirements: PDF-01, PDF-02, PDF-03

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices at Claude's discretion. The print page at apps/web/src/app/(app)/reports/[reportId]/print/page.tsx already exists but is unstyled. Now that Phase 10 styled all components, the print page needs print-specific CSS using Tailwind print: variants.

Key approach:
- Add print: variants to existing styled components (hidden nav, visible content)
- Use hex/rgb for traffic light colors in @media print (no oklch — PDF viewers may not support it)
- Page breaks between sections (break-inside: avoid on Card components)
- Traffic light colors already have hex fallbacks in packages/ui/src/styles/traffic-lights.css

</decisions>

<specifics>
## Specific Ideas

No specific requirements — use Tailwind print: variants and existing traffic-lights.css hex fallbacks.

</specifics>

<deferred>
## Deferred Ideas

None.

</deferred>
