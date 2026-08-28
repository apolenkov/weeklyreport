## MODIFIED Requirements

### Requirement: Size and complexity thresholds are pinned with exempt directories

The standard MUST pin maintained product code to `max-lines` at 230 with
`skipBlankLines: true` and `skipComments: true`, `max-lines-per-function` at 57
counted lines with blank lines and comments excluded, cyclomatic complexity at
no more than 10, and `sonarjs/cognitive-complexity` below 10. The maintained
product surface MUST include hand-written source under `apps/api/src`,
`apps/web/src`, `packages/shared/src`, and `packages/ui/src` unless a file has a
stable, explicit repository role that makes a product rule inapplicable. The
maintained product surface MUST also reject avoidable `let`, reassignment, and
in-place mutation.

Tests, generated sources, fixtures, seeds, configuration, and externally
constrained adapters MAY use separately measured rule scopes only when an
explicit role classification records the scope, owner, rationale, and
executable policy probe. A maintained product file MUST NOT use a path-specific
override, inline suppression, or broad role classification as an exemption from
these thresholds.

#### Scenario: a long generated file is not flagged for size

- **WHEN** the standard enforces `max-lines`
- **THEN** an explicitly classified 600-line generated file under
  `prisma/generated` is not reported by the maintained-product rule
- **AND** a 231-line hand-written product file is reported
- **AND** a 230-line hand-written product file is accepted
- **AND** the threshold counts neither blank lines nor comments
- **AND** a policy probe fails if that generated role is applied to maintained
  product source

#### Scenario: the file threshold accepts its boundary and rejects overflow

- **WHEN** a hand-written product file contains 230 counted lines
- **THEN** the file is not reported by `max-lines`
- **AND** the same file at 231 counted lines is reported
- **AND** test, generated, fixture, seed, config, and externally constrained
  adapter scopes remain separately classified and measured
- **AND** no product-path override raises the file limit

#### Scenario: A product function exceeds the limit

- **WHEN** a hand-written product function contains 57 counted lines, has
  cyclomatic complexity 10, and has cognitive complexity 9
- **THEN** none of those boundaries is reported
- **AND** the same function at 58 counted lines is reported
- **AND** cyclomatic complexity 11 is reported at error severity
- **AND** cognitive complexity 10 is reported at error severity
- **AND** no product-path override raises either limit

#### Scenario: Product code uses avoidable mutation

- **WHEN** a maintained product module uses `let`, reassignment, or in-place
  mutation without an externally imposed mutation boundary
- **THEN** the effective ESLint configuration reports the construct at error
  severity
- **AND** the correction expresses the transformation immutably rather than
  hiding it behind a cast or suppression

### Requirement: All product source reaches the exemplary standard wave-by-wave

Every product source file SHALL satisfy the Exemplary Code Standard: file at
most 230 counted lines with blanks and comments excluded, functions at most 57
counted lines with blanks and comments excluded, cyclomatic complexity at most
10, cognitive complexity under 10, zero avoidable `let`/reassignment/in-place
mutation, and no silent product-configuration fallback. No product file may
remain in an `eslint.config.ts` exemption or carry an inline suppression at
campaign completion. The rollout proceeds in dependency-aware slices, and each
changed slice receives focused verification and adversarial final-blob review
before its verdict becomes terminal.

#### Scenario: A wave brings a slice to the standard

- **WHEN** a rollout wave completes for a product slice
- **THEN** every reworked product file passes ESLint with zero errors and zero
  warnings under the universal thresholds and without a slice-scoped exemption
- **AND** focused tests, typecheck, and applicable lint gates pass before the
  files are assigned final verdicts
- **AND** runtime behavior remains unchanged unless an explicit durable-spec
  delta authorizes the semantic change

#### Scenario: A supposedly permanent product exception remains

- **WHEN** a product file is listed in a permanent or grandfathered ESLint
  override at final completion
