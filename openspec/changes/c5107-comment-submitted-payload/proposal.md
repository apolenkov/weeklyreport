# Proposal

## Why

C5107 (TASK-503.38): the review-comment composer validates and counts the raw
draft, but the mutation sends `text.trim()`, so the value that was validated is
not the value that is submitted. A draft that exceeds the shared limit only by
surrounding whitespace is blocked although its submitted payload fits, and the
counter reports characters that are never stored. The reopen dialog already
measures its trimmed payload for both limit feedback and admission
(`d37-f03-admitted-write-contracts`, `lead-form-write-actions`); the
review-comment composer is the remaining field where the local boundary
disagrees with the shared schema that the server applies to the submitted text.

The frozen subclaim "trimming validated text makes payload unsafe/invalid"
stays rejected: trimming cannot add null bytes or visible content and only
shortens the value. The rapid native double-submit clause is untouched by this
change and stays open for browser evidence.

Backlog: TASK-503.38. Frozen registry:
`task-503/wave11/tracking/FROZEN-DEFERRED-38.json`.

## What Changes

- The composer counts, validates and gates the text it submits: the draft's
  trimmed value, while the raw draft stays visible and editable.
- The mutation carries exactly the validated text, without a second
  normalization step.
- The maximum, the shared schema, stored text and server validation stay
  unchanged.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `record-comment-save-coordination`: the local 2,000-character boundary
  measures the same text the composer submits.

## Impact

`apps/web/src/features/review/ui/comments/use-record-comment-state.ts`,
`apps/web/src/features/review/ui/comments/record-comment-composer.tsx`,
`apps/web/src/features/review/ui/comments/record-comments.tsx` and
`apps/web/src/features/review/ui/comments/record-comments.test.tsx`.

## Non-goals

- Rapid native Enter+click double-submit: no admitted browser chronology, so the
  frozen `needs-evidence` verdict stays unchanged.
- No change to the shared review schema, the maximum, the raw draft retention or
  any other text field.
