# Reopen-decisioning is a head capability, not admin-only

**Status:** accepted

## Context

A lead can ask to edit their own already-submitted section again by filing a
**reopen request** (`leadForm.requestReopen` → a `pending` `ReopenRequest` row).
Someone then approves or rejects it; approving flips that `ReportSection`
`submitted` → `draft` so the lead can edit.

The three tRPC procedures that read and decide these requests —
`listReopenRequests`, `respondReopenRequest`, `pendingReopenCount` — were all
built on `adminProcedure`. Per `UFB-038` the codebase deliberately split
`adminProcedure` (admin-only) away from `headProcedure` (head + admin), with the
rationale "heads have a dashboard, not an admin panel." That split swept the
reopen procedures into admin-only territory along with genuine admin surfaces
(users, periods, reminders, groups).

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

This **amends, not contradicts, `UFB-038`.** `UFB-038`'s principle — "heads have
a dashboard, not an admin panel" — stands: heads still do not get the admin panel.
This decision corrects a mis-filed gate by moving a review capability out of the
admin allowlist and onto the head's own dashboard, which is precisely where
`UFB-038` says head work belongs.

The reopen procedures keep their `admin.*` tRPC namespace for now (both surfaces
already call `admin.listReopenRequests` / `admin.respondReopenRequest`); the
namespace is a wire path, not an authorization claim, and renaming it is churn
without behavior change. The authorization claim is the gate, and the gate is now
`headProcedure`.

## Consequences

- A head with no admin role can adjudicate reopen requests. This is the intended
  outcome and the reason for the change.
- The `role-coverage-gate` test still passes: it asserts every procedure is built
  on one of the recognized base procedures, and `headProcedure` is recognized; it
  does not pin these three procedures to `adminProcedure`.
- Widening the decider set from "admins only" to "heads + admins" makes
  concurrent decisions on the same request more likely, so the response path must
  re-check `status = 'pending'` inside its transaction (handled in the
  `reopen-request-lifecycle` change, not here).
- The `admin.*` namespace now hosts a head-gated procedure, a small naming
  irregularity accepted in exchange for not duplicating the procedures into a
  `review.*` namespace and re-wiring the existing admin tab.
- If SAML attribute mapping later makes admin a fully independent role with its
  own narrow surface, this decision needs no revision — reopen already lives with
  the head, where it belongs.
