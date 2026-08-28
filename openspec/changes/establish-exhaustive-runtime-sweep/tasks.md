## Superseded task boundary

Owner direction retired this campaign in favor of
`replace-runtime-sweep-with-product-acceptance`. Commit `42a5bd7b4` removed the
runtime platform; the unlaunched r6 packet is
`NOT_RUN_SUPERSEDED_BY_OWNER_DIRECTION` in the external archive. Every
unchecked task below remains unchecked historical scope: it was not executed,
is not waived, and MUST NOT be launched, resumed, checked, synced, or used as
current WeeklyReport acceptance evidence.

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
- [x] 1.7 Bind the canonical source to both the raw 40-character Git tree object
      id and the existing tree digest; reject legacy or tampered source artifacts
      instead of backfilling identity from the live worktree.

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
- [x] 3.7 Make observability evidence fail closed: persist browser request
      timelines plus API/worker logs, query Bugsink and Loki by correlation id
      and cell time window, detect undeclared failures, repeated requests,
      retry storms, cache-contract misses, and slow outliers, and reject a green
      browser assertion when telemetry is dirty or correlation evidence is
      missing.
- [x] 3.8 Freeze screenshot and geometry before keyboard/axe instrumentation for
      every bounded transition; keep same-route landmark comparison strict and
      allow only URL-proven cross-route topology masks while snapshot-local
      overflow, loading, and geometry failures remain blocking.
- [x] 3.9 Reject runtime lane execution when the live worktree is dirty or HEAD
      differs from the frozen source SHA.
- [x] 3.10 Bind strict observability completion manifests to source, matrix,
      assignment, run, lane, and profile identities; await file/OTel/Sentry
      shutdown, settle late browser/log events, and allow only the exact declared
      controlled fault while every additional failure remains blocking.
- [x] 3.11 Keep the coordinated API shutdown as the sole process-signal owner
      and prove racing termination signals close the Nest application and exit
      exactly once.
- [x] 3.12 Quiesce the prior browser document before profile reseed, run the
      preflight API without a source watcher, and persist its API log so a
      structured 500 remains diagnosable.
- [x] 3.13 Preserve exact Sentry envelope navigation aborts as raw evidence while
      excluding only the explicit browser/Next.js SDK signature allowlist from
      failure counts, and require a frozen submit transition to execute the
      scoped confirmation action before recovery.
- [x] 3.14 Freeze every deterministically reachable post-transition control and
      its canonical reveal path plus exact raw semantic surface (including
      `order`/`domOrderKey`) into `PREFLIGHT.json` before finalizing `MATRIX.json`;
      retain raw transition/action-surface bindings, derive a material semantic
      projection only for branch/visited accounting, prove each preparation
      step is database-non-mutating, replay the path before the target action,
      reject ambiguous paths, and fail a cell on any unknown, missing,
      non-positional, or relative-order drift instead of trimming discovery
      evidence or appending drift as passing evidence.
- [x] 3.15 Bind read-only preparation reuse to the exact canonical state-plan
      digest and full route identity, prove every preparation axis changes the
      key while case/action identity alone may reuse, and stop the whole
      campaign when any executor resolves a non-pass cell.
- [x] 3.16 Require an explicit runtime oracle for every coverage cell and make
      terminal ledger validation reject missing runtime evidence unless the
      cell carries the typed reasoned inapplicable entry allowed by the spec.
- [x] 3.17 Bind an explicit route network policy or reviewed `null` declaration
      into source, case identity, and matrix digest; propagate the effective
      policy into ordinary and specialized capture without a permissive default.
- [x] 3.18 Bind independent reveal material-edge/action and control/case limits
      to version-2 SOURCE.json, propagate reveal limits into production
      preflight, reject control overflow before canary PASS, and retain the
      finalizer's no-trimming second check with focused overflow/tamper tests.

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
- [x] 5.4 Generalize deterministic replay to a requested bounded lane count;
      require exclusive database/Redis/API/web/browser/output resources, one
      serial worker per lane, bounded DB pools, fail-closed process cleanup, and
      exact source/evidence/coverage validation in the merger. Benchmark
      increasing lane counts with one-cell and full-group canaries before the
      immutable full run.
