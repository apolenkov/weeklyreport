## ADDED Requirements

### Requirement: The submission ring renders a valid percentage when the period has zero enrolled leads

The `KpiCards` component MUST guard the `submissionPercent` ratio with a
`total > 0` check and fall back to `0` when `total` is zero, so the
conic-gradient ring and the percentage title always receive a finite numeric
value. A `NaN` ratio MUST NOT reach the ring's `background` style or the
`title` attribute.

#### Scenario: a period opens with no leads enrolled yet

- **GIVEN** an active period where `data.total === 0` and `data.submitted === 0`
- **WHEN** `KpiCards` renders the Submissions card
- **THEN** the ring's conic-gradient receives `0%` for the filled arc
- **AND** the title attribute reads `"0 of 0 leads submitted this week (0%)"`
  rather than any string containing `"NaN"`

#### Scenario: a period with enrolled leads renders the real ratio

- **GIVEN** an active period where `data.total > 0` and `data.submitted <= data.total`
- **WHEN** `KpiCards` renders the Submissions card
- **THEN** `submissionPercent` equals `Math.round((data.submitted / data.total) * 100)`
- **AND** the ring and title reflect that finite value

### Requirement: The AlertBar labels every not-yet-submitted lead as "Not started"

The `AlertBar` component MUST label each entry in the `pendingLeads` prop as
"Not started". The positional `i === 0` heuristic that labeled the first
entry "(Draft)" MUST NOT appear, because `pendingLeads` is the not-started
filter — every entry in it represents a lead who has not yet begun a
submission, never a lead who has an in-progress draft.

#### Scenario: one pending lead in the bar

- **GIVEN** `pendingLeads` contains a single lead name
- **WHEN** `AlertBar` renders the pending-names list
- **THEN** that entry is labeled "Not started"
- **AND** the text "Draft" does not appear in the bar

#### Scenario: multiple pending leads in the bar

- **GIVEN** `pendingLeads` contains two or more lead names
- **WHEN** `AlertBar` renders the pending-names list
- **THEN** every entry is labeled "Not started"
- **AND** no entry carries the label "Draft"
