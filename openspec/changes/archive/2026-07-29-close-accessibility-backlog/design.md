## Context

The current sweep reports 47 axe violations across 51 role-route visits. The
inventory contains only two rule families (`color-contrast` and
`heading-order`), with the same selectors repeated across roles and redirects.
The dominant shared cause is the muted text token; heading defects come from
reusable report and slide content rendered without the preceding level.

The sweep currently writes reports and always passes. This makes the number
visible but does not make it decrease.

## Goals / Non-Goals

**Goals:**

- Reduce the current four-role axe result to zero.
- Preserve the report even when the sweep fails.
- Make a future axe violation fail `test:uat`.
- Prove the scanner and verdict with a planted browser defect.
- Preserve all business behavior and existing repository policy.

**Non-Goals:**

- Redesigning the product or changing authorization/domain semantics.
- Deleting justified lint suppressions or surface-specific ESLint policy.
- Adding a dependency or database migration.

## Decisions

### Fix shared causes before route-specific symptoms

The muted foreground token will be adjusted to meet WCAG AA on every shipped
light surface. Remaining direct color failures will be fixed at their owning
component. This is preferred to adding route-specific classes because the same
failure repeats across roles and components.

Alternative rejected: suppressing axe selectors or excluding contrast rules.
That would make the report empty without making the UI readable.

### Repair semantic levels at reusable content boundaries

Components that currently jump from `h1` to `h3` will expose the correct `h2`
level or accept an explicit level from their parent where reuse requires it.
Typography remains CSS-driven, so changing semantic rank does not require a
visual redesign.

### Keep reports, then fail

Each role test will finish its route walk, write and attach the Markdown report,
then assert that the anomaly set is empty. Playwright continues running the
remaining role tests after one failure, so all four reports remain available.

### Prove the detector with a real browser violation

A small Playwright probe will render intentionally low-contrast text, run the
same axe integration, and assert that `color-contrast` is detected. This proves
that zero means a clean DOM rather than a disabled or empty scanner.

### Preserve completed policy campaigns

The suppression ledger and ESLint-scope probes remain blocking. Their durable
specifications define completion as zero unresolved/unjustified debt, not zero
configuration blocks. Their live counts are evidence, not open defects.

## Risks / Trade-offs

- **Darker muted text changes visual tone** -> choose the smallest token change
  that passes and inspect representative routes in Chromium.
- **Axe can report duplicate symptoms after redirects** -> completion uses the
  measured full sweep, while implementation groups duplicates only for repair.
- **Blocking UAT can expose future legitimate false positives** -> require a
  source-grounded fix; do not add a generic allowlist in this change.
- **Heading changes can affect CSS selectors** -> preserve classes and add
  component tests for semantic rank.

## Migration Plan

1. Add the blocking verdict and planted detector proof.
2. Apply token and semantic-heading repairs.
3. Run UAT until all four reports contain zero anomalies.
4. Run integration, production, CSP, unit, lint, typecheck, build, and strict
   OpenSpec validation.
5. Archive the change and update every continuation artifact.

Rollback is a normal revert; there is no data migration or feature flag.

## Invariants

Period dual-state, role-coverage middleware, destructive database guard, and
deferred-feature behavior are untouched.

## Open Questions

None.
