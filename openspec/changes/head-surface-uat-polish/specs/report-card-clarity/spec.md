# report-card-clarity Specification

## MODIFIED Requirements

### Requirement: Needs Attention never duplicates an item

A product's escalation ("needs attention") SHALL fold into the Risks & Blockers
section as a leading row rather than render as a separate "Needs Attention"
banner, and SHALL be suppressed when its text matches the text of a row already
rendered in the same product card — whether a current/next-week item or a risk.
When it renders, it SHALL add information beyond what the item and risk rows
already show, and it SHALL carry a Flagged identity gutter and a Blocked /
At Risk severity badge. The Risks & Blockers section renders when the product has
either structured risks or a distinct escalation.

#### Scenario: escalation text equals a shown item

- **WHEN** a product's escalation text is identical to a current-week item's text
- **THEN** no escalation row renders that duplicate text

#### Scenario: escalation text equals a shown risk

- **WHEN** a product's escalation text is identical to a rendered risk's text
- **THEN** no escalation row renders above the duplicate risk

#### Scenario: escalation adds information

- **WHEN** a product's escalation is a distinct head-facing summary
- **THEN** it renders as a leading row inside Risks & Blockers with a Flagged
  gutter and a Blocked / At Risk badge
- **AND** no standalone "Needs Attention" banner appears
