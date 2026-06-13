# Tasks — Wire Prisma Typecheck Gate (verify + tidy)

Decisions D1-D3: `design.md`. Evidence anchors: `proposal.md`.
NOT STARTED — captured 2026-06-10. This is verify-and-tidy: the gate
already exists and passes; the work is removing one stale marker and
recording the coverage as a durable spec. Implement on go-ahead.

## 1. Confirm the gate is already live (no code change)

- [x] 1.1 Confirm `tsconfig.prisma.json:13` sets `"include":
["prisma/**/*.ts"]` and `tsc --project tsconfig.prisma.json
--listFiles --noEmit` loads all 7 `prisma/*.ts` scripts.
- [x] 1.2 Confirm `package.json:24` defines `lint:prisma:typecheck` and
      `package.json:21` chains it inside `pnpm lint`.
- [x] 1.3 Confirm `.github/workflows/ci.yml:50` runs `pnpm lint` (the
      Prisma pass rides the aggregate; no separate CI step needed).
- [x] 1.4 Re-run the dropped-model probe: temporarily inject
      `tx.nonExistentModel.deleteMany({})` into `wipe-manual-uat.ts`,
      confirm `pnpm lint:prisma:typecheck` fails with `error TS2339`,
      then restore the file and confirm a clean `git diff`.

## 2. Remove the stale marker (prisma)

- [x] 2.1 Delete the stale `TODO(PRISMA-TYPECHECK-01)` comment at
      `prisma/wipe-manual-uat.ts:180-181` (the only occurrence in the
      repo); change nothing else in the file — no `deleteMany` call,
      ordering, or guard edits.
- [x] 2.2 Confirm no `PRISMA-TYPECHECK` reference remains anywhere:
      `grep -rn "PRISMA-TYPECHECK" --include="*.ts" .` returns nothing.

## 3. Record the durable invariant (planning + docs)

- [x] 3.1 At archive time, sync the
      `specs/lint-toolchain-ownership/spec.md` delta into
      `openspec/specs/lint-toolchain-ownership/spec.md` (two ADDED
      requirements: the chained Prisma pass and the dropped-model
      failure).
- [x] 3.2 `openspec validate wire-prisma-typecheck-gate --strict` passes.

## 4. Gates + verification + acceptance

- [x] 4.1 Run the full quality gates: `pnpm typecheck && pnpm lint &&
pnpm test && pnpm build` — all green.
- [x] 4.2 Run `pnpm lint:prisma:typecheck` directly — exits 0 with the
      marker removed.
- [x] 4.3 `npx prettier --check` over the change dir and the edited
      `prisma/wipe-manual-uat.ts` passes.
- [x] 4.4 User acceptance: confirm the change is "verify + remove stale
      marker" only, with no new tsconfig / lint script / CI step, before
      archiving.
