---
phase: 27-quality-stabilisation-role-middleware-factory
plan: 05
status: blocked
date: 2026-04-29
type: execute
requirements: [QA-01]
---

# Plan 27-05 Summary — BLOCKED per D-QA-01 STOP rule

## Outcome

Plan halted at Task 1 Step 5 per CONTEXT.md D-QA-01:

> "If investigation reveals the failures are NOT a single root cause, this plan STOPS and splits into 27-05a/b/c/... — one bandage per spec is forbidden in a single PR per D-QA-01."

Live trace evidence (single-spec run + full 4-spec run with `--trace on`) falsified all three CONTEXT.md hypotheses (a)/(b)/(c). The 5 failures are 5 independent bugs across 4 layers, not a shared `waitForResponse` race.

## Per-failure root cause matrix

| # | Test | Error class | Root cause | tRPC POSTs in trace |
|---|------|-------------|------------|---|
| 1 | `admin-crud.integration.spec.ts:94` | `expect(count).toBe(2)` got `0`; page snapshot shows 404 | `/admin/products` route does not exist in app + seed has 0 products for `LEAD_POLENKOV_ID` | 0 |
| 2 | `cross-role-lifecycle.integration.spec.ts:24` | `PrismaClientKnownRequestError` on `prisma.reportSection.update()` | Seed does not contain a `reportSection` for Olga at `ACTIVE_REPORT_ID` (composite key miss) | 0 |
| 3 | `lead-journey.integration.spec.ts:92` | `expect(section?.status).toBe('submitted')` got `'draft'` | Submit UI click does not actually persist `status='submitted'` (mutation not wired or guard rejected) | 0 |
| 4 | `lead-journey.integration.spec.ts:143` | `locator.click: strict mode violation: /fill from/i resolved to 2 elements` | Selector regex matches BOTH `Fill from Previous` button AND `Choose past report to fill from` aria-label | 0 (click never executes) |
| 5 | `status-risk-sync.integration.spec.ts:23` | `TimeoutError: page.waitForResponse 15000ms` (only one matching CONTEXT.md symptom) | `getByRole('button', { name: /at.?risk/i }).first()` matches the **Product Status accordion header** whose description text reads "Blocked and at-risk stages link to the context…". Click toggles accordion (no mutation). | 0 |

## Why the planned helper does not fix this

- 4 of 5 failures never reach the `waitForResponse` line, or reach a post-`waitForResponse` DB assertion that fails on its own.
- The 1 that does time out (status-risk-sync:23) does so because the user click lands on the wrong DOM element — no mutation is dispatched. A tighter URL filter cannot match an HTTP request that does not exist.
- The bugs span: missing route (Next.js page), seed data drift, UI wiring (submit handler), selector ambiguity from a recently-added button, and selector ambiguity from a description-text leak. Five files, five layers, no shared root cause.

## tRPC client configuration confirmed

- `apps/web/src/lib/trpc.ts:99-104` uses `httpBatchLink` → batch-comma URLs (e.g. `/trpc/reports.getActive,reports.myHistory`).
- The originally-proposed `waitForTrpcMutation` regex correctly handles batch URLs.
- This proves hypothesis (c) was investigated — but moot, since 4 of 5 tests never make POSTs at all.

## Recommendation: split into 27-05a..e

Each sub-plan is small but lives in a different module:

| Sub-plan | Scope | Layer | Estimated work |
|---|---|---|---|
| 27-05a | Add `/admin/products` Next.js route + seed products for Polenkov | App route + seed | ~30 min |
| 27-05b | Add `reportSection` for Olga to seed at `ACTIVE_REPORT_ID` | Seed | ~10 min |
| 27-05c | Wire submit-button → status='submitted' mutation | UI / mutation handler | ~30 min |
| 27-05d | Tighten "Fill from" selector in lead-journey:143 | Test selector | ~10 min |
| 27-05e | Tighten "at-risk" selector in status-risk-sync:23 | Test selector | ~10 min |

Total: ~90 min if executed sequentially. **Each must be its own atomic commit.**

Before issuing 27-05a..e, the planner should re-derive the failure list from a fresh live run — CONTEXT.md's claim that all 5 fail with `TimeoutError: page.waitForResponse 15000ms` is no longer accurate (likely was once true, before subsequent UI changes — the `lead-journey:143` "Choose past report to fill from" button is clearly recent).

## What was NOT done

- No helper file written (would not fix the bugs).
- No spec edits.
- No commits except this SUMMARY (docs-only).
- No green-run evidence captured (would document a non-existent outcome).

## Files relevant to next step

- `/apps/web/e2e/integration/admin-crud.integration.spec.ts` (test 1)
- `/apps/web/e2e/integration/cross-role-lifecycle.integration.spec.ts` (test 2)
- `/apps/web/e2e/integration/lead-journey.integration.spec.ts` (tests 3 + 4)
- `/apps/web/e2e/integration/status-risk-sync.integration.spec.ts` (test 5)
- `/prisma/seed.ts` (for tests 1, 2 — seed drift)
- `/apps/web/src/app/admin/products/` (must exist for test 1; currently 404)
- `/apps/web/src/lib/trpc.ts` (httpBatchLink confirmed; not the bug)

## Phase 27 progress with this BLOCKED status

- 27-01 (QA-04) ✓ complete
- 27-02 (QA-03) ✓ complete (with 1 scope deviation: deleted obsolete co-located test)
- 27-03 (QA-02) ✓ complete (with adapted --schema flag for root-level Prisma layout)
- 27-04 (AUTH-03) ✓ complete (with sessionRoleSchema split + assertRole helper)
- 27-05 (QA-01) ⛔ BLOCKED — splits into 27-05a..e

Phase 27 is **partial complete (4/5)**. v6.0 cannot proceed to Phase 28 until 27-05a..e land — per CONTEXT.md, Phase 28's AUTH-04 service-layer filter will need a passing integration suite to verify itself.

## Resume guidance

Run `/gsd-plan-phase 27 --gaps` to generate 27-05a..e, then `/gsd-execute-phase 27 --gaps-only` to ship them. Alternatively, the user can fix the 5 issues manually with priority on items 4 and 5 (test selectors only — no app changes) as the lowest-risk first cut.
