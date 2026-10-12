# Proposal

## Why

A report date error describes year 2000 as excluded although the validator accepts it. Item status validation also repeats an already canonical enum, while a web prose validator repeats the shared visible-text message used for error classification.

The admitted D37-SI01 roots are `rv3b-item-status-owner`, `rv3b-report-date-message`, and `web-prose-visible-text-message-coupling`; their complete clauses and caller evidence are retained in the external D37-SI01 handoff.

## What Changes

- Remove duplicate Current/Next status arrays and the redundant refinement after enum parsing, together with both caller imports/calls.
- Describe the existing inclusive UTC year boundary as “in year 2000 or later”.
- Define and reexport `INVISIBLE_TEXT_MESSAGE` with the existing literal for the subsequent web consumer checkpoint.
- Remove only obsolete facade assertions and extend the existing public date parser case with the corrected message.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

None. This ownership cleanup and corrective copy preserve the existing requirements in `record-status-derivation` and `schema-conventions`; `skip_specs: true` avoids inventing a new product requirement for them.

## Non-goals

- No accepted/rejected item, prose, or date values change.
- No dependency, mapper/error-code, authorization, persistence, or traffic normalization policy changes.
- No leaf UI implementation or native acceptance is included in this checkpoint.

## Impact

Six shared source/test files change. Both schema callers travel with the removed refinement. `INVISIBLE_TEXT_MESSAGE` is available through `@customreport/shared` for the already identified `record-prose-validation.ts` production consumer; that leaf remains separately assigned.
