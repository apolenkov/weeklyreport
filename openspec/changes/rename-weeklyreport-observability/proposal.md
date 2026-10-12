# Proposal: rename-weeklyreport-observability

## Why

After the `@weeklyreport/*` scope rename (wave 0), observability still emits
`customreport_*` series, `customreport-api/bullmq` service names, and
`customreport` dashboard/alert/backup literals. Operators see one product name
in code and another in Grafana/alerts/dumps. This change renames the
supported metric names, dashboards/alerts, tracing/logging identities,
Helm/env/config, and storage/backup paths to `weeklyreport` with no
compatibility aliases or dual publication.

Inventories: `apps/api/src/infrastructure/metrics/*` (26 `customreport_*`
series), `apps/api/src/infrastructure/otel/*`, `apps/api/src/lib/logger*`,
`apps/api/src/bootstrap/nest-app.ts`,
`apps/api/src/infrastructure/bullmq/worker-observability.ts`,
`apps/api/src/infrastructure/config/config.module.ts`,
`deploy/helm/weeklyreport/observability/**`,
`deploy/helm/weeklyreport/templates/{api,backup,pgbouncer,postgres}.yaml`,
`deploy/helm/weeklyreport/values-*.example.yaml`, `deploy/local-dev/deps.yaml`,
`deploy/local-prod/{provision-users.sql,realm.template.json}`,
`deploy/postgres/{backup-health,backup-loop}.sh`,
`deploy/postgres/init-pg-stat-statements.sql`, `docs/{kubernetes,operations}.md`,
`openspec/specs/{deploy-kubernetes-chart,manual-publish-telemetry}/spec.md`.
Basis: decision-161 (MVP without compatibility), doc-455 §5/§7.

## What Changes

- Prometheus series `customreport_*` → `weeklyreport_*` (no dual publish,
  no recording-rule aliases); dashboards/alerts query the new names.
- OTEL/tracing/logging identity `customreport-api`/`customreport-bullmq` →
  `weeklyreport-api`/`weeklyreport-bullmq`.
- Grafana files `customreport-dashboard.json` → `weeklyreport-dashboard.json`,
  `customreport.yml` → `weeklyreport.yml`; provisioning paths/titles/tags/uids
  follow.
- Helm env/config, DB role `weeklyreport`, template DB literals
  (`weeklyreport_production` in examples, `weeklyreport_e2e` in local-dev),
  realm/seed mails `*@weeklyreport.local`, backup dumps
  `weeklyreport-*.dump`, docs/runbooks follow.
- Specs pin the new dump pattern and the new publish-counter series names.

## Non-goals

- Server-side live rollout or touching live servers/data (E2); examples and
  templates only.
- Deleting/renaming the live shared PG role `customreport` (E6); the new
  role is created alongside.
- Reissuing SAML keys/certs (E7); only CN/text fixtures already owned by 02.
- Renaming the AI-key crypto domain or ADR 0020 (E1).
- Adding a monitoring stack, alert receivers, or off-cluster backup.
