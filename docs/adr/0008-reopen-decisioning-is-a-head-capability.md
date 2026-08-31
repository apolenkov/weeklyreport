# Reopen-decisioning is a head capability, not admin-only

**Status:** accepted

## Context

A lead can ask to edit their own already-submitted section again by filing a
**reopen request** (`leadForm.requestReopen` → a `pending` `ReopenRequest` row).
Someone then approves or rejects it; approving flips that `ReportSection`
`submitted` → `draft` so the lead can edit.

The three tRPC procedures that read and decide these requests —
`listReopenRequests`, `respondReopenRequest`, `pendingReopenCount` — were all
built on the admin-only procedure gate. That split swept the reopen procedures
into admin-only territory along with genuine admin surfaces (users, periods,
reminders, groups), even though reopen decisioning is review work.

But reopen-decisioning is not administration — it is **review**. The procedure
comments themselves describe the flow as "Lead-initiated, **Head**-decided", the
`headProcedure` is already the documented gate for "dashboards, weekly reports,
and review", and the project's role definition states a head has "lead
capabilities + review + publish". A head reads a lead's submission and decides
whether to let them change it; that is the same review act as the existing
per-section revoke a head already performs on `/head/report`.

In a deployment where **head and admin are distinct people** — the real target
configuration — the admin-only gate is actively wrong: the person who owns the
review relationship with the leads (the head) gets `FORBIDDEN`, while the
technical admin, who has no reason to adjudicate a lead's edit request, is the
only one who can. Live page feedback asked for exactly this: the head wants to
see and approve reopen requests from their own dashboard, without an admin panel.

## Decision

Reopen-decisioning is a **head capability**. The three reopen procedures move
from `adminProcedure` to `headProcedure` (head + admin):

- `listReopenRequests`, `respondReopenRequest`, `pendingReopenCount` are gated by
  `headProcedure`. A non-admin head can now read the queue, see the pending
  count, and approve/reject.
- The admin Reopen Requests tab (`/admin?tab=reopen`) is **unchanged** and keeps
  working, because admin is in the `headProcedure` allowlist (admin is god-mode
  that inherits head). The same procedures back both surfaces.
- The head consumes this capability from a new **Reopen Requests** surface on the
  head dashboard (`/head/dashboard`), not from the admin panel.

Heads still do not get the admin panel. This decision corrects a mis-filed gate
by moving a review capability out of the admin-only surface and onto the head's
own dashboard.

The reopen procedures use the `admin.*` tRPC namespace as their wire path, while
`headProcedure` is the authorization contract. The namespace does not grant an
admin-only capability.

## Consequences

- A head with no admin role can adjudicate reopen requests. This is the intended
  outcome and the reason for the change.
- The `role-coverage-gate` test still passes: it asserts every procedure is built
  on one of the recognized base procedures, and `headProcedure` is recognized; it
  does not pin these three procedures to `adminProcedure`.
- Widening the decider set from "admins only" to "heads + admins" makes
  concurrent decisions on the same request more likely, so the response path must
  re-check `status = 'pending'` inside its transaction.
- The `admin.*` namespace now hosts a head-gated procedure, a small naming
  irregularity accepted in exchange for not duplicating the procedures into a
  `review.*` namespace and re-wiring the existing admin tab.
