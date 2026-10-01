## Why

Owner decision 2026-10-01 (backlog decision-092): production runs on the
corporate Kubernetes cluster owned by DevOps, delivered as a Helm chart that
lives in this repository. Today the only production artifact is
`docker-compose.prod.yml`, and the 2026-09-28 CI decision forbids image builds,
so no immutable image exists for a cluster to pull
(`docs/operations.md` "Rollback" and "External first-production prerequisites"
name this as BLOCKED).

## What Changes

- Add `deploy/helm/weeklyreport/`: a Helm chart mapping all ten compose
  services to Kubernetes objects (design.md section 1), with
  `values.schema.json` as the fail-closed replacement for `${VAR:?}`.
- Keep Caddy as an in-cluster edge behind the cluster Ingress so the tested
  route table and security-header contract have one source. Move the Caddyfile
  into the chart and mount it from there in compose too.
- Run `prisma migrate deploy` as an api initContainer (not a Helm hook).
- Turn the backup loop into a CronJob by giving `backup-loop.sh` a one-shot mode.
- Point Gotenberg at the internal `web` Service origin; no hairpin through the
  public edge.
- GitLab CI: add a gated image-build job (rootless BuildKit, no Docker-in-Docker)
  that pushes to a registry named by CI variables, and an optional manual
  `helm upgrade --install` job gated on a DevOps-supplied `KUBECONFIG` variable.
  This reverses the 2026-09-28 "no image builds" decision for image builds
  only; Docker-in-Docker and operational smoke stay forbidden.
- Add chart gates (lint, template, kubeconform, compose parity) to `quality`.
- Keep `docker-compose.prod.yml` and its gate unchanged in behavior.

## Capabilities

### New

- `deploy-kubernetes-chart`: chart topology, configuration, secrets, edge,
  renderer, persistence, probes, images, and verification contract.

### Modified

- `ci-merge-gate`: CI may build and push images and offer a gated manual deploy.
- `deploy-caddy-config`: the Caddyfile lives in the chart; the client address is
  resolved through a trusted-proxy list.

Specs that name compose (`web-api-url-config`, `pdf-renderer-service`,
`deploy-config-integrity`, `prod-security-hardening`) stay true for compose and
are not contradicted; the chart's equivalent rules live in
`deploy-kubernetes-chart`.

## Impact

- New: `deploy/helm/weeklyreport/**`, `docs/kubernetes.md`.
- Moved: `deploy/caddy/Caddyfile` to `deploy/helm/weeklyreport/files/Caddyfile`.
- Changed: `deploy/postgres/backup-loop.sh` (+test), `.gitlab-ci.yml`,
  `scripts/gates/operations/*.test.ts`, `.prettierignore`, `.dockerignore`,
  `docs/{operations,gitlab-ci,README}.md`, `docker-compose.prod.yml` (mount path only).
- No application source change. If the Caddyfile edit in design.md section 1
  proves insufficient for client-IP handling, that is a Task 2 finding, not a
  silent scope increase.
- Out of scope: HA PostgreSQL, Argo CD, SBOM/provenance signing, off-cluster
  backup replication, multi-environment image tagging, deleting compose.
