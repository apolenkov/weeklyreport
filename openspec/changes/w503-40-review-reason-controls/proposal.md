# Proposal

## Why

The Request changes dialog now keeps its explanatory reason hint mounted and
reports a rejected request in its own alert node instead of replacing the hint,
and the reason field is invalid only when its own value fails validation. While
that dialog is open, the section's Approve and Request changes controls stay
inactive, so the dialog holds the next verdict write. Both are user-visible
verdict behaviour, but the owning requirement in
`openspec/specs/review-verdict-integrity/spec.md:122` still describes only the
original dialog contract: it does not say which feedback is an alert, when the
reason field is invalid, or which control owns the armed verdict write.

## What Changes

- Keep the explanatory reason hint visible next to any feedback and announce a
  rejected request in a separate alert. Mark the reason field invalid only when
  the reason value itself fails validation; a version conflict or transport
  failure must not mark a valid reason invalid.
- Keep Approve and Request changes inactive while the reason dialog is open, so
  the dialog's submit is the section's only armed verdict write until it closes.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `review-verdict-integrity`: specify separate reason feedback and the single
  armed verdict writer while the reason dialog is open.

## Impact

`apps/web/src/features/review/ui/request-changes-dialog.tsx`,
`apps/web/src/features/review/ui/section-verdict-control.tsx` and their
colocated tests. The contract owner is
`openspec/specs/review-verdict-integrity/spec.md`. Backlog: TASK-503.40.

## Non-goals

- No server, authorization, section lifecycle, shared-schema or transport
  changes.
- No native browser/AT, race or database execution; those stay Waiting for the
  parent integration.
