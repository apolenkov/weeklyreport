# Tasks

## 1. Web feature clusters

- [x] Refactor the slide-grid cluster; prove model/subsection ownership and
      decrement the baseline for its one violation.
- [x] Refactor the reopen-request-card cluster; prove card/parts composition and
      decrement the baseline for its one violation.
- [x] Refactor the record-comments cluster; prove comment mutation ownership and
      decrement the baseline for its one violation.
- [x] Refactor the periods action/table cluster; prove action rendering and
      decrement the baseline for its one violation.
- [ ] Refactor the lead-form section-composition cluster; prove all affected
      editing and accordion journeys and decrement its three violations.
- [ ] Refactor the unified-activity cluster; prove bucket rendering, dialog
      editing, and mutation behavior and decrement its four violations.
- [ ] Refactor the SDLC-pipeline cluster; prove view-model, health, hidden-stage,
      and UI ownership and decrement its five violations.
- [ ] Refactor the dashboard-model cluster; prove KPI, lead priority,
      presentation, and escalation derivation and decrement its five violations.
- [ ] Refactor the admin/period/organization settings cluster; prove settings
      routes, panel composition, and public feature APIs and decrement its six
      violations.

## 2. Per-cluster verification

- [ ] For every cluster, run its targeted unit/integration tests.
- [ ] Run `pnpm typecheck`, `pnpm depcruise`, and `pnpm lint:type-cycles`.
- [ ] Update `scripts/type-cycle-baseline.json` by the exact measured decrement
      in the same commit.
- [ ] Update all affected durable specs and all four seed profiles when a slice
      changes product, wire, or persisted semantics.
- [ ] Checkpoint HTML, `roadmap.json`, and `HANDOFF.md`; commit and push before
      beginning the next cluster.

## 3. Completion

- [ ] Prove the pre-compilation graph exits 0 with zero `no-circular`
      violations and baseline `{"cycles": 0}`.
- [ ] Prove the ordinary runtime graph still exits 0.
- [ ] Run `pnpm lint`, `pnpm typecheck`, and affected product journeys.
- [ ] Run `openspec validate refactor-type-cycle-clusters --strict`.
