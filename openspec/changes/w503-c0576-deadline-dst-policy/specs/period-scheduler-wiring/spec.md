## ADDED Requirements

### Requirement: The period deadline resolves a gap or fold wall-clock time by one explicit rule

`computeDeadline` SHALL apply the configured deadline time (hour and minute) as a wall-clock time in the schedule's timezone on the deadline day. When that wall-clock time does not exist on that day (a spring-forward gap) the deadline SHALL be the instant obtained by moving forward by the length of the gap. When it occurs twice (a fall-back overlap) the deadline SHALL be the earlier of the two instants. The result SHALL NOT depend on the clock time of the period start, which is discarded.

#### Scenario: A nonexistent wall-clock time moves forward

- **GIVEN** the timezone `America/New_York` and a deadline time of 02:30
- **WHEN** the deadline day is 2026-03-08 (02:00 jumps to 03:00)
- **THEN** the deadline is 03:30 local time (2026-03-08T07:30:00Z), for any period start time

#### Scenario: An ambiguous wall-clock time takes the earlier occurrence

- **GIVEN** the timezone `America/New_York` and a deadline time of 01:30
- **WHEN** the deadline day is 2026-11-01 (01:00–02:00 occurs twice)
- **THEN** the deadline is the first 01:30 (2026-11-01T05:30:00Z), for any period start time
