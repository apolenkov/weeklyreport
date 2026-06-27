# Plan Review Log: reopen-request-lifecycle

Act 1 (grill-with-docs) complete — plan locked, CONTEXT.md + ADR 0008 updated. MAX_ROUNDS=5.

## Round 1 — Codex

VERDICT: REVISE

1. `published` section-reopen is internally contradictory: spec allows published-in-window but D4 does not reopen the period, so approval yields a non-editable draft; also conflicts with CONTEXT.md (section reopen meaningful only for open/reopened). Fix: forbid section reopen on published (route via period-level reopen) OR atomically reopen the period on approval.
2. Race fix guards only request status, not section state: a pending request can be approved/counted after the section was separately revoked to draft. Fix: in the same transaction require section still `submitted` for approval, else stale (no flip, no metric).
3. Lead button task assumes lifecycle/policy fields exist in `leadForm.byPeriod` ({section, readOnly}); ReportSectionReadModel has none of them. Fix: server computes `canRequestReopen` (+reason) into `leadForm.byPeriod`; client reads the boolean.
4. Partial unique-index task says "in schema.prisma" but Prisma can't express the WHERE predicate (design already says so). Fix: schema comment + raw init-migration SQL + post-reset DB assertion.

### Claude's response

1. ACCEPT — adopt option A: forbid section reopen on `published`/`archived`; allow only `open`/`reopened`. Published routes through the existing period-level reopen (where `allowReopenAfterPublish` already lives). Matches the user's real need ("no request on a closed period") and removes the contradiction. Overrides the earlier "published by policy" sub-choice for a documented technical reason.
2. ACCEPT — approval transaction also requires section `status = 'submitted'`; else report stale, no flip, no metric.
3. ACCEPT — add server-computed `canRequestReopen` (+ reason) to `leadForm.byPeriod`; button reads it; no client-side policy reconstruction.
4. ACCEPT — reword task 3.1: schema comment documenting the index + raw SQL in the init migration + a post-`migrate reset` assertion query.

## Round 2 — Codex

VERDICT: REVISE (4 prior fixes confirmed present; 3 new findings)

1. `canRequestReopen` omits duplicate-pending state: button must hide exactly when server rejects, and server rejects an existing pending request, but the flag was defined only from submitted + open/reopened. Fix: include "no pending request exists" in the flag.
2. Stale approval leaves the request stuck `pending` (lists/counts read status='pending'), so it never leaves the queue. Fix: define a terminal stale outcome that drops it from the pending queue without skewing the approve/reject funnel.
3. Non-admin heads would get a GLOBAL reopen queue: every other head dashboard read is group-scoped (`groupScopeFilter`), but `listReopenRequests`/`pendingReopenCount`/`respondReopenRequest` filter only by status. Fix: apply report-section group scope for head sessions (admin stays global), including an ownership check on respond.

### Claude's response

1. ACCEPT — `canRequestReopen` is true only for a `submitted` section on an `open`/`reopened` period AND with no existing pending request; refresh after a successful request.
2. ACCEPT — spec made outcome-based: a stale approval makes the request terminal (leaves the pending queue) and does NOT increment the approve/reject funnel. v1 implements this as auto-reject with a system note + a `state:'stale'` metric label; an explicit `stale` status is the deferred, more-honest alternative.
3. ACCEPT — add a group-scope requirement: head sessions see/count/decide only reopen requests whose section is in their reporting group; admin stays global. Respond re-checks group ownership for head.

## Round 3 — Codex

VERDICT: REVISE (round-2 fixes confirmed; 2 blockers)

1. Stale-approval metric inconsistency: design/tasks said increment `state:'stale'`, but the metric is a three-state contract `requested/approved/rejected` (metrics.registry.ts + Grafana), and it contradicts task 2.4 "no metric". Fix: stale increments nothing on the funnel.
2. Group-scope task imprecise: `groupScopeFilter(session,'reportSection')` returns `{ author: { reportingGroupId } }` (a ReportSection fragment), but reopen queries are ReopenRequest queries — it must be NESTED under `reportSection`, not spread at top level.

### Claude's response

1. ACCEPT — stale approval sets status `rejected` with an auto note and increments NO funnel metric (keeps the three-state contract intact); removed the `state:'stale'` label from design + tasks.
2. ACCEPT — design D8 and tasks 1.4/1.5 reworded to nest: `where: { ...status, reportSection: groupScopeFilter(session,'reportSection') }`.

## Round 4 — Codex

VERDICT: APPROVED
Round-3 blockers confirmed resolved (stale = no funnel metric; group-scope nested under reportSection with scoped respond). No remaining material flaws. Converged in 4 rounds (MAX_ROUNDS=5).
