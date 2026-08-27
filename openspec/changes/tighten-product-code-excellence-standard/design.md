## Context

The durable `lint-max-strictness-standard` currently pins maintained product
code at 300 counted lines per file, 70 counted lines per function, cyclomatic
complexity 20, and cognitive complexity below 10. The accepted CustomReport
product-excellence goal requires 230, 57, 10, and below 10 respectively, but a
global configuration flip would make the repository red before its actual debt
and scope were proven.

The repository already owns the relevant mechanisms: `classifyExemplaryFile`
classifies repository roles, the exemplary inventory measures product scope,
the exemplary-floor ratchet protects monotonic progress, and ESLint policy
probes verify effective configuration. This change extends those owners instead
of creating a parallel gate. It changes engineering policy only; request paths,
API contracts, Prisma data flow, Redis coordination, and the period dual-state
and role-coverage invariants remain unchanged.

### Planning measurement

On source commit `823b239cdc80312ecdf9eee3fd44b8a0618bffa4` and tree
`c9381080cf9ab529ce16a579a94fc9c0b3cb2189`, a read-only ESLint run over the
975 tracked files currently classified as `product` found 67 candidate
violations in 60 files: 23 `max-lines`, 16 `max-lines-per-function`, 27
cyclomatic `complexity`, and one `sonarjs/cognitive-complexity`. The affected
file denominator is 15 API, 44 web, zero shared, and one UI file. A control run
over unclassified `src` input produced 820 findings in 404 files because it
included tests; that result is intentionally rejected as a product baseline.

These counts are planning evidence, not an accepted enforcement baseline. They
remain `NOT-PROVEN` until apply records the command and effective config in a
durable evidence artifact and planted probes prove all four exact boundaries,
including cognitive complexity 9/10, on the same exact source tree.

## Goals / Non-Goals

**Goals:**

- Make 230 counted lines per file, 57 counted lines per function, cyclomatic
  complexity at most 10, and cognitive complexity below 10 the durable standard
  for all maintained production code.
- Give every non-product scope an explicit, tested repository role rather than
  a hidden path exemption.
- Prove the denominator and every candidate gate mechanically before changing
  enforcement.
- Move folder by folder on a monotonic ratchet, with fixes and enforcement
  landing together and zero structural exemptions at completion.
- Remove or deliberately migrate obsolete paths, duplicate enforcement, and
  historical suppressions encountered by the migration.

**Non-goals:**

- Change user-visible behavior, UI, API contracts, database schemas, runtime
  acceptance denominators, deployment policy, or credentials.
- Apply production-code budgets unchanged to tests, generated output, fixtures,
  seeds, configuration, or externally constrained adapters.
- Introduce a second classifier, lint orchestrator, baseline system, or quality
  framework.
- Turn all stricter rules on globally before the maintained product denominator
  is compliant.

## Decisions

### 1. Durable policy changes before implementation

This OpenSpec delta becomes the authority for the stricter targets before
documentation, ESLint configuration, probes, ratchets, or product modules are
changed. The implementation will then keep the spec, standard document, gate
configuration, probes, and baselines coherent in each relevant slice.

Alternatives rejected:

- Editing ESLint first would contradict the current durable spec.
- Leaving the targets only in a campaign goal would make enforcement authority
  temporary and ambiguous.

### 2. One role classifier owns the denominator

`scripts/quality/exemplary/exemplary-file-kind.ts` remains the single owner for
repository-role classification. The implementation may extend its explicit
role vocabulary and metadata where the accepted spec requires it, but MUST NOT
add per-file size allowlists or a second path classifier. Classifier tests and
policy probes must demonstrate that maintained source cannot escape through a
test, tooling, config, generated, fixture, seed, or adapter role.

Alternatives rejected:

- Directory-only exemptions are easy to broaden accidentally and do not carry
  ownership or rationale.
- Inline ESLint suppressions conceal debt from the central inventory.

### 3. Measure shippable options before selecting enforcement

