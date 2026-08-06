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
- [x] 1.6 Add the discriminated execution contract and one centralized legal-row
      policy; reject transition/action mismatch, missing fault ids, fabricated
      `none` witnesses, and unreasoned specialized-axis omissions.

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
- [x] 2.5 Add tests proving reseed determinism, scoped fault teardown,
      concurrency isolation, and unchanged persisted state after rejected actions.

## 3. Web DOM, accessibility, and visual execution

- [x] 3.1 Implement semantic live-DOM inventory for visible interactive
      controls and newly revealed controls, with stable role/name/order identities.
- [x] 3.2 Implement bounded control actions, including publish, delete, revoke,
      and restore on the disposable E2E database, with reset/reseed after stateful
      or ambiguous outcomes.
- [x] 3.3 Collect per-cell functional, keyboard/focus/axe, console/page/network,
      screenshot, geometry, and overflow evidence at Chromium `1440x900`.
- [x] 3.4 Add the dedicated runtime-sweep Playwright config/spec and root
      commands without weakening the existing integration and `test:uat` suites.
- [x] 3.5 Add planted harness tests proving dynamic-control discovery, missing
      accessible names, visual changes, console/network errors, and unreasoned
      omissions fail the owning cell.
- [x] 3.6 Implement deterministic two-stage route/state preflight: freeze an
      immutable `SOURCE.json` plan, use the dedicated Playwright preflight to
      reset/prepare every nominal segment and inventory controls into
      `PREFLIGHT.json`, then require that artifact to finalize frozen
      `MATRIX.json` cases, typed inapplicable records, total-case limits, and
      digest before immutable baseline execution.

## 4. Native Codex Luna Max review and fail-closed import

- [x] 4.1 Keep immutable `SOURCE.json` tool versions provider-neutral; the
      deterministic Playwright project chain remains the exhaustive authority
      and no external provider executable is required.
- [x] 4.2 Define a strict provider-neutral report contract with metadata
      `provider: native-codex`, `model: gpt-5.6-luna`, and `reasoning: max`.
      Reports validate source SHA/profile/role, exact assigned cells/actions,
      timelines, canary, environment evidence when applicable, and candidates.
- [x] 4.3 Keep native Luna review bounded to one canonical role/profile route
      evidence batch at a time. Native Luna emits candidates only and never
      mutates deterministic cells or the canonical ledger.
- [x] 4.4 Require an explicitly supplied read-only verifier/import for every
      candidate; missing, malformed, stale, or partial verification fails
      closed and only confirmed candidates may enter adjudication.
- [x] 4.5 Add the `pnpm test:runtime-driver` CLI to ingest one or more supplied
      report files, validate and merge exact frozen cells, and write projections
      only after all identity/canary/verifier checks pass.
- [x] 4.6 Retain deterministic route-local assignment/shard checks for exact
      cell identity; the AI review references those cells without duplicating
      every deterministic action.

## 5. Documentation and operator surface

- [x] 5.1 Replace the stale `e2e/README.md` layout and commands with the current
      integration, catalog-sweep, runtime-sweep, seed-profile, and native Codex
      Luna import workflows and destructive-data warning.
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
- [ ] 6.3 Run bounded native Codex `gpt-5.6-luna` Max review passes for every
      canonical role/profile route evidence batch, collect canary/timeline/
      environment evidence, and import reports through the fail-closed CLI.
- [ ] 6.4 Independently verify every candidate, close every baseline cell, and
      publish an immutable adjudicated finding register before changing product or
      harness behavior.

## 7. Fixes and final resweep

- [ ] 7.1 Implement confirmed fixes in small ownership-safe batches with a
      regression test per behavioral boundary; do not weaken or delete failing
      tests and do not overwrite baseline evidence.
- [ ] 7.2 After each batch, rerun every affected cell from a clean reset/profile
      at the new SHA and bind its evidence to the baseline finding.
- [ ] 7.3 Run the entire declared deterministic Playwright matrix again at one
      final SHA, then run bounded native Codex Luna Max review batches through
      the explicit import/verifier path; require every final cell to pass with
      complete function/a11y/visual evidence and zero unresolved or confirmed
      gaps.

## 8. Verification, review, and closeout

- [ ] 8.1 Run `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test`,
      `pnpm build`, `pnpm test:e2e:integration`, `pnpm test:uat`, the runtime-sweep
      command, and `openspec validate --all --strict`; record exact exits/artifacts.
- [ ] 8.2 Perform exact-final-SHA goal/constraint, code-quality, security, and
      independent manual visual QA reviews; resolve every blocking finding.
- [ ] 8.3 Verify the final ledger, report projections, Mermaid rendering, the
      final campaign branch at its remote tip, clean worktree, empty stash, no
      owned test/browser processes, and the explicit owner waiver for server-side CI.
- [ ] 8.4 Sync durable specs, archive the completed OpenSpec change, commit and
      push the green final SHA to the dedicated campaign branch without merging
      `main`, then publish `REPORT.md` and `HANDOFF.md` with required remainder `0`.
