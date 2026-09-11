## Why

Approving a reopen request changes the section to Draft, but the dashboard only
refreshes the request queue and its count. The Period Summary can continue to
show Submitted, a Review action, and the old submission total until another
navigation refreshes the report data.

## What Changes

- Refresh the dependent live report and review reads when a reopen decision
  settles, using the existing cache invalidation contract.
- Apply the same rule to the dashboard and review/admin reopen surface.
- Keep the request list/count refresh and response draft behavior intact.
- Add regression coverage for the stale report view and verify the local
  submit, request, approve, and return-to-edit flow in the browser.

## Impact

- Affected specification: `reopen-requests`.
- Affected code: web reopen decision hooks and their regression tests.
- No server lifecycle, role, database schema, or visual-style changes.
