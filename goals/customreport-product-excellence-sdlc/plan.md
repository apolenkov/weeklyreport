# WeeklyReport product-excellence execution plan

## Solution approach

Bring the product to one coherent, source-bound standard in product-sized
increments. Architecture and readability lead every increment; tests, isolated
runtime, observability and CI prove the result rather than becoming independent
infrastructure workstreams. Each increment owns one product surface, its
OpenSpec requirements, its regression tests and its cleanup, and leaves the
tree no weaker than it found it.

Mechanical code-style work is not an independent delivery stream. Existing
ratchets may require a narrow extraction while landing a product fix, but the
plan does not spend product time chasing file/function counts or wrapper shape
without an observable behavior, architecture, security or operability outcome.
Strict structural, complexity and immutability ratchets apply to maintained
product code only. Tests, fixtures, harnesses, UAT and E2E remain free of those
budgets and test-style preferences until a later test-quality campaign; they
retain formatting, type safety and failure-prevention checks needed to keep
results trustworthy.

The accepted final standard is stricter than the current live ratchet. Current
documentation describes production limits of 300 lines per file, 70 lines per
function and cyclomatic complexity 20. The target is file length at most 230,
function length at most 57, cyclomatic complexity at most 10 and cognitive
complexity below 10. A dedicated OpenSpec change and strict delta-spec
validation must approve those targets before they supersede the durable
standard. They will then be introduced through a measured baseline and
monotonically shrinking exemptions; no unmeasured rule or blanket override is
allowed.

## Current owner decision and execution authority

- WeeklyReport is the only product name. `customreport-*`, `@customreport/*`,
  `customreport_e2e`, and existing archive paths are legacy technical
  identifiers, not a separate product.
- The verified 2026-08-27 planning snapshot contained 12 prioritized changes
  and 40 unchecked non-mobile tasks. Re-read the live OpenSpec state at every
  checkpoint because implementation and archive work may reduce that number.
- Six `fix-mobile-*` changes and their 15 unchecked tasks are owner-deferred.
  Preserve them in OpenSpec, but do not start, continue, delete, or claim them
  complete without a later explicit owner decision. Mixed desktop/tablet work
  remains active when it has independent non-mobile outcomes.
- For this MVP, the owner authorizes autonomous local product, architecture,
  code-quality, documentation, test, and DevOps changes inside the repository,
  including focused verification and clean local checkpoint commits. Prefer
  product implementation over building test infrastructure.
- This standing local authority does not include production/shared data,
  credentials, destructive work outside the exact guarded disposable targets,
  external publication, billable services, push, merge, or release. Those
  boundaries still require exact task-specific authority.
- Product checkpoints landed on the current branch now cover readable and
  assistive-technology-equivalent Trends charts, recoverable Trends queries,
  recoverable Head publish controls, fail-closed session loading with retry,
  and desktop Admin alert counts that distinguish unavailable data from a real
  zero. Keep these as product evidence; do not turn them into a new browser or
  lint campaign.

## Ordered plan

1. Establish one product denominator and an owned backlog.

   - First propose, review and strictly validate one dedicated OpenSpec change
     that owns the stricter file/function/cyclomatic/cognitive limits and their
     exact maintained-scope classification. It must update the durable
     `lint-max-strictness-standard` requirements before any documentation or
     enforcement change claims the new numbers.
   - Reconcile every non-archived incomplete change in `openspec/changes/` with
     the durable requirements in `openspec/specs/`. Group them by product
     surface: report record ordering; lead recovery; PDF export; admin
     navigation and products; action-log search; desktop composition and
     hierarchy; owner-deferred mobile touch/overflow; confirmation dialogs;
     bounded browser smoke correctness; and repository-tooling boundaries.
   - Use `docs/architecture/TARGET-STRUCTURE-2026-07-02.md`,
     `docs/exemplary-code-standard.md`, `docs/quality-program.md` and
     `docs/sdlc.md` as the current quality baseline. Record for each requirement
     its owner, product behavior, code path, test, live proof and closeout
     condition.
   - Classify each older or overlapping OpenSpec change as implement, merge into
     its canonical successor, or explicitly close with evidence. Never delete a
     requirement merely because a later branch has similar code.

   Verification: `openspec list`; `openspec validate --all --strict`; a
   requirement-to-evidence ledger with no unowned active item.

