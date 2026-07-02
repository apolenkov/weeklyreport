## Context

The reminders namespace exposes three `headProcedure` operations in
`apps/api/src/infrastructure/trpc/trpc.router.ts`:

- `reminders.execute` (~1821) — `requestReminderExecution(ruleId, recipientEmail)`.
- `reminders.listExecutions` (~1839) — `listExecutions(ruleId, pagination)`.
- `reminders.dispatchPending` (~1910) — fans out one execution per pending
  draft author of a report.

`headProcedure` resolves to `buildRoleMiddleware(["head", "admin"])`, so both
head and admin reach these procedures. Only `dispatchPending` reads
`ctx.session` today (the `activeReportId === reportId` guard). `execute` and
`listExecutions` ignore the session entirely and trust a client-supplied
`ruleId` / `recipientEmail`, and `dispatchPending`'s `draftSections` query has
no author-group filter. The canonical scope helper already exists:
`groupScopeFilter(session, "reportSection")` returns
`{ author: { reportingGroupId: { in: groupIds } } }`, and `{}` for admin.

## Goals / Non-Goals

**Goals:**

- Bound each reminder procedure to the non-admin caller's group, reusing the
  existing `groupScopeFilter` helper (no new scope mechanism).
- Close the open-mailer hole on `execute` (`recipientEmail` must be an
  in-scope draft author, not an arbitrary address).
- Keep admin god-mode and the existing `activeReportId` guard intact.
- Add a cross-group regression test mirroring `repository-scope-guard`.

**Non-Goals:**

- No schema change (MVP disposable-DB rules do not apply here).
- No change to the reminders engine, scheduler, dedupe pipeline, or
  `EmailService`.
- Not fixing the separate escalation-recipient / dedupe-atomicity bugs —
  those are the distinct `fix-reminders-escalation-dedupe` change (P1-6).
- No new tRPC middleware-chain builder; these stay `headProcedure`.

## Decisions

### Scope each procedure via the rule's report sections, not a rule group

A `ReminderRule` has no group column; its only group link is
`rule.report -> ReportSection.author.reportingGroupId`. So "is this rule in
my scope" becomes "does the rule's report have at least one section author in
`groupScopeFilter(session, "reportSection")`". Decision: resolve `reportId`
from the loaded rule, then check section authorship with the helper.

Alternative considered: add a group column to `ReminderRule`. Rejected — it
duplicates the section-author source of truth, needs backfill, and contradicts
the "reuse the canonical helper" goal.

### Data flow before/after

- `execute` before: `requestReminderExecution(input.ruleId, input.recipientEmail)`.
  after: load rule -> resolve `reportId` -> assert an in-scope section author
  exists -> assert `recipientEmail` is one of those in-scope draft authors ->
  then call the service.
- `listExecutions` before: `listExecutions(input.ruleId, ...)`.
  after: load rule -> assert in-scope report -> drop rows whose
  `recipientEmail` is out of scope BEFORE paginating -> paginate the scoped
  set (see "Recipient-level filter" below).
- `dispatchPending` before: `findMany({ reportId, status: "draft", leadId? })`.
  after: for the bulk path (no `leadId`) spread `groupScopeFilter(session,
"reportSection")` into that `where`; when `leadId` is supplied, check the
  lead's group scope separately from draft status (see "Lead scope vs draft
  status" below).

### Admin stays god-mode for free

`groupScopeFilter` returns `{}` for `role === "admin"`, so the same code path
applies no filter for admins. The scope checks branch on a non-empty filter
only for non-admin callers; admins skip the rule-ownership assertions.

### Reject vs silent-empty

For non-admin out-of-scope `ruleId` / `reportId` / `leadId`, throw a tRPC
`FORBIDDEN` (matching the `dispatchPending` `report-not-active` precedent),
not a silent empty result, so the boundary behaves like the other scope
guards and the regression test can assert a 403-equivalent.

### Recipient-level filter on `listExecutions` (Codex P1-4 High)