- [x] 5.5 Require one non-forgeable, exact-environment Redis mutation
      authorization across every public preparation and replay entrypoint; bind
      create/start/remove to immutable container IDs and re-prove the complete
      identity after each bounded readiness wait with mocked fail-before-mutation
      controls.
- [x] 5.6 Add separate guard-only PostgreSQL and Redis target-plan commands that
      derive every canonical lane target, reject unsafe/equal/ambiguous inputs,
      emit typed `destructiveOperationsAllowed=false` evidence, and prove by
      source-level controls that no mutation-capable primitive is reachable.
- [x] 5.7 Bind immediate product effects into the frozen semantic control
      surface, exclude `mutation-required` controls only from reveal
      preparation, and retain their ordinary runtime matrix coverage.
- [x] 5.8 Mark reopen decision buttons as `mutation-required`, preserve Cancel as
      client-only, and cover the metadata and classification in product and
      Chromium tests.
- [x] 5.9 Bind every intentional catalog redirect alias to one exact landing URL
      in `SOURCE.json`; make preflight prove the initial landing and use only its
      pathname as the reveal boundary, with negative tests for missing, wrong,
      and later cross-path navigation.
- [x] 5.10 Add an immutable exact-state preflight canary that reuses the full
      preparation/navigation/inventory/reveal/non-mutation implementation and
      blocks repair/resweep full preflight until the failed segment passes at
      the current clean source identity.
- [x] 5.11 Model resolver-route outcomes as state-bound, source-digest-bound
      expectations: visible current, published fallback, empty, query error,
      and anonymous. Cover the minimum applicable profile, record typed
      inapplicable role-permission boundaries (including minimal where the
      capability is absent), keep the resolver outcome model explicit rather
      than assigning one unconditional exact landing route, and implement
      `viewer-status-empty` plus `viewer-status-query-error` as frozen
      route-local specialized resolver scenarios with guarded disposable-state
      preparation, exact retry/non-mutation proof, and end-to-end artifact
      identity.
- [x] 5.12 Add a source/plan/assignment-bound append-only preflight journal and
      exact state-boundary resume. Reject stale, foreign, duplicate, reordered,
      truncated, tampered, started-only, failed, ambiguous, or digest-drifted
      entries; never resume inside a state; publish canonical `PREFLIGHT.json`
      only after the validated ordered union exactly covers the full source plan.
- [x] 5.13 Replace the broad destructive database suffix/override path with one
      exact loopback disposable-target validator and per-run consent boundary;
      apply it before Prisma, pg, Redis, database creation, reset/seed/cleanup,
      and child-process operations across E2E, runtime lanes, direct profiles,
      reset-hard, wipe-manual-uat, and policy backfill. Add fail-before-primitive
      negatives, exact CI targets, onboarding/runtime docs, and the durable
      destructive-db-guard delta.
- [x] 5.14 Bound exhaustive preflight diagnostic amplification by retaining the
      failed call/source trace, a separate full network HAR without response
      bodies, failure screenshot, video, and error context without per-call
      trace DOM snapshots/screenshots; prove the policy does not trim reveal or
      runtime-cell coverage and rerun the exact R182 timeout state before
      marking this task complete.
- [x] 5.15 Preserve completed reveal-discovery candidates across bounded child
      chunks with immutable terminal-candidate receipt chunks containing only
      disjoint suffixes and a pure deterministic parent-owned reducer: amend
      the contract/design, bind source/tree/plan/state/selector/route/
      initial-surface identities and a fresh parent attempt, enforce canonical
      receipt/chunk digests, atomic archive-confined raw IO, parent-only HMAC
      execution grants, and source-derived finite no-progress guards.
      Permit one authority-free receiptless bootstrap only for ordinal zero,
      no grant, a zero chain, and a parent-revalidated empty initial frontier;
      require the parent to re-derive its genesis, source bounds, reducer state,
      and controls before signing the zero-chain parent PASS.
      Recreate a fresh disposable database/browser boundary, replay the next
      branch's canonical path, and prove uninterrupted versus split equivalence
      plus tamper, reorder, omission, duplicate, stale-source, synthetic
      rehash, last-candidate, and canonical IO rejection. The child emits no
      PASS; the parent alone reduces the suffix to an empty frontier and writes
      the parent PASS/canary PASS. Any nonzero child exit terminates the current
      attempt. This implementation is exact-canary-only; full/shard journal
      continuation remains explicitly NOT-PROVEN and no grant, chunk, or
      canary artifact crosses execution scope.