- **THEN** the universal-floor check fails
- **AND** the file MUST be refactored rather than accepted as exemplary

#### Scenario: Readability conflicts with a mechanical rewrite

- **WHEN** a proposed lint correction would obscure domain intent or create
  indirect, harder-to-follow control flow
- **THEN** the implementation is redesigned into smaller named units that
  satisfy the rule and remain understandable to a junior maintainer
- **AND** the rule is not weakened merely to preserve the original structure

#### Scenario: Rejected churn classes stay out

- **WHEN** a rollout wave proposes fixes for review findings
- **THEN** changes belonging to the ratified reject-list (`&&`-to-ternary
  rewrites, TODO purges, `.js` import consistency sweeps, empty-catch logging,
  mass magic-string extraction, blanket explicit return types) are excluded
  from the wave

## ADDED Requirements

### Requirement: Structural gate changes require proven measurements

Before a structural threshold, scope, or ratchet changes, the implementation
MUST enumerate every shippable enforcement option, run each option against the
same maintained-product denominator, and record the exact violation count,
affected files, command, exit status, and effective configuration. A zero result
MUST be accepted only after a planted violation proves the resolver and rule can
fail in that scope. Every measured result MUST be classified as `REAL`,
`VACUOUS`, `CONFIG`, or `NOISE`; only `REAL` results MAY justify enforcement or
debt claims.

#### Scenario: A candidate rule reports zero violations

- **WHEN** a candidate structural rule reports zero maintained-product
  violations
- **THEN** the same command is rerun with a temporary planted violation in a
  representative maintained-product file
- **AND** the planted run fails for the expected rule and file
- **AND** the clean run, planted run, effective configuration, and restored
  worktree are recorded before the zero is classified as `REAL`

#### Scenario: A candidate option is not executable

- **WHEN** a shippable candidate rule cannot resolve, crashes, silently skips
  its intended scope, or reports only parser or framework noise
- **THEN** the result is classified as `CONFIG` or `NOISE` rather than product
  debt
- **AND** the option cannot be used to claim compliance or select a threshold

### Requirement: Maintained-product structural debt ratchets monotonically to zero

The implementation MUST migrate the maintained product surface in reviewable
folder or domain slices. For every governed structural rule, a slice MUST land
its fixes and corresponding enforcement together on a green tree. New
violations MUST be rejected immediately, the recorded violation count MUST NOT
increase, and the final repository state MUST have zero maintained-product
violations, path-specific threshold overrides, and inline structural
suppressions.

#### Scenario: A compliant folder lands its enforcement

- **WHEN** a folder or domain slice reaches zero measured violations for a
  governed structural rule
- **THEN** the same change enables or tightens enforcement for that slice
- **AND** executable probes prove the compliant boundary and one-step overflow
- **AND** subsequent changes cannot add a new violation in that slice

#### Scenario: A proposed baseline increases structural debt

- **WHEN** a proposed baseline contains more governed violations than its
  predecessor
- **THEN** the ratchet fails
- **AND** a justification entry or per-file exemption cannot make that increase
  compliant

### Requirement: Obsolete paths and duplicate enforcement receive explicit dispositions

Every stale workflow, dead maintained-product path, duplicate quality tool, and
historical suppression encountered during the migration MUST receive a reviewed
`REMOVE`, `MIGRATE`, or `RETAIN` disposition. A `RETAIN` disposition MUST record
its current owner, present rationale, and executable evidence that the path or
mechanism is still used. Historical provenance alone MUST NOT justify retention.

#### Scenario: A migration encounters an apparently unused path

- **WHEN** a maintained source path or quality mechanism has no demonstrated
  current consumer
- **THEN** it is classified as `REMOVE`, `MIGRATE`, or `RETAIN`
- **AND** `RETAIN` is accepted only with an owner, current rationale, and a
  reproducible consumer or policy probe
- **AND** unclassified obsolete code cannot remain in the completed migration
