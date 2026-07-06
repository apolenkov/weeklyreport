## 1. Relocate the report-shell primitives (behavior-neutral)

- [x] 1.1 `git mv` the whole `apps/web/src/components/report-shell/` folder to
      `apps/web/src/shared/ui/report-shell/` — all 13 source files (the 11 mapped
      primitives plus `rotating-chevron.tsx` and `use-report-shell-url-state.ts`),
      every co-located `*.test.tsx`/`*.test.ts` (the seven per-component tests, the
      multi-component `report-shell.test.tsx`, and the two `@vitest-environment
node` guard tests `card-surface-guard.test.ts` + `toolbar-control-token.test.ts`),
      and the `__snapshots__/` directory. Preserve rename detection; filenames
      unchanged. **Run `git reset` immediately after each `git mv`** so nothing of
      this change sits in the shared index (parallel-session commits sweep the whole
      index) — the moved files stay on disk. Remove the emptied
      `components/report-shell/` directory so the legacy folder does not survive.
- [x] 1.2 Fix the two source files with upward relative imports by **recomputing
      from the new location** `src/shared/ui/report-shell/` (do NOT just add one
      `../`): - `lock-badge.tsx`: `../ui/sdlc-tooltip` →
      `../../../components/ui/sdlc-tooltip` (the target is `src/components/ui/`;
      the path must route back through `components/`, it is NOT
      `shared/ui/sdlc-tooltip`). - `save-now-button.tsx`: `../../hooks/use-lead-form-autosave` →
      `../../../hooks/use-lead-form-autosave` (target is top-level `src/hooks/`).
      Re-sort the import groups (`simple-import-sort`). All intra-folder
      `./`-relative imports (e.g. `scope-toggle` → `./segmented-toggle`, tests →
      `./accordion-section`) stay unchanged. The two guard tests resolve their scan
      roots from `process.cwd()` and need no edit.
- [x] 1.3 Reroute every repo-wide consumer of the moved paths to
      `shared/ui/report-shell/*`, recomputed per consumer location (no barrel —
      none is prescribed for `shared/`). Known consumer trees: `app/(app)/lead/.../preview`,
      `app/print/[reportId]`, `components/head/head-report-shell`,
      `components/lead/*` (decision-card, item-card-actions, lead-form + snapshot
      tests, risk-card), `components/viewer/viewer-report-shell`,
      `components/weekly-report/*` (export-pdf-button, product-accordion,
      review/review-mode-toggle, review/submission-filter, weekly-report-page +
      test), `components/slides/deck-fullscreen-overlay`,
      `components/coming-soon-style.test`, and
      `features/dashboard/ui/blocked-at-risk-table` (currently
      `../../../components/report-shell/rotating-chevron` →
      `../../../shared/ui/report-shell/rotating-chevron`). Re-sort each touched
      import group. Grep `report-shell` repo-wide to confirm no consumer still
      references the legacy `components/report-shell/` path.
- [x] 1.4 Confirm no `eslint.config.ts` update is needed: grep the config for
      `report-shell` / `rotating-chevron` / `use-report-shell-url-state` and any of
      the moved filenames — it returns **zero** matches (no report-shell file is
      path-pinned for size/complexity, unlike navigation/dashboard). Do NOT touch
      `eslint.config.ts`; in particular the `webSlices` array is NOT changed
      (`shared/` is not a feature slice, no cross-slice zone governs it).

## 2. Verify (behavior-neutral)

- [x] 2.1 Focused `pnpm exec eslint --max-warnings 0` over every moved file plus
      every rerouted consumer green — proves the deeper `shared/ui/report-shell/`
      path introduces no new complexity/size/import-order violation and needs no
      exemption. Run `pnpm typecheck` (the reroute touches type-only imports —
      `AutosaveSnapshot`, `ScopeValue` — that vitest/esbuild strip without
      resolving; only tsc proves the recomputed paths resolve).
- [x] 2.2 Run the moved report-shell test files plus every rerouted consumer's
      tests (lead-form + decisions/risks snapshot suites, weekly-report-page,
      print page, coming-soon-style, dashboard blocked-at-risk-table) via
      `cd apps/web && pnpm exec vitest run <paths>` (never wrap vitest in rtk — it
      mis-parses TSX). Then run the full web unit suite green (a folder-scoped run
      can mask a failing sibling).
- [x] 2.3 Live-verify web from source (the shared-src `.js`-extension /
      module-resolution class of gotcha passes tsc+vitest but 500s the page): boot
      `pnpm --filter @customreport/web dev`, dev-login, and confirm a report surface
      that mounts these primitives (e.g. `/reports` and a lead report edit view)
      renders the toolbar, toggles, and accordion sections.
- [x] 2.4 `openspec validate restructure-web-shared-report-shell --strict` green.
