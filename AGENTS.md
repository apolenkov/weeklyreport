# AGENTS.md

WeeklyReport is a pnpm/Turbo monorepo for weekly reports: Leads author sections;
the Head reviews, publishes and exports. Start with the task's scope, then read
the relevant README and OpenSpec contract. This file adds repository rules to
the owner's global instructions; it does not replace their decisions.

## Find the owner

| Area                          | Purpose                                                           |
| ----------------------------- | ----------------------------------------------------------------- |
| `apps/web`                    | Next.js UI; features and their colocated tests                    |
| `apps/api`                    | NestJS/tRPC API, workers and external-service adapters            |
| `packages/shared`             | Shared Zod schemas, types and contracts                           |
| `packages/report-persistence` | Server-only Prisma mapping and snapshots                          |
| `packages/ui`                 | Shared UI components and design tokens                            |
| `packages/migrator-runtime`   | Prisma CLI dependencies for the migration image                   |
| `prisma`                      | Schema, migrations, seeds, destructive guards and operations      |
| `e2e`                         | Browser setup and complete product journeys                       |
| `scripts`                     | Development automation and repository/build gates                 |
| `deploy`                      | Local/tester infrastructure, Helm and observability configuration |
| `docs`, `openspec/specs`      | Current product guides/ADRs; requirements and scenarios           |

Use CodeGraph first when the project is indexed. Reuse existing owners and public
contracts; keep tests beside their owner. Read `docs/exemplary-code-standard.md`.
UI copy in `apps/web/src/**/*.tsx` is English. Required runtime configuration
fails closed; no silent defaults, new lint exemptions or compatibility layers.
Comments explain current rationale; use `TODO(<ref>): note` for tracked work.

## Work and ownership

This checkout is an actively developed local MVP. Within the requested task,
proceed with diagnostics, tests, browser checks and recoverable changes to known
synthetic records. Localhost alone does not prove a disposable target. Inspect
handlers before unclear controls, record lifecycle pre-state, and disclose any
unexpected state change; recover only when recovery is known and authorized.

- Backlog holds task state and execution plans; OpenSpec holds requirements and
  changes. Cross-link them. Read the applicable Backlog CLI phase instructions.
  Put reusable research in Backlog Documents and substantial decisions in ADRs.
- Audit-only work stays read-only. Non-trivial behavior changes start with an
  OpenSpec change. Use the installed skill for the phase; do not copy its workflow
  into this file. Keep only current product documentation in `docs/`.
- Work in your own branch/worktree under `.worktrees/`. Preserve other sessions'
  files, processes and resources. Keep review evidence in the owner's durable
  handoff directory, outside the product tree. Commit or hand off unique work.
- Use normal lefthook hooks and Conventional Commits; never bypass hooks or alter
  their skip conditions to make a check pass. Hooks do not replace acceptance.
- After OpenSpec archival, preserve evidence outside the repository and remove
  only your archived change artifacts. Coordinate other archive contents.

## Commands and runtime

Use pnpm. Read `.nvmrc`, `package.json` and workspace manifests for runtime and
package pins; do not duplicate version numbers in instructions. Local dependency
commands are `pnpm deps:up` / `pnpm deps:down` in OrbStack namespace `wr-dev`.
Web uses port 3000; API port 3002. Dev authentication is forbidden in production.

## Database safety

- The owner grants standing authority for task-required operations on exact,
  guard-approved synthetic targets, including schema/history repair, reset,
  drop/recreate and reseed. No per-run approval is needed. This authority excludes
  production, shared/unknown targets, unprovisioned lanes and read-only audits.
  It also covers task-required cleanup of Redis DB15, restart of local repository
  processes/resources and removal of generated runtime/build/cache state. Verify
  the target and coordinate other sessions before every destructive operation.
- Current disposable targets are `customreport_e2e` and provisioned lanes
  `customreport_e2e_lane_a_test` / `customreport_e2e_lane_b_test`. A broader guard
  pattern does not authorize more lanes. Dev/test/E2E share the main target.
