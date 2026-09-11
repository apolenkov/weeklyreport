# dashboard-record-count Specification

## Purpose

Make review-dashboard record totals count each persisted product item, risk,
and decision exactly once.

## Requirements

### Requirement: Dashboard record totals count distinct persisted records

The review dashboard SHALL derive each lead's product record total from the
number of product-parented items, risks, and decisions. An item's priority rank
SHALL remain a separate classification and MUST NOT add another record to the
total.

#### Scenario: A prioritized item remains one record

- **WHEN** a lead section contains one product item with a priority rank and no
  risks or decisions
- **THEN** the dashboard maps the section to one product record
- **AND** it maps one priority
- **AND** the lead summary labels the total as `1 record`

#### Scenario: Different record types contribute independently

- **WHEN** a lead section contains product-parented items, risks, and decisions
- **THEN** each persisted record contributes exactly one to the product record total
- **AND** priority classifications do not change that total
