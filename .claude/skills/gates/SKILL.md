---
name: gates
description: Run the canonical local quality gate for CustomReport — regenerate the Prisma client, then typecheck, lint, and unit-test. Use before committing or pushing, when asked to "run the gates", "check it's green", or to verify a change is safe to commit.
---

# Run the local quality gates

This is the same sequence CI and the husky hooks enforce, run locally so problems
surface before a commit or push rather than after. Run it from the repo root, in
this exact order, and stop at the first failing gate — a later gate's output is
noise once an earlier one is red.

```bash
pnpm --filter @customreport/api db:generate   # regenerate the Prisma client first (see below)
pnpm typecheck                                # turbo run typecheck (depends on db:generate)
pnpm lint                                     # eslint . && stylelint && lint:prisma:typecheck
pnpm test                                     # turbo run vitest (unit only)
```

Why each detail matters:

- **`db:generate` goes first.** Earlier `pnpm` operations in a session can wipe the
  generated `.prisma` client; a stale or missing client makes `typecheck` report
  phantom TS2339 errors on real Prisma models. Regenerating first removes that
  whole class of false failure, so you debug real type errors, not tooling drift.
- **`pnpm lint` is the full stack** (ESLint + stylelint + Prisma typecheck), not
  just `eslint`. Running `eslint` alone passes a tree that `pnpm lint` would reject.
- **Unit scope only.** This deliberately excludes E2E (`pnpm test:e2e:integration`)
  and `pnpm build` — they are slow and need infra. Append `pnpm build` only when the
  user asks for the full pre-release gate.
- **rtk caveat.** Prefixing the `pnpm` scripts with `rtk` for token savings is fine;
  never call `rtk vitest` directly — rtk mis-parses TSX and reports 0 tests, which
  reads as a false green.
- **Fix, don't suppress.** Re-run a failing gate until it is genuinely green before
  reporting done; never silence a warning to pass.

When everything passes, report a one-line green summary (e.g. "all 4 gates green")
rather than pasting full output — the value is the verdict, not the logs.
