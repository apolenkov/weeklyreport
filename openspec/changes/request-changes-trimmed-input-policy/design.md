# Design

## Context

See `proposal.md` for motivation and the delta spec for the accepted Root B contract. `RequestChangesDialog` already counts trimmed code points and validates with `reviewVerdictInputSchema`, but its native `maxLength` counts raw UTF-16 and every local failure is rendered as an empty-reason error.

## Goals / Non-Goals

Keep the dialog's raw editable state separate from its canonical command. Retain existing focus, pending-submit, success-close and server-error behavior. No shared schema or transport changes; no other composer is affected.

## Decisions

- Remove `maxLength` rather than introducing a new cap or clipping callback. A raw cap cannot implement trimmed code-point acceptance.
- Keep the canonical verdict schema as the validation authority. Classify its comment `too_big` issue for an actionable English limit error; retain existing handling for other failures. Do not duplicate the acceptance predicate.
- Keep `reason` unchanged on rejection. Only the command is trimmed. Existing edits clear feedback and allow correction/retry.
- Extend the existing dialog test owners with schema-oracled boundary cases, retained invalid input, correction and padded server rejection. User-event paste exercises jsdom interactions, not native clipboard or browser enforcement.

Before: raw input → native UTF-16 cap → raw state → trimmed schema → mutation or empty-reason error.
After: raw input → full raw state → trimmed canonical schema → mutation or specific inline error, retaining raw state.

## Risks / Trade-offs

- Native attempted-paste/readback and AT behavior remain unproved → explicitly leave those in Waiting; no whole C5122 closure.
- More raw text can be edited locally → unchanged server body limits and canonical schema remain authoritative.
- Independent review and full repository gates belong to parent integration under the wave brief; only focused checks run here.

## Migration Plan

No data migration, flags or destructive operations. Deploy the web change; roll back the commit if necessary. Period dual-state, canonical authorization middleware and database guards are unchanged. API and Lead form consumers are not modified.
