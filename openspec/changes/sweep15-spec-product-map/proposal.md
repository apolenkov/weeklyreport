## Why

The durable spec directory is difficult to navigate by user journey, mixes product capabilities with engineering governance, and leaves many user-facing Purpose sections as generated `TBD` text.

## What Changes

- Add a product-capability index under `openspec/specs`, organized by role and lifecycle, with a separate engineering-governance section.
- Replace every user-facing `TBD` Purpose with a concrete scope statement; explicitly cover `activity-reporting-unit`, `head-report-visibility`, `head-dashboard-clarity`, and `review-acknowledge-placement`.
- Add only a deferred trace for activity-scoped escalation parity; do not create requirements or implementation tasks for it.
- Link/classify the already-authored `sweep15-viewer-authority-labeling` decision without duplicating its viewer requirement or implementation scope.

## Capabilities

### New Capabilities

- `product-capability-map`: Index structure, classification rules, and meaningful Purpose coverage.

### Modified Capabilities

- None.

## Impact

Docs only: durable spec index/Purpose text plus `openspec/changes/deferred/` trace metadata. No application code or runtime behavior is implemented by this change.

## Non-goals

- No viewer authority/header requirement or implementation; `sweep15-viewer-authority-labeling` owns that P1 change.
- No activity escalation type, dashboard surface, or implementation plan.
- No rewrite of requirement bodies unrelated to viewer labeling.
