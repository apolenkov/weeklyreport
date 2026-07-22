## ADDED Requirements

### Requirement: Published-floor analytics queries exclude reopened periods

`AnalyticsPrismaRepository`'s `PUBLISHED_FLOOR` MUST require both the legacy
`status: 'published'` field AND `periodStatus: 'published'`. A report whose
legacy `status` is `'published'` but whose `periodStatus` is `'reopened'`
(editable again, per the `reopen` transition's intentional dual-state
asymmetry) MUST NOT be returned by `trafficLightHistory`, `leadVelocity`, or
`periodComparison`. This holds until the period is genuinely re-published and
`periodStatus` returns to `'published'`.

#### Scenario: A reopened period drops out of trafficLightHistory

- **GIVEN** a report with legacy `status: 'published'` and
  `periodStatus: 'reopened'`
- **AND** one of its sections was edited after the reopen
- **WHEN** `trafficLightHistory` is called for a range covering that period
- **THEN** the response contains no data derived from that report
- **AND** the edited section's content is not visible in any returned row

#### Scenario: A reopened period drops out of periodComparison

- **GIVEN** a report with legacy `status: 'published'` and
  `periodStatus: 'reopened'`
- **WHEN** `periodComparison` is called with that period as `periodA` or
  `periodB`
- **THEN** the corresponding side of the comparison reflects no data from
  that report

#### Scenario: A re-published period reappears

- **GIVEN** a report that was reopened and then re-published, so
  `periodStatus` is `'published'` again
- **WHEN** `trafficLightHistory`, `leadVelocity`, or `periodComparison` is
  called for that period
- **THEN** the report's (re-published) sections are included normally
