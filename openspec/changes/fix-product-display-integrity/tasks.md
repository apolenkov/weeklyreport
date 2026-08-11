## 1. Shared Read Model

- [x] 1.1 Add an optional human-readable live-section group label to the canonical shared report-section schema and update focused schema tests.

## 2. API and Seed Integrity

- [x] 2.1 Derive seeded users and `GroupProduct` rows from one effective reporting-group resolver, then add a regression test for the Finance reassignment.
- [x] 2.2 Extend full-profile validation so a product-group edge that differs from its lead's effective group fails loudly.
- [x] 2.3 Batch-resolve live weekly-report group names, stamp every grouped section with a label, and add repository/read-model tests for present and missing metadata.

## 3. Web Presentation

- [x] 3.1 Preserve distinct `{groupId, label}` targets in the report review model and render the label in each visible and accessible acknowledgement action.
- [x] 3.2 Add component tests proving two group actions have distinct labels while acknowledgement mutation and publish placement remain unchanged.

## 4. Product Evidence and Verification

- [ ] 4.1 Reset and reseed only `customreport_e2e` through the destructive guard with explicit consent, then prove the Finance lead preview is populated.
- [ ] 4.2 Capture and review the repaired desktop preview and multi-group acknowledgement surface plus representative iPhone 14 and Pixel 7 layouts in the external product atlas.
- [ ] 4.3 Run and record the exact focused schema, seed, API, web-component, and Playwright commands; then run `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`, `pnpm format:check`, and `openspec validate fix-product-display-integrity --strict`.
