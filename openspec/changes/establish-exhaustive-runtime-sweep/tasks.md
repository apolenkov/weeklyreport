## 1. Shared contracts and campaign identity

- [x] 1.1 Add the `Exhaustive Runtime Sweep` glossary entry and ADR for one
      SHA-bound evidence ledger with immutable baseline/final segments.
- [x] 1.2 Add strict Zod schemas and readonly TypeScript types for campaign
      manifests, coverage cells, DOM controls, evidence refs, candidates, and
      dispositions under `e2e/runtime-sweep/`.
- [x] 1.3 Implement deterministic ids/digests and a finite pairwise matrix
      compiler for role, route, profile capability, lifecycle, submission,
      ownership-density, permission, fault, and control-transition axes.
- [x] 1.4 Implement append-only JSONL writers plus validators that reject
      duplicate cells, mixed SHAs, missing evidence, unreasoned omissions, and
      incomplete final verdicts.
- [x] 1.5 Add focused unit tests for schema rejection, reproducible matrix
      ordering, pair coverage, digest drift, and zero-gap stop-gate arithmetic.

## 2. API, database, and deterministic state preparation

- [x] 2.1 Parameterize the existing E2E reset/seed setup by the four canonical
      profiles while preserving the distinct-database check and destructive guard.
- [x] 2.2 Add state preparation and database-oracle helpers for lifecycle,
      submission, ownership-density, permission, and period dual-state assertions.
- [x] 2.3 Add deterministic Playwright HTTP/network fault declarations and
      recovery cleanup for auth, timeout, 4xx/5xx, and aborted-request cells without
      adding production-only hooks.
- [x] 2.4 Add two-context concurrency cells and reuse existing infrastructure
      failure seams for Redis/mail/PDF only where cleanup and non-mutation can be
      proven.
- [ ] 2.5 Add tests proving reseed determinism, scoped fault teardown,
      concurrency isolation, and unchanged persisted state after rejected actions.

## 3. Web DOM, accessibility, and visual execution

- [x] 3.1 Implement semantic live-DOM inventory for visible interactive
      controls and newly revealed controls, with stable role/name/order identities.
- [ ] 3.2 Implement bounded control actions, including publish, delete, revoke,
      and restore on the disposable E2E database, with reset/reseed after stateful
      or ambiguous outcomes.
- [x] 3.3 Collect per-cell functional, keyboard/focus/axe, console/page/network,
      screenshot, geometry, and overflow evidence at Chromium `1440x900`.
- [x] 3.4 Add the dedicated runtime-sweep Playwright config/spec and root
      commands without weakening the existing integration and `test:uat` suites.
- [x] 3.5 Add planted harness tests proving dynamic-control discovery, missing
      accessible names, visual changes, console/network errors, and unreasoned
      omissions fail the owning cell.

## 4. OpenCode Luna Driver and feedback loop

- [x] 4.1 Pin and connect Microsoft Playwright MCP `0.0.78` to the installed
      OpenCode `1.18.11` as isolated headless Chromium at `1440x900`; verify the MCP
      reports connected.
- [x] 4.2 Replace stale Driver paths and the read-mostly prompt with a bounded
      cell protocol that permits declared disposable-DB mutations and returns only
      schema-valid candidates, timelines, canary, and evidence refs.
- [x] 4.3 Implement the primary-orchestrator command that freezes one SHA,
      resets profiles, schedules one Luna Max role/profile drive at a time, captures
      OpenCode session ids, and refuses browser/database parallelism.
- [ ] 4.4 Implement environment-feedback correlation and independent read-only
      candidate verification; only verified candidates may enter adjudication.
- [ ] 4.5 Add preflight and planted tests for missing MCP tools, blind canary,
      malformed model output, interrupted sessions, stale SHA, and partial report
      recovery.

## 5. Documentation and operator surface

- [x] 5.1 Replace the stale `e2e/README.md` layout and commands with the current
      integration, catalog-sweep, runtime-sweep, seed-profile, and OpenCode Driver
      workflows and destructive-data warning.
- [x] 5.2 Document the declared Chromium desktop scope, explicit engine/viewport
      exclusions, matrix/profile mapping, controlled faults, archive layout, and
      exact resume procedure without claiming unbounded coverage.
- [x] 5.3 Add archive bootstrap/report builders under the campaign archive,
      update its `INDEX.md` entry, and keep all session artifacts outside `docs/`.

## 6. Immutable baseline and adjudication

- [ ] 6.1 Freeze a clean-source manifest containing full SHA/tree, catalog/spec/
      profile/matrix digests, tool versions, exclusions, and environment liveness.
- [ ] 6.2 Run the complete deterministic Playwright matrix sequentially across
      all declared roles, routes, states, controls, transitions, and controlled
      faults, preserving every cell and artifact before verdict aggregation.
- [ ] 6.3 Run bounded OpenCode Luna Max Driver passes for every assigned cell,
      collect canary/timeline/environment evidence, and preserve interrupted output.
- [ ] 6.4 Independently verify every candidate, close every baseline cell, and
      publish an immutable adjudicated finding register before changing product or
      harness behavior.

## 7. Fixes and final resweep

- [ ] 7.1 Implement confirmed fixes in small ownership-safe batches with a
      regression test per behavioral boundary; do not weaken or delete failing
      tests and do not overwrite baseline evidence.
- [ ] 7.2 After each batch, rerun every affected cell from a clean reset/profile
      at the new SHA and bind its evidence to the baseline finding.
- [ ] 7.3 Run the entire declared Playwright and Luna matrix again at one final
      SHA; require every final cell to pass with complete function/a11y/visual
      evidence and zero unresolved or confirmed gaps.

## 8. Verification, review, and closeout

- [ ] 8.1 Run `pnpm prettier:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test`,
      `pnpm build`, `pnpm test:e2e:integration`, `pnpm test:uat`, the runtime-sweep
      command, and `openspec validate --all --strict`; record exact exits/artifacts.
- [ ] 8.2 Perform exact-final-SHA goal/constraint, code-quality, security, and
      independent manual visual QA reviews; resolve every blocking finding.
- [ ] 8.3 Verify the final ledger, report projections, Mermaid rendering,
      `HEAD = origin/main`, clean worktree, empty stash, no owned test/browser
      processes, and the explicit owner waiver for server-side CI.
- [ ] 8.4 Sync durable specs, archive the completed OpenSpec change, commit and
      push the green final SHA to `main`, then publish `REPORT.md` and `HANDOFF.md`
      with required remainder `0`.
