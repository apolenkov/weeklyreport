# lint-suppression-adjudication Specification

## Purpose

Adjudicate every ESLint suppression with source evidence, keep retained directives minimal and proved, and complete only with zero unresolved dispositions.

## Requirements

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

The suppression campaign MUST be considered complete only when all starting
directives, all starting measurement-noise observations, and every directive or
configuration exemption added during the campaign have a current verdict; every
`remove` or `replace` verdict is implemented; and every retained non-product verdict
has a current planted proof. The final product surface MUST contain zero inline ESLint
suppression directives and zero per-file or per-slice rule exemptions. The measured
baseline MUST equal the retained non-product total.

#### Scenario: A justified non-product suppression remains

- **WHEN** a generated adapter, test harness, or other explicitly non-product surface
  has a retained directive satisfying the identity, minimality, reason, and planted-
  proof contract
- **THEN** the campaign may complete with that non-product directive in the measured
  baseline
- **AND** it does not place any product file outside catalogue class `A`

#### Scenario: A product suppression remains

- **WHEN** any final `kind: "product"` file contains an ESLint directive or is named
  by a rule-weakening override
- **THEN** the suppression completion check exits nonzero
- **AND** a retained verdict or explanatory comment cannot waive the product-floor
  failure

#### Scenario: Some justified suppressions remain

- **WHEN** all retained non-product entries meet the adjudication and planted-proof
  contract
- **THEN** the campaign may complete with a nonzero raw suppression count
- **AND** that count becomes the new ratcheted non-product baseline

### Requirement: Configuration exemptions are adjudicated like inline directives

Every `files`, `ignores`, or rule-severity entry that weakens effective ESLint
coverage for a subset of maintained files MUST have a stable ledger identity, exact
matched-path inventory, current rationale, and planted proof. An exemption removed
from configuration MUST not be credited if equivalent debt moves to another tool,
path classification, helper, or unsafe cast.

#### Scenario: An override matches more files than its rationale names

- **WHEN** effective-config enumeration shows that an ESLint override matches paths
  outside its adjudicated inventory
- **THEN** the exemption proof fails
- **AND** the configuration MUST be narrowed or removed

#### Scenario: A directive is replaced with an unsafe cast

- **WHEN** a suppression disappears but the same unsafe operation is hidden behind
  `as unknown as`, `any`, or an unvalidated wrapper
- **THEN** the disposition remains unresolved
- **AND** neither the suppression count nor the exemplary-floor count is credited
