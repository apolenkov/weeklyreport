## Why

Live page feedback on `/admin?tab=reopen`: a lead filed a **reopen request**
(asking to edit their own already-submitted section), but the head can only act
on it inside the admin panel. The head wants to see and approve/reject reopen
requests directly on **their own dashboard** (`/head/dashboard`), without
detouring through `/admin`.

Two facts make this more than a UI move:

1. The three reopen procedures (`listReopenRequests`, `respondReopenRequest`,
   `pendingReopenCount`) are gated `adminProcedure` — **admin-only**. Per
   `UFB-038` heads were deliberately cut off `/admin/*`. So in the real
   deployment, where **head and admin are different people**, a non-admin head
   gets `FORBIDDEN` and cannot decide a reopen request at all — even though the
   code calls the flow "Lead-initiated, **Head**-decided" and a head already
   owns review + per-section revoke. Reopen-decisioning is a head capability
   mis-filed into the admin panel (see ADR 0008).

2. Related lead-side feedback on `/lead/report/...`: the **Request Reopen**
   button shows for any submitted section regardless of the period lifecycle, so
   a lead can ask to reopen a section on a closed period. The server
   (`leadForm.requestReopen`) only checks section existence, ownership, and
   `status === "submitted"` — it never consults the period state.

This change makes reopen-decisioning a head capability surfaced on the head
dashboard, and makes a reopen request respect the period lifecycle on both the
button and the server. It also closes correctness gaps the wider decider set
exposes (duplicate pending requests, a concurrent-decision race).

## What Changes

- **The three reopen procedures move from `adminProcedure` to `headProcedure`
  (head + admin).** A non-admin head can read the queue, see the pending count,
  and approve/reject. The admin Reopen Requests tab is unchanged — admin is in
  the head allowlist, and both surfaces call the same procedures. (ADR 0008.)
- **A new "Reopen Requests" card on the head dashboard** (`/head/dashboard`,
  `DashboardPage`) lists pending requests with inline Approve / Reject and an
  optional head note, reusing `admin.listReopenRequests({ status: "pending" })`
  and `admin.respondReopenRequest` with the same query-key invalidation the admin
  tab uses (`listReopenRequests` + `pendingReopenCount`). The card is read from
  the same data, so the admin tab and the dashboard never drift.
- **The pending reopen count surfaces in the dashboard `AlertBar`.** `AlertBar`
  currently returns `null` when there are no late/missing leads; it is changed so
  it still renders when the reopen count is non-zero, otherwise a head with zero
  missing submissions but pending reopen asks would see no alert.
- **A reopen request now respects the period lifecycle**, on the button and on
  the server. `leadForm.requestReopen` allows `open` and `reopened` periods and
  forbids `published` and `archived` — a request is only meaningful where the
  section is editable after approval. `archived` is a separate `Report` flag, not
  a `periodStatus` value, and is checked explicitly. A `published` period is
  reopened only through the existing period-level reopen (Admin → Periods, where
  `AppSettings.allowReopenAfterPublish` already governs); once it is `reopened`,
  section requests are allowed again.
- **The server is the single source of truth for the button.** The lead-form read
  (`leadForm.byPeriod`) carries a server-computed `canRequestReopen` boolean (plus
  a reason when false); the lead's **Request Reopen** button reads that flag and
  the web client does not reconstruct the policy. The flag is true only for a
  `submitted` section on an `open`/`reopened` period with no existing pending
  request, and it refreshes after a successful request so the button can't invite
  a duplicate. `ReportSectionReadModel` carries none of the lifecycle/policy
  fields today, so the computation stays on the server where they live.
