# E2E verification

CustomReport has four complementary E2E layers. They share helpers where the
contract is identical, but they do not substitute for one another.

| Layer         | Command                       | Purpose                                                                 |
| ------------- | ----------------------------- | ----------------------------------------------------------------------- |
| Integration   | `pnpm test:e2e:integration`   | Deterministic cross-role and business-critical journeys                 |
| Seed profiles | `pnpm test:e2e:seed-profiles` | Minimal, demo, full, and stress profile smoke coverage                  |
| Catalog UAT   | `pnpm test:uat`               | Role-reachable route, console, page, network, and axe gate              |
| Runtime sweep | Ordered commands below        | SHA-bound control, state, visual, accessibility, and telemetry evidence |

Production-build and CSP verification remain separate commands:

```bash
pnpm test:e2e:prodbuild
pnpm test:e2e:csp
```

## Layout

```text
e2e/
+-- integration/        isolated deterministic journeys and global setup
+-- seed-profiles/      checked-in profile smoke verification
+-- catalog/            canonical role route/intent YAML
+-- sweep/              catalog parser, UAT runner, dev-auth, and driver prompt
+-- runtime-sweep/
|   +-- source/         clean SHA/tree and campaign input freeze
|   +-- preflight/      live route/state/control inventory
|   +-- matrix/         finite executable matrix and applicability rules
|   +-- lanes/          isolated resource plans, runners, and validated merge
|   +-- evidence/       function, a11y, visual, request, and log evidence
|   +-- driver/         native Codex report import and verifier binding
|   +-- replay/         one-cell execution and recovery
|   +-- support/        shared deterministic runtime helpers
+-- helpers/            reusable database, Redis, and runtime-state boundaries
+-- csp/                production CSP policy checks
```

## Safety boundary

All destructive E2E and runtime work uses an explicit `E2E_DATABASE_URL` that
differs from `DATABASE_URL`. The exact guard accepts only loopback PostgreSQL
URLs whose raw path is exactly `customreport_e2e` or
`customreport_e2e_lane_[a-o]_test`; encoded, case-folded, whitespace, query,
fragment, and multi-segment aliases are rejected. Every reset, seed, cleanup,
Redis flush, database creation, or child process that can perform one of these
operations must receive the exact per-run consent
`PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION='давай'`. `ALLOW_PROD_DESTRUCTIVE`
cannot bypass this E2E/runtime guard. Production restore remains a separate
unchanged contract.

Before any lane database or Redis preparation, run the non-mutating plan
guards:

```bash
E2E_DATABASE_URL=postgresql://customreport:localdev@127.0.0.1:5432/customreport_e2e \
DATABASE_URL=postgresql://customreport:localdev@127.0.0.1:5432/customreport_dev \
PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION='давай' \
RUNTIME_SWEEP_LANE_COUNT=4 \
pnpm test:runtime-lane-database-targets

E2E_REDIS_FLUSH=true \
REDIS_HOST=127.0.0.1 \
E2E_DATABASE_URL=postgresql://customreport:localdev@127.0.0.1:5432/customreport_e2e \
PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION='давай' \
RUNTIME_SWEEP_LANE_COUNT=4 \
RUNTIME_SWEEP_REDIS_RECREATE=true \
pnpm test:runtime-lane-redis-targets
```

These commands only derive typed target evidence. Their result always contains
`destructiveOperationsAllowed=false`; they cannot connect, create, reset, seed,
flush, start, or remove a resource. Passing them does not authorize later
mutation. The target-plan commands remain non-mutating and use target-only
validation; preparation and replay require the exact single-use Redis
capability and the Prisma dangerous-action consent path shown above.

## Runtime sweep order

The authoritative environment and archive contract is the active
`establish-exhaustive-runtime-sweep` OpenSpec change. The operator order is:

1. Prove a clean worktree and create immutable `SOURCE.json` with
   `pnpm test:runtime-source`. Then create the exclusive canonical-origin
   receipt with `pnpm test:runtime-source-validate`, capture its printed
   `receipt-file-sha256`, and recheck both immutable files with
   `pnpm test:runtime-source-check`. Every later command requires
   `RUNTIME_SWEEP_SOURCE=/absolute/archive/root/SOURCE.json` and
   `RUNTIME_SWEEP_SOURCE_VALIDATION=/absolute/archive/root/SOURCE-VALIDATION.json`
   plus `RUNTIME_SWEEP_SOURCE_VALIDATION_SHA256=<receipt-file-sha256>`.
   Initial authority paths must name the canonical origin, never a manually
   reconstructed artifact. Lane copies are permitted only after the runner
   verifies their exact digests and repeats the semantic source/receipt check.
2. Set `RUNTIME_SWEEP_CAMPAIGN_KIND=initial` for the first baseline. After a
   failed preflight, use `repair`, `fix`, or `resweep` and run
   `pnpm test:runtime-preflight-repair`. This supported chain runs the exact
   failed `stateId` canary, validates its immutable artifact in the same
   launcher process, rechecks the clean source identity, and only then starts
   the full preflight. The canary output must be the archive-local
   `PREFLIGHT_CANARY.json`. Direct repair/resweep/fix full launches are
   rejected.
