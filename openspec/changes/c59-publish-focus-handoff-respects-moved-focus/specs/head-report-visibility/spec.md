# Spec Delta

## ADDED Requirements

### Requirement: The publish and reopen focus hand-off MUST NOT take focus the reviewer moved

After a successful Publish & lock or Reopen period, the control that replaces it
MUST receive focus only while focus is still dropped (on the document body or
nowhere). If the reviewer has placed focus on another control before the
status change arrives, that control MUST keep focus.

#### Scenario: Focus moved while the published status is pending

- **WHEN** a reviewer confirms Publish & lock, then moves focus to another
  control before the period shows as published
- **THEN** that control keeps focus when Reopen period appears

#### Scenario: Focus moved while the reopened status is pending

- **WHEN** a reviewer confirms Reopen period, then moves focus to another
  control before the period shows as open
- **THEN** that control keeps focus when Publish & lock appears

#### Scenario: Focus is still dropped

- **WHEN** nothing else took focus after the confirmation
- **THEN** the replacing control receives focus as before
