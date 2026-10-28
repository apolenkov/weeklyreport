# Delta Spec: lead-status-overview

## ADDED Requirements

### Requirement: Timeline grid omits leading left border on the first column

At intermediate and wide viewports (`md` and up), the 3-column timeline grid MUST NOT render a left border on its first column ("Previously planned"), preserving separator borders between columns without adding an outer border to the container.

#### Scenario: Status overview timeline columns rendered at md

- **WHEN** the status overview timeline header or lineage row renders at `md`
- **THEN** the first column has no left border
- **AND** the second and third columns retain `border-l`
