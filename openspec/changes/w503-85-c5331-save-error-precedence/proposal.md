# Proposal

## Why

Tracking: TASK-503.112, clause C5331 of TASK-503.85 (owner decision: GO on the
product fix).

`SaveNowButton` clears its Saved flash in a passive effect, and `deriveSaveView`
ranks the flash above `error`. On a `saved -> error` transition, the commit that
carries the failure still presents "Draft saved" with the green check, and only
the next commit presents "Retry saving draft".

## What Changes

- In `deriveSaveView`, a failed save outranks the Saved flash: the precedence is
  in-flight, then error (Retry), then the Saved flash, then the idle/pending Save.
- The commit that carries `state="error"` presents Retry.
- Saved, Saving and Save presentations are unchanged. The flash hook is not changed:
  it already drops the flash on leaving `saved`, one commit later.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `lead-report-controls-integrity`: the Retry requirement gains a scenario that a
  failed save never presents as Saved, in any commit.

## Impact

- `apps/web/src/shared/ui/report-shell/save-now-button.tsx`
- `apps/web/src/shared/ui/report-shell/save-now-button.test.tsx`