- [x] 5.16 Enforce `maxControlsPerSegment` inside the shared pure reveal queue
      before accepting dynamic control registration or extending the queue;
      prove exact-limit success, plus-one rejection, and live/parent-replay
      parity without trimming controls or emitting continuation/canary evidence
      on overflow.
- [x] 5.17 Add a separately identified, exact-source, single-child capacity
      survey with explicit graph, wall-time, per-file, and aggregate archive
      limits. Disable HAR, trace, video, screenshots, continuation assets, and
      every canary/journal/PASS writer. It may publish terminal counts only
      after the monolithic reveal queue proves an empty frontier, never writes
      or satisfies acceptance evidence, and must be completed before replacing
      the production reveal limits. Renew a near-expiry cached actor session
      from its actual browser-cookie expiry without changing the product auth
      TTL, reject route drift before inventory comparison, run browser work
      outside active Playwright `TestInfo`, traverse with iterative cursors, and
      retain only fixed-interval scalar heap/cardinality progress samples.

- [x] 5.18 Preserve one terminal-candidate failure from an exact capacity survey
      in a separately rooted, diagnostic-only failure-frontier packet. Add an
      optional default-off callback before candidate-cursor advancement that
      receives the pre-candidate state, branch, canonical candidate list,
      failing index/identity and original error, publishes bounded immutable
      branch/path/inventory/surface/candidate-list evidence, and rethrows the
      original error without emitting RESULT, continuation, resume, grant,
      PASS, canary, journal, matrix or acceptance authority. Bind exact source,
      plan, selector, state and route identity; enforce a 64 KiB manifest,
      depth 8, at most 64 assets, 8 MiB per asset and 64 MiB aggregate bounds;
      require archive confinement, regular non-symlink files, write-last atomic
      manifest publication and digest read-back. Add missing, duplicate, stale,
      foreign, reorder, tamper, symlink, path-escape, partial-write and every
      bound negative. Add a fresh-state focused Chromium replay that restores
      the saved path, re-derives and exactly matches the canonical candidate,
      invokes the unchanged whole-surface boundary without executing the final
      action, and emits only diagnostic terminal classifications.

- [ ] 5.19 Add source-bound canonicalization for independent reversible
      `aria-controls`-scoped disclosures. Retain toggle metadata in live and
      continuation inventories, require the explicit
      `data-reveal-independence="source-bound-row-local"` contract in every
      candidate step, execute and record both `A → B` and `B → A` for disjoint
      targets, require equal material surfaces and URL before reducing deeper
      combinations to the material union, retain every row-local control, and
      keep modal/coupled/URL-changing/incomplete/untrusted controls ordinary.
      Add deterministic four-toggle rejection coverage and preserve the
      existing `maxControlsPerSegment` plus-one guard. This remains
      NOT-PROVEN until an exact `admin/demo` canary exercises the contract.
      Within the same task, add a pure eligibility/inverse-restoration contract
      and a 20-toggle operation-count proof; implement a branch-local verified
      restore callback/token in branch execution; invoke the exact inverse only
      after a terminal candidate will not yield; and reuse the restored branch
      only after exact URL, full-inventory, full-surface, and non-mutation
      equality. Keep self and ordinary controls on full replay, never serialize
      reused state, preserve candidate/receipt ordering and the conservative
      action debit, and add negative continuation/publication tests for target,
      state, URL, inventory, surface, database, timeout, signal, and inverse
      execution drift. Publish focused timing and operation evidence for one
      source-bound aggregate attempt made of ordered partition receipts. Each
      receipt must carry a `partitionPlanDigest` that transitively binds the
      exact source/tree/plan; the receipt itself must bind an exact predecessor
      and a half-open cumulative candidate-count range
      `[startCandidateCount, endCandidateCount)`; ranges must be contiguous and
      non-overlapping, with only the declared single terminal overshoot. Bind
      `partitionMaxMs=4_500_000`,
      `teardownReserveMs=360_000`, and the derived
      `supervisorMaxMs = maxPartitions * partitionMaxMs + teardownReserveMs`.
      Normal candidate work, checkpoint waits, and new-child starts must stop
      before the teardown reserve; terminal checkpoint response and
      permit-bound publication may use the outer deadline, after which only
      controller settlement, teardown, source read-back, and verified
      zero-residue checks may continue. Completion is coverage-only and full
      supervisor zero-residue evidence is separate. The parent-attempt HMAC is
      ephemeral anti-tamper state, not an archived public signature or reusable
      authority. A single exact production canary may close the task only when
      its frontier is empty and parent-authored aggregate PASS is published;
      timeout, incomplete frontier, lineage mismatch, missing or failed
      publication, or cleanup residue is NOT-PROVEN and is not retried.
      Before that attempt, the stock launcher must reject an
      equal parent `DATABASE_URL`/`E2E_DATABASE_URL` before Playwright spawn,
      and controller settlement may collapse only an exact primary failure or
      an `AbortError` caused by that same object; independent cleanup failures
      remain aggregated.

