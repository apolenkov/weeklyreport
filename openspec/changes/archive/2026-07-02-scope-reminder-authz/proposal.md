## Why

A non-admin head can drive the three reminder tRPC procedures against any
group's data: `reminders.execute` sends to an arbitrary `recipientEmail`
for an arbitrary `ruleId`, `reminders.listExecutions` reads any rule's
execution history by `ruleId`, and `reminders.dispatchPending` fans out to
draft-section authors without filtering on the caller's group. The first is
also an open-mailer — a head can ping any email address, lead or not. The
council (Codex) flagged this as a High-severity authorization gap
(P1-4 in `docs/repo-excellence-review-2026-06-28.md`).

## What Changes

- Thread `ctx.session` into all three reminder procedures in
  `apps/api/src/infrastructure/trpc/trpc.router.ts`
  (`execute` ~1821, `listExecutions` ~1839, `dispatchPending` ~1910).
- `execute`: load the `ReminderRule`, reject a `ruleId` whose report has no
  section in the caller's scope, and reject a `recipientEmail` that is not a
  draft-section author within the caller's scope on that report.
- `listExecutions`: reject a `ruleId` whose report is out of the caller's
  scope, and additionally filter execution rows to in-scope `recipientEmail`
  BEFORE cursor pagination, so a mixed-scope shared report cannot leak group-B
  `recipientEmail` / `dedupeKey` rows and out-of-scope rows cannot drive the
  page or `nextCursor`.
- `dispatchPending`: apply `groupScopeFilter(session, "reportSection")` to
  the bulk `draftSections` query (keeping the existing `activeReportId`
  guard); for a single `leadId`, authorize the lead against the `User` row via
  `groupScopeFilter(session, "user")` (not a section, which may not exist yet)
  — reject FORBIDDEN only for an out-of-scope lead, and preserve the
  `no-matching-section` result for an in-scope lead with no draft section.
- Reuse the canonical `groupScopeFilter` helper
  (`apps/api/src/lib/group-scope.js`); admin sessions keep god-mode because
  the helper returns `{}` for `role === "admin"`.
- Add a regression test: a head in group A is rejected (FORBIDDEN) when
  targeting group B's `ruleId` / `reportId` / `leadId`, with no group-B data
  returned.

## Capabilities

### New Capabilities

- `reminder-scope-authz`: per-group authorization scope for the reminder
  dispatch / list / execute tRPC procedures — which rules, reports, leads,
  and recipient emails a non-admin head may target.

### Modified Capabilities

- (none)

## Impact

- Code: `apps/api/src/infrastructure/trpc/trpc.router.ts` (three procedures),
  reuse of `apps/api/src/lib/group-scope.ts`.
- Behavior: a head can no longer execute, list, or dispatch reminders for
  another group's report, lead, or rule, nor send to an arbitrary email.
- Tests: new scope regression coverage for the reminder namespace.
- No schema change, no new dependency. Admin behavior unchanged.
