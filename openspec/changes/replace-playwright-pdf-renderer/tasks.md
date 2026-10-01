# Tasks

Sequencing constraints: one owner holds the shared Nest/env wiring and the
`pnpm-lock.yaml` regeneration (serialized step); tasks land in order; later
parallel work only touches disjoint files. Every implementation task is TDD:
write or update the colocated test first, then the code.

## 1. Renderer adapter and configuration (apps/api)

- [x] 1.1 Add `GOTENBERG_URL` to `apps/api` `envSchema` as required `z.url()`
      fail-closed (no default; syntactic validation only — no DNS or
      reachability check, so host-source `pnpm dev` keeps booting on an
      unreachable but syntactically valid URL per D8). Wire every actual
      environment and typed fixture that supplies API config: the `COMPLETE`
      fixture and the required-keys `it.each` list in
      `apps/api/src/infrastructure/config/env.schema.test.ts`; a
      `GOTENBERG_URL ??=` line in
      `apps/api/src/test-utils/test-env.setup.ts`; and
      `GOTENBERG_URL=http://gotenberg:3000` with a comment that the
      compose-internal hostname is unavailable to host-source `pnpm dev`
      and to the integration lane in `.env.example` and `.env.test.example`
      (`.env.test` feeds `vitest.integration.config.ts`, which does not load
      `test-env.setup.ts`) — verify
      `cd apps/api && pnpm exec vitest run src/infrastructure/config/env.schema.test.ts`
      passes with the new required key.
- [x] 1.2 Define the `PdfRenderer` port in
      `apps/api/src/modules/pdf-export/pdf-export.ports.ts`
      (`render(input): Promise<Buffer>`) and implement the Gotenberg adapter
      posting `multipart/form-data` to
      `POST {GOTENBERG_URL}/forms/chromium/convert/url` with `url`
      (`{PDF_BASE_URL}/print/{reportId}?jobId={jobId}`), `paperWidth=8.27`,
      `paperHeight=11.7`, `printBackground=true`, the readiness
      `waitForExpression`, the `cookies` JSON credential (`domain` =
      `PDF_BASE_URL` host), and `Gotenberg-Trace` = job identity — verify
      adapter unit tests pass asserting the serialized request fields.
- [x] 1.3 Bound the response path in the adapter: a 160 s client timeout
      covering the whole request including response-body consumption; an
      explicit initial maximum body size of 64 MiB enforced while streaming
      the body — cancel and release the stream on overflow, following the
      existing bounded-reader shape in
      `apps/api/src/modules/search/infrastructure/openai-compatible.response-body.ts`;
      and deterministic minimum PDF validation — non-empty body, `%PDF-`
      header, `%%EOF` marker after trailing whitespace — before bytes reach
      the artifact store. The 64 MiB figure is an explicit initial safety
      bound, not measured capacity evidence — verify unit tests cover
      timeout during body read, over-limit body, invalid PDF bytes, and a
      valid PDF body.
- [x] 1.4 Map renderer outcomes to job errors: direct `403` and locally
      proven request-construction failures become `UnrecoverableError`; `400`,
      `409`, `503`, transport failures, client-side timeout, and a `200` with
      an invalid body become retryable failures — verify unit tests pin each
      classification and assert nothing else is terminal.

## 2. Worker render path (apps/api)

- [x] 2.1 Rewrite `buildAuthCookies` in `pdf-export.service.ts` to the
      Gotenberg cookie shape (`{name, value, domain, path, httpOnly, sameSite}`
      with `domain` = `PDF_BASE_URL` host) and reword the Playwright-specific
      comment — verify `pdf-export.service.test.ts` and
      `pdf-export.contract.test.ts` are updated to the new shape and pass.
- [x] 2.2 Replace the Playwright block in `pdf-export.processor.ts`
      (`chromium.launch`, `newContext`/`addCookies`, `page.goto`, the selector/
      font waits, `page.pdf`, `browser.close`) with a `PdfRenderer` port call,
      preserving identity gates, the fresh token mint per attempt, generation
      fencing, `timed()` step logging (renamed for the HTTP boundary), and
      `persistCompletedArtifact` — verify the rewritten
      `pdf-export.processor.test.ts` stubs the renderer at its HTTP boundary,
      launches no browser, and passes alongside
      `pdf-export.processor.artifact-race.test.ts`.
