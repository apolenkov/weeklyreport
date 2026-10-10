# docs/

Curated product documentation only. Temporary review data and run artifacts do
not belong in this directory.

| Path                         | What it is                                                                                             |
| ---------------------------- | ------------------------------------------------------------------------------------------------------ |
| `artifacts.md`               | Source/local-state ownership, Git and Docker admission, CI evidence, image and report-export storage.  |
| `adr/`                       | Current accepted architectural and product decisions; `adr/README.md` holds the ADR template.          |
| `exemplary-code-standard.md` | Current code-quality and maintainability standard.                                                     |
| `onboarding.md`              | New-contributor guide: setup, development, testing, workflows.                                         |
| `environment.md`             | Environment precedence and safe contracts for dev, tests, local dependencies, production Helm, and CI. |
| `gitlab-ci.md`               | GitLab CI lint/test lanes and the gated image build and deploy jobs: job map, database topology.       |
| `kubernetes.md`              | Kubernetes delivery: Helm chart install, upgrade, secrets, rollback limits, backup, recovery.          |
| `operations.md`              | Production runbook: first deploy, health triage, backups and restore, secret rotation, rollback.       |
| `sdlc.md`                    | Lifecycle control map and fail-closed prerequisites for the first production point.                    |
| `llm-report/`                | Current Report Assistant flow, component boundaries, and load-bearing invariants.                      |
| `coming-soon.md`             | Canonical register of intentionally deferred product work awaiting direct owner instruction.           |

Product tests are colocated with the code they verify. The disposable-database
boundary remains documented in `AGENTS.md` and `docs/onboarding.md`.
