# Proposal

## Why

Three admitted UI sequences lose current state: parent changes retain a stale decision-stage error, an unpinned report visit pins a cached former active report, and overlapping archive/scope navigation drops an earlier selection. TASK-503 C2494, C2665 and C3311 were independently code-confirmed and assigned by wrk-42.

## What Changes

- Clear stage validation when a decision parent changes while preserving required-stage validation and implicit singleton selection.
- Resolve an unpinned weekly-report visit from a successful fresh active-report request before pinning its ID; preserve explicit report selection and retained background content.
- Compose overlapping archive/scope selections through the shared report-shell URL owner; external navigation supersedes queued selections.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `risk-stage-integrity`: stage errors reflect the current decision parent.
- `head-report-visibility`: an initial unpinned entry resolves the current active report rather than a former cached identity.
- `web-shared-idioms`: independent report-shell selections compose before navigation commits.

## Impact

Web decision form state, weekly page query resolution and shared shell URL state with colocated regression tests. No API, persistence, schema or dependency changes. Evidence and review stay in task-503/triage-web/code-fix3; Registry/main publication belongs to codex-wr.
