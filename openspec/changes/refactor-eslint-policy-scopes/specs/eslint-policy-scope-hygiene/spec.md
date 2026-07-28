# eslint-policy-scope-hygiene

## ADDED Requirements

### Requirement: Every ESLint file scope MUST have an effective-config verdict

Every `files:` block in `eslint.config.ts` MUST have one evidence-backed primary
classification: enforcement, policy, specialization, duplicate, or relaxation
debt. Classification MUST compare effective ESLint configuration for matching
and nonmatching representative files.

#### Scenario: Two blocks look textually similar

- **WHEN** their parser context, plugin availability, rule options, or matched
  files differ
- **THEN** they MUST NOT be classified as duplicates from source text alone

### Requirement: Useful policy scopes MUST be preserved

A block that enables surface-specific enforcement, encodes an architectural
boundary, or supplies necessary parser/plugin/environment specialization MUST
remain unless another structure proves equivalent intended effective coverage.

#### Scenario: Package exports require public JSDoc policy

- **WHEN** a package-source scope enables public-export documentation without
  applying that rule to application internals
- **THEN** consolidation MUST preserve that positive and negative coverage

### Requirement: Duplicate and relaxation-debt scopes MUST be removed

A proven duplicate MUST be consolidated. A block that disables or weakens
policy without current evidence MUST be removed or redesigned. Cleanup MUST NOT
replace block debt with ignores, inline directives, or a broader disabled rule.

#### Scenario: A block lowers a rule for one legacy file family

- **WHEN** current source and planted probes do not justify that relaxation
- **THEN** the source is fixed or the policy is redesigned
- **AND** the relaxation is not retained for compatibility history

### Requirement: Scope coverage MUST have planted proof

Every retained scope family MUST have a positive probe that fails under its
intended rule and a nearby negative probe showing the rule does not leak into
an unintended surface. Probes MUST use installed production ESLint settings.

#### Scenario: A selector changes

- **WHEN** its glob accidentally stops matching an intended representative
- **THEN** the positive probe fails the main gate

### Requirement: Completion is classification-clean, not count-zero

The change MUST be considered complete only when no block is unclassified, no proven duplicate
remains, no unjustified relaxation debt remains, all retained families have
proof, and the baseline equals the measured retained block count.

#### Scenario: Necessary blocks remain

- **WHEN** retained blocks are distinct and fully proved
- **THEN** a nonzero `overrideBlocks` count is an acceptable completed state
