## Why

The UI works, but the current four-role sweep records 47 accessibility
violations: low text contrast and skipped heading levels. These are repeated
symptoms of a smaller set of shared UI causes, and the report-only sweep lets
them remain indefinitely.

The evidence is the current
`e2e/sweep/.reports/{admin,head,lead,viewer}.md` inventory: 19 + 15 + 8 + 5
anomalies. The existing `behavioral-ui-regression-gate` explicitly keeps axe
results non-blocking, while `uat-quality-gates` does not require an empty axe
result.

## What Changes

- Repair every current contrast and heading-order root cause without changing
  business behavior.
- Make the four-role UAT sweep fail when axe reports any violation.
- Keep route, role, console, and broken-state coverage unchanged.
- Add regression proof that the sweep still detects a planted accessibility
  defect, so a future empty result cannot come from a disabled scanner.
- Re-run business E2E and repository gates after the UI repair.
- Record before/after evidence in the roadmap data, report, HTML artifact, and
  durable handoff.

### Non-goals

- Forcing the 72 proved suppressions or 26 proved ESLint scopes to zero. Their
  existing specifications define completion as fully justified and
  mechanically proved, not numerically empty.
- Redesigning product flows, visual identity, authorization, or domain logic.
- Claiming server-side CI execution while GitHub Actions history is
  intentionally empty.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `behavioral-ui-regression-gate`: replace the phase-1 non-blocking axe verdict
  with a blocking zero-violation contract while keeping scenario discovery
  report-oriented.
- `uat-quality-gates`: require zero axe violations across all four roles and a
  planted proof that the accessibility gate detects a real defect.
- `ratcheted-quality-debt`: record the proved suppression improvement from 72
  to 71 without misclassifying the 26 necessary policy scopes as unfinished.

## Impact

- Frontend tokens and semantic headings under `apps/web` and `packages/ui`.
- `e2e/sweep` verdict logic, tests, and generated ignored reports.
- OpenSpec, campaign roadmap/report/HTML, and durable handoff.
- No API, database, dependency, or intentional business-behavior change.
