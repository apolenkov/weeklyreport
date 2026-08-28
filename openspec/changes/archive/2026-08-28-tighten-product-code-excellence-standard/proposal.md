## Why

CustomReport is expected to be understandable and safely changeable even by a
new engineer, but the current maintained-product limits still allow 300-line
files, 70-line functions and cyclomatic complexity 20. The accepted product
goal and the current inventories in `docs/exemplary-code-standard.md`,
`eslint-config/`, `scripts/quality/exemplary/` and
`scripts/eslint/policy/` require a stricter, source-of-truth standard before
implementation can honestly enforce smaller units.

## What Changes

- Tighten maintained production code to at most 230 counted lines per file, at
  most 57 counted lines per function, cyclomatic complexity at most 10 and
  cognitive complexity below 10.
- Define the maintained product surface and require generated, test, fixture,
  seed, configuration and externally constrained adapter code to use an
  explicit role-based classification rather than a hidden exemption.
- Require measured shippable-option counts, planted-probe proof and
  REAL/VACUOUS/CONFIG/NOISE classification before changing any mechanical gate.
- Require a monotonic folder-by-folder ratchet: fixes and enforcement land
  together on a green tree, counted debt only decreases, and no per-file or
  inline suppression can substitute for compliance.
- Keep immutable-by-default production code and remove unclassified mutation,
  stale historical workflow, dead product paths and duplicate tooling through
  reviewed REMOVE/MIGRATE/RETAIN decisions.

### Non-goals

- Changing product behavior, UI, API contracts, database schema or runtime
  acceptance denominators.
- Enabling the stricter thresholds globally before the measured product code is
  compliant.
- Applying product-code size budgets unchanged to tests, generated output,
  fixtures, seeds or framework-mandated adapters.
- Creating production infrastructure, credentials or deployment policy.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `lint-max-strictness-standard`: Tighten maintained-product size and
  cyclomatic thresholds and make their scope, measurement and ratchet authority
  explicit.

## Impact

The durable spec, `docs/exemplary-code-standard.md`, `eslint-config/*.ts`,
policy probes, exemplary-floor/directory-architecture gates, and maintained
source under `apps/*/src` and `packages/*/src` will be affected during apply.
No dependency, API, database or user-visible behavior change is introduced by
the standard itself.
