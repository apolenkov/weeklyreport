# Sources and artifacts

Use this map to find a file's producer, consumer and cleanup authority.
Directories with live source consumers stay in Git. Generated outputs, secrets,
local working copies and run evidence are separate from product source.
The executable policies are `.gitignore`, `.dockerignore`, `.prettierignore`
and `scripts/gates/repository-cleanliness.ts`.

## Source ownership

| Area                          | Owner and consumer                                                      |
| ----------------------------- | ----------------------------------------------------------------------- |
| `apps/web`                    | Next.js UI and colocated tests; web build and browser acceptance        |
| `apps/api`                    | NestJS/tRPC modules, workers, adapters and colocated tests; API build   |
| `packages/shared`             | Browser-safe Zod schemas/types and cross-application contracts          |
| `packages/ui`                 | Shared UI primitives and design tokens                                  |
| `packages/report-persistence` | Server-only Prisma mapping and published snapshot assembly              |
| `packages/migrator-runtime`   | Manifest-only Prisma CLI dependencies for the minimal migration image   |
| `prisma`                      | Schema, guarded operations, canonical migrations and seed profiles      |
| `deploy`                      | Local infrastructure/tester kit, Helm, monitoring and backup operations |
| `scripts`                     | Existing gates, development automation and analysis consumers           |
| `e2e`                         | Product acceptance source and reusable browser/database setup           |
| `eslint-config`               | Policy helpers consumed by root `eslint.config.ts`                      |
| `assets/readme`               | SVGs consumed by the root README                                        |
| `docs`                        | Current guides and accepted ADRs; raw run material stays external       |
| `openspec`                    | Normative requirements, active changes and generator context            |
| `.gitlab`, `.gitlab-ci.yml`   | Accountable code ownership and pipeline orchestration                   |
| Root manifests/config/docs    | Tool discovery and developer entrypoints; keep their current paths      |

Versions and commands belong to manifests, `.nvmrc`, `turbo.json`, Dockerfiles
and CI declarations. Workspace packages are private; their source exports serve
the monorepo rather than a public package-release workflow.

## Local state and delivery

| Class                   | Producer and placement                                                                                       | Git / image context                                                 | Cleanup authority                                                        |
| ----------------------- | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Working copies          | Agents and developers; root `.worktrees/` or `.claude/worktrees/`                                            | Local only                                                          | Their owner after delivery or a durable handoff; preserve other sessions |
| Dependencies/cache      | pnpm and build tools; `node_modules/`, root `.pnpm-store/`, `.turbo/`                                        | Local only; images install their own dependencies                   | Owning task after resource coordination                                  |
| Build output            | Next.js `.next/`, `.next-docker-dev/`, `.next-lane_*/`; package `dist/`, `*.tsbuildinfo`                     | Generated, not source; Docker stages explicitly copy final payloads | Owning build/dev process                                                 |
| Logs                    | Application/tool `.logs/`                                                                                    | Local only                                                          | Owning process/task, preserving needed diagnostics                       |
| Coverage and CI reports | Vitest; `coverage/`, root `ci-reports/` (legacy)                                                             | Not source or application inputs                                    | Owning local check                                                       |
| Agent/browser state     | Declared `.codegraph`, `.kilo`, `.superpowers`, `.opencode`, `.playwright-*`, `.devin*`, `.pi` runtime paths | No application image payload                                        | Owning harness/session; no uncoordinated deletion                        |
| OpenSpec adapters       | Regenerated `.agents`/`.claude` OpenSpec skills and commands (Pi and Devin read `.agents`)                   | Local adapters, excluded from image context                         | `openspec init` lifecycle; keep project configuration visible            |
| Export storage          | API `PDF_OUTPUT_DIR`; local `apps/api/storage/` when configured there, production `/app/data/pdfs`           | Never Git or a build input                                          | Temporary attempts: worker; completed PDFs: unresolved below             |
| Run evidence            | Task's external durable handoff; local root `output/` for permitted tool output                              | Not source or application payload                                   | Task owner after preservation; keep proofs for continuation              |

