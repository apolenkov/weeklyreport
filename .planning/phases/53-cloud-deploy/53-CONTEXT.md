# Phase 53: Cloud Deployment (DEFERRED)

**Status:** DEFERRED indefinitely (2026-05-11 user decision)
**Driver:** «cloud и будущая интеграция» (2026-05-10 in-chat capture)
**User decision (2026-05-11):** «зачем это сейчас? on-prem + Docker Compose
(skip cloud пока)». Phase 38 (on-prem Docker Compose) is sufficient for the
foreseeable future. Re-open this phase only when org explicitly requests
cloud migration with budget + data-residency answers.
**Distinct from:** Phase 38 (infrastructure-deploy — on-prem Docker Compose).
This phase is **public-cloud deployment** for production — not needed now.

## Scope (idea-level)

- Pick the cloud target (Yandex Cloud / Selectel / VK Cloud / AWS / GCP /
  bare-metal Hetzner). Russian-resident data may force YC or Selectel
  given current jurisdiction.
- Provision via Terraform / Pulumi:
  - Managed Postgres 15
  - Managed Redis 7
  - Container Registry
  - Kubernetes cluster (or managed equivalent — VK Cloud has managed k8s,
    YC has Managed Kubernetes)
- CI/CD: extend the GitHub Actions workflow from Phase 47-02 to push
  images to the registry on tag, then trigger a deploy via ArgoCD /
  Flux / kubectl.
- Secrets management: Hashicorp Vault or cloud-native (KMS).
- Observability: ship Prometheus/Grafana to managed equivalent
  (Grafana Cloud, Yandex Monitoring).
- Disaster recovery: nightly Postgres backups + offsite copy.
- SAML/Keycloak: dedicated Keycloak instance for the org (or use
  cloud SSO).

## Likely shape

| Plan | Scope                                         |
| ---- | --------------------------------------------- |
| 53-A | Cloud target decision + Terraform skeleton    |
| 53-B | Helm charts for api / web / scheduler         |
| 53-C | CI/CD pipeline (image build, push, deploy)    |
| 53-D | Secrets + Vault integration                   |
| 53-E | Observability shipping (Prometheus → managed) |
| 53-F | Backup + DR runbook                           |

## Dependencies

- Phase 47 (CI baseline) ✓ already landed
- Org decision on cloud target + data residency requirements

## Open questions for /gsd-discuss-phase

- Cloud target (data residency)
- Budget per month (RUB)
- Compliance requirements (152-FZ если в РФ)
- Single-region or multi-region from day one
- Manual deploy vs full GitOps (ArgoCD)
