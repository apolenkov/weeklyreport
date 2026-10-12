## ADDED Requirements

### Requirement: A derived Next commitment row exposes no terminal outcome action

A Next-week row that projects the same Current record's commitment
(`focusNextStep`) MUST NOT offer the terminal "Update status" outcome action
in its overflow or its primary status interaction; that record's terminal
progress belongs to its Current occurrence. Genuine Next items and editable
Current items MUST keep their terminal outcome action, and the derived row's
supported week-move action MUST remain available.

#### Scenario: A Current result carries a next-step commitment

- **GIVEN** an editable Current item with a separate next-week commitment
- **WHEN** the derived Next row's actions are rendered
- **THEN** no terminal status action invokes resolution from that row
- **AND** the Current occurrence and genuine Next items keep their terminal
  action

### Requirement: Temporal source counts equal their rendered column items

Each temporal source count MUST equal the number of item rows rendered in the
corresponding column across all reporting units, including intentionally
visible resolved history. A source count MUST NOT re-derive membership with a
different filter than the rendered columns use.

#### Scenario: Resolved rows remain visible

- **GIVEN** a resolved item rendered in a temporal column
- **WHEN** the source counts are projected
- **THEN** that column's count includes the resolved row