`.pi/settings.json` and `.pi/agents/` remain committable project configuration;
only declared runtime/adapters are ignored in Git. The application Docker context
excludes `.pi` entirely because it is not a build input. Unknown ignored files,
hand-made ignored tool installations and unexplained residue still fail the
existing cleanliness gate. Allowed local paths do not authorize force-adding
generated output or reserved worktree/store/log/CI/export paths to Git.

The API image uses Turbo pruning, production `pnpm deploy` and the existing
production-dist/dependency gates. Its runner receives compiled API and production
dependencies; the migrator is separate. The web runner receives Next standalone
and static output. `.dockerignore` preserves the single production-prune CLI
fixture used during the API image build while excluding other test/harness data.
Helm is consumed by deployment CI from checkout, not by the application image.
Do not exclude a needed manifest, source file or build-time fixture to reduce
context size. See `Dockerfile.api`, `Dockerfile.web` and `turbo.json`.

## GitLab outputs

| Output                                     | Declared consumer/storage                               | Declared retention                     |
| ------------------------------------------ | ------------------------------------------------------- | -------------------------------------- |
| `image-digests.txt`                        | Build-images evidence for API/migrate/web/backup images | 30 days                                |
| Container images tagged by `CI_COMMIT_SHA` | GitLab registry, then manual Helm deployment            | External registry policy is unverified |

These declarations in `.gitlab-ci.yml` are not evidence of a successful pipeline
or deployment. A GREEN CI claim requires the pipeline's exact tested SHA.
Follow the task's current decision about intermediate CI; one final corporate
CI remains required for the full completion program. The local operator-triggered Renovate
command is documented in `docs/gitlab-ci.md`; token provisioning and actual
activation remain unverified.

## Product report exports

The current export pipeline produces PDF from a published report snapshot.
It uses the canonical published content and existing service/render contracts;
repository organization does not change fields, visibility or authorization.

```text
published snapshot -> durable job/generation -> BullMQ worker/Gotenberg
                   -> atomic generation artifact -> authorized download
```

Owners are `modules/pdf-export` in the API, `pdf-export.processor.ts` and
`pdf-export.artifact-store.ts` under `infrastructure/bullmq`, and the web
`features/pdf-export` flow. The service stores the published snapshot and queues job identifiers; the worker
obtains its short-lived render token at execution.

`PDF_OUTPUT_DIR` is required and nonblank. Relative values resolve from the API
working directory. The API image creates `/app/data/pdfs`; the production Helm
chart mounts a PVC there. Its production example declares 5 GiB, one API replica
and `Recreate`. A plain container needs operator mounts for persistent storage.
These are declared source/config facts, not a check of a deployed volume.

A temporary attempt is created exclusively with mode0600. The artifact store
publishes the canonical generation file atomically and hashes it; the worker
cleans its temporary attempt on success or failure. The physical name is
`{jobId}-g{generation}.pdf`, while the public route is `/pdfs/{jobId}.pdf` through
the same-origin web rewrite. The download handler resolves the durable job's
artifact, rejects symlinks and authorizes the original requester. Its
`Content-Disposition: attachment` header has no explicit filename. The actual
browser-selected save filename has not been verified.

No completed-PDF deletion/retention owner was found in this traced path.
Database backup retention (14 days in the production example) is a separate
policy. External cleanup, registry retention, actual PVC usage/recovery and
browser filename behavior remain unverified. A new PDF TTL or deletion process
requires a separate product decision and OpenSpec change; this guide adds none.

## Verify the boundary

Use the existing real-Git `repository-cleanliness.test.ts` owner for allowed
local state, unknown residue and force-added output. Docker/build consumers are
covered by existing operations/image contracts and actual build acceptance.
The export store, worker and download owners have their own colocated tests;
root unit tests are not database/browser/deployment acceptance.

Follow [the code standard](./exemplary-code-standard.md#verification),
[AGENTS.md](../AGENTS.md#database-safety) for exact disposable targets, and
[the browser rules](../AGENTS.md#browser-verification) for observable acceptance.
Keep commands, exit codes, source SHA and independent review separate from
inventory declarations. Retain raw evidence outside this curated guide.