- [x] 2.3 Remove the `attemptsMade >= attempts` early return in the
      failed-event path so an `UnrecoverableError` reconciles through the
      generation-scoped queue-state read under the export-row lock — verify
      processor tests cover an unrecoverable failure terminalizing with
      attempts remaining while intermediate failures leave the row queued.

## 3. Renderer health signal (apps/api)

- [x] 3.1 Add `PdfRendererHealthIndicator` probing
      `GET {GOTENBERG_URL}/health` under `withReadinessTimeout` (~2 s) with an
      `AbortSignal` and response-resource release, register it in the health
      module, and expose `GET /health/pdf-renderer` (key `pdf_renderer`,
      200/503, no error details leaked) without touching `/health/ready` —
      verify `health.test.ts` covers up on 2xx, down on transport
      error/non-ok/timeout, no detail leak, and that readiness still aggregates
      exactly `database`, `redis`, `bullmq`, `memory_heap`.

## 4. Compose wiring and Playwright removal (ops)

- [x] 4.1 Add the `gotenberg` service to the Compose graphs: image
      `gotenberg/gotenberg:8.37.0-chromium` pinned by manifest-list digest
      `sha256:0d28ae9a96441588ef739623726bd500ad0720b77266c6f1351a13e333fbd61c`,
      no `ports:` publish, no ingress route, a healthcheck exercising the real
      `GET /health`, and env `API_TIMEOUT=150s`, `CHROMIUM_MAX_CONCURRENCY=1`,
      `CHROMIUM_CLEAR_COOKIES=true`, `CHROMIUM_CLEAR_STORAGE=true`,
      `CHROMIUM_CLEAR_CACHE=true`, `CHROMIUM_DENY_PRIVATE_IPS=true`,
      `CHROMIUM_DENY_PUBLIC_IPS=true`; the anchored allow-list is the literal
      `CHROMIUM_ALLOW_LIST=^http://web:3000/` in `docker-compose.yml` and
      `docker-compose.dev.yml`, while `docker-compose.prod.yml` requires the
      operator-set
      `CHROMIUM_ALLOW_LIST: ${CHROMIUM_ALLOW_LIST:?CHROMIUM_ALLOW_LIST must be set}`
      matching the production `PDF_BASE_URL` origin (D7), with a blank
      `CHROMIUM_ALLOW_LIST=` in `deploy/environment/production.env.example`; on
      the api service `docker-compose.yml` and `docker-compose.dev.yml` keep
      the literal `PDF_BASE_URL=http://web:3000`, while
      `docker-compose.prod.yml` keeps the required operator-set
      `PDF_BASE_URL: ${PDF_BASE_URL:?PDF_BASE_URL must be set}` — that
      operator-controlled production origin is what the rendered
      `CHROMIUM_ALLOW_LIST` must match (D7); add
      `GOTENBERG_URL=http://gotenberg:3000` to `docker-compose.yml` and
      `docker-compose.dev.yml`,
      `GOTENBERG_URL: ${GOTENBERG_URL:?GOTENBERG_URL must be set}` to
      `docker-compose.prod.yml`, `GOTENBERG_URL=` to
      `deploy/environment/production.env.example`, and `GOTENBERG_URL` plus
      `CHROMIUM_ALLOW_LIST` job-env values to the removed
      `docker-build` CI job so the production compose render keeps
      passing — verify the compose gate test suite passes with assertions on
      all effective renderer values.
