# Spec Delta

## ADDED Requirements

### Requirement: Accessible draft-hidden signal in report review

The draft-hidden signal MUST keep a polite live region (`role="status"`, `aria-live="polite"`) mounted while the section filter is shown in review, and MUST render only its notice text conditionally inside that region, so that a draft-hidden notice arriving after a filter switch is announced. The `Show all` action MUST stay outside the live region and MUST expose contextual naming (`aria-label="Show all sections including drafts"`).

#### Scenario: head opens a report with drafts and zero submissions

- **WHEN** the head opens a live report where leads have draft content but no section is yet submitted (`Live · 0/N Submitted`)
- **THEN** the live region is already in the DOM before the filter is switched, and it gains the draft-hidden notice text when the default submitted-only view hides drafts
- **AND** the no-content empty state is not shown
- **AND** activating `Show all` reveals the current draft content of each section
