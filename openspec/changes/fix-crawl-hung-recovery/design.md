## Context

See proposal.md. Saved results are in same-origin sessionStorage. Browser recovery can fail independently and the existing run policy recognizes coverage-incomplete findings.

## Goals / Non-Goals

Keep observed evidence without executing screenshot or restore operations against an unknown recovered page. No browser adapter, request-budget change or traversal policy expansion.

## Decisions

Read recovery evidence first and return its error explicitly. Attempt dismissal and page load independently with existing CLI bounds. Return a restoration status alongside the original timeout; the round owner records recovered actions and ends the page when restoration fails.

Represent unmeasured request use as null and retain the original reservation until expiry. A zero would falsely claim a measurement; resetting the budget would permit excess requests.

## Risks / Trade-offs

- Unrestored pages cannot supply new screenshots: recovered records retain only observed timings and logs.
- Recovery itself can fail: report its separate cause and incomplete coverage.

## Rollout

No migrations, feature flags or API/web changes. Period dual-state, role coverage and destructive database guards remain unchanged. Rollback is the group commit.
