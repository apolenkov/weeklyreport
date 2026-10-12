## ADDED Requirements

### Requirement: Record text feedback uses the existing schema metric

The shared record textarea count and overflow state SHALL measure Unicode code points consistently with the governing shared text schema. Numeric limits and associated error/hint references SHALL remain unchanged. Over-limit drafts SHALL remain available without truncation or a new native `maxlength`.

#### Scenario: A schema-valid non-BMP field

- **WHEN** the current 500-point field contains 500 non-BMP code points and no other error
- **THEN** its count is 500 and the field is not marked invalid for length

#### Scenario: A non-BMP field overflows

- **WHEN** the field contains 501 non-BMP code points
- **THEN** its count is 501, feedback identifies one point over the limit and the complete value remains

#### Scenario: Combining marks remain separate points

- **WHEN** the field contains 250 visible letters each followed by one combining mark
- **THEN** the count remains 500, matching the existing schema rather than a new grapheme policy
