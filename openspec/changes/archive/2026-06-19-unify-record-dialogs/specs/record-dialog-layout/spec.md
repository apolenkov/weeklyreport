## ADDED Requirements

### Requirement: The three record dialogs share one two-column layout

The Item, Risk, and Decision dialogs MUST render with the same two-column layout so the lead reads them as one family: primary text fields on the left, and a right-hand CLASSIFICATION panel holding the Product picker, the SDLC Stages selector, and the Status/Severity control.

1. The Product picker MUST live in the right-hand CLASSIFICATION panel in all three
   dialogs and MUST always render, even when only one product is available.
2. The SDLC Stages selector and the Status (item) / Severity (risk) control MUST sit
   in the same CLASSIFICATION panel, in the same order across dialogs.
3. The primary text fields (item description; risk text/impact/mitigation; decision
   text/impact; plus decision owner/deadline and item priority rank) MUST occupy the
   left column.
4. Where a consequence-preview banner already exists (the risk severity preview), it
   MUST remain above the stage selector.

#### Scenario: the Product picker is consistently placed

- **WHEN** a lead opens any of the Item, Risk, or Decision dialogs
- **THEN** the Product picker appears in the right-hand CLASSIFICATION panel
- **AND** it renders even if there is only one product

#### Scenario: classification controls group identically

- **WHEN** a lead opens any of the three dialogs
- **THEN** the SDLC Stages selector and the Status/Severity control are grouped
  together in the CLASSIFICATION panel in the same order
