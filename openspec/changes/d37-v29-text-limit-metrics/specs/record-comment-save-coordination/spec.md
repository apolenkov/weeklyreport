## ADDED Requirements

### Requirement: Comment counts use the current shared schema metric

The review-comment count SHALL measure Unicode code points, matching the existing shared validation maximum. It SHALL NOT count graphemes or UTF-16 units instead. The existing maximum, validation, trim behavior and complete over-limit draft retention SHALL remain unchanged.

#### Scenario: A boundary-valid non-BMP comment

- **WHEN** a reviewer pastes 2,000 non-BMP code points through the current composer
- **THEN** its associated count is 2,000 and the current schema-valid comment can be submitted

#### Scenario: A non-BMP overflow is corrected

- **WHEN** a reviewer pastes 2,001 non-BMP code points
- **THEN** the complete draft remains with a count of 2,001 and no mutation runs
- **AND** correcting it to 2,000 permits one comment command
