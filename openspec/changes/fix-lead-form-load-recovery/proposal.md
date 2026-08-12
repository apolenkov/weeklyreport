## Why

When the primary `leadForm.byPeriod` read fails, the lead form can remain on a
loading skeleton indefinitely. The source-bound R41 acceptance review in
`~/work/customreport-archive/2026-08-11-product-form-atlas/` found no visible
terminal state or recovery action, so a lead cannot distinguish a slow load
from a failed report and cannot retry safely.

## What Changes

- Replace the lead form's perpetual skeleton after a terminal primary-read
  failure with an explicit error state.
- Show a clear retry action that refetches the failed primary read without
  exposing stale editable draft content.
- Keep the existing centralized query-error logging and toast policy.
- Add focused component tests and source-bound browser evidence for failure,
  retry, and recovery.

### Non-goals

- No API, schema, database, authorization, or route changes.
- No redesign of other lead-form loading states or global error handling.
- No automatic mutation, draft reset, or navigation on load failure.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `lead-form-data-loading`: require a visible terminal error state and an
  explicit retry path when the primary lead-form read fails.

## Impact

The change affects the lead-form data-loading result, the lead-form top-level
render branch, focused web tests, and R41 Playwright evidence. It preserves
the current tRPC contract and the `useQueryErrorHandler` reporting seam.
