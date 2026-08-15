## Why

Real-Chrome evidence for the landmark-focus repair exposed two visible navigation defects outside that repair: the Admin tab strip expands the 768 px document by 115 px and hides its final destinations, while the 375 px Settings sub-tab strip clips `Notifications` and gives no evident route to later sections. The same packet also showed that a narrowly scoped screenshot approval can coexist with obvious whole-frame defects, so responsive navigation and visual acceptance need one explicit contract.

## What Changes

- Keep the compact Admin picker through tablet widths and show the pill strip only where all canonical destinations fit without document-level overflow.
- Preserve the pending Reopen and failed-job signals when the primary navigation collapses, instead of dropping operational information on smaller screens.
- Replace the undiscoverable narrow Settings sub-tab strip with a compact control that exposes every working section while preserving the existing desktop Radix tab list and active-panel behavior.
- Give the Admin picker and pill links one intentional token-driven `focus-visible` treatment rather than accepting inconsistent browser-default outlines.
- Add rendered responsive assertions at 375, 768, 1023, 1024, and 1280 CSS px, including maximum-display operational counts, destination reachability, active state, focus visibility, and zero document overflow.
- Require visual-review verdicts to enumerate every captured page/state/viewport and to treat any visible product defect as blocking the overall visual gate, even when a narrower behavior assertion passes.

### Non-goals

- No visual redesign, new color or spacing token, Admin information-architecture change, Settings form change, or new backend/API behavior.
- No R188/runtime-sweep infrastructure expansion and no release, commit, push, merge, or publication action.
- No conversion of Settings sub-tabs to URL-deep-linked state in this repair; that guideline gap remains separately traceable.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `admin-settings-ui`: define responsive, reachable Admin primary and Settings secondary navigation without document overflow.
- `uat-quality-gates`: make full-frame, per-viewport visual review a blocking acceptance condition rather than a scoped screenshot attachment.

## Impact

Affected surfaces are `apps/web/src/app/(app)/admin/page.tsx`, the primary Admin navigation labels/picker, `apps/web/src/features/admin/ui/settings-tab.tsx`, their focused component/contract tests, the durable `admin-settings-ui` and repository-wide `uat-quality-gates` contracts, and the source-bound Chrome evidence ledger/harness. Existing count queries are reused; no shared schema, API, database, Redis, dependency, or production configuration changes.