The rule-level "report has at least one in-scope section author" check is
necessary but NOT sufficient for `listExecutions`. A `ReminderRule` is
rule-wide (`ReminderExecution.ruleId`, no per-recipient scope column), and a
shared report can carry both group-A and group-B draft-section authors. The
scheduler fans out one execution per draft author regardless of group, so the
rule's execution set mixes recipients. Each row exposes `recipientEmail` and
`dedupeKey` (the dedupe key embeds the recipient email), so the rule-passes
check alone would let a group-A head read group-B lead identities.

Decision: after the rule-level check, resolve the set of in-scope recipient
emails — section authors within `groupScopeFilter(session, "reportSection")`
on the rule's report, plus the caller's own email for escalation reminders
addressed to the head themself — and drop every returned execution whose
`recipientEmail` is not in that set. This recipient filter MUST run BEFORE
cursor pagination, not after it: `RemindersService.listExecutions` slices and
computes `nextCursor` over the repository's unscoped newest-100 slice
(`reminders.service.ts:230-241` over `reminders.prisma-repository.ts:290-295`),
so filtering the already-paginated page (in the router) would let out-of-scope
rows consume the page size and drive `nextCursor` — yielding empty or short
pages and potentially surfacing an out-of-scope execution id as the cursor.
Apply the recipient predicate to the full slice — inside the service before it
slices/computes the cursor, or pushed into the repository's execution query —
so pagination runs over the already-scoped set. Admin bypasses the filter.
This keeps the legitimate shared-report use case (a head reviewing their own
group's executions) while closing the cross-group leak. Alternative
considered: reject non-admin listing outright for any mixed-scope report.
Rejected — it breaks the legitimate case and is coarser than necessary.

### Lead scope vs draft status on `dispatchPending` (Codex P1-4 Medium)

`no-matching-section` is a valid success state, not an authorization failure:
an in-scope lead can have an already-submitted section or no section yet, and
`remind-lead-button.tsx` renders this as the `no-section` confirmation. So
"`leadId` resolves to zero draft rows" must NOT be treated as out-of-scope.

Decision: for the single-lead path, authorize the lead against the `User`
row, not a `ReportSection`. Load the `User` named by `leadId` under
`groupScopeFilter(session, "user")` — which filters `User.reportingGroupId`
directly (`prisma/schema.prisma:26,34`) — and throw FORBIDDEN only when no
in-scope user matches (out of scope or nonexistent). A section-based check
cannot be used here: with no `ReportSection` row it cannot distinguish an
in-scope lead who simply has no section yet from an out-of-scope lead. Because
authorization no longer depends on a section existing, an in-scope lead with
no draft section still flows to the existing `no-matching-section` result. The
bulk path (no `leadId`) keeps the simple `groupScopeFilter(session,
"reportSection")` spread into the `draftSections` query — there is no per-lead
success state to preserve there.

## Risks / Trade-offs

- [Extra read on `execute` / `listExecutions` to load the rule before acting]
  → one indexed `findFirst` by `id`; negligible, and these are low-frequency
  head actions, not hot paths.
- [A shared/cross-group active report could legitimately contain other-group
  draft authors] → desired: `dispatchPending` must only ping the caller's own
  group; the `activeReportId` guard plus the section-author filter together
  enforce that.
- [`recipientEmail` constraint could reject a previously-valid manual send]
  → intended tightening; the client already resolves emails server-side for
  `dispatchPending`, and `execute`'s recipient must be a real in-scope author.

## Migration Plan

Pure code change in one router file plus tests. No migration, no flag, no
data backfill. Rollback is reverting the router edit. Downstream `apps/web`
callers are unaffected on the happy path (they already pass in-scope ids);
out-of-scope calls now fail closed.

Invariants: preserves the role-coverage gate (procedures stay
`headProcedure`), the period dual-state writers, and the destructive-db
guard (untouched). Relaxes nothing; tightens authorization only.

## Open Questions

- None blocking. If a future need arises for an admin-only "send to arbitrary
  email" path, it would be a separate `adminProcedure`, out of scope here.
