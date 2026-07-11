# Tasks: add-status-ssot-lint-gate

## 1. Scanner

- [x] 1.1 Write `scripts/find-status-literal-unions.mjs` (find-archaeology idiom: staged paths as args, `--all` sweep, exit 1 on hit; detection per the `status-type-ssot-gate` spec; hardcoded allowlist: SSOT file + `prisma/seed-constants.ts`; skip `dist/`, `node_modules/`, `.next/`, generated files)
- [x] 1.2 Unit test for the scanner (`scripts/find-status-literal-unions.test.mjs`, `node --test`): full color union fires, exact draft+published fires, z.enum forms fire, subset/composition/distinct-vocabulary pass, allowlist passes, test files covered
- [x] 1.3 Wire lint-staged entry and `lint:status-literal-unions` script into `package.json`; add the `--all` run to the root `lint` composite

## 2. Dead vocabulary removal

- [x] 2.1 Remove `status` from `ArchiveReport` and `mapArchiveSummary` in `apps/web/src/features/dashboard/model/dashboard.ts`; fix any test pinning the field
- [x] 2.2 Delete the unconsumed `ArchiveReport` interface and `MOCK_ARCHIVE` from `apps/web/src/shared/lib/dashboard-mock-data.ts`

## 3. Port-type boundary

- [x] 3.1 Pin the port-declaring file inventory (grep module service/contract files; confirm each is Prisma-clean) and extend the ESLint Zone 4 `files` list; update the zone comment to name the invariant and its exemptions
- [x] 3.2 Confirm `pnpm lint` stays green with the extended zone (behavior-neutral extension)

## 4. Gates and verification

- [x] 4.1 Run the scanner `--all` — tree must be clean after 2.x
- [x] 4.2 Full gates: `pnpm --filter @customreport/api db:generate`, `pnpm typecheck`, `pnpm lint`, `pnpm test`
- [x] 4.3 Negative probe: stage a scratch file re-declaring each union and confirm lint-staged blocks it (then drop the scratch)

## 5. Spec sync

- [x] 5.1 `openspec validate add-status-ssot-lint-gate --strict` green
- [x] 5.2 Sync deltas to main specs on archive (backlog MODIFIED + two new capabilities)
