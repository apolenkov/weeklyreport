## MODIFIED Requirements

### Requirement: The three record dialogs share one two-column layout

The Item, Risk, and Decision dialogs MUST render with the same two-column layout so the lead reads them as one family: primary text fields on the left, and a right-hand CLASSIFICATION panel holding the Product picker, the SDLC Stages selector, and the Status/Severity control.

1. The Product picker MUST live in the right-hand CLASSIFICATION panel in all three
   dialogs and MUST always render, even when only one product is available.
2. The SDLC Stages selector and the Status (item) / Severity (risk) control MUST sit
   in the same CLASSIFICATION panel, in the same order across dialogs.
3. The primary text fields (item description; risk text/impact/mitigation; decision
   text/impact; plus decision deadline and item priority rank) MUST occupy the
   left column. The Decision dialog carries NO Owner field — a decision is always
   owned by its author (the current lead on create, the saved owner on edit), so
   `owner` is persisted automatically and never shown as an editable input.
4. Where a consequence-preview banner already exists (the risk severity preview), it
   MUST remain above the stage selector.
5. The two-column layout is the `md`-and-up (full-tier) presentation. Below `md`
   (the compact tier) the two columns MUST collapse to a single column with the
   CLASSIFICATION panel stacked beneath the left-hand primary fields, in the same
   top-to-bottom order, so no field is dropped and the dialog needs no horizontal
   scroll. The classification grouping and per-control order from points 1–4 MUST
   be preserved in the stacked layout.

#### Scenario: the Product picker is consistently placed

- **WHEN** a lead opens any of the Item, Risk, or Decision dialogs
- **THEN** the Product picker appears in the right-hand CLASSIFICATION panel
- **AND** it renders even if there is only one product

#### Scenario: classification controls group identically

- **WHEN** a lead opens any of the three dialogs
- **THEN** the SDLC Stages selector and the Status/Severity control are grouped
  together in the CLASSIFICATION panel in the same order

#### Scenario: the Decision dialog shows no Owner field

- **WHEN** a lead opens the Decision dialog to create or edit a decision
- **THEN** no Owner input is rendered, and the left column holds the decision
  text, the deadline, and the impact
- **AND** the saved decision still carries an `owner` derived from the author (the
  current lead on create, the unchanged saved owner on edit), keeping the
  mine/foreign and `LockBadge` logic intact

#### Scenario: the dialog collapses to one column on a phone

- **WHEN** a lead opens any of the three record dialogs at a compact (`<md`) width
- **THEN** the layout collapses to a single column with the CLASSIFICATION panel
  stacked beneath the primary text fields
- **AND** every field remains present and the dialog needs no horizontal scroll
