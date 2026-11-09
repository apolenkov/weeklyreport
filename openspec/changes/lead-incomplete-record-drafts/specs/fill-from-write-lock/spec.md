## ADDED Requirements

### Requirement: Fill From excludes incomplete source records

Fill From MUST exclude incomplete source risks and decisions before constructing target rows. Complete-source carryability, item mapping, resolution metadata and fresh target identity semantics MUST remain unchanged. Source rows and snapshots MUST NOT be mutated. The entitled source author MUST receive a retained-draft notice and recovery link, not automatic draft copying.

#### Scenario: Mixed source retains complete Fill From behavior

- **GIVEN** an eligible source contains complete and incomplete Product risks and decisions, including a complete resolved decision
- **WHEN** Fill From replaces an eligible target
- **THEN** only complete carryable source rows are copied with fresh stableIds and the complete decision retains the existing resolvedAt mapping
- **AND** incomplete rows remain only in the source, unchanged, with an author-visible recovery notice and link
- **AND** the separate explicit recovery-copy flow resets resolution metadata and requires current target validation

#### Scenario: Product stages change and an Activity is removed

- **GIVEN** source Product stages have been reassigned and a source Activity is no longer attached to the target
- **WHEN** Fill From processes mixed complete and incomplete source records
- **THEN** incomplete Product and Activity records are excluded regardless of incidental mapper carryability
- **AND** complete Product behavior remains governed by existing Fill From rules and removed-Activity rows remain excluded
- **AND** recovery can read the author's retained text but explicit copy cannot reuse an ineligible Product stage or removed Activity

### Requirement: Fill From respects incomplete target deletion intent

Fill From MUST enforce the same explicit kind and stableId deletion intent at the expected target version as other replacement writers. Published-lineage and lifecycle checks remain stronger. Source exclusion MUST NOT be treated as authorization to delete an incomplete target row. Recovery notices MUST use the current-role own-source policy and MUST NOT disclose foreign retained counts or text.

#### Scenario: Incomplete target prevents silent replacement

- **WHEN** Fill From excludes incomplete source rows but would also replace an incomplete target row without explicit deletion intent
- **THEN** the entire replacement rejects before child clearing with target version, rows and comments unchanged
- **AND** the author must complete the target row or explicitly delete it before replacement can succeed

#### Scenario: Explicit target deletion does not copy a source draft

- **WHEN** an authorized author supplies valid deletion intent for an incomplete target at its current version and all other Fill From guards pass
- **THEN** replacement may remove that target identity but still excludes incomplete source rows
- **AND** copied complete records have new identities, source rows remain unchanged and no source comments are cloned
