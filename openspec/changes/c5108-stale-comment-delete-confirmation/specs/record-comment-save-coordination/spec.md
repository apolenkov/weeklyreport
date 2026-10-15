# Spec Delta

## ADDED Requirements

### Requirement: A delete confirmation follows the live comment and permission

An open review-comment delete confirmation with no delete in flight MUST close
without deleting when its comment is no longer in the record's current comment
list or the current actor may no longer delete that comment. A confirmation
whose delete is in flight MUST stay open until that delete settles. The server MUST remain the authority
for every delete.

#### Scenario: Review rights are withdrawn while the confirmation is open

- **WHEN** a reviewer has the delete confirmation open and the refreshed
  record no longer grants that reviewer review rights
- **THEN** the confirmation closes and no delete is requested

#### Scenario: The comment is removed elsewhere

- **WHEN** the comment under confirmation disappears from the refreshed list
- **THEN** the confirmation closes and no delete is requested

#### Scenario: The list refreshes while the delete is in flight

- **WHEN** the reviewer confirmed the delete and a refreshed list drops the
  comment before the delete settles
- **THEN** the confirmation stays open until the delete settles and then
  reports its outcome
