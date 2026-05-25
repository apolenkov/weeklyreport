# Fix period reopen UI

## Problem

Report periods can be closed by the head. User feedback: "It's unclear how to
reopen a closed period. Where are the reopen requests in the UI?" DeepScan
audit confirms no visible reopen action on closed-period views. Head and
admin roles should see a "Request reopen" or "Reopen" button on closed
periods; the ability exists in the backend but is not exposed.

## Solution

1. Audit backend: verify `openPeriod()` or `reopenPeriod()` tRPC procedure
   exists and is guarded by `@IsHead()`.
2. Add action button to period card / period detail view (on head/admin
   surfaces only) to trigger reopen workflow.
3. UX: button shows on closed periods only; triggers confirmation dialog;
   POST to reopen endpoint.
4. Success toast: "Period reopened. Leads can now edit reports."

## Non-goals

- Change the reopen business logic or state machine.
- Add reopen request queue (if backend needs design, it's a separate scope).

## Status

Open — DeepScan finding, user feedback in test session 2026-05-14.
