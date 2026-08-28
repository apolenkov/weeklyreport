## Why

WeeklyReport has strong local quality gates, but a contributor cannot yet tell
which SDLC controls are enforced now and which are prerequisites for the first
production point. The R59 primary-source review found avoidable pre-production
gaps in GitHub Actions token scope, checkout credential retention, ownership,
security reporting, and durable documentation, while external production
controls remain unavailable or intentionally unconfigured.

## What Changes

- Give every current GitHub Actions workflow an explicit read-only permission
  baseline and prevent read-only checkouts from retaining credentials.
- Add repository ownership and private vulnerability-reporting policies for
  sensitive paths and incident response.
- Add a mechanical repository gate that rejects workflow permission or checkout
  regressions.
- Document the complete plan-to-operate SDLC, current evidence, and the exact
  first-production prerequisites without creating a non-functional deployment.
- Update durable CI and dependency-security requirements that still describe
  the former dispatch-only workflow state.

Non-goals:

- Enabling GitHub rulesets, CodeQL, dependency review, secret scanning, or
  protected environments without verified plan support and administrative
  access.
- Publishing images, releases, SBOMs, or attestations before a registry,
  deployment target, and production owner exist.
- Changing application behavior, database schema, dependency versions, or the
  MVP direct-push authorization.

## Capabilities

### New Capabilities

- `repository-security-controls`: Least-privilege workflow execution, checkout
  credential hygiene, sensitive-path ownership, security reporting, and a
  mechanical regression gate.
- `sdlc-release-readiness`: A durable lifecycle contract that separates
  present MVP evidence from mandatory first-production controls.

### Modified Capabilities

- `ci-merge-gate`: Replace the obsolete no-runner/dispatch-only premise with
  the current running CI and explicitly tracked unprotected-main boundary.
- `dependency-vulnerability-scanning`: Describe the scheduled audit as an
  independent control without relying on the obsolete dispatch-only premise.

## Impact

Affected paths are `.github/workflows/`, `.github/CODEOWNERS`,
`.github/SECURITY.md`, `docs/`, the configuration gate under `scripts/gates/`,
the root development dependencies, and the named OpenSpec capabilities. GitHub
settings and external infrastructure remain unchanged and explicitly
unverified where the current token or plan returns `403`.
