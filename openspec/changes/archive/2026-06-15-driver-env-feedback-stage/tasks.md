# Tasks — Driver Environment-Feedback Stage (DRAFT)

Status: captured 2026-06-11, NOT started. Channel facts verified against
`docker-compose.observability.yml`, `docker-compose.errors.yml`,
`apps/api/src/infrastructure/otel/otel.bootstrap.ts`,
`e2e/sweep/driver/README.md`, and memory `driver-env-feedback-idea`.
Re-verify before implementing — wiring may have moved.

## 1. Drive timeline

- [x] 1.1 Extend `e2e/sweep/driver/drive-prompt.md` return JSON with a
      `timeline` block: run `startedAt`/`endedAt` plus per-route
      `enteredAt`/`leftAt` (ISO 8601, browser clock is fine — all channels
      share the host clock).
- [x] 1.2 Require the per-role report
      (`e2e/sweep/.reports/<role>-driver.md`) to persist the timeline before
      the agent returns, so a crashed drive still leaves a correlatable
      window.

## 2. Channel wiring fixes (prerequisite for signal)

- [x] 2.1 Web→Bugsink: add `NEXT_PUBLIC_SENTRY_DSN` to the sweep web start
      command in `e2e/sweep/driver/README.md`; verify a forced
      error-boundary render during a manual run actually lands in Bugsink
      (`http://localhost:8000`, project DSN from `.env`).
      NOTE: inline env var added to the web start command in README; live
      error-boundary verification needs a manual run (needs-live-validation).
- [x] 2.2 API→Loki: documented that a native (non-Docker) sweep API needs
      `OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318` in README and
      `.env.example`. Decision: collector degrades gracefully (marks Loki
      blind) when no streams; README start command is unchanged so the
      user sets it explicitly in their shell if needed.
- [x] 2.3 Driver API log path confirmed: `apps/api/.logs/driver/app.log`
      (from `LOG_DIR=.logs/driver` in the README start command). Collector
      reads all `app.log*` files via rotation-pattern `API_LOG_ROTATION_PATTERN`.

## 3. Collector (bundled with the skill, like verify.workflow.mjs)

- [x] 3.1 Create `.claude/skills/ai-ui-driver/scripts/collect-env-feedback.mjs`
      taking `{ role, timeline }`; named consts for ports, paths, and query
      limits — no magic numbers.
- [x] 3.2 Browser-console channel: reads `.playwright-mcp/console-*.log`,
      filters to the run window via filename timestamp + elapsed_ms offset;
      `DRIVER_CANARY_42` detection proves liveness.
- [x] 3.3 API-log channel: filters by JSON `time` field and
      `"level":"error|warn"` — no bare-grep; rotation pattern covers
      `app.log`, `app.log.1`, etc.
- [x] 3.4 Bugsink channel: Sentry-compatible HTTP API (`/api/0/projects/`);
      single-user mode (no auth). `bugsink-manage` CLI is the alternative
      (requires docker exec); HTTP API works when the service is reachable.
- [x] 3.5 Loki channel: Grafana datasource proxy at
      `http://localhost:3003/api/datasources/proxy/uid/loki/...`; uses Node
      built-in `fetch` (not curl — no PATH dependency, no --noproxy needed
      since Node fetch ignores HTTP_PROXY). UID `loki` confirmed in
      `deploy/grafana/provisioning/datasources/loki.yml`.
- [x] 3.6 Per-channel liveness: `reachable` / `hasStreams` / `blind`
      implemented; empty-from-blind is flagged, not treated as clean.

## 4. Skill + report integration

- [x] 4.1 Phase 2.5 added to SKILL.md (after free exploration, before
      verify); phase diagram updated; channel-canary guardrail added.
- [x] 4.2 Hits correlated to routes via timeline in the collector;
      "Environment feedback" markdown section appended to per-role report.
- [x] 4.3 Hits fed into Phase 3 as `kind:"env"` candidates with no
      `intentId` (oracle-free path, same as Phase 2 crashes).
- [x] 4.4 Phase 2.5 mirrored in README (Phase 2.5 section added).

## 5. Validation

- [~] 5.1 Liveness dry run (no active drive — timeline used a wide synthetic
  window over 2026-06-14). Results: console=reachable (80 historical
  entries), apiLog=hasStreams (dir exists, no error/warn in window),
  bugsink=blind (running but no project configured — correct behavior),
  loki=hasStreams (Grafana reachable, no streams in window). Full canary
  test requires a real live drive. NEEDS-LIVE-VALIDATION for canary.
  To run: start sweep servers per README, drive one role, then:
  node .claude/skills/ai-ui-driver/scripts/collect-env-feedback.mjs \
  '{"role":"viewer","timeline":<json-from-drive>}'
- [~] 5.2 Bugsink blind test: Bugsink is currently blind (no project
  configured) — collector already correctly reports "blind" rather than
  "clean". Full stop+restart test NEEDS-LIVE-VALIDATION.
- [x] 5.3 Gates: `openspec validate driver-env-feedback-stage --strict` →
      "Change is valid". ESLint on the collector → no issues.
