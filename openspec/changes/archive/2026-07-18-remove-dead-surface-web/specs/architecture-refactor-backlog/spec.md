## ADDED Requirements

### Requirement: Dead web-frontend surface found by code review MUST be deleted, not just tolerated

The backlog SHALL record that code review confirmed six pieces of
`apps/web` surface with no production caller, each carrying its own test
suite that gives false coverage confidence, and that these were deleted
rather than kept: `stageNameMatches`
(`features/report-sections/model/stage-tags.ts`),
`visibleLeadSlidePeriodOptions`
(`features/slides/model/lead-slide-periods.ts`), the
`applyStatusSuggestion`/`syncSource()` half of `useStatusRiskSync`
(`hooks/use-status-risk.ts`), the ignored `source?: SyncSource` parameter
contract on `handleStageStatusChange`, and `getDialogPreset`
(`shared/ui/confirmation-dialog.tsx`).

#### Scenario: Reviewer re-encounters one of the removed symbols

- WHEN a future review or grep turns up `stageNameMatches`,
  `visibleLeadSlidePeriodOptions`, `applyStatusSuggestion`, `syncSource`, or
  `getDialogPreset` reintroduced in `apps/web`
- THEN treat it as new dead surface requiring the same justification (a real
  production caller) before it is allowed to stay, not as a restoration of
  prior-approved code

#### Scenario: A hook parameter is added to a public interface

- WHEN a function's exported interface declares an optional parameter (e.g.
  `source?: SyncSource`)
- THEN the implementation MUST branch on that parameter's value, or the
  parameter MUST be removed — an interface may not advertise behavior the
  implementation does not provide
