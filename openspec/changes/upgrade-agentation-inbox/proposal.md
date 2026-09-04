## Why

The Agentation capture surface is now available, but `/feedback` is still
presented as a passive list. Reviewers cannot quickly understand the lifecycle
or perform the common follow-up actions (reply, resolve, dismiss with a reason,
or delete an obsolete item). This makes the extra Agentation capability hard to use
in day-to-day triage.

## What Changes

- Turn `/feedback` into an operational Agentation workbench with explicit
  status, lifecycle actions, detail, thread, and evidence affordances. The
  workbench does not expose an `Open context` action.
- Make the status transition visible and understandable (`New`, `Acknowledged`,
  `Resolved`, `Dismissed`) instead of hiding it in an ambiguous control.
- Allow an authorized author to edit their own original annotation only;
  admins/heads may triage, reply, and manage visible records but never rewrite
  another user's original text.
- Add a confirmed, non-destructive `Dismiss` action requiring a reason.
- Add a separate, single-item `Delete` action for admins only. It requires an
  explicit confirmation and permanently removes the selected visible item from
  either source; Agentation keeps its session while stored annotation events
  are removed explicitly and annotation/thread children cascade, and legacy
  ProductFeedback children cascade. No bulk delete is available.
- Keep legacy rows readable and manageable within their existing ownership and
  role capabilities, without creating a second capture path.
- Preserve the current authenticated rollout, server-derived identity, product
  scope, PostgreSQL source of truth, and fail-closed production behavior.

### Non-goals

- No Agentation package patch, fork, or replacement capture UI.
- No non-admin delete, no bulk delete, bulk triage, bulk status, or
  report-lifecycle mutation.
- No new feedback transport, SQLite product store, or external webhook/cloud
  dependency.
- No redesign of the `/admin?tab=ai` surface in this change.

## Capabilities

### Modified Capabilities

- `authenticated-product-feedback`: define the operational inbox flow,
  lifecycle actions, author-only editing, thread/evidence detail, and safe
  dismissal semantics.

## Impact

The change affects the feedback inbox/card UI, the existing adapter/domain
commands for status/thread/edit/dismiss, and focused web/API/browser tests. It
does not require changing Agentation itself or changing persistence ownership.
Its final access rule supersedes the transitional bulk-delete wording in the
completed `replace-siteping-with-agentation` change, so either archive order
converges on the same non-destructive workbench contract.

## Evidence

The decision is grounded in
`docs/research/agentation-v3-weeklyreport-implementation-2026-09-04.md`,
especially its management-inbox operation matrix and recommended hierarchy.
