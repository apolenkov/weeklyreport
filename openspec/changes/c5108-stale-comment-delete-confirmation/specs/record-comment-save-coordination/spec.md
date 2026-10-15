# Spec Delta

## ADDED Requirements

### Requirement: A delete confirmation follows the live comment and permission

An open review-comment delete confirmation MUST close without deleting when
its comment is no longer in the record's current comment list or the current
actor may no longer delete that comment. The server MUST remain the authority
for every delete.

#### Scenario: Review rights are withdrawn while the confirmation is open

- **WHEN** a reviewer has the delete confirmation open and the refreshed
  record no longer grants that reviewer review rights
- **THEN** the confirmation closes and no delete is requested

#### Scenario: The comment is removed elsewhere

- **WHEN** the comment under confirmation disappears from the refreshed list
- **THEN** the confirmation closes and no delete is requested
