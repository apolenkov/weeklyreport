## ADDED Requirements

### Requirement: The head deck shows its skeleton while mismatched live activity refetches

When the head deck needs the activity fallback and the cached live-activity
response belongs to another report than the selected active report, the deck
MUST treat the activity read as loading while it refetches and MUST show the
slide skeleton, not an empty deck. The skeleton is not shown for a matching
response or when the activity read is not fetching.

#### Scenario: Stale activity from another period refetches

- **GIVEN** the selected active report has no sections and the cache holds live activity of another report
- **WHEN** the activity read refetches
- **THEN** the slide skeleton is shown
- **AND** no deck is rendered