- [x] 4.2 Update `prod-compose-gate.test.ts`: replace the positive
      playwright-install assertion with gotenberg service/pinning assertions
      on the effective image digest and every pinned security/config value,
      re-anchor the runner-layer ordering assertion, and keep the
      `pnpm exec playwright` negative ban as a regression guard. The gate
      asserts the dev/base effective literal `^http://web:3000/` allow-list,
      the production required `${CHROMIUM_ALLOW_LIST:?...}` interpolation, and
      the effective rendered production allow-list: the fixture supplies a
      `^`-anchored regex host-scoped to its sample `PDF_BASE_URL` with the DNS
      hostname's dots escaped (a placeholder host per existing gate
      conventions — no real domain or secret), and a regression assertion
      rejects a lookalike hostname that an unescaped pattern would match;
      `GOTENBERG_URL` and
      `CHROMIUM_ALLOW_LIST` join the gate's required policy inputs, the
      full-policy render fixture, and the `docker-build` CI job env so
      production rendering stays green, while a render missing
      `CHROMIUM_ALLOW_LIST` must fail — verify the gate suite passes.
- [x] 4.3 Remove `playwright` from `apps/api/package.json`; remove the
      `playwright install --with-deps chromium` step and both
      `PLAYWRIGHT_BROWSERS_PATH` lines from `Dockerfile.api` and reword the
      glibc/`--ignore-scripts` comments; remove `allowBuilds.playwright` from
      `pnpm-workspace.yaml`; reword stale references in `.env.example`,
      `env.schema.ts`, `Dockerfile.pdf-artifact-migrator`,
      `docs/operations.md`, and `openspec/config.yaml` — verify a repository
      search shows every remaining `playwright` match is classified as
      historical evidence, upstream optional peer metadata, agent-browser tool
      names, or deny-only rules.
- [x] 4.4 Remove the Playwright-Test-only ignore entries
      (`playwright-report`, `test-results`) from `.gitignore` and
      `.dockerignore`, keeping `.playwright-cli`/`.playwright-mcp` agent-tool
      entries and the `repository-cleanliness` deny-only artifact rules —
      verify `pnpm lint` (repository-cleanliness gate) passes.
- [x] 4.5 Regenerate `pnpm-lock.yaml`: with the manifest edits above already
      in the tree, the single wiring owner runs `pnpm install` (never
      hand-edited) in the isolated task worktree as the serialized step,
      compares the result against the pre-step lockfile and rejects
      unrelated package updates, then verifies installation with
      `pnpm install --frozen-lockfile` — no temporary commit is required to
      obtain a clean status — verify the lockfile diff removes
      `playwright`/`playwright-core` while upstream optional peer metadata
      and `electron-to-chromium` remain.

## 5. Focused tests and repository checks

- [x] 5.1 Run the focused unit suites at the candidate:
      `cd apps/api && pnpm exec vitest run` over the pdf-export processor,
      service, and contract suites plus the health and env-schema suites —
      the unit config excludes `*.integration.test.ts` — verify all pass.
- [x] 5.2 Run the API database integration lane at the candidate:
      `pnpm --filter @customreport/api test:integration`. The only permitted
      target is the existing loopback `customreport_e2e` database — lane
      targets (`customreport_e2e_lane_[a-o]_test`) are guard-permitted but
      not provisioned and MUST NOT be created for this run without a new
      owner order. Preflight before any destructive command: resolve the
      target from `.env.test`'s `E2E_DATABASE_URL` (or the command's
      explicit database URL), print it with credentials masked, prove it is
      loopback-only and names exactly `customreport_e2e` — not production,
      shared, or unknown — and require `prisma/guards/_destructive-guard.ts`
      to accept that same target. Check exclusive ownership of the shared
      database against concurrent sessions before reset/seed/test, and run
      DB-mutating phases sequentially, never in parallel.
      `prisma/operations/migrate-reset.ts` reads and guards `DATABASE_URL`,
      so pass the verified target explicitly with the per-operation consent
      on each destructive command — e.g.
      `DATABASE_URL="$E2E_DATABASE_URL" PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION='давай' pnpm exec tsx prisma/operations/migrate-reset.ts`
      followed by
      `DATABASE_URL="$E2E_DATABASE_URL" PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION='давай' pnpm --dir apps/api exec tsx ../../prisma/seeds/profiles/seed-profile.ts full`
      (Prisma 7 `migrate reset` does not auto-seed). An unrun, unsafe, or
      unavailable integration check is reported as such — never claimed as
      PASS.
