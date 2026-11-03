## ADDED Requirements

### Requirement: Lead and Head forms share neutral Paused progress semantics

Lead Report Overview and the `/head/report/[reportId]` form MUST present paused item progress as `Paused` using the same muted-foreground token, including Head Product and Activity details. Shape and text MUST distinguish pause from alarm; paused progress MUST NOT use at-risk amber or be normalized into the canonical health union. Existing risk-derived alarm rules and slide/print presentation MUST remain unchanged.

#### Scenario: The same paused item is read in both roles

- **WHEN** Lead Overview and Head Product or Activity details render an item with paused progress
- **THEN** the progress indicator resolves `--color-muted-foreground` from one shared presentation definition
- **AND** its accessible label and tooltip identify `Paused`, with visible text wherever the surface renders a status label
- **AND** the Head badge foreground and Lead pause glyph use that same token without private color literals

#### Scenario: Pause and risk coexist

- **WHEN** a paused item is displayed alongside a genuine at-risk or blocked risk
- **THEN** pause stays neutral while the risk retains its canonical alarm presentation
- **AND** no stored item progress, risk severity, Product health or Activity health is changed by the presentation choice
