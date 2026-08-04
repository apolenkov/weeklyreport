## MODIFIED Requirements

### Requirement: Size and complexity thresholds are pinned with exempt directories

The standard MUST pin `max-lines` at 300 with `skipBlankLines: true` and
`skipComments: true`, `max-lines-per-function` at 70, cyclomatic complexity at no
more than 20, and `sonarjs/cognitive-complexity` below 10. The maintained product
surface MUST also reject avoidable `let`, reassignment, and in-place mutation. Tests,
generated sources, seeds, and configuration MAY use separately measured rule scopes
only when their repository role makes the product rule inapplicable; a maintained
product file MUST NOT use such a scope as an exemption.

#### Scenario: A long generated file is not flagged for size

- **WHEN** the standard enforces `max-lines`
- **THEN** a 600-line file under `prisma/generated` is not reported
- **AND** a 301-line hand-written product file is reported
- **AND** a 300-line hand-written product file is accepted by `max-lines`
- **AND** the threshold counts neither blank lines nor comments

#### Scenario: A product function exceeds the limit

- **WHEN** a hand-written product function contains more than 70 counted lines or has
  cognitive complexity of 10 or greater
- **THEN** ESLint reports the function at error severity
- **AND** no product-path override raises either limit

#### Scenario: Product code uses avoidable mutation

- **WHEN** a maintained product module uses `let`, reassignment, or in-place mutation
  without an externally imposed mutation boundary
- **THEN** the effective ESLint configuration reports the construct at error severity
- **AND** the correction expresses the transformation immutably rather than hiding it
  behind a cast or suppression

### Requirement: All product source reaches the exemplary standard wave-by-wave

Every product source file SHALL satisfy the Exemplary Code Standard: file at most 300
lines, functions at most 70 lines, cognitive complexity under 10, zero avoidable
`let`/reassignment/in-place mutation, and no silent product-configuration fallback.
No product file may remain in an `eslint.config.ts` exemption or carry an inline
suppression at campaign completion. The rollout proceeds in dependency-aware slices,
and each changed slice receives focused verification and adversarial final-blob review
before its verdict becomes terminal.

#### Scenario: A wave brings a slice to the standard

- **WHEN** a rollout wave completes for a product slice
- **THEN** every reworked product file passes ESLint with zero errors and zero warnings
  under the universal thresholds and without a slice-scoped exemption
- **AND** focused tests, typecheck, and applicable lint gates pass before the files are
  assigned final verdicts
- **AND** runtime behavior remains unchanged unless an explicit durable-spec delta
  authorizes the semantic change

#### Scenario: A supposedly permanent product exception remains

- **WHEN** a product file is listed in a permanent or grandfathered ESLint override at
  final completion
- **THEN** the universal-floor check fails
- **AND** the file MUST be refactored rather than accepted as exemplary

#### Scenario: Readability conflicts with a mechanical rewrite

- **WHEN** a proposed lint correction would obscure domain intent or create indirect,
  harder-to-follow control flow
- **THEN** the implementation is redesigned into smaller named units that satisfy the
  rule and remain understandable to a junior maintainer
- **AND** the rule is not weakened merely to preserve the original structure

## ADDED Requirements

### Requirement: Strict rules require measured ownership probes

Each enabled or retained strict rule family MUST have measured repository signal,
documented scope ownership, and a planted positive probe that fails through the same
aggregate command used at completion. Where false-positive boundaries matter, the
probe suite MUST include a nearby valid negative case.

#### Scenario: A rule is configured but not reached by the gate

- **WHEN** a planted violating fixture passes the aggregate lint command because the
  file or rule is outside effective scope
- **THEN** the strictness verification fails
- **AND** the rule MUST NOT be credited as enforced

#### Scenario: A proposed rule duplicates formatter ownership

- **WHEN** an ESLint rule checks whitespace or layout already normalized by Prettier
- **THEN** the duplicate rule is not enabled
- **AND** Prettier remains the single owner of that formatting concern
