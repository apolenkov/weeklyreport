## ADDED Requirements

### Requirement: Escalation rows carry their concrete SDLC stage(s)

An escalation row (Blocked & At Risk) MUST carry the concrete SDLC
stage(s) of its underlying blocked item or risk; the stage data exists
and MUST NOT be hardcoded to null. The single shared escalation builder
`buildEscalationsFromReadSections` — used by BOTH the live and the
published-snapshot paths — MUST select and resolve the stage arrays
(`item.stageIds` and `risk.stageIds`) into stage name(s). A row backed by a legacy
stage-less risk (empty `stageIds`) MUST render the explicit "No stage
set" warning marker — never a silent "—" — and that legacy stage-less
risk MUST contribute 0 to the lead's stage completeness counter (see
`lead-pipeline-card`).

#### Scenario: an escalation row shows its stage name

- **WHEN** an escalation row is built from a blocked item or risk that
  carries one or more `stageIds`
- **THEN** the row displays the resolved stage name(s)
- **AND** it does not display a hardcoded null or a silent "—"

#### Scenario: a legacy stage-less escalation shows "No stage set"

- **WHEN** an escalation row is built from a risk whose `stageIds` is
  empty
- **THEN** the row shows the "No stage set" warning marker, never a
  silent "—"
- **AND** that legacy risk contributes 0 to stage completeness
