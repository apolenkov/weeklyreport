## 1. Dissolve components/lead/ across six homes (behavior-neutral, atomic)

- [x] 1.1 `git mv` all 54 source files (+ co-located tests + `__snapshots__`) from
      `components/lead/` into `features/report-sections/{ui,model}`, `features/period/{ui,model}`,
      `features/review/ui`, `features/pdf-export/ui`, `features/admin/ui`, and
      `shared/ui/` per the mapping. Match extra test files (`<stem>-add-signal.test.tsx`,
      `<stem>.snapshot.test.tsx`, `lead-form-visibility.test.tsx`, …) to their subject
      by longest-prefix stem. Remove the emptied `components/lead/`.
- [x] 1.2 Assign the 4 post-catalog files: `board-column-header`, `board-empty-state`,
      `activity-lanes-block` → `report-sections/ui`; `pause-reason-dialog` → `period/ui`.
- [x] 1.3 Rewrite every relative import in one deterministic pass (path.relative from
      each file's real location): intra-cluster siblings, the kernel files' tree-wide
      external consumers (`hooks/`, `lib/`, `head/`, `viewer/`, `weekly-report/`,
      `app/(app)/lead`, `app/(app)/reports`), and the 2 `slides/` edges.
- [x] 1.4 Repoint the 10 path-pinned `eslint.config.ts` exemptions (complexity /
      max-lines / cognitive) from `components/lead/*` to the files' new homes.
      Leave `webSlices` / zone-5 unchanged (admin-dissolve precedent — enforcement
      flip is a later boundaries slice).

## 2. Verify (behavior-neutral)

- [x] 2.1 Cold `cd apps/web && pnpm exec tsc --noEmit -p tsconfig.json` — 0 errors
      (regen prisma first to avoid false TS2339). Proves every rewritten relative
      import resolves.
- [x] 2.2 `pnpm exec eslint --fix` (import-sort) then `--max-warnings 0` over the
      moved slices + consumers + `eslint.config.ts` — clean (repointed exemptions
      cover the monolith files; no new exemption added).
- [x] 2.3 Full web unit suite (`pnpm exec vitest run`) — 1567 passing.
- [x] 2.4 Live-verify from source (`:3100`, dev-login cookie): `/lead/report/[id]`
      (LeadForm orchestrator), `/reports` (search + history), `/head/report/[id]`
      (consumes moved period-navigator/mock-data) — all HTTP 200, no
      module-resolution 500. No `.js`-extension shared-src import in any shipped file.
- [x] 2.5 `openspec validate restructure-web-lead-slice --strict` green.
