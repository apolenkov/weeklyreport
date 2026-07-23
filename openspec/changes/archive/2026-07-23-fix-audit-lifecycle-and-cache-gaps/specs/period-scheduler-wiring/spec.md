## ADDED Requirements

### Requirement: Due scheduled periods open independently of automatic period creation

`PeriodCreatorScheduler.runOnce` MUST invoke the governed scheduled-to-open transition for every due `Report` whose `periodState` is `scheduled` and whose `periodStart` has been reached, regardless of the `AppSettings.autoCreatePeriods` value. Disabling automatic period creation MUST prevent creation of a new period, but MUST NOT prevent an already-scheduled period from transitioning to `open`. The transition MUST continue to use `flipDueScheduledToOpen` and its guarded `buildTransition('open', {})` field set so the period dual-state remains atomic.

#### Scenario: A due scheduled period opens while automatic creation is disabled

- **GIVEN** `AppSettings.autoCreatePeriods` is `false`
- **AND** a report has `periodState: 'scheduled'` and `periodStart <= now`
- **WHEN** `PeriodCreatorScheduler.runOnce(now)` executes
- **THEN** `flipDueScheduledToOpen` transitions the report to `periodState: 'open'` using the full governed transition field set
- **AND** the scheduler creates no new report

#### Scenario: A future scheduled period remains scheduled

- **GIVEN** `AppSettings.autoCreatePeriods` is `false`
- **AND** a report has `periodState: 'scheduled'` and `periodStart > now`
- **WHEN** `PeriodCreatorScheduler.runOnce(now)` executes
- **THEN** the report remains `scheduled`
- **AND** the scheduler creates no new report