- [x] 5.3 Run the full repository gates at the candidate SHA and record the
      exact commands and results:
      `pnpm format:check && pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm spec:check`
      — verify all exit 0 (`pnpm build` needs the web build's `API_URL`;
      the root `.env` supplies it locally, otherwise run
      `API_URL=http://localhost:3002 pnpm build`).

## 6. Runtime acceptance (real compose stack)

- [ ] 6.1 Execute the design "Runtime Acceptance" matrix items 1–16 against
      the real stack, running the two modes sequentially — compose
      (`pnpm dev:watch`) first, then host-source `pnpm dev` — not as sixteen
      independent environments; one real compose run may prove several items.
      Before the first browser command, establish the named session and load
      the skill:
      `export AGENT_BROWSER_SESSION="$(agent-browser session id --scope worktree --prefix task)"`
      then `agent-browser skills get core`. Write all evidence outside the
      repository under
      `~/.codex/work-artifacts/weeklyreport-continuation-20260920/gotenberg-runtime/<candidate-sha>/`
      with a manifest binding the exact candidate SHA, the effective
      config/image (pinned digest and renderer env values), the synthetic
      record IDs used, and each matrix item to its screenshot/DOM/network/PDF
      evidence — including artifact PDF SHA-256 and persisted job state —
      keeping secrets and personal data out of artifacts. Item coverage:
      `pnpm dev:watch` health state, host-source `pnpm dev` boot with the
      renderer hostname unresolvable, UI-driven export through the
      agent-browser named session, artifact checksum correctness and
      owner/non-owner download, error-page terminal failure, cookie clearing
      after success/failure/timeout/abort, localStorage and HTTP-cache
      isolation under the four pinned flags (sessionStorage, IndexedDB,
      Cache Storage API, and service-worker state are explicit exclusions —
      a fresh reachable-print-source audit MUST run on the final
      implementation candidate), two real requesters, bounded
      queue-wait/saturation observation, transient-outage retry recovery,
      mid-cycle renderer restart with health recovery, deterministic `403`
      terminality, `recovery_required` → `g+1`, bounded hung-page failure,
      the provisional-1-GiB renderer memory-cap evidence (effective Compose
      limit, actual container/cgroup limit, peak memory on the largest
      representative synthetic report at concurrency 1, OOMKilled/restarts,
      export success and duration, and host memory headroom — an OOM or
      inadequate headroom stops the run for a data-driven cap revision),
      and the expired/absent-token path — verify every item produces
      manifest-bound evidence tied to the exact candidate SHA, with
      exclusions reported rather than claimed. Status (2026-09-30), per-item results in `/Users/wrk/.local/state/session-review/weeklyreport-20260929/openspec-fix/pdf-matrix.json`: items 2, 3 (re-exported after the print CSS fix, `/Users/wrk/.local/state/session-review/weeklyreport-20260929/openspec-fix/after-export.pdf`), 5, 6, 8, 10, 12, 13, 14, 15 verified; items 4, 7, 9, 11, 16 verified in part (residual variants in TASK-145.11.05); item 1 only for the compose gotenberg service, not the full `pnpm dev:watch` stack, and no compose-first ordering or SHA-bound manifest (TASK-145.11.04). Stays unchecked.

## 7. Candidate review

- [x] 7.1 Review the exact candidate diff and references end-to-end against
      the delta specs, the removal inventory, and the pinned image/config —
      verify a written findings list covers every modified file and that every
      remaining `playwright` match is classified (historical, upstream
      metadata, agent-tool, or deny-only rule). Done 2026-09-30 by an independent
      Fable review on main 19cc7762b: no blocking findings, no leftover `playwright`
      match; the SSR print view, the env comment and a body-read timeout test were
      reconciled afterwards.
- [ ] 7.2 Run the final `astra_reviewer` review of the candidate after all
      checks pass — verify the verdict is recorded and any blocking finding is
      returned to the owning task before the change is called done. Open until
      6.1 passes on the compose stack (TASK-145.11.04/05); the reviewer is an
      independent model, not necessarily `astra_reviewer`.
