# Design — reopen-request-lifecycle

Decisions for implementing this change. Durable, repo-wide rationale lives in
ADR 0008 (the gate is a head capability) and CONTEXT.md (the _Reopen request_
term); this file holds the change-scoped technical choices.

## D1 — Gate: widen the three procedures to `headProcedure`

`listReopenRequests`, `respondReopenRequest`, `pendingReopenCount` switch from
`adminProcedure` to `headProcedure`. Rationale in ADR 0008. Mechanics:

- The `role-coverage-gate` test passes by construction — it asserts each
  procedure is built on a recognized base and `headProcedure` is one of them; no
  assertion pins these three to `adminProcedure` (verified against
  `role-coverage.test.ts`).
- The admin tab keeps working because admin ∈ `headProcedure` allowlist.
- The `admin.*` tRPC namespace is **kept**: both the admin tab and the new
  dashboard card already import `trpc.admin.listReopenRequests` /
  `trpc.admin.respondReopenRequest`. Renaming to `review.*` is pure churn — the
  authorization claim is the gate, not the path. The naming irregularity is
  recorded in ADR 0008.

## D2 — Dashboard surface reuses the admin procedures (no duplication)

A new `ReopenRequestsCard` on `DashboardPage` calls
`admin.listReopenRequests({ status: "pending" })` and `admin.respondReopenRequest`,
and on success invalidates **both** `listReopenRequests` and `pendingReopenCount`
query keys — identical to `reopen-tab.tsx`. Same query input shape (`{ status:
"pending" }`) so React Query dedupes and the admin tab + dashboard never diverge.

The card is intentionally lighter than the full admin tab: it shows only
`pending` requests with inline Approve / Reject + optional note. The admin tab
keeps the full filter set (pending/approved/rejected/all) and history. Heads who
want history still have the dashboard's normal flow; the card is a queue, not an
archive.

## D3 — Pending count in `AlertBar`, with the early-return fixed

`pendingReopenCount` (already cheap, a single `count`) feeds an indicator in
`AlertBar`. The blocker: `AlertBar` returns `null` when there are no late/missing
leads. That early return is widened so the bar renders when **either** there are
missing leads **or** the reopen count is non-zero. Zero-of-both still returns
`null`. The reopen indicator links to / scrolls to the `ReopenRequestsCard`.

## D4 — Reopen requests only on editable-lifecycle periods (KEY)

This is the load-bearing decision and the one most worth challenging.

