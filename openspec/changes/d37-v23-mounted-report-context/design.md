# Design

## Context

See proposal.md. The corrected round2 patch supersedes the earlier D37-V23 proposal. Immutable patch and source hashes are recorded in the integration handoff; earlier rejected optimizations are excluded.

## Decisions

The canonical Overview editor's existing confirmationOnly field lock receives saveDisabled. This locks fields and Save while leaving Cancel outside the disabled fieldset. The existing close/discard and focus hooks remain the owners; cancelling the surface makes no promise to cancel transport or restore an in-flight draft.

WeeklyReportBody stores the current report/deep-link basis alongside the overview target and its epochs. A basis change resets that navigation state, so a stale overview target cannot override the new deep-link focus. Unchanged-basis renders retain the map and existing manual-disclosure behavior. No size cap or new navigation policy is introduced.

Empty product headers omit expanded state when no panel exists. Lead loading toolbar classes retain the same breakpoint ownership as ReportToolbar; this is source parity, not measured CLS acceptance.

## Risks and verification

Real public-consumer deferred-save and mounted author-focus tests fail on the baseline and pass on corrected sources. Author command summaries are not equivalent to fresh integrated checks. Native keyboard/AT/layout and transport acceptance remain unverified until Root provides their actual boundaries. No lifecycle tuple, canonical auth builder or destructive guard changes occur.

## Migration

No schema or dependency migration. Integrate the six source/test files and these deltas with ordinary hooks, then run the six aggregate gates and one independent review in Root's window. Main specification synchronization remains a later coordinator operation.
