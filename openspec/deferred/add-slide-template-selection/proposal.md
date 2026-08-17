# Add slide-template selection

## Problem

Head presentation mode currently supports only the working Document/
Presentation density choice. It has no template catalog or selection model, so
the future capability needs one explicit deferred boundary instead of an
implied or hidden template choice.

## Solution

When activated, add a selectable slide-template catalog for Head presentation
mode. Each template will expose a preview, a stable identity, and the layout
contract required by slide export. The selected template will persist for the
report context and will be passed explicitly to the export path. Until that
work is activated, the Head slides context renders one inert `Slide templates`
Coming-Soon control and keeps density selection functional.

## Scope boundaries

- **Catalog:** define stable template IDs, display names, supported content,
  and availability states.
- **Preview:** show a representative preview before selection; previews do
  not mutate report records.
- **Persistence:** store and restore an explicit report/template choice; no
  hidden local default may change an export.
- **Export:** resolve the selected template through the same source-bound
  report snapshot used for PDF/slides output.
- **Activation:** remove the inert control only after catalog, preview,
  persistence, and export acceptance are complete.

## Non-goals

- Implement a template catalog, preview, persistence, or export changes in this
  deferred entry.
- Change Document/Presentation density, slide content, ordering, or navigation.
- Add a runtime feature flag, mobile redesign, or template selection for leads.

## Status

Deferred. The current UI trace is owned by
`apps/web/src/features/report-pages/ui/head/head-report-shell.tsx`; activation
must preserve the shared deferred-feature pattern and the source-bound export
contract.
