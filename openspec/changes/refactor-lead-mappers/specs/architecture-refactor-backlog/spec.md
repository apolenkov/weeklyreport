## MODIFIED Requirements

### Requirement: The lead-form god component is a recorded decomposition target

The backlog MUST record that `apps/web/src/components/lead/lead-form.tsx`
(1936 LOC as of 2026-06-10; 300-line `max-lines` standard) is a
decomposition target being reduced in recorded slices, each captured as
its own grilled refactor change before work starts. The first slice is
`refactor-lead-mappers`: the pure cross-author and snapshot derivations
move to tested adapters in `apps/web/src/lib/mappers/` (expected
landing near 1630 LOC). The decomposition target itself stays open;
the deferred `ReportDataCoordinator` / `FormStateManager` objects MUST
NOT be built outside a future grilled change of their own.

#### Scenario: the lead-form size target is discoverable

- **WHEN** a maintainer looks for known oversized modules
- **THEN** the backlog names `lead-form.tsx` with its current LOC and
  the 300 target
- **AND** it lists the landed slices (first: `refactor-lead-mappers`)
  and marks the remaining decomposition as needing its own grilled
  refactor change before work starts

#### Scenario: a second slice starts

- **WHEN** an agent or maintainer picks up further lead-form
  decomposition work
- **THEN** a grilled OpenSpec change exists for that slice before any
  code is written
- **AND** the change cites the updated LOC evidence from the previous
  slice
