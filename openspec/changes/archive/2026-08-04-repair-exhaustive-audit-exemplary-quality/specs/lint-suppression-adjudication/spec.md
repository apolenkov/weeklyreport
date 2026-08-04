## MODIFIED Requirements

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

## ADDED Requirements

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
