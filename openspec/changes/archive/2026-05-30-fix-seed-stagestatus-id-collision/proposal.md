# Fix advanced seed StageStatus primary-key collision

## Why

`pnpm db:fresh:advanced` (`prisma/seed.ts`) fails with Prisma `P2002` unique
constraint violation on `StageStatus.id`:

```
Unique constraint failed on the fields: (`id`)  at prisma/seed.ts (stageStatus.upsert)
```

Root cause: the `StageStatus` `create.id` is built by unpadded string
concatenation —
`` `a0000000-0000-4000-8000-0000000f0${cfg.leadIndex}${pIdx + 1}${offset + 1}` ``.
When a lead owns ≥10 products, `pIdx + 1` becomes two digits and the
concatenation is no longer an injective mapping from `(leadIndex, prodSeq,
stageSeq)` to id — distinct tuples produce the same 12-char UUID tail, so a
later `create` reuses an already-issued primary key. (The sibling helpers
`riskId`/`decisionId` already zero-pad for exactly this reason; the inline
StageStatus id was the one that did not.)

Found during the Wave-1 UAT setup: `db:fresh:simple` works, but
`db:fresh:advanced` is unusable. This blocks the richer advanced dataset.

Running it surfaced a chain of three issues that together made
`pnpm db:fresh:advanced` unusable (the StageStatus failure masked the rest):

## What Changes

1. **StageStatus id collision.** Replace the inline StageStatus id with a
   `stageStatusId(leadIndex, prodSeq, stageSeq)` helper that zero-pads each field
   to a fixed width so the mapping is injective and the value stays a valid
   12-hex-char UUID tail. Keep the `f0` namespace marker (distinct from
   `040`/`05`/`06`/`0009`/`00a`).
2. **ReminderRule upsert duplicate.** `db:reset:hard` seeds a `seed-simple`
   baseline first; the advanced seed then upserted `ReminderRule` by surrogate
   `id`, so it tried to CREATE a second row for a `(reportId, policyId)` the
   baseline already owned → `P2002` on `uq_rule_report_policy`. Upsert by the
   natural key `reportId_policyId` instead (idempotent over the baseline, like
   the other natural-key upserts).
3. **`tsx` not resolvable from root.** `db:fresh:simple` / `db:fresh:advanced`
   invoke bare `tsx prisma/...`, but `tsx` is declared only in `apps/api`, so
   after the Wave-3 dependency upgrades changed hoisting it no longer resolves at
   the repo root (`sh: tsx: command not found`). Declare `tsx` in root
   `devDependencies` so the scripts resolve it while keeping `cwd` at the repo
   root (required by `seed.ts`'s `import "dotenv/config"`, which loads `.env`
   from `cwd`).

## Impact

- `prisma/seed.ts` (two seed-time id/upsert fixes; no schema/migration change,
  no runtime code) and root `package.json` + lockfile (`tsx` devDependency).
- Verified end-to-end: `pnpm db:fresh:advanced` runs to a clean completion
  (`tsx v4.22.3` → `Seeded: … 30 stage statuses … 2 reminder rules …`, exit 0).
