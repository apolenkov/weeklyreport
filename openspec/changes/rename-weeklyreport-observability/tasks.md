# Tasks: rename-weeklyreport-observability

## 1. API metrics + OTEL/logging

- [ ] 1.1 Rename 26 `customreport_*` series to `weeklyreport_*` in
      `apps/api/src/infrastructure/metrics/{ai-prompt,ai-provider,metrics.registry,report-assistant}.metrics.ts`;
      remove the `customreport_*` retention comment; update owned unit tests
      (`ai-prompt.metrics.test.ts`, `ai-provider.metrics.test.ts`).
- [ ] 1.2 Rename service/tracer identities to `weeklyreport-api` /
      `weeklyreport-bullmq` in `nest-app.ts`, `worker-observability.ts`,
      `config.module.ts`, `trpc-metrics.middleware.ts`, `otel.bootstrap.ts`,
      `logger.ts`; update `logger.test.ts` org fixture to WeeklyReport.

## 2. Helm observability

- [ ] 2.1 Update `alert-rules.yml`, `product-telemetry-dashboard.json`,
      `trpc-latency-dashboard.json`, `customreport-dashboard.json` queries/titles/
      tags/uids to `weeklyreport`; rename files to `weeklyreport-dashboard.json`
      and `provisioning/dashboards/weeklyreport.yml` with provisioning paths.

## 3. Deploy/config/storage/docs/specs

- [ ] 3.1 Update `templates/{api,backup,pgbouncer,postgres}.yaml` (DB user
      `weeklyreport`, `OTEL_SERVICE_NAME`), `values-*.example.yaml`,
      `deploy/local-dev/deps.yaml`, `provision-users.sql`, `realm.template.json`,
      `backup-{health,loop}.sh`, `init-pg-stat-statements.sql`,
      `docs/{kubernetes,operations}.md`, `openspec/specs/*/spec.md`.
- [ ] 3.2 Verify: `pnpm --filter @weeklyreport/api exec vitest run
src/infrastructure/metrics src/infrastructure/otel src/lib`;
      `helm lint deploy/helm/weeklyreport`; `helm template` for both example
      values with `grep -ci customreport` → 0 (except E2); `jq .` each Grafana
      JSON; `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test`
      (unit scope), `pnpm build` (with `API_URL=http://127.0.0.1:3002`),
      `pnpm spec:check`.
