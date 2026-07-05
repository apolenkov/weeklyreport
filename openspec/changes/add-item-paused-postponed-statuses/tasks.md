# Tasks: add-item-paused-postponed-statuses

## 1. Schema + shared

- [ ] 1.1 `prisma/schema.prisma`: extend `ItemWorkflowStatus` with `paused`, `postponed`; `migrate reset` (dev/test); regenerate client.
- [ ] 1.2 `packages/shared` item schemas/enums + contract tests; verify via `pnpm --filter @customreport/shared test`.
- [ ] 1.3 Seeds: one paused + one postponed exemplar in seed-demo small; seed-simple untouched unless its band derivations need arms.

## 2. API

- [ ] 2.1 Sweep `workflowStatus` switches in api (rollups, readiness, analytics) — explicit arms for both states, not-done + non-escalating; unit tests per derivation.

## 3. Web

- [ ] 3.1 Lead form status control offers the new states (same gating as blocked today); mapper tests.
- [ ] 3.2 Card renderers + weekly-report mappers: explicit mapping per render site; tests.
- [ ] 3.3 Slide grid: `buildOwnItemRow` + `ItemRow` render pause/forward glyphs + sr-only labels; deck tests extend the no-status-words case.
- [ ] 3.4 PDF export template arms; grayscale-safe glyphs.

## 4. Verification

- [ ] 4.1 Full unit suites (web + api + shared), `pnpm typecheck`, repo lint, `pnpm test:integration`.
- [ ] 4.2 Live-verify on :3000 after reseed: both states visible on form, card, slide, published view; dashboard shows no escalation from them.
