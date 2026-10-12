## ADDED Requirements

### Requirement: Active Activity empty state follows the search filter

The active Activity list MUST show its no-active-data message when its filtered list is empty without a nonblank search, including when only archived rows exist. A nonblank search with no active matches MUST show the search empty message. Accepted archived names MUST remain complete with wrapping beside Restore.

#### Scenario: Only archived activities exist

- **WHEN** the active list is empty and search is blank
- **THEN** it shows No active activities yet and retains the archived list

#### Scenario: Search has no matches

- **WHEN** a nonblank filter produces zero active matches
- **THEN** the active list shows No activities match the search

#### Scenario: Archived name is unbroken

- **GIVEN** an archived Activity has an accepted 200-character unbroken name
- **WHEN** the row renders
- **THEN** its name can shrink and wrap beside its Restore control without truncating the content
