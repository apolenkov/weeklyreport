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

All destructive E2E work uses an explicit `E2E_DATABASE_URL` that differs from
`DATABASE_URL`. Runtime lanes derive canonical databases named
`customreport_e2e_lane_<id>_test`. The Prisma destructive guard remains the
final database authority. Never set either URL to a production target.

Before any lane database or Redis preparation, run the non-mutating plan
guards:

```bash
E2E_DATABASE_URL=postgresql://.../customreport_e2e \
DATABASE_URL=postgresql://.../customreport_dev \
RUNTIME_SWEEP_LANE_COUNT=4 \
pnpm test:runtime-lane-database-targets

E2E_REDIS_FLUSH=true \
REDIS_HOST=127.0.0.1 \
RUNTIME_SWEEP_LANE_COUNT=4 \
RUNTIME_SWEEP_REDIS_RECREATE=true \
pnpm test:runtime-lane-redis-targets
```

These commands only derive typed target evidence. Their result always contains
`destructiveOperationsAllowed=false`; they cannot connect, create, reset, seed,
flush, start, or remove a resource. Passing them does not authorize later
mutation. The preparation and replay entrypoints still require the exact
single-use Redis capability and the Prisma dangerous-action consent path.

## Runtime sweep order

The authoritative environment and archive contract is the active
`establish-exhaustive-runtime-sweep` OpenSpec change. The operator order is:

1. Prove a clean worktree and create immutable `SOURCE.json` with
   `pnpm test:runtime-source`.
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
