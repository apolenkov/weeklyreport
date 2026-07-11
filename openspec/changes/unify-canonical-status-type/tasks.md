# Tasks: unify-canonical-status-type

## 1. Consolidation

- [x] 1.1 `traffic-light.ts`: replace the `StageStatus` literal union with a type-only alias of `CanonicalStatus` (import from `lib/status-presentation`)
- [x] 1.2 `mock-data.ts`: replace the duplicate declaration with `export type { StageStatus } from "./traffic-light"`
- [x] 1.3a `activity-status-strip.tsx`: alias `ActivityTone` to `CanonicalStatus` (fourth declaration, surfaced by the new gate rule; TONE Records stay — parity-gated debt)
- [x] 1.3 `lib/stage-status.ts`: type against `CanonicalStatus` from `./status-presentation`, removing the lib→feature import

## 2. Gate extension (after the parallel scanner edits land)

- [x] 2.1 Add the contains-all-four rule for `blocked`/`at-risk`/`on-track`/`empty` to `scripts/find-status-literal-unions.mjs`; allowlist `apps/web/src/lib/status-presentation.ts`
- [x] 2.2 Extend the scanner test: four-value union and z.enum fire; `at-risk`/`blocked` subset and alias compositions pass; the allowlisted SSOT passes

## 3. Gates and verification

- [x] 3.1 Scanner suite + `--all` sweep clean; scoped eslint `--max-warnings 0` on touched files
- [x] 3.2 Full gates: `pnpm --filter @customreport/api db:generate`, `pnpm typecheck`, `pnpm lint`, `pnpm test`
- [x] 3.3 Adversarial verification of the diff (workflow verifier), findings folded in

## 4. Spec sync

- [x] 4.1 `openspec validate unify-canonical-status-type --strict` green
- [ ] 4.2 Archive with spec sync (status-presentation-model ADDED, status-type-ssot-gate MODIFIED, backlog MODIFIED)
