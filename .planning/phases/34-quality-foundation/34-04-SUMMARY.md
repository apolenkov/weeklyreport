# Phase 34, Plan 04 — SUMMARY

**REQ-IDs:** Q-04
**Commit:** `d12c0a7 ci(34-04): Prisma migrate-reset CI gate`
**Status:** complete

## What shipped

New CI job `migrate-reset` in `.github/workflows/ci.yml`:

- Runs after `quality` (parallel with `e2e` + `docker-build`)
- Postgres 15-alpine service container, ephemeral DB `customreport_reset_check`
- Steps: corepack/pnpm/node setup → `pnpm install` → `prisma migrate reset --force --skip-seed` → `prisma generate`
- Exit 0 required

## Why `--skip-seed`

Prisma 7's `prisma.config.ts` does NOT auto-invoke seed despite docs implying it does (see Prisma 7 schema audit notes in CLAUDE.md). Making `--skip-seed` explicit prevents accidental seed-side-effect coupling and matches the deploy-time `migrate deploy` behaviour.

## What this catches

- A migration whose SQL parses but errors out against an empty schema (e.g. references a column that an earlier migration was supposed to add but didn't).
- Drift between `schema.prisma` and the migration tail when someone hand-edits a migration after generating it.
- Foreign key + cascade rule mistakes that only surface during full rebuild.

## Files

- `.github/workflows/ci.yml` (one new job)
