# Phase 35, Plan 01 — SUMMARY (partial)

**REQ-IDs:** UX-13 (counter portion only)
**Commit:** `cb2e3a9 fix(admin): 0/7 stages counter reads from live DB, not stale snapshot`
**Status:** partial — counter fixed; 3 LOW mockup deltas (DEC-2 / SDLC-3 / LF-1) deferred

## What shipped

- New tRPC procedure `admin.listStageAssignmentCounts` in `apps/api/src/infrastructure/trpc/trpc.router.ts` — head-only, single Prisma `groupBy({by: ['projectId'], _count: { _all: true }})` returning `[{projectId, count}]`.
- `apps/web/src/components/admin/products-tab.tsx` fetches the new query, builds `Map<projectId, count>`, replaces `product.stages.filter(s => s.assigneeId).length` with `stageCountByProject.get(product.id) ?? 0`.

## Verification

- TS clean both apps (api + web).
- vitest 598/598 api still green (no regression).
- Manual probe: 12 active products show real assignment counts (mostly 3/7) instead of uniform 0/7.

## Deferred (still open under UX-13)

- DEC-2 `--color-canvas` alias resolves to `#f4f1eb` — needs CSS-variable cascade verification.
- SDLC-3 locked-stage tooltip with assignee name — needs hover-state visual.
- LF-1 period nav leading "Week" + calendar icon — flagged "intentional skip" in audit; needs design decision.

These three should land in a follow-up plan (35-01.5 or fold into 35-02) with you reviewing the screenshots side-by-side with the mockup.

## Files

- `apps/api/src/infrastructure/trpc/trpc.router.ts` (1 new procedure)
- `apps/web/src/components/admin/products-tab.tsx` (useQuery + Map lookup)
