# Tasks — Driver Environment-Feedback Stage (DRAFT)

Status: captured 2026-06-11, NOT started. Channel facts verified against
`docker-compose.observability.yml`, `docker-compose.errors.yml`,
`apps/api/src/infrastructure/otel/otel.bootstrap.ts`,
`e2e/sweep/driver/README.md`, and memory `driver-env-feedback-idea`.
Re-verify before implementing — wiring may have moved.

## 1. Drive timeline

- [ ] 1.1 Extend `e2e/sweep/driver/drive-prompt.md` return JSON with a
      `timeline` block: run `startedAt`/`endedAt` plus per-route
      `enteredAt`/`leftAt` (ISO 8601, browser clock is fine — all channels
      share the host clock).
- [ ] 1.2 Require the per-role report
      (`e2e/sweep/.reports/<role>-driver.md`) to persist the timeline before
      the agent returns, so a crashed drive still leaves a correlatable
      window.

## 2. Channel wiring fixes (prerequisite for signal)

- [ ] 2.1 Web→Bugsink: add `NEXT_PUBLIC_SENTRY_DSN` to the sweep web start
      command in `e2e/sweep/driver/README.md`; verify a forced
      error-boundary render during a manual run actually lands in Bugsink
      (`http://localhost:8000`, project DSN from `.env`).
- [ ] 2.2 API→Loki: document that a native (non-Docker) sweep API needs
      `OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318` (the
      `.env.example` default `http://otel-lgtm:4318` only resolves inside
      Compose); decide whether the README start command sets it or the
      collector degrades gracefully when Loki has no streams.
- [ ] 2.3 Confirm the driver API log path: README starts the API with
      `LOG_DIR=.logs/driver`, so the collector must read
      `apps/api/.logs/driver/app.log`, not the `pnpm logs` default
      `apps/api/.logs/app.log`. Verify rotation prefix handling
      (`app.log.*`).

## 3. Collector (bundled with the skill, like verify.workflow.mjs)

- [ ] 3.1 Create `.claude/skills/ai-ui-driver/scripts/collect-env-feedback.mjs`
      taking `{ role, timeline }`; named consts for ports, paths, and query
      limits — no magic numbers.
- [ ] 3.2 Browser-console channel: read `.playwright-mcp/console-*.log`,
      filter to the run window (files accumulate across sessions); the
      injected `DRIVER_CANARY_42` doubles as this channel's liveness proof.
- [ ] 3.3 API-log channel: filter
      `apps/api/.logs/driver/app.log` to the window by the JSON `time`
      field and `"level":"(error|warn)"` — never bare-grep `error` (SQL
      column names in debug query lines false-positive).
- [ ] 3.4 Bugsink channel: list events created in the window (UI/API at
      `http://localhost:8000`, single-user mode); record the access method
      that actually works (HTTP API vs `bugsink-manage`) in the script
      comments.
- [ ] 3.5 Loki channel: query via the Grafana datasource proxy
      (`http://localhost:3003/api/datasources/proxy/uid/loki/loki/api/v1/query_range`)
      for the window; `--noproxy '*'` on all curl/fetch calls (loopback
      proxy 502 hazard).
- [ ] 3.6 Per-channel liveness: each channel reports
      `reachable` / `hasStreams` / `blind`; an empty result from a blind
      channel is flagged, not reported as clean (Monitor "silence is not
      success").

## 4. Skill + report integration

- [ ] 4.1 Add the stage to `.claude/skills/ai-ui-driver/SKILL.md` as
      "Phase 2.5 — Environment feedback" (after free exploration, before
      verify); update the phase diagram and guardrails (channel-canary
      rule).
- [ ] 4.2 Correlate hits to routes via the timeline and append an
      "Environment feedback" section to the per-role report: channel,
      timestamp, matched route, excerpt.
- [ ] 4.3 Feed correlated hits into Phase 3 as candidates with
      `kind: "env"` and no `intentId` (oracle-free, like Phase 2 crashes);
      Phase 4 packages confirmed ones as fix tasks.
- [ ] 4.4 Mirror the stage in `e2e/sweep/driver/README.md` so the skill and
      the README do not drift (skill rule: read, do not duplicate).

## 5. Validation

- [ ] 5.1 Dry run on one role (viewer is cheapest): healthy env, drive,
      collect; confirm all four channels report liveness and the canary
      appears in the console channel.
- [ ] 5.2 Negative test: stop Bugsink, re-collect, confirm the channel is
      reported "blind" rather than "clean".
- [ ] 5.3 Gates: `openspec validate driver-env-feedback-stage --strict`;
      repo gates untouched by this change (`pnpm typecheck && pnpm lint`)
      stay green.
