## ADDED Requirements

### Requirement: Lead-surface card product names resolve report-wide

Lead-surface card product names MUST resolve report-wide. Names on risks,
decisions, items (current and next week), and priorities MUST resolve from a
name source covering every project the report can name, not only the author's
stage-owned `projects` list alone. The placeholder (`"Unknown"` for risks and
items, `"Group"` for decisions, an empty name for priorities) MUST appear
only when the referenced project id is absent from the entire resolved name
source — never for a project the system can name.

The consumer surface is the lead-surface mappers in
`apps/web/src/lib/mappers/lead-form.ts` (`mapLeadRisks`, `mapLeadDecisions`,
`mapLeadItems`, `mapLeadPriorities`), fed by the
`reports.getActive` / `leadForm.byPeriod` read model from
`apps/api/src/modules/report-sections/`.

#### Scenario: a risk references a project the author owns no stage on

- **WHEN** a section's risk references a `projectId` that is not in the
  section author's stage-owned `projects` list but names a real project the
  system knows
- **THEN** the risk card shows the real product name
- **AND** the `"Unknown"` placeholder does not appear

#### Scenario: a decision references a project the author owns no stage on

- **WHEN** a section's decision carries a `productId` that is not in the
  author's stage-owned `projects` list but names a real project
- **THEN** the decision card shows the real product name
- **AND** the `"Group"` placeholder does not appear

#### Scenario: an item or priority references a project the author owns no stage on

- **WHEN** a current-week item, next-week item, or priority references a
  `projectId` outside the author's stage-owned `projects` list but naming a
  real project
- **THEN** the card shows the real product name

#### Scenario: a truly foreign project id still falls back

- **WHEN** a card references a `projectId` that the entire resolved name
  source cannot name
- **THEN** the card shows its existing placeholder (`"Unknown"` /
  `"Group"` / empty) rather than crashing or hiding the row

#### Scenario: name resolution does not add a stray product card

- **WHEN** the name source is widened to resolve a referenced-but-not-owned
  project
- **THEN** the lead's product list (`mapLeadProducts`) and its SDLC stage
  grids are unchanged — a referenced-only project contributes a name only,
  not an editable product card or an empty stage grid
