# Proposal

## Why

Reviewers can lose schema-valid padded text to the dialog's raw length cap, and an over-limit reason receives an unrelated empty-reason error. TASK-503.72 (C5122) adopts Root policy B: retain editable input and validate the canonical trimmed code-point length.

## What Changes

- Remove the dialog's raw UTF-16 `maxLength` restriction; keep the existing trimmed code-point counter.
- Use the existing canonical verdict schema before mutation and show actionable inline feedback for over-limit text.
- Preserve the exact raw draft on local validation and server rejection; submit only the validated trimmed command.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `review-verdict-integrity`: specify trimmed code-point dialog acceptance, retained rejection input and over-limit feedback.

## Impact

Only `apps/web/src/features/review/ui/request-changes-dialog.tsx` and its existing colocated tests change. The contract owner is `openspec/specs/review-verdict-integrity/spec.md`. Source decision and conditional RED: `/home/user/work/handoffs/task-503/request-changes-72/ROOT-POLICY-DECISION.md` and `CONTRACT-RED.md` in the same directory.

## Non-goals

- No server, authorization, body-limit, shared-schema, lifecycle or other composer changes.
- No grapheme counting or expansion into C5098.
- No native/browser/AT/database execution or whole-card closure; those remain Waiting for the parent.
