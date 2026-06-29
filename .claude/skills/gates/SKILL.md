---
name: gates
description: Run the canonical local quality gate for CustomReport — regenerate the Prisma client, then typecheck, lint, and unit-test. Use before committing or pushing, when asked to "run the gates", "check it's green", or to verify a change is safe to commit.
---

# Run the local quality gates

Run the project's gate sequence from the repo root, in order, stopping at the
first failure and reporting which gate failed with its output.

```bash
pnpm --filter @customreport/api db:generate   # pnpm ops wipe the .prisma client; regenerate first
pnpm typecheck                                # turbo run typecheck
pnpm lint                                     # eslint . && stylelint && lint:prisma:typecheck
pnpm test                                     # turbo run vitest (unit only)
```

Notes:

- Run `db:generate` first: a stale/missing Prisma client surfaces as bogus TS2339
  errors on known models during `typecheck`.
- `pnpm lint` is the FULL stack (ESLint + stylelint + Prisma typecheck), not just `eslint`.
- This is unit-level only. It does NOT run E2E (`pnpm test:e2e:integration`) or
  `pnpm build` — add `pnpm build` if the user asks for the full pre-release gate.
- Do NOT wrap `vitest` in `rtk` (it mis-parses TSX → 0 tests). The `pnpm` scripts are fine.
- Fix failures, don't suppress them. Re-run the failing gate until green before reporting done.