**The problem.** Approving a request flips the section `submitted` → `draft`. But
`LeadFormPrismaRepository.getSectionForPeriod` computes `readOnly = periodStatus
!== "open"` (with a standing comment "'reopened' is treated as non-open per spec
— callers may refine"). So today a draft section on any non-`open` period is
still read-only — a `published`-period approval would hand the lead a draft they
**cannot edit**. The feature is only functional on `open` periods, and a
`published` request is internally contradictory (allowed to ask, but useless on
approval).

**The decision (option A — forbid section reopen on closed periods).**

1. A reopen request (button + server) is allowed only on a period whose section
   is editable after approval:

   - `open` — allowed (the common case: lead submitted early, period still open,
     head approves, lead edits).
   - `reopened` — allowed, AND the lead-form read-only rule is refined so a
     `reopened` period is editable (`readOnly = periodStatus !== "open" &&
periodStatus !== "reopened"`). This closes the "callers may refine" gap; a
     `reopened` period that stays read-only is itself a latent bug, since the
     whole point of the `reopened` state is to allow edits.
   - `published` — **forbidden** at the section level. To reopen a section on a
     published period, the **period** must first be reopened (`published` →
     `reopened`) via the existing head/admin period-level action in Admin →
     Periods, which is exactly where `AppSettings.allowReopenAfterPublish` /
     `reopenWindowHours` already govern. Once the period is `reopened`, section
     reopen requests are allowed again by the rule above. This keeps the publish
     policy meaningful (at the period level, where it lives) without the
     section-level contradiction.
   - `archived` — forbidden. `archived` is a separate `Report` boolean, not a
     `periodStatus` value, so it is checked explicitly, not inferred from the
     enum.

2. The server is the single source of truth. `requestReopen` enforces the rule,
   and the lead-form read (`leadForm.byPeriod`) carries a server-computed
   `canRequestReopen` boolean (plus a reason when false). The web button reads
   that flag; it does **not** reconstruct the policy. This avoids drift between
   the button and the server, and keeps the lifecycle/policy fields
   (`periodStatus`, `archived`, `publishedAt`, settings) on the server where they
   already live — `ReportSectionReadModel` carries none of them today.

**Why this overrides the earlier "published by policy" sub-choice.** During the
grill the recommended option allowed `published` within the policy window. The
read-only code (`getSectionForPeriod`) and Codex review proved that path is a
dead end: approval there yields a draft the lead still cannot edit, and it
contradicts CONTEXT.md. Forbidding `published`/`archived` at the section level
matches the user's actual stated need — "no reopen request on a closed period" —
more simply and without contradiction, while the period-level reopen still honors
the publish policy.

## D5 — One pending request per section

`requestReopen` rejects a second `pending` request for a section that already has
one (mapped to a friendly domain error). The durable enforcement is a **partial
unique index** on `ReopenRequest (reportSectionId) WHERE status = 'pending'`,
reshaped directly into `prisma/schema.prisma` + the init migration (MVP:
disposable DB, hand-edit the partial-index SQL Prisma can't express). The
application check gives the clean error message; the index is the real guarantee
against a race between two `requestReopen` calls. Approved/rejected rows are
unconstrained, so a section can be reopened, re-submitted, and requested again.

## D6 — Race-safe decision

`respondReopenRequest` currently reads the row, checks `status === "pending"`
**outside** the transaction, then updates by `id` only **inside** it. Two
deciders (now head + admin) can both read `pending` and both write — the second
overwrites the first decision and double-increments
`customreportReopenRequestsTotal`. Fix: inside the transaction do a conditional
`updateMany({ where: { id, status: "pending" }, data: ... })` and assert
`count === 1`; if `0`, the request was already decided — throw "Already
processed." and do not touch the section or the metric.

The request status is not the only state to guard: a head can revoke a submitted
section separately, so a request can still be `pending` while its section is no
longer `submitted`. For an **approve**, the same transaction must also require the
section is still `submitted` (a conditional `updateMany` on the section asserting
one row); if the section already moved to `draft`, the request is **stale** — flip
nothing, do not increment the approve/reject funnel.

A stale request must become **terminal** so it leaves the pending queue
(`listReopenRequests` / `pendingReopenCount` read `status = 'pending'`); otherwise
it sticks forever. v1 resolves a stale approval by writing `status = 'rejected'`
with an auto `reviewNote` ("Auto-closed: the section was already reopened.") and
**incrementing no funnel metric at all**. `customreportReopenRequestsTotal` is a
fixed three-state contract (`requested` / `approved` / `rejected`, mirrored by the
Grafana product-telemetry dashboard); an auto-close is not a real decision, so it
must not add a fourth label or inflate `rejected`. This needs no schema change.
The more-honest alternative — a dedicated `stale` terminal status on
`ReopenRequest` — is deferred because it ripples into the status enum, the list
filter, and the admin tab palette/labels; the spec is written outcome-based
(terminal + funnel not skewed) so either implementation satisfies it.

## D8 — Head reopen reads/decisions are group-scoped; admin stays global

Widening the gate to `headProcedure` exposes a scope gap: `listReopenRequests` /
`pendingReopenCount` filter only by `status`, so a non-admin head would see every
group's requests — inconsistent with every other head dashboard read, which is
group-scoped via `groupScopeFilter(session, 'reportSection')` (head → own
`ReportingGroup`; admin → `{}`). That helper returns a `ReportSectionWhereInput`
fragment (`{ author: { reportingGroupId: ... } }`), and reopen queries are
`ReopenRequest` queries, so the fragment must be **nested under `reportSection`**,
not spread at the top level:

```ts
const scope = groupScopeFilter(session, "reportSection"); // {} for admin
reopenRequest.findMany({ where: { ...statusFilter, reportSection: scope } });
```

`pendingReopenCount` filters the same way, and `respondReopenRequest` re-loads the
request with `{ id, reportSection: scope }` so a head cannot decide an out-of-group
request by passing its id (the scoped load finds nothing → reject). Admin keeps the
empty fragment (global), so the admin tab is unchanged.

## D7 — UI strings stay English; data stays as-is

The new dashboard card and the AlertBar indicator are production UI in
`apps/web/src/**/*.tsx`, so all copy is English per the repo UI-strings rule
(reuse the admin tab's existing strings where possible). No new Russian literals.

## Open questions

1. **Two-step published reopen ergonomics.** With option A, reopening a section on
   a published period is two steps: the head reopens the period (Admin → Periods),
   then approves the lead's section request. If UAT finds this clumsy, revisit
   whether approving a request should be allowed to trigger the period reopen in
   one step (the heavier option B — it must then cover dual-state + frozen-snapshot
   effects, so it is deliberately out of v1).
2. **AlertBar information density.** If the bar already shows late-lead and
   missing-submission indicators, a third reopen indicator may crowd it; the
   fallback is to drop the AlertBar indicator and rely on the card's own header
   count. Decide during implementation against the live bar.
