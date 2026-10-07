# Spec Delta

## ADDED Requirements

### Requirement: Head period history projects only a matching live report envelope

The head report's `PeriodNavigator` history MUST use live period dates,
archive status and lifecycle state only when the live payload's `reportId`
matches the history entry's report identity. A displayed route resolving to
another report MUST NOT overwrite that entry's frozen envelope. The Current
marker MUST identify the actual active report, independently of the displayed
route.

#### Scenario: A reopened report updates its own frozen history envelope

- **GIVEN** a compiled history entry for a previously published report
- **AND** the matching live report was reopened and its period dates changed
- **WHEN** the head's period history is derived
- **THEN** that report uses its live dates, archive flag and open lifecycle
- **AND** its Current marker follows the actual active report identity

#### Scenario: A displayed route returns a different report

- **GIVEN** history contains report A with frozen period dates
- **AND** the displayed route addresses A but its payload describes report B
- **WHEN** the head's period history is derived
- **THEN** A retains its frozen dates and archive status
- **AND** A's lifecycle comes from its own archived or reopened history state
- **AND** B's live envelope is not projected onto A

#### Scenario: A scheduled displayed report does not steal the Current marker

- **GIVEN** an open active report and a different displayed scheduled report
- **WHEN** the head's period history is derived
- **THEN** only the actual active report is marked Current
- **AND** the displayed scheduled report retains its scheduled lifecycle
