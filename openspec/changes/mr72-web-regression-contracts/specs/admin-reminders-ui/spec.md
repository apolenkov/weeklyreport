# Spec Delta

## ADDED Requirements

### Requirement: Reminder mutations keep each row independently busy

The admin `RemindersTab` MUST disable a reminder's toggle, Edit and Remove
controls while that row's save or removal is pending. Other rows MUST remain
usable. Overlapping row operations MUST retain independent busy lifecycles;
each settled request MUST release only its own row, on success or failure.

#### Scenario: Two reminder toggles overlap

- **GIVEN** reminders A, B and C are available
- **WHEN** the admin toggles A and then B before either save finishes
- **THEN** A and B have disabled toggle, Edit and Remove controls
- **AND** C retains usable controls

#### Scenario: Overlapping requests settle in either order

- **GIVEN** reminder toggles A and B are both pending
- **WHEN** either request succeeds or fails
- **THEN** only the settled reminder's controls become usable
- **AND** the other reminder stays busy until its own request settles
- **AND** both rows become usable after both requests settle

### Requirement: Next-send calculation uses the time of the current render

The admin `RemindersTab` MUST recompute each card's earliest upcoming send
against the current time whenever the tab renders. A rule whose fire time has
elapsed MUST NOT remain upcoming because the tab has stayed mounted. This
requirement MUST NOT add a backend query or require periodic polling.

#### Scenario: Search causes a render after the displayed send elapsed

- **GIVEN** an active reminder shows a future generated send
- **AND** the tab stays mounted until that send's fire time has elapsed
- **WHEN** the admin changes the reminder search and the card remains in view
- **THEN** the card shows the next future rule if one exists
- **AND** otherwise it shows `No upcoming sends`
- **AND** the elapsed rule is no longer displayed as the next send
