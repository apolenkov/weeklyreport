# Proposal

## Why

Tracking: TASK-503 (W503 R3 repairs). Four behaviour repairs reached `main`
without an OpenSpec change, although the repository rules require one for
behaviour changes. This change records the delivered behaviour retroactively so
the specifications match the code and its tests. It changes no application code.

## What Changes

Retrospective specification of already delivered commits:

- `50dd50f93` (C4927): Discard after a failed Overview Save update saves the
  restored item text, not the abandoned text.
- `12f9d34fc` (ACCEPT-R3 defect 2): the sticky completion Retry is disabled
  while an Overview update is open.
- `c7f02a897` (C4836): a Submitted or Read-only header badge outranks the
  Unsaved update badge.
- `e25c57c1b` (C5154): the head deck shows its skeleton while live activity of
  another report refetches.

Not duplicated: `44eae8e8a` (C4907/C4909, view settings and cross-author reads
wait for the section fetch; their failure shows the shared load error with
Retry) is already specified by the requirement "Required Lead reads expose
recoverable terminal outcomes" in `lead-form-data-loading`.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `lead-status-overview-actions`: two requirements added.
- `report-toolbar-layout`: "Lead read-only state is stated in the header" gains
  the locked-badge precedence rule and a scenario.
- `status-slide-rendering`: one requirement added.

## Impact

Specifications only. Delivered code, for reference:

- `apps/web/src/features/report-pages/ui/lead/shell/overview-item-submission.ts`
- `apps/web/src/features/report-pages/ui/lead/chrome/lead-completion-actions.tsx`,
  `apps/web/src/features/report-pages/ui/lead/shell/lead-status-overview-content.tsx`,
  `apps/web/src/shared/ui/report-shell/save-now-button.tsx`
- `apps/web/src/features/report-pages/ui/lead/chrome/lead-form-header-actions.tsx`
- `apps/web/src/features/slides/ui/head-slides-client.tsx`