3. For an initial baseline, run `pnpm test:runtime-preflight` to prepare
   deterministic states. The launcher freezes an archive-local,
   source/plan-bound `PREFLIGHT_ASSIGNMENT.json` before the browser starts,
   then appends one serialized `PREFLIGHT.journal.jsonl` record pair per whole
   state and writes immutable `segments/<stateId>.attempt-<n>.json` artifacts.
   A resume re-proves the clean source and exact assignment before and after
   every state, skips only a revalidated terminal `PASS`, and resets/replays
   every `STARTED`, `FAIL`, or `AMBIGUOUS` state from its beginning. The
   journal is progress evidence only: it cannot authorize a canary, full
   launch, matrix finalization, or a partial `PREFLIGHT.json`; that artifact is
   published only after the ordered union covers every source-plan state.
   `pnpm test:runtime-preflight-canary` remains available as a canary-only
   diagnostic; its artifact alone cannot authorize a later standalone full
   launch.
4. Run `pnpm test:runtime-manifest` to create the finite `MATRIX.json` and
   campaign manifest.
5. Run `pnpm test:runtime-lane-plan` for one-cell, one-shard, or full mode.
6. Run both target-plan guards above.
7. Only after exact disposable ownership is approved, run
   `pnpm test:runtime-lane-prepare` and `pnpm test:runtime-lanes`.
8. Run `pnpm test:runtime-lane-merge`; the merger rejects missing, duplicate,
   stale-SHA, foreign-run, digest-mismatched, or non-pass output.
9. Run `pnpm test:runtime-coverage` and import bounded native Codex review
   reports with `pnpm test:runtime-driver`.

The harness uses Chromium at exactly `1440x900` for `lead`, `head`, `admin`, and
`viewer`. Firefox, WebKit, mobile, and tablet are explicit exclusions, not
covered targets. Every lane owns a distinct database, Redis instance, API/web
ports, browser process, Next.js output, queue namespace, and archive subtree.
Each lane uses one Playwright worker and executes its assigned cells serially.

## Failure-frontier diagnostic replay

A failed exact capacity survey may opt in to a separately rooted
`PREFLIGHT_REVEAL_FAILURE_FRONTIER` packet. After that packet exists, replay
only its saved branch with the ordinary preflight runtime environment plus the
following exact paths:

```bash
RUNTIME_SWEEP_ARCHIVE=/absolute/archive/root \
RUNTIME_SWEEP_SOURCE=/absolute/archive/root/SOURCE.json \
RUNTIME_SWEEP_SOURCE_VALIDATION=/absolute/archive/root/SOURCE-VALIDATION.json \
RUNTIME_SWEEP_SOURCE_VALIDATION_SHA256=<64-hex-receipt-file-sha256> \
RUNTIME_SWEEP_CAPACITY_SURVEY_PLAN=/absolute/archive/root/survey/PREFLIGHT_CAPACITY_SURVEY_PLAN.json \
RUNTIME_SWEEP_FAILURE_FRONTIER_REPLAY_PACKET_ROOT=/absolute/archive/root/failure-frontier \
RUNTIME_SWEEP_CAPACITY_SURVEY_TEMP_ROOT=/absolute/disposable/temp/root \
RUNTIME_SWEEP_CAPACITY_SURVEY_MAX_DURATION_MS=600000 \
E2E_DATABASE_URL=postgresql://customreport:localdev@127.0.0.1:5432/customreport_e2e \
PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION='давай' \
pnpm test:runtime-preflight-failure-frontier-replay
```

The global setup validates the source, capacity plan, complete packet, archive
confinement, and live clean Git identity before launching Chromium. A valid
packet gets one fresh guarded database/browser boundary. Replay restores the
saved path, re-derives the canonical immediate candidate list, checks the
unchanged whole-surface boundary, and never executes the failing final action.
The command runs Playwright in a detached child process group; the declared
maximum duration covers setup, servers, browser work, and teardown, with
process-group escalation if graceful interruption does not finish.
It emits exactly one diagnostic-only classification: `INVALID_PACKET`,
`PATH_OR_LINEAGE_DRIFT`, `REPRODUCED`, or `NOT_REPRODUCED`. None is a capacity
result, continuation, canary, matrix, PASS, release, or acceptance artifact.
Generic browser, database, server, or filesystem failures remain non-zero
infrastructure failures rather than diagnostic verdicts.

## Evidence and archive

Runtime evidence is not curated repository documentation. Store it below the
campaign directory in `~/work/customreport-archive/`, never under `docs/` or
`e2e/`. Preserve failed cells, screenshots, geometry, axe/keyboard results,
request timelines, API/worker logs, Bugsink/Loki evidence, and exact content
digests before aggregation.

Baseline evidence is immutable. A product or harness fix creates a new SHA-bound
rerun; it never edits the baseline. Completion requires every final matrix cell
to pass at one SHA with no unresolved or confirmed functional, accessibility,
visual, observability, or recovery gap.
