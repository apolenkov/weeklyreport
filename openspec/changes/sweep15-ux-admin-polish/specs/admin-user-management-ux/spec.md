## ADDED Requirements

### Requirement: Routine and destructive user actions have separate hierarchy

The Admin Users table MUST keep Edit and Activate/Deactivate inline and MUST move Delete out of the routine action row into an accessible overflow menu or a clearly separated edit-dialog danger zone.

#### Scenario: An active user row renders

- **WHEN** an admin scans the row actions
- **THEN** Edit and Deactivate are visible inline
- **AND** Delete is not presented as an equal adjacent pill

#### Scenario: The admin chooses Delete

- **WHEN** the admin activates the labeled overflow/danger action
- **THEN** the existing delete confirmation and authorization flow opens
- **AND** cancel restores focus to the trigger

### Requirement: Admin user actions meet the interactive target floor

Every interactive control in a Users table row MUST provide a hit target of at least 40 by 40 CSS pixels without relying on adjacent whitespace or overlapping another target.

#### Scenario: Users table targets are measured

- **WHEN** Edit, Activate/Deactivate, and overflow controls render at narrow and desktop widths
- **THEN** each target is at least 40px in both interactive dimensions
- **AND** keyboard focus remains visibly apparent