- Before every destructive operation, resolve and print the credential-masked
  target, prove loopback and exact eligibility, and require
  `prisma/guards/_destructive-guard.ts`. Set
  `PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION='давай'` for that command.
- Before each database-backed test/E2E phase, use guarded reset and explicit seed
  on the same target. Prisma7 reset does not auto-seed. Coordinate shared users.
- Redis must use an explicit DB: product/dev0, main E2E15, provisioned lanes a/b1/2. Derive
  cleanup DB from the guarded target; never flush0,13 or14.
- Browser source-start: `REDIS_DB=15 pnpm exec turbo run dev --env-mode=loose`.
  Plain `pnpm dev` drops that variable under Turbo's strict mode. Verify the
  actual clients' DB and served source; readiness only proves connectivity.
- Canonical init may be re-baselined before production exists, with its contract
  test preserved. After first production deployment use forward-only migrations.

## Preserve product invariants

- Update periodState and the report lifecycle tuple atomically.
- tRPC routes use the seven canonical middleware builders, including reference-
  identical leadProcedure; do not construct custom authorization chains.
- Rollover creates at most one active W+1 item per stableId. Explicit Next wins;
  unfinished Current continues otherwise. Previous stays read-only.

Read and link the owning OpenSpec scenario for each write-path change. Only the
Report lifecycle tuple has the corresponding database check constraint.

## Files leaving the repository

Read [docs/artifacts.md](docs/artifacts.md) for producers, consumers, storage,
retention and checks. Source tests and automation with live consumers stay in
Git; raw campaign/session output stays in the external evidence archive.

Keep local worktrees/stores, build output, coverage, logs, secrets and generated
reports out of Git and application image contexts. Use `.gitignore` and
`.dockerignore`; preserve inputs required by the Dockerfiles and production gates.
Workspace packages are private. Versions, commands and output paths have owners
in manifests, `turbo.json`, Dockerfiles and `.gitlab-ci.yml`.

Distinguish three outputs: expiring GitLab evidence artifacts, SHA-tagged container
images, and API-owned report files. The Helm chart manages deployment configuration;
an image or a successful build does not prove production acceptance.

PDF exports use a published report snapshot, durable job/generation and requester-
authorized download. `PDF_OUTPUT_DIR` owns filesystem placement; the production
Helm chart mounts `/app/data/pdfs`. Preserve canonical generation paths, atomic
publication, temporary-file cleanup and access checks. Completed-PDF retention
has no owner in the traced source; do not infer it from database-backup retention
or silently add deletion. Document any new export contract in OpenSpec first.

## Verify and deliver

For application, build, dependency or runtime configuration changes, run all six
commands on the reviewed tree:

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm spec:check
```

For prose/instructions only, check changed-file formatting, referenced paths and
commands, and `git diff --check`; validate OpenSpec if its files change. Follow
`docs/exemplary-code-standard.md#verification`. Run additional coverage, guarded
API integration and full E2E when the affected contract requires them. Root unit
tests do not prove database integration. Generate stale Prisma client with
`pnpm --filter @customreport/api db:generate` before relevant checks.

## Browser verification

Before UI edits, list pages and read annotations through onui-local at standard
detail. Resolve an annotation only after its requirement maps to changed sources,
a check and browser evidence. Browser acceptance uses agent-browser (Vercel):

```bash
export AGENT_BROWSER_SESSION="$(agent-browser session id --scope worktree --prefix "task-$(date +%s)-$$")"
agent-browser skills get core
```

Create the session before the task's first browser command and reuse it. Verify
observable DOM/network/screenshot outcomes and inspect whole screenshots. A
visible defect, failed or unknown result is not PASS.

GitLab is the only remote. Follow the current task's CI decision; skipped or
cancelled CI is not GREEN. Tie local checks, independent review, MR delivery and
remote CI to their actual SHA and keep those evidence layers distinct. Report
what changed, what passed, what remains and the next action in Backlog. Stop only
your processes and remove only delivered task-owned worktrees/resources; retain
evidence and other sessions' work.