- [x] 5.20 Retain Darwin raw-free pages as receipt telemetry without using them
      as an independent baseline/runtime veto; keep available memory, pressure,
      swap and swap growth, compression, malformed-input, and cumulative-counter
      guards fail-closed, preserve historical raw-free receipt reason tokens,
      and add focused reclaimable-memory regression coverage.

- [x] 5.21 Make canonical SOURCE origin a fail-before-effects authority. Rebuild
      the expected artifact through the existing campaign builder, require exact
      canonical bytes in addition to the embedded digest, publish one immutable
      source/SHA/tree/plan/file-bound PASS receipt, and require a read-only
      receipt recheck before packet/gate materialization and every runtime-capable
      preflight, manifest, lane, coverage, AI-import, or Playwright entrypoint.
      Reject stale, foreign, tampered, synthetically rehashed, reordered,
      whitespace-drifted, post-receipt, missing, duplicate, and overwritten
      artifacts before directory, runtime/browser/server/resource child,
      browser, destructive guard, Docker, database, or Redis effects; allow
      only validator-owned read-only Git/tool subprocesses, keep the static
      harness exempt, and add a
      source-import architecture regression.

- [x] 5.22 Add the source-bound parent-only host checkpoint for the exact
      `admin/demo` canary continuation: strict canonical request/response and
      immutable file-backed client, post-reduction sequencing before every next
      child, unchanged 60-sample host baseline/thresholds/hysteresis, exact
      5-second wait, parent-only environment filtering, external controller/core
      and test packet, focused failing-first evidence, and the remeasured
      directory-architecture baseline. Full/shard continuation remains
      NOT-PROVEN and task 5.19 remains unchecked.

- [x] 5.23 Replace the miscalibrated absolute Darwin swap-used veto with the
      reviewed historical-swap telemetry/current-pressure contract, anchored
      swap growth/activity and swap-free headroom; bound the one-worker
      exact-canary continuation by 60 seconds, 256 terminal candidates, 1,024
      reveal actions, a 90-second process-group wall and final-child checkpoint.
      Verify focused regressions for stable historical swap PASS; low headroom,
      growth, pressure, malformed/reset counters and sustained churn failures;
      producer/reader 60-sample anchor equivalence; all three cooperative
      yields; tampered limits; hard group kill with no resumable artifact; and
      exactly one healthy checkpoint after every child including terminal.

## 6. Immutable baseline and adjudication

- [x] 6.1 Freeze a clean-source manifest containing full SHA/tree, catalog/spec/
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
      complete function/a11y/visual/runtime evidence and zero unresolved or
      confirmed gaps.
- [ ] 7.4 Adjudicate the final request/log/correlation timelines and transition
      screenshot pairs; publish request/cache/performance findings and prove
      zero undeclared Bugsink/Loki/API/worker/browser errors before the stop
      gate may pass.

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
