# Plan Review Log: viewer-live-status

Act 1 (grill-with-docs) complete — plan locked, CONTEXT.md + ADR 0007 updated. MAX_ROUNDS=5.

## Round 1 — Codex (VERDICT: REVISE)

12 findings. Dispositions in "### Claude's response" below.
1 latestForViewer published fallback is GLOBAL-newest, returns null instead of older-visible → REAL.
2 TOCTOU gate race (currentPeriodId vs fetch) → minor, document + post-fetch ordering.
3 Non-current reopened in History but gate-rejected → broken link → REAL edge.
4 Removing Agent review violates deferred-feature-pattern contract → add delta.
5 Status highlight not pathname-representable; History-active is a durable contract → add delta + marker.
6 sections.some proves existence not content → weaken wording.
7 search scopeAccessed scenario impossible under author-group filter → reword to truth.
8 report-toolbar-parity still asserts viewer published-only → add delta.
9 latestForViewer anyRole tested lead/admin contradicts "unchanged" → clarify wording.
10 lifecycle pill is in shared WeeklyReportPage (affects head/lead) → DESCOPE (pre-existing).
11 no-access "any report"→empty contradicts non-current→not-found → reword scenario.
12 "current period any state" misuses canonical term → introduce "Status target".

### Claude's response (Round 1)

ACTED: 1 (two-step scoped resolver, not getActiveReportId+filter); 2 (fail-closed post-fetch ordering, no mandatory txn); 3 (viewer History → periodStatus=published only, kills broken reopened link + overlap); 5 (nav highlight DESCOPED to rename-only, no History-contract amend); 6 (weakened "content-less shell" → "no viewer-visible section"); 7 (search scopeAccessed scenario reworded to no-op-by-construction); 8 (report-toolbar-parity MODIFIED delta drops "published-only"); 9 (clarified non-viewer paths unchanged; latestPublished sole consumer is viewer route); 11 (no-access scenario → current/published report returns empty); 12 ("Status target" term introduced in CONTEXT/ADR/specs).
REVERSED my own call: 4 (Agent-review KEPT — deferred-feature-pattern mandates it on /reports/[reportId]; removing breaks a durable contract; flagged for sign-off). Only Back-to-Archive removed.
DESCOPED: 10 (lifecycle pill is in shared WeeklyReportPage, affects head/lead, not user-requested → out of scope, noted pre-existing).
Re-validated --strict: valid.

## Round 2 — Codex (VERDICT: REVISE)

6 findings: 1 resolver picks older-visible editable the gate rejects; 2 post-fetch ordering not fail-closed on open→published (getActiveReportId published fallback); 3 no archived:false in current queries; 4 proposal stale (History untouched / reuses getActiveReportId / "any state"); 5 search delta dropped out-of-group exclusion scenario; 6 compiledHistory shared → unconditional filter alters head/lead.

### Claude's response (Round 2)

ACTED on all 6. #1+#2 unified into Decision 0: `currentEditableId` = global newest non-archived editable, NO published fallback; used by BOTH gate and resolver. Gate fail-closed (open→published race → reject → snapshot on re-fetch). #3 archived:false in the helper + archived-open rejection scenario + test. #4 proposal synced (History narrowed, currentEditableId, Status-target). #5 re-added out-of-group published exclusion scenario. #6 History filter made role===viewer conditional + head/lead non-regression tests. Re-validated --strict: valid.

## Round 3 — Codex (VERDICT: REVISE)

5 findings (R2 #1/#3/#5/#6 resolved): 1 ADR+proposal still "two queries/getActiveReportId"; 2 "client re-fetches" is false (query-client never retries NOT_FOUND → terminal notice); 3 "one helper both" seam underspecified (router has no repository); 4 viewer History filter must hit listWhere AND archiveCountWhere; 5 proposal 880w vs ~400 limit.

### Claude's response (Round 3)

ACTED on all 5. #1 ADR 0007 + proposal rewritten to currentEditableId + exact-id visibility check + published fallback. #2 corrected the false "re-fetches" claim everywhere; added task 4.3 one-shot re-resolution via /reports/latest on race NOT_FOUND + integration test (declined a generic retry policy — out of scope). #3 seam named: getCurrentEditableId() on repository, surfaced via WeeklyReportService; gate uses repository, resolver uses service. #4 filter on BOTH listWhere AND archiveCountWhere + viewer archive-count test. #5 proposal trimmed 880→395w, rationale lives in design.md. Re-validated --strict: valid.

## Round 4 — Codex (VERDICT: REVISE)

2 findings (R3 #1/#3/#4/#5 resolved): 1 one-shot recovery lacks origin/attempt marker (can't tell Status from History/direct, can't track retried); 2 getCurrentEditableId lacks direct repo coverage + task 1.2 deletes the existing SQL integration test instead of adapting.

### Claude's response (Round 4)

ACTED on both. #1 specified the bounded marker ?source=status&recovery=0|1 (design + task 4.3 + a Given/When/Then recovery scenario): recover only when source=status & recovery=0, set recovery=1 to bar a loop, no-marker NOT_FOUND is terminal. #2 added task 0.2 (direct repo integration test for getCurrentEditableId: archived-open excluded, future excluded, no published fallback, mutation-proven); task 1.2 now ADAPTS reports-latest-published.integration.test.ts → reports-latest-for-viewer.integration.test.ts (keeps SQL section-scope coverage) instead of deleting. Re-validated --strict: valid.

## Round 5 — Codex (VERDICT: REVISE) — MAX_ROUNDS cap reached

1 finding (R4 #2 resolved): recovery state not propagated — /reports/latest always emits recovery=0 and the failing report redirects to plain /reports/latest, so recovery=1 is never produced → potential loop.

### Claude's response (Round 5) — arbiter fix, no 6th Codex round (cap=5)

VALID and mechanical (not a contested judgment) → fixed in-place: /reports/latest now PROPAGATES an incoming recovery flag onto the resolved URL; the failing report redirects to `/reports/latest?recovery=1` (flag carried UP), which resolves to `…&recovery=1`; a NOT_FOUND with recovery=1 is terminal. Task 4.3 now tests BOTH redirect hops. Spec scenario names the two hops. Re-validated --strict: valid.

## Resolution: CONVERGED (5 Codex rounds: 12→6→5→2→1 findings)

The cap was reached with one narrow, non-judgment wiring bug, which the arbiter fixed directly (the loop-guard now actually works). No genuine disagreement remains; all findings were accepted or consciously descoped with logged reasons (Agent-review kept per deferred-feature-pattern; pill out of scope; generic retry out of scope). Plan is ready for human sign-off.