For each structural rule or scope change, the exemplary audit process will run
all shippable options against the same product denominator and record exact
counts, affected files, exit codes, and effective config. A zero is real only
after a temporary planted violation fails predictably and the clean worktree is
restored. Results are classified `REAL`, `VACUOUS`, `CONFIG`, or `NOISE`; only
`REAL` measurements enter the ratchet or support compliance claims.

Alternatives rejected:

- Using a successful command alone cannot distinguish genuine coverage from an
  empty match or broken resolver.
- Reporting sampled counts would not establish the full denominator.

### 4. Ratchet by reviewable product slice

The existing exemplary-floor mechanism remains the ratchet owner and will be
extended, if necessary, to track exact structural-rule debt by product slice.
Migration proceeds through bounded domains or folders. A slice first gets a
reproducible baseline, then reaches zero, and lands the fix together with its
enforcement and boundary probes on a green tree. No baseline increase,
justified structural regression, path-specific limit increase, or inline
suppression is accepted.

The intended order is:

1. The already-clean shared package, followed immediately by API code that
   protects the period dual-state and canonical role-coverage middleware
   invariants.
2. Remaining API domains and workers.
3. Web features and route-level composition.
4. The UI package, whose one affected file is unrelated to the load-bearing
   API invariants.
5. Global threshold activation, obsolete override removal, and final inventory.

The ordering protects load-bearing invariants early while keeping each change
small enough for targeted review and tests.

Alternatives rejected:

- A single repository-wide rewrite has excessive review and regression risk.
- Deferring enforcement until all refactors finish allows new debt to enter
  already-clean areas.

### 5. Structural refactors preserve behavior

Refactors must extract cohesive domain behavior, keep dependency direction
explicit, prefer immutable transformations, and preserve public contracts.
Every touched behavior path receives focused unit or integration tests before
the slice's full relevant gates run. Any query-semantic or behavior change is a
separate OpenSpec change rather than hidden inside this migration.

### 6. Cleanup decisions are explicit

Every apparently dead path, stale workflow, duplicate quality mechanism, or
historical suppression encountered during apply is recorded as `REMOVE`,
`MIGRATE`, or `RETAIN`. `RETAIN` requires a current owner, rationale, and
executable consumer or policy evidence. Cleanup remains in the slice where the
evidence is available; speculative deletion is not permitted.

## Risks / Trade-offs

- **Large refactor surface can introduce behavior regressions.** Mitigation:
  bounded slices, public-contract preservation, focused tests, and green gates
  before each ratchet movement.
- **A zero count can be vacuous.** Mitigation: planted violations, effective
  config inspection, resolver-health evidence, and explicit result classes.
- **Role classification can hide product code.** Mitigation: one classifier,
  metadata and probes for every exceptional role, and negative escape tests.
- **Framework or generated files can create irrelevant noise.** Mitigation:
  separately measured role scopes rather than weakening product thresholds.
- **Concurrent OpenSpec or product changes can invalidate a baseline.**
  Mitigation: remeasure on the exact source tree and keep one integration writer
  for overlapping slices.
- **Smaller units may add indirection.** Mitigation: extract only cohesive domain
  concepts and reject line-count splitting that does not improve ownership or
  dependency direction.

## Migration Plan

1. Inventory the exact maintained-product denominator through the existing role
   classifier and record all exceptional roles with owners and probes.
2. Measure every structural rule on the exact source tree, including boundary
   fixtures and planted violations; classify all results.
3. Extend the existing exemplary baseline and ratchet only where the current
   counters cannot represent exact structural debt.
4. Refactor and enforce one product slice at a time in the decided order, with
   focused tests and relevant gates on every slice.
5. Enable the global 230 / 57 / 10 / below-10 configuration only after the
   maintained-product inventory is zero; remove obsolete overrides and
   structural suppressions in the same change.
6. Align `docs/exemplary-code-standard.md`, policy probes, baseline fixtures,
   and gate documentation; run the complete repository gate set.
7. Re-run the exact inventory and planted probes on the final source tree and
   archive the evidence with its source SHA and tree.

Rollback is commit- or slice-scoped: revert the affected refactor and its
paired enforcement together. Do not weaken the durable target or silently raise
a baseline as rollback.
