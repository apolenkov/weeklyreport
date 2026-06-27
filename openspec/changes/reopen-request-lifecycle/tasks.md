# Tasks — reopen-request-lifecycle

## 1. Gate: reopen procedures become head-and-admin

- [x] 1.1 In `trpc.router.ts`, switch `listReopenRequests`, `respondReopenRequest`,
      and `pendingReopenCount` from `adminProcedure` to `headProcedure`.
- [x] 1.2 Add API tests: role `head` succeeds and role `lead` / `viewer` is
      forbidden on all three procedures; `admin` still succeeds.
- [x] 1.3 Confirm `role-coverage-gate` stays green (no per-procedure pin to
      `adminProcedure`); run the role-coverage test.
- [x] 1.4 Apply group scope for head sessions by NESTING the
      `groupScopeFilter(session, 'reportSection')` fragment (a
      `ReportSectionWhereInput`, `{}` for admin) under `reportSection` in the
      `where` of `listReopenRequests` and `pendingReopenCount`:
      `where: { ...statusFilter, reportSection: scope }`. Do not spread it at the
      top level — these are `ReopenRequest` queries.
- [x] 1.5 In `respondReopenRequest`, re-load the request with
      `{ id, reportSection: scope }` so a head cannot decide an out-of-group
      request by id; reject when the scoped load finds nothing.
- [x] 1.6 Add tests: a head sees/counts only in-group requests; a head deciding an
      out-of-group request by id is rejected; an admin sees all.

## 2. Race-safe decision

- [x] 2.1 In `respondReopenRequest`, replace the read-then-update with a
      transactional conditional update: `updateMany({ where: { id, status:
  "pending" }, data: ... })`; assert one affected row, else "Already
      processed." (no section change, no metric).
- [x] 2.2 For an **approve**, also require the section is still `submitted` in the
      same transaction (conditional `updateMany` on the section asserting one row).
      If the section already moved to `draft`, make the request terminal so it
      leaves the pending queue (v1: set `status='rejected'` with an auto note
      "Auto-closed: the section was already reopened."), flip no section, and
      increment **no** funnel metric (the three-state `requested/approved/rejected`
      contract must stay intact — an auto-close is not a decision).
- [x] 2.3 Increment `customreportReopenRequestsTotal` only when the request was
      freshly `pending` (and, for approve, the section freshly `submitted`).
- [x] 2.4 Add tests: two concurrent decisions → one decision, one section flip,
      one metric increment, one "already processed" loser; and approve of a
      request whose section was already revoked → stale, no flip, no metric.

## 3. One pending request per section

- [x] 3.1 Add the one-pending-per-section DB guard: document the intended partial
      unique index in a `prisma/schema.prisma` comment on `ReopenRequest`
      (Prisma cannot express the `WHERE status = 'pending'` predicate), hand-write
      the `CREATE UNIQUE INDEX ... WHERE status = 'pending'` SQL into the init
      migration, `migrate reset` the dev DB, and add a post-reset assertion query
      confirming the index exists.
- [x] 3.2 In `requestReopen`, reject when a pending request already exists for the
      section, mapped to a clear domain error.
- [x] 3.3 Add tests: a second pending request is rejected; a new request is
      allowed once the prior is approved/rejected.

## 4. Lead-side period-lifecycle guard (server, single source of truth)

- [x] 4.1 Extend the lead-form read path so the service has the period lifecycle:
      `periodStatus` and the `Report` `archived` flag (extend `getSectionById` /
      `getSectionForPeriod` or add a focused read in `lead-form-shared.ts` /
      `lead-form.prisma-repository.ts`).
- [x] 4.2 Implement the rule in `requestReopen`: allow `open` / `reopened`; reject
      `published` and `archived` (`archived` is the explicit `Report` flag, not a
      `periodStatus` value), mapped to a clear domain error.
- [x] 4.3 Compute `canRequestReopen` (and a reason when false) on the server and
      add it to the `leadForm.byPeriod` output + its shared schema in
      `packages/shared`. It is true only for a `submitted` section on an
      `open` / `reopened` period AND with no existing pending request for that
      section; the client must refetch it after a successful request.
- [x] 4.4 Add tests covering the guard for open, reopened, published, and archived,
      and that `canRequestReopen` matches whether `requestReopen` would succeed.

## 5. Lead-side button visibility

- [x] 5.1 In `lead-form.tsx`, drive the Request Reopen control off the
      server-computed `canRequestReopen` flag (hidden when false); do not
      reconstruct the lifecycle/policy on the client.
- [x] 5.2 Add a web test asserting the control is hidden when `canRequestReopen`
      is false and shown when true.

## 6. `reopened` periods are editable

- [x] 6.1 In `lead-form.prisma-repository.ts` `getSectionForPeriod`, refine the
      read-only rule so a `reopened` period section is editable
      (`readOnly = periodStatus !== "open" && periodStatus !== "reopened"`).
- [x] 6.2 Audit other readers of this read-only flag for the same assumption; adjust
      or note. Add a test that a `reopened` period section is editable.

## 7. Dashboard "Reopen Requests" card

- [x] 7.1 Add `apps/web/src/components/dashboard/reopen-requests-card.tsx`: list
      `admin.listReopenRequests({ status: "pending" })` with inline Approve /
      Reject + optional note, reusing `admin.respondReopenRequest`.
- [x] 7.2 On a decision, invalidate both `listReopenRequests` and
      `pendingReopenCount` query keys (mirror `reopen-tab.tsx`).
- [x] 7.3 Mount the card in `dashboard-page.tsx`. All copy English.
- [x] 7.4 Add a web test: the card renders pending requests, approve removes the
      row, and the decision triggers the invalidations.

## 8. Pending count in AlertBar

- [x] 8.1 In `alert-bar.tsx`, widen the early return so the bar renders when the
      reopen count is non-zero even with zero missing leads; render nothing when
      both are zero.
- [x] 8.2 Add the pending-reopen indicator with the count, linking to / scrolling
      the card. Decide density against the live bar (design.md Open question 2).
- [x] 8.3 Add a test: bar shows with reopen-count > 0 and zero missing leads; bar
      hidden with both zero.

## 9. Docs and gates

- [x] 9.1 `CONTEXT.md` _Reopen request_ term and ADR 0008 are in place (done with
      this change) — re-read after implementation for drift.
- [x] 9.2 Run `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`; all green.
- [ ] 9.3 Live-verify as a real (non-admin) head: dashboard card visible, approve
      reopens a section; as a lead: Request Reopen hidden on a forbidden period.
