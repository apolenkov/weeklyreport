# record-dialog-layout — delta: activity-first-class-reporting-unit

## MODIFIED Requirements

### Requirement: The three record dialogs share one two-column layout

The Item, Risk, and Decision dialogs MUST render with the same two-column layout
so the lead reads them as one family: primary text fields on the left, and a
right-hand CLASSIFICATION panel holding the PARENT picker, the SDLC Stages
selector, and the Status/Severity control.

1. The PARENT picker MUST live in the right-hand CLASSIFICATION panel in all three
   dialogs and MUST always render. It offers the section author's products AND
   attached activities as parents, so the lead can scope a record to a product or
   to an activity.
2. The SDLC Stages selector and the Status (item) / Severity (risk) control MUST
   sit in the same CLASSIFICATION panel, in the same order across dialogs. The
   SDLC Stages selector MUST be hidden when the chosen parent is an ACTIVITY (an
   activity has no stage), and MUST render when the chosen parent is a product.
3. The primary text fields (item description; risk text/impact/mitigation; decision
   text/impact; plus decision deadline and item priority rank) MUST occupy the
   left column. The Decision dialog carries NO Owner field — a decision is always
   owned by its author (the current lead on create, the saved owner on edit), so
   `owner` is persisted automatically and never shown as an editable input.
4. Where a consequence-preview banner already exists (the risk severity preview), it
   MUST remain above the stage selector.

#### Scenario: the parent picker is consistently placed

- **WHEN** a lead opens any of the Item, Risk, or Decision dialogs
- **THEN** the parent picker appears in the right-hand CLASSIFICATION panel
- **AND** it renders even if there is only one parent available

#### Scenario: classification controls group identically

- **WHEN** a lead opens any of the three dialogs on a PRODUCT parent
- **THEN** the SDLC Stages selector and the Status/Severity control are grouped
  together in the CLASSIFICATION panel in the same order

#### Scenario: an activity parent hides the stage selector

- **WHEN** a lead selects an activity as the parent in any of the three dialogs
- **THEN** the SDLC Stages selector is not rendered
- **AND** the Status/Severity control still renders in the CLASSIFICATION panel

#### Scenario: the Decision dialog shows no Owner field

- **WHEN** a lead opens the Decision dialog to create or edit a decision
- **THEN** no Owner input is rendered, and the left column holds the decision
  text, the deadline, and the impact
- **AND** the saved decision still carries an `owner` derived from the author (the
  current lead on create, the unchanged saved owner on edit), keeping the
  mine/foreign and `LockBadge` logic intact
