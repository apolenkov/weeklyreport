## Why

Two review findings show canonical presentation helpers being silently reimplemented instead of reused:

- `apps/web/src/app/print/[reportId]/print-report-theme.ts:18` defines `printStatusLabel`, a `switch` over `"on-track" | "at-risk" | "blocked"` that maps to `"On Track"`, `"At Risk"`, `"Blocked"`, falling back to the raw status string otherwise. This duplicates the `print` variant of the canonical `statusLabel(status, "print")` in `apps/web/src/lib/status-presentation.ts`, whose documented purpose is to be the single source for status labels so surfaces stay byte-identical. Two print consumers (`print-portfolio-table.tsx`, `print-lead-section.tsx`) currently call the local copy, so any future edit to one label vocabulary can silently diverge from the other.
- `apps/web/src/features/admin/ui/policy-form.tsx:216` defines a local `PlusIcon` component that is byte-for-byte identical (same viewBox, stroke props, `<line>` children) to the canonical `PlusIcon` exported from `apps/web/src/shared/ui/icons.tsx`. The admin products, groups, and users tabs already import the shared icon; `reminders-tab.tsx` and `reminders-empty-state.tsx` instead import `PlusIcon` from `./policy-form`, keeping a redundant implementation alive.

## What Changes

- Delete `printStatusLabel` from `print-report-theme.ts` and reroute `print-portfolio-table.tsx` and `print-lead-section.tsx` to call `statusLabel(status, "print")` from `lib/status-presentation`.
- Delete the local `PlusIcon` in `policy-form.tsx` and its re-export; reroute `reminders-tab.tsx` and `reminders-empty-state.tsx` to import `PlusIcon` from `shared/ui/icons`.

## Capabilities

### Modified Capabilities

- `code-quality-modernization`: print status labels and the admin plus-icon each collapse onto their single canonical implementation, removing the drift-prone duplicates.

## Impact

- Packages: `@customreport/web`.
- Files: `apps/web/src/app/print/[reportId]/print-report-theme.ts`, `apps/web/src/app/print/[reportId]/print-portfolio-table.tsx`, `apps/web/src/app/print/[reportId]/print-lead-section.tsx`, `apps/web/src/features/admin/ui/policy-form.tsx`, `apps/web/src/features/admin/ui/reminders-tab.tsx`, `apps/web/src/features/admin/ui/reminders-empty-state.tsx`.
- No API, schema, or wire-contract changes; rendered output is expected to stay pixel/text identical.

## Non-goals

- No change to `printStatusColor` or `workflowBadge` in `print-report-theme.ts` — only the label duplicate is in scope.
- No visual redesign of the plus icon or any admin tab layout.
- No broader sweep of other icon or label duplicates beyond the two findings named above.
