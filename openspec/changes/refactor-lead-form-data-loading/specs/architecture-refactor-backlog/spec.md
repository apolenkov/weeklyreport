## MODIFIED Requirements

### Requirement: The lead-form god component is a recorded decomposition target

The backlog MUST record that
`apps/web/src/features/report-sections/ui/lead-form.tsx` (975 LOC after
`refactor-lead-form-data-loading` on 2026-07-10; 250-line `max-lines`
standard) is a decomposition target being reduced in recorded slices, each
captured as its own grilled refactor change before work starts. The first slice
is `refactor-lead-mappers`: the pure cross-author and snapshot derivations
moved to tested adapters in `apps/web/src/lib/mappers/` (landed at 1658 LOC on
2026-06-11; the file stood at 1930 when the slice started). The second slice is
`refactor-lead-form-draft-orchestration`: the draft mirror, stable draft payload
baseline, autosave handoff, stale-version conflict handler, and optimistic-lock
version owner moved behind a tested feature-local hook (landed with the file at
2036 LOC; it stood at 2117 when the slice started). The third slice is
`refactor-lead-form-write-actions`: submit/revoke/reopen/fill-from command
orchestration, dialog/error state, write invalidation, and optimistic-lock
command-time version reads moved behind a tested feature-local hook (landed
with the file at 1858 LOC; it stood at 2036 when the slice started). The fourth
slice is `refactor-lead-form-draft-merges`: product/activity/item/risk/decision
presentation-to-draft merge commands, item move commands, blocker routing, and
quick-add item saves moved behind a tested feature-local boundary (landed with
the file at 1485 LOC; it stood at 1858 when the slice started). The fifth slice
is `refactor-lead-form-loaded-view-model`: loaded display derivations for
cross-author products, own/foreign rows, activity cards, unified entries,
published-lineage locks, visible periods, and read-only affordances moved behind
a tested feature-local boundary (landed with the file at 1314 LOC; it stood at
1485 when the slice started). The sixth slice is
`refactor-lead-form-data-loading`: the six lead-form queries, enablement
chains, record-visibility gating, foreign-content cache purges,
canonical/head-away redirects, and query error handlers moved behind a tested
feature-local hook, with the file-local SVG icons and record-visibility toggle
relocated to their own modules (landed with the file at 975 LOC; it stood at
1314 when the slice started). The decomposition target
itself stays open; the deferred `ReportDataCoordinator` / `FormStateManager`
objects MUST NOT be built outside a future grilled change of their own.

#### Scenario: the lead-form size target is discoverable

- **WHEN** a maintainer looks for known oversized modules
- **THEN** the backlog names `lead-form.tsx` with its current LOC and the 250
  target
- **AND** it lists the landed slices (first: `refactor-lead-mappers`; second:
  `refactor-lead-form-draft-orchestration`; third:
  `refactor-lead-form-write-actions`; fourth:
  `refactor-lead-form-draft-merges`; fifth:
  `refactor-lead-form-loaded-view-model`; sixth:
  `refactor-lead-form-data-loading`) and marks the remaining decomposition
  as needing its own grilled refactor change before work starts

#### Scenario: a later slice starts

- **WHEN** an agent or maintainer picks up further lead-form decomposition work
- **THEN** a grilled OpenSpec change exists for that slice before any code is
  written
- **AND** the change cites the updated LOC evidence from the previous slice
