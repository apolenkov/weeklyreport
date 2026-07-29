# lint-suppression-adjudication

## ADDED Requirements

### Requirement: Every live suppression MUST have an adjudicated identity

Every inline `eslint-disable`, `eslint-disable-next-line`, and
`eslint-disable-line` parsed from a directive comment MUST have exactly one
ledger record keyed by path, directive source fingerprint, and rule. The record
MUST contain a source-grounded verdict of `remove`, `replace`, or `retain`.
Strings and explanatory prose containing `eslint-disable` MUST NOT count as
live directives, but every such observation from the 126-entry starting raw
snapshot MUST remain recorded as measurement noise.

#### Scenario: A directive moves after a neighboring edit

- **WHEN** its line number changes but path, rule, and source fingerprint still
  identify the same exception
- **THEN** the ledger continues to resolve it
- **AND** no duplicate record is created

### Requirement: Retained suppressions MUST be minimal and proved

A retained suppression MUST name the exact rule, use the narrowest possible
scope, state a concrete current reason, identify its owning surface, and store a
planted proof under the production effective ESLint configuration. File-wide or
multi-rule suppression MUST be rejected unless narrower expression is
demonstrably impossible.

#### Scenario: An external type is stricter than runtime reality

- **WHEN** current source proves a defensive branch is reachable but the
  installed rule flags it from the declared type
- **THEN** a line-scoped retained suppression may be accepted
- **AND** an adjacent unguarded violation still fails the planted probe

### Requirement: Suppression cleanup MUST NOT relocate enforcement debt

Removing an inline directive MUST NOT be credited when the same rule is
disabled or weakened in ESLint configuration, the file is newly excluded, or
equivalent unsafe behavior is hidden behind a cast or helper.

#### Scenario: A directive disappears after a config edit

- **WHEN** effective configuration no longer runs the rule on that file
- **THEN** the ledger marks the attempted cleanup invalid
- **AND** the suppression baseline is not lowered

### Requirement: Completion means zero unresolved adjudications

The change MUST be considered complete only when all 115 starting directives,
all 11 starting measurement-noise observations, and every directive added
during the campaign have a current verdict; every `remove` or `replace` verdict
is implemented; every `retain` verdict has proof; and the baseline equals the
measured retained total.

#### Scenario: Some justified suppressions remain

- **WHEN** all entries meet the adjudication and proof contract
- **THEN** the campaign may complete with a nonzero raw suppression count
- **AND** that count becomes the new ratcheted baseline
