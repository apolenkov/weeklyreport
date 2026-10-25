## ADDED Requirements

### Requirement: Viewer acknowledgement reads expose only the caller's receipt

For an entitled Viewer, `review.acknowledgements` MUST return an array containing
only the caller's receipt, or an empty array if absent. Each returned row MUST
contain exactly `userId`, `reportId`, `groupId`, and `seenAt`. It MUST NOT expose
`userName`, peer identities, peer receipts, or a count. Reviewer designation MUST
NOT widen this response.

#### Scenario: Viewer has acknowledged alongside peers

- **WHEN** an entitled Viewer reads a report/group with their own and peer receipts
- **THEN** the response contains exactly their own four-field receipt without names
- **AND** the same rule applies whether or not the Viewer is a designated reviewer

#### Scenario: Only peers have acknowledged

- **WHEN** an entitled Viewer has no receipt in a report/group with peer receipts
- **THEN** the response is an empty array

#### Scenario: Only the Viewer has acknowledged

- **WHEN** an entitled Viewer is the only acknowledger for a report/group
- **THEN** their four-field receipt is returned without `userName`

### Requirement: Acknowledgement response shaping preserves role and group admission

`review.acknowledgements` MUST preserve the full named roster for Head and Admin
within their existing group entitlement. A Head MUST remain confined to their
reporting group. A Viewer MUST remain confined to granted groups, regardless of
reviewer designation. Lead, missing-session and foreign-group requests MUST
remain denied.

#### Scenario: Entitled leadership reads the full roster

- **WHEN** a Head reads their group or an Admin reads any group
- **THEN** the response retains all receipts and names for that exact report/group

#### Scenario: An actor requests a foreign group

- **WHEN** a Head or Viewer requests a group outside their entitlement
- **THEN** the request is rejected as forbidden without reading the roster

#### Scenario: A Lead requests acknowledgements

- **WHEN** a Lead calls the acknowledgement-list procedure
- **THEN** the request is forbidden before its resolver runs

#### Scenario: No authenticated session is present

- **WHEN** the acknowledgement-list procedure is called without a session
- **THEN** the request is unauthorized before its resolver runs