2. Measure architecture or code-style debt only when it blocks a product slice.

   - Use `eslint-config/core.ts`, `eslint-config/overrides.ts`,
     `eslint-config/immutability.ts`, `eslint-config/boundaries.ts`,
     `.dependency-cruiser.cjs`, `scripts/gates/directory-architecture/` and
     `scripts/quality/exemplary/` as the enforcement owners.
   - Apply the exemplary-audit procedure only to a rule proposed by an active
     product or architecture change. Measure it at shipping options, prove a
     zero with a planted violation, and classify the signal as REAL, VACUOUS,
     CONFIG or NOISE before changing enforcement.
   - Do not run a repository-wide style campaign while user-facing,
     data-integrity, recovery or first-production work remains. Existing gates
     continue to block regressions; a product commit that trips one receives
     the smallest architectural repair that keeps the gate honest.

   Verification: the actual gate invocations and probe outputs are archived;
   all counts identify rule, options, file count and exit code; no claim relies
   on an unproven zero.

3. Finish the architecture by product domain, not through a big-bang rewrite.

   - In `apps/api/src/modules/`, complete the existing modular-monolith pattern:
     invariant-bearing domains keep pure domain logic, application services and
     explicit ports/adapters; thin CRUD domains stay deliberately flat. Preserve
     the period dual-state and canonical tRPC middleware-chain invariants.
   - In `apps/web/src/`, make `app/` routing-only and move product behavior into
     the `features/<domain>/{ui,model,api}` slices defined by the target
     architecture; keep business-agnostic code in `shared/` and retain
     `packages/shared` as contracts and `packages/ui` as presentation-only.
   - Remove boundary allowlists only after the relevant domain is compliant.
     Extend ownership and dependency checks in
     `scripts/gates/directory-architecture/` and `eslint-config/boundaries.ts`
     only when the measured module graph proves that the rule can detect a real
     violation.

   Verification: targeted domain tests, `pnpm lint:directory-architecture`,
   `pnpm depcruise`, affected typechecks, and a review of public imports and
   write paths against the target architecture.

4. Apply the strict code standard inside product increments.

   - Refactor only the domain owned by the active product increment. Respect the
     live function/file/complexity ratchets, but extract named operations only
     when they clarify an actual product or architecture boundary; never split
     code mechanically to manufacture a metric win.
   - Make product code immutable by default: eliminate `let`, parameter/property
     mutation and hidden state where a new value, reducer or narrow effect
     boundary is clearer. A remaining adapter mutation must be explicitly
     classified and justified, never hidden by an inline disable.
   - Remove stale comments, obsolete TODO/FIXME/HACK markers, duplicate helpers,
     unused exports and unreferenced paths. For every candidate, use a
     REMOVE/MIGRATE/RETAIN decision with references before changing it.
   - Update `docs/exemplary-code-standard.md`, `eslint-config/*.ts`, policy
     probes under `scripts/eslint/policy/`, and exemplary-floor baselines only
     together with the fixes or a shrinking counted baseline. Do not create a
     per-file exemption list to make the numbers pass.

   Verification: measured rule probes, `pnpm lint:eslint`,
   `pnpm lint:directory-architecture`, `pnpm knip`, `pnpm depcruise`,
   `pnpm lint:exemplary-floor`, and a clean full `pnpm lint` table after each
   bounded domain batch.

5. Close product behavior and UX/accessibility changes surface by surface.

   - Implement and verify the active user-facing OpenSpec changes: stable report
     ordering, disabled PDF-export reason and artifact race, lead-form load
     recovery, action-log search/detail behavior, admin responsive navigation,
     desktop report composition/hierarchy, and Radix confirmations. Keep the
     six owner-deferred mobile touch-target/overflow changes out of the active
     implementation denominator.
   - For each surface, update the relevant web feature, API module and shared
     contract before duplicating types; add a focused colocated regression test
     when it materially protects the repaired behavior.
   - Treat no horizontal overflow, 44x44 px mobile targets, role authorization,
     request/error behavior and data integrity as product assertions, not
     screenshot impressions.

   Verification: focused colocated Vitest suites and product-source review.
   Browser inspection is optional, manual evidence for a changed UI surface;
   it is not a maintained repository harness or a default completion gate.

