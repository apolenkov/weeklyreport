# by-lead-referenced-content Specification

## Purpose

Keep referenced-product contributions visible in read-only by-lead reports
without changing product ownership or mixing authors' content.

## Requirements

### Requirement: By-lead report preserves referenced-product contributions

The weekly report's by-lead scope SHALL render a read-only product card when a
lead's section contains report content parented to a named referenced product.
The card SHALL contain only that lead's items, risks, decisions, priorities, and
applicable Needs Attention content. A referenced product with no such content
MUST NOT create an empty card.

#### Scenario: Referenced-only risk and decision remain visible

- **WHEN** a lead records a risk and decision against a product present only in
  the section's `referencedProjects`
- **THEN** by-lead scope renders a card with the referenced product's real name
- **AND** the card contains that lead's risk and decision

#### Scenario: Referenced product separates authors

- **WHEN** two leads record content against the same referenced product
- **THEN** each lead's card contains only that lead's records
- **AND** neither lead receives the other lead's records

#### Scenario: Editable product ownership is unchanged

- **WHEN** a referenced-only product is added to the by-lead reviewer projection
- **THEN** it does not become a stage-owned editable product in the lead form
