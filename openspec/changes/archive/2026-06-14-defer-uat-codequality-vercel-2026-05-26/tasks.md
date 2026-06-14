# Tasks — defer-uat-codequality-vercel-2026-05-26

Umbrella tracker. Decomposed + narrowed 2026-06-14 (artifacts only, no code).
See the proposal's "Decomposition + narrow — 2026-06-14" section for evidence.
Boxes below mark dispositions, not fresh implementation work — every genuine
item is covered or archived elsewhere.

- [x] Wave 1: UAT sweep of the 4 roles — COVERED by the ai-ui-driver runs
      (`archive/2026-06-14-driver-findings-2026-06-11`) + the automated
      `pnpm test:uat` catalog sweep.
- [x] Wave 2: fix found bugs — COVERED by `driver-findings-2026-06-11`
      (implemented + archived).
- [x] Wave 3 (Biome foundation): OBSOLETE — Biome was removed; the repo kept
      ESLint + Prettier + stylelint (`migrate-lint-to-eslint-prettier`).
      `migrate-to-biome` / `enable-biome-recommended-ruleset` are archived.
- [x] Wave 3 (code-quality + deps): DONE — archived
      `code-quality-modernization`, `dependency-upgrades-minor`, and the
      `upgrade-*-major` cluster; verified in the live tree 2026-06-14.
- [x] Wave 4: Vercel / UI-UX audit — DONE (research-only) — archived
      `ui-ux-vercel-audit-research` (durable spec `frontend-audit-memo`).
- [x] Wave 5: final gates + re-sweep — DONE — archived `final-gates-resweep`
      (static gate chain green + automated catalog sweep). Note: the old
      `pnpm lint:md` gate no longer exists (markdownlint removed).