6. Use runtime and observability only when a product change needs that proof.

   - Do not maintain a root E2E, UAT, route-catalog, acceptance, Playwright-test,
     campaign, continuation, lane, matrix, or AI-import platform.
   - Keep resilience, Redis outage/recovery, logs, traces, and errors in focused
     deterministic tests and bounded operational rehearsals. Browser smoke is
     one evidence class, not complete product acceptance by itself.
   - Use databases, Redis, containers and telemetry only for a focused
     product-owned integration or operational check. Keep those resources
     isolated and disposable; never turn the environment into the workstream.

   Verification: one clean SHA/tree plus only the focused checks owned by an
   affected product boundary. Any started disposable resource is torn down.
   Do not recreate browser-contour or SOURCE/MATRIX/frontier protocols.

7. Make delivery and documentation match the finished product.

   - Reconcile `.github/workflows/ci.yml`, local hooks, `docs/operations.md`,
     `docs/onboarding.md`, `docs/sdlc.md`, architecture docs and durable OpenSpec
     specs with the final code and recovery paths. Keep runtime session evidence
     in `~/work/customreport-archive/`, not in `docs/`.
   - Verify that deterministic product checks, colocated tests, migration/seed
     proof and source-built runtime checks exercise the actual product. Treat
     GitHub protection, dependency/security settings and any
     production release controls as external authority: inspect and record them,
     but request the owner before changing unavailable account-level controls.
   - Resolve the publish-ingestion production boundary before claiming first
     production readiness. Current composition intentionally refuses to boot in
     `NODE_ENV=production`, and no real ingestion consumer exists in source.
     The owner must choose either a defined consumer outcome to implement or
     explicit retirement of the dormant ingestion contract; do not disguise a
     no-op queue as production readiness.

   Verification: `pnpm format:check`, `pnpm lint`, `pnpm typecheck`,
   `pnpm test`, `pnpm build`, `openspec validate --all --strict`, exact
   remote-tip equality, CI read-back, Dependabot read-back and reviewed current
   documentation.

8. Perform exact-final acceptance and close only the evidence that is complete.

   - Freeze one final clean source SHA/tree; re-run all required affected gates
     and source-bound product evidence at that identity. Reconcile every fact in
     `facts.md` to a concrete artifact rather than to an intent or old result.
   - Obtain independent final Sol review for architecture, code quality,
     product behavior, accessibility, data integrity, observability and release
     evidence. Repair every accepted blocker and repeat only the affected proof
     on the new identity.
   - Sync/validate durable specs, archive only completed OpenSpec changes, update
     the closeout evidence and leave no owned worktree, process, listener,
     container, volume, credential or unresolved requirement behind.

   Verification: a final requirement-by-requirement audit, source/tree digest
   equality across evidence, all stated commands PASS, no remaining active
   blocking task, independent Sol PASS and `required remainder = 0`.

## Risks and explicit stop conditions

- The accepted `230/57/10` standard is stricter than the current live
  `300/70/20` ratchet. It must be measured and ratcheted per folder; a global
  config flip before the fixes would create a red, non-actionable tree.
- The active OpenSpec list contains overlapping visual, mobile, runtime and
  tooling work. The denominator must be reconciled before closing any item, or
  duplicate changes will produce contradictory evidence.
- Every retired runtime-sweep campaign and canary remains immutable historical
  evidence and must not be retried. The separate E2E/UAT/catalog/acceptance
  platform is deleted and must not be recreated; use colocated product tests.
- Production/shared/unknown data, credentials, account-level GitHub controls,
  main merge and unavailable required remote authority are outside the standing
  repository workflow. Stop and request the owner before crossing any of those
  boundaries.
- Implementing or retiring the currently unwired publish-ingestion capability
  changes the durable product denominator. Keep local MVP work moving, but stop
  for the owner's choice before changing that contract or claiming first
  production/release readiness.
