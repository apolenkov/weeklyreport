## ADDED Requirements

### Requirement: Live review history retains its reviewer user

The admin user deletion command MUST reject hard deletion while any live ReviewAcknowledgement.user, SectionReview.reviewer or RecordComment.reviewer reference exists, returning the existing typed conflict with deactivation guidance. User identity and referenced history MUST remain intact. Database referential integrity MUST enforce refusal atomically, including concurrent deletion/reference writes.

#### Scenario: Any acknowledgement retains its user

- **GIVEN** a user is referenced by a live ReviewAcknowledgement and has no other deletion-blocking reference
- **WHEN** the administrator requests hard deletion
- **THEN** deletion fails with a typed conflict and the user and acknowledgement remain unchanged

#### Scenario: Any verdict retains its reviewer

- **GIVEN** a user is referenced by a live SectionReview and has no other deletion-blocking reference
- **WHEN** the administrator requests hard deletion
- **THEN** deletion fails with a typed conflict and the user and verdict remain unchanged

#### Scenario: Any comment retains its reviewer

- **GIVEN** a user is referenced by a live RecordComment and has no other deletion-blocking reference
- **WHEN** the administrator requests hard deletion
- **THEN** deletion fails with a typed conflict and the user and comment remain unchanged

#### Scenario: Reviewer deactivation preserves history

- **GIVEN** any of the live review-history references retains its user
- **WHEN** the administrator deactivates that user instead
- **THEN** the user becomes inactive and all review-history rows and unrelated data remain unchanged

#### Scenario: A reference-free user can still be removed

- **GIVEN** the user has no review-history or other deletion-blocking reference and existing administrator protection allows deletion
- **WHEN** the administrator requests hard deletion
- **THEN** only that user is deleted and unrelated users and history remain unchanged

#### Scenario: A review reference competes with hard deletion

- **WHEN** a review-history reference and deletion of its user compete
- **THEN** the database cannot commit both a live orphaned reference and the deletion
- **AND** a reference that commits first retains its user and history