- **A `reopened` period section becomes editable.** The lead-form read-only rule
  is refined so a `reopened` period is editable (closing the existing "callers may
  refine" gap); without it, even an approved reopen on a `reopened` period would
  leave the lead unable to edit. (See `design.md` D4 — the key decision.)
- **Duplicate pending requests are prevented.** `requestReopen` refuses to create
  a second `pending` request for a section that already has one.
- **The response path is made race-safe.** `respondReopenRequest` re-checks
  `status = 'pending'` inside its transaction (a conditional update asserting one
  affected row), so two reviewers — now head and admin — cannot both decide the
  same request or double-count the funnel metric. An approve also requires the
  section is still `submitted`; if it was separately revoked, the request becomes
  terminal (leaves the pending queue) without skewing the funnel.
- **Head reads and decisions are group-scoped.** Widening the gate to head exposes
  a scope gap: the reopen procedures filter only by status, while every other head
  dashboard read is limited to the head's reporting group. The three procedures
  apply the `reportSection` group scope for head sessions (admin stays global), so
  a head sees, counts, and decides only their own group's requests — never another
  group's, even by passing its id.

Out of scope: proactive per-lead "return" without a lead request (the head's
existing `revokeAllSubmitted` / per-section revoke already covers that — see
CONTEXT.md _Revoke_); the period-level reopen in Admin → Periods; any change to
the frozen `publishedSnapshot` / search semantics; renaming the `admin.*` tRPC
namespace.

## Capabilities

- `reopen-requests` (NEW) — the reopen-request lifecycle contract: who may decide
  a request (head + admin), where the head decides it (the dashboard surface +
  the unchanged admin tab), when a lead may file one (period-lifecycle guard on
  button and server), the one-pending-per-section rule, and the race-safe
  decision.

## Impact

- API (in scope):
  - `apps/api/src/infrastructure/trpc/trpc.router.ts` — `listReopenRequests`,
    `respondReopenRequest`, `pendingReopenCount` switch `adminProcedure` →
    `headProcedure` and apply `groupScopeFilter(session, 'reportSection')` for head
    sessions (admin global); `respondReopenRequest` transaction re-checks
    `status = 'pending'` and section-still-`submitted`, with a terminal stale
    outcome; `requestReopen` rejects a duplicate pending request and enforces the
    period-lifecycle guard.
  - `apps/api/src/lib/group-scope.ts` — reused as-is (the `reportSection` target);
    no change, only a new call site.
  - `apps/api/src/modules/report-sections/lead-form.service.ts` /
    `lead-form-shared.ts` / `lead-form.prisma-repository.ts` — the reopen guard
    needs the period lifecycle (`periodStatus` + the `Report` `archived` flag) at
    the service boundary; `requestReopen` enforces open/reopened-only; the
    lead-form read returns a server-computed `canRequestReopen` flag; the
    read-only rule refines so `reopened` is editable.
  - `packages/shared/src/schemas/section.schema.ts` (or the `leadForm.byPeriod`
    output schema) — add the `canRequestReopen` field (+ optional reason) to the
    lead-form read contract.
- Web (in scope):
  - `apps/web/src/components/dashboard/dashboard-page.tsx` — mount the new card.
  - `apps/web/src/components/dashboard/reopen-requests-card.tsx` (NEW) — the
    dashboard queue with inline Approve / Reject, reusing the admin procedures.
  - `apps/web/src/components/dashboard/alert-bar.tsx` — render when reopen count
    is non-zero; show the count.
  - `apps/web/src/components/lead/lead-form.tsx` — hide Request Reopen when the
    period lifecycle forbids it.
- Tests: role-coverage stays green (`headProcedure` is recognized); add API tests
  for the gate (head allowed, lead/viewer forbidden), the lifecycle guard
  (open/reopened/published-in-window/published-out-of-window/archived), the
  duplicate-pending rejection, and the concurrent-decision race; web tests for
  the dashboard card and the button-visibility rule.
- Schema: a partial unique index preventing two `pending` `ReopenRequest` rows
  for one section is the durable form of the duplicate guard; during MVP this is
  reshaped directly in `prisma/schema.prisma` + the init migration (see
  `design.md` for the application-level vs DB-constraint choice).
- Domain docs: `CONTEXT.md` gains the **Reopen request (section reopen)** term;
  `docs/adr/0008-reopen-decisioning-is-a-head-capability.md` records the gate
  decision.
