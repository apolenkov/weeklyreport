# Design

## Context

See proposal.md. The server's existing assertEndNotBeforeStart rejects reversed
manual envelopes before deadline computation. The current dialog's end error
only covers empty edit-mode input, so clearing the deadline leaves valid but
reversed dates enabled for submission. CreatePeriodFields already associates
an end error with its input; no new error component is needed.

## Goals / Non-Goals

Mirror existing valid-envelope ordering in the dialog. Preserve native date
controls, UTC payload construction, optional create ends, deadline clear/derive
semantics, pending locks and lifecycle guards. Do not extend date parsing or
invent policies for malformed browser values.

## Decisions

Extend the existing periodEndError calculation and existing canSubmit gate.
Compare the same UTC start and end-of-day timestamps that submission uses.
Same-day dates stay ordered. Keep the existing required-end message first for
edit mode. Avoid a new shared parser, export, API adapter or dependency.

Before: valid reversed controls -> enabled submit -> server overlap rejection.
After: the same controls -> associated end error -> disabled submit/no mutation;
correction -> the existing UTC mutation payload. Server validation is unchanged.

## Risks / Trade-offs

- jsdom can prove the actual public dialog/mutation admission boundary but not
  native Safari typing or AT announcements. Root owns those acceptance checks.
- No changes to persistence, role builders, period lifecycle tuple, overlap
  concurrency, defaults or destructive guards. No rollout migration or flags.
