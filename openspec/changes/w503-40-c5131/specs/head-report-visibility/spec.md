# Spec Delta

## ADDED Requirements

### Requirement: Accessible draft-hidden signal in report review

The draft-hidden signal MUST be accessible to assistive technologies via a polite live region (`role="status"`, `aria-live="polite"`), and its `Show all` action MUST expose contextual naming (`aria-label="Show all sections including drafts"`).

#### Scenario: head opens a report with drafts and zero submissions

- **WHEN** the head opens a live report where leads have draft content but no section is yet submitted (`Live · 0/N Submitted`)
- **THEN** the default submitted-only view shows a draft-hidden signal rather than the empty state
- **AND** the draft-hidden signal has a polite live region (`role="status"`, `aria-live="polite"`)
- **AND** the `Show all` button provides assistive-technology context via `aria-label="Show all sections including drafts"`
- **AND** activating `Show all` reveals the current draft content of each section
- **AND** the no-content empty state is not shown
