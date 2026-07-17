## Why

The viewer Status surface intentionally exposes the current working report, including drafts, while Search remains published-only; without explicit labeling those two authority windows look contradictory. The Product forks section of `docs/reviews/2026-07-15-external-sweep.md` records the fork and the chosen operational-observer model.

## What Changes

- Keep current live-draft visibility and the existing published-or-current read gate.
- Label an open or reopened viewer Status report `Working report — includes drafts`.
- Show the displayed report's `Draft`, `Reopened`, or `Published` state in the viewer header using the shared report header/toolbar model.
- Keep all viewer controls read-only and keep Search published-only.
- Add route/header tests covering live open, reopened, and published reports.

## Capabilities

### New Capabilities

<!-- none -->

### Modified Capabilities

- `viewer-report-navigation`: the viewer report surface explicitly identifies working versus published authority while preserving live Status access.

## Impact

- Viewer report shell and shared report header/toolbar presentation tests.
- No API authorization, report selection, search scope, schema, or lifecycle changes.

## Non-goals

- Switching viewers to published-only Status access.
- Expanding Search to drafts or adding dual search scopes.
- Adding viewer mutation or review authority.
