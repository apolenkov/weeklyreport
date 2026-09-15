## Why

The Lead Status Overview exposes the correct three-period lineage, but its mixed icon controls, technical continuation labels, uneven action placement, and combined “Additional updates” area make the basic reporting sequence hard to understand. The two supplied UI feedback notes and the current implementations in `status-overview-row.tsx`, `status-overview-additional-updates.tsx`, and `status-overview-linked-continuation.tsx` justify a focused interaction rewrite.

## What Changes

- Present every lineage as the plain sequence “Previously planned → Current week → Next week”, with one obvious primary action in each editable cell.
- Keep drag-and-drop as an optional shortcut for creating or editing a linked next step, while retaining an equivalent labelled button and keyboard path.
- Rename technical continuation and promotion controls in outcome-oriented language; keep promotion manual, audited, and secondary.
- Align descriptions, metadata, history, and actions consistently across the three temporal cells.
- Separate unplanned current work from standalone next-week plans instead of grouping both under “Additional updates”.
- Give empty cells a meaningful empty state or applicable action and keep history progressively disclosed.
- Preserve canonical editors, autosave, conflict handling, lineage identity, permissions, and all existing write paths.

### Non-goals

- No automatic calendar-based promotion or new lifecycle transition.
- No new persistence model, endpoint, dependency, ordering field, or drag-to-reorder behavior.
- No redesign of Head, Viewer, Slides, admin, or report sections outside Status Overview.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `lead-status-overview`: Clarify the visible authoring sequence, action hierarchy, drag enhancement, empty states, and independent-work presentation while preserving existing temporal and write semantics.

## Impact

The change is limited to the Lead Status Overview React components and their colocated tests, plus the `lead-status-overview` specification. It does not change shared schemas, API procedures, Prisma, authentication, lifecycle state, or dependencies. Existing uncommitted Overview work must be preserved and integrated rather than replaced.
