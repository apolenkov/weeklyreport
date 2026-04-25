---
plan: 20-01
phase: 20-seed-type-foundation
status: complete
completed: 2026-04-25
runtime_verified: true
---

# Plan 20-01: Database Seed + DEV_SESSION Fix — SUMMARY

## What was built

Mockup-aligned database seed with idempotent upserts and dynamic DEV_SESSION resolution.

### Deliverables

- `prisma/seed-constants.ts` (NEW, 175 lines) — Single source of truth for canonical UUIDs and names. 12 products (CRM Platform, Data Analytics Suite, etc.), 6 leads (Platanov A., Ivanova E., Petrov D., Slivova M., Kozlov V., Novikova A.), 7 SDLC stages, 2 report periods.
- `prisma/seed.ts` (REWRITTEN, 521 lines) — Idempotent upserts for users, products, stages, stage assignments, 2 reports, 12 sections, ~24 items, ~20 traffic lights, 4 risks, 3 decisions, ~16 priorities. Uses `prisma.upsert()` everywhere.
- `apps/api/src/infrastructure/trpc/trpc.context.ts` — Added `resolveSectionId` helper for dynamic `activeReportSectionId` lookup. PrismaService resolved once at factory init.

### Key invariants (verified statically)

- `ACTIVE_REPORT_ID` (`a0000000-0000-4000-8000-000000000001`) matches `DEV_SESSION.activeReportId`
- `HEAD_USER_ID` (`a0000000-0000-4000-8000-000000000099`) matches `DEV_SESSION.userId`
- Lead UUIDs (`...0011` through `...0016`) do not collide with report UUIDs

## Commits

- `3e25dc9` feat(20-01): rewrite seed with mockup-aligned data
- `c04cf6d` feat(20-01): dynamically resolve activeReportSectionId in DEV session
- `3f1944b` fix(20-01): correct UUID format in seed.ts ID helpers

## Verification status

**Static (passed):**
- TypeScript typecheck clean (`tsc --noEmit -p apps/api/tsconfig.json`)
- All UUIDs match standard regex
- Cross-file invariants verified (constants ↔ trpc.context)

**Runtime (PASSED, 2026-04-25):**
- 1st seed: `Seeded: 8 users, 12 products, 7 stages, 36 assignments, 2 reports, 12 sections, 35 items, 22 project statuses, 4 risks, 3 decisions, 20 priorities`
- 2nd seed (idempotency): identical output, no errors
- DEV_SESSION user `a0000000-0000-4000-8000-000000000099` exists with role=head
- DEV_SESSION report `a0000000-0000-4000-8000-000000000001` exists with weekLabel=Week 16

## Bug fixed during runtime verification

`feb1edd` fix(20-01): remove `id` from upsert update branches — Prisma 7 cannot update primary key, caused P2002 UniqueConstraintViolation on Stage and StageAssignment upserts.

## Requirements completed

SEED-01, SEED-02, SEED-03, SEED-04, SEED-05 — code-complete, runtime-pending.
