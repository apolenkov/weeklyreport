# lint-suppression-adjudication Specification

## Purpose

Keep every live ESLint suppression minimal, explicitly owned and proven under
the effective configuration without retaining resolved historical records.

## Requirements

### Requirement: Every live suppression MUST have one current retained identity

Every inline `eslint-disable`, `eslint-disable-next-line`, and
`eslint-disable-line` parsed from a directive comment MUST have exactly one
ledger record keyed by path, source fingerprint, and rule. The ledger MUST
contain only directives that remain live in the current tree; resolved and
measurement-noise records MUST NOT remain in the active ledger.

#### Scenario: A directive moves after a neighboring edit

- **WHEN** its line number changes but path, rule, and source fingerprint still
  identify the same exception
- **THEN** the ledger continues to resolve it
- **AND** no duplicate record is created

#### Scenario: A resolved directive remains in the ledger

- **WHEN** a ledger identity has no matching live directive
- **THEN** the suppression gate fails and names the stale record

### Requirement: Retained suppressions MUST be minimal and proved

A retained suppression MUST name one exact rule, use the narrowest possible
scope, state a concrete current reason, identify its owning surface, and carry a
planted proof under the production effective ESLint configuration. File-wide or
multi-rule suppression MUST be rejected unless narrower expression is
demonstrably impossible.

#### Scenario: An external type is stricter than runtime reality

- **WHEN** current source proves a defensive branch is reachable but the
  installed rule flags it from the declared type
- **THEN** a line-scoped retained suppression may be accepted
- **AND** an adjacent unguarded violation still fails the planted proof

### Requirement: Suppression cleanup MUST NOT relocate enforcement debt

Removing an inline directive MUST NOT be credited when the same rule is
disabled or weakened in ESLint configuration, the file is newly excluded, or
equivalent unsafe behavior is hidden behind a cast or helper. Maintained product
source MUST contain zero inline suppression directives and zero path-specific
rule weakening.

#### Scenario: A directive disappears after a config edit

- **WHEN** effective configuration no longer runs the rule on that file
- **THEN** the cleanup is rejected as enforcement weakening

#### Scenario: A product suppression appears

- **WHEN** a maintained product file contains an ESLint directive or is named
  by a rule-weakening override
- **THEN** the product-floor gate exits nonzero
- **AND** a ledger record cannot waive the failure
