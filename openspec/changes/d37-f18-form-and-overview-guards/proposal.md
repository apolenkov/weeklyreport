# Proposal

## Why

Leaf package D37-F18 repairs several confirmed owner-level defects in the
lead form and Status Overview surface:

- The activity-status refusal notice persists after the observed alarm floor
  that caused it changed, explaining a stale reason.
- `archivedHidden` reports hidden archive rows whenever any archive exists
  with the toggle off, even when the selected-row retention or the
  all-archived fallback removed no row.
- `leadPeriodLabel` borrows the newest visible period's label for a provided
  but missing addressed report id, mislabelling the breadcrumb.
- The derived Next commitment row offers a terminal "Update status" route
  that reaches the same Current record a second time.
- `sourceCounts` excludes intentionally visible resolved rows, so the counts
  can disagree with the rendered columns the spec already requires them to
  equal.
- Revoke surfaces a recognized bare transport message instead of the
  action-specific copy the shared mutation formatter already provides.
- Unified activity edit/delete commits against a captured row identity that
  the save-time id remint or a concurrent change may have invalidated,
  emitting no-op parent writes and closing dialogs over unsaved input.

## What Changes

- Tie the refusal notice to the alarm floor observed at pick time and
  invalidate it on an observed floor change.
- Derive `archivedHidden` from actually removed period rows.
- Resolve the breadcrumb label by exact addressed match only; keep the
  newest-visible fallback for an absent address.
- Suppress the terminal outcome action on derived (`focusNextStep`) Next
  rows while keeping genuine Next and Current resolution.
- Count each temporal source by its rendered column items, including
  intentionally visible resolved rows.
- Format revoke failures through the shared mutation error formatter.
- Re-resolve the captured edit/delete target against the latest entries in
  the same week before committing; keep the dialog and unsaved input with an
  explicit error when no safe target exists.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `activity-reporting-unit`: refusal notice lifetime and unified editing
  commit target resolution.
- `lead-form-loaded-view-model`: archive-hidden affordance and breadcrumb
  label resolution.
- `lead-form-write-actions`: revoke failure copy normalization.
- `lead-status-overview`: derived-row terminal action guard and rendered
  source counts.

## Impact

Sources under `apps/web/src/features/period/ui`,
`apps/web/src/features/report-sections/model`, and
`apps/web/src/features/report-sections/ui`, plus their colocated owner
tests. Evidence is preserved in the external D37-F18 handoff.

## Non-goals

- Changing palette, palette tokens, or the paused progress tone.
- Server CAS, save-echo, transport or persistence-contract changes.
- Global per-project rank ordering in weekly priorities.
- Native browser, DB, HTTP or full-gate acceptance claims.
