## MODIFIED Requirements

### Requirement: Own-input completeness counts only stages the lead explicitly set

Own-input completeness MUST count a stage as addressed when EITHER
the lead set an explicit non-empty status on it OR the stage is covered
by the current lead's OWN non-empty staged risk. A risk is the lead's
input about that stage, so a stage the lead never explicitly set still
counts when their own risk covers it. The counter MUST be derived from a
`coveredByOwnRisk` annotation placed on the raw stage by the read-model
mapper (`mapLeadProducts` in `apps/web/src/features/report-sections/model/lead-form.ts`),
where `computeCompleteness` counts a stage when
`status !== "empty" || coveredByOwnRisk`. Foreign coverage MUST NOT inflate the
counter:

1. A foreign or cross-author covering risk shown in Everyone mode MUST
   color the chip (display floor) but MUST NOT set `coveredByOwnRisk`, MUST
   NOT count toward this lead's completeness — another lead's risk never
   finishes this lead's input — and MUST NOT block the lead's own status
   toggle, which is guarded by the lead's own covering risks only. Toggling
   such a chip MUST save the lead's status and show a non-blocking hint that
   another lead's risk keeps the stage colored.

This MUST hold on reload: `coveredByOwnRisk` is derived from the
persisted own risks plus the raw per-stage status, never from transient
floored display state.

#### Scenario: an untouched stage covered by the lead's own staged risk counts

- **WHEN** the lead owns three stages with no explicit status set, and
  saves one own risk that explicitly covers all three stages
- **THEN** the three stage chips render at the risk severity (display floor)
- **AND** the completeness counter reads 3 of 3 because each stage is
  `coveredByOwnRisk`
- **AND** after a page reload the counter still reads 3 of 3 — derived
  from the persisted risk plus raw status

#### Scenario: a foreign covering risk colors but does not count

- **WHEN** in Everyone mode an untouched stage the lead owns is covered only
  by another author's risk
- **THEN** the chip renders at the covering severity (display floor)
- **AND** the completeness counter does NOT count that stage —
  `coveredByOwnRisk` is false for a foreign risk

#### Scenario: toggling a chip colored by a foreign risk saves and hints

- **WHEN** in Everyone mode the lead toggles the status of their own stage
  whose chip is colored only by another author's risk
- **THEN** the lead's status is saved
- **AND** a non-blocking hint says another lead's risk keeps the stage colored
