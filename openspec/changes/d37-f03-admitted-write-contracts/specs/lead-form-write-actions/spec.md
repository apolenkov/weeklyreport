## ADDED Requirements

### Requirement: Reopen feedback and admission measure its submitted payload

The reopen dialog MUST measure its existing trimmed payload in Unicode code points for both limit feedback and Send admission. Its raw editable draft MUST remain intact. The current maximum, optional whitespace-only payload, sending/error/discard behavior and server validation MUST remain unchanged. Other text fields MUST retain their existing normalization.

#### Scenario: Padding exceeds the cap but the normalized reason does not

- **WHEN** a reason has a valid trimmed payload with oversized whitespace padding
- **THEN** the counter and Send gate describe that normalized payload
- **AND** sending delivers the same trimmed payload without altering the visible draft beforehand

#### Scenario: The normalized reason itself exceeds the cap

- **WHEN** the trimmed payload contains 501 code points
- **THEN** Send remains blocked and the complete raw draft stays available
