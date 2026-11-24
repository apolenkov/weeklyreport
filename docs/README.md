# docs/

Curated product documentation only. Temporary review data and run artifacts do
not belong in this directory.

| Path                         | What it is                                                                                                                  |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `artifacts.md`               | Source/local-state ownership, Git and Docker admission, CI evidence, image and report-export storage.                       |
| [`images/`](images/)         | Architecture and quality-gate diagrams with SVG sources, plus CLI captures embedded in the [README](../README.md).          |
| [`adr/`](adr/README.md)      | Architecture and product decisions, including [GitHub checks](adr/0026-github-actions-checks-coverage-and-supply-chain.md). |
| `exemplary-code-standard.md` | Current code-quality and maintainability standard.                                                                          |
| `onboarding.md`              | New-contributor guide: setup, development, testing, workflows.                                                              |
| `quick-start.md`             | Local setup steps, dev login, main commands and delivery gates.                                                             |
| `environment.md`             | Environment precedence and safe contracts for dev, tests, local dependencies, production Helm, and CI.                      |
| `gitlab-ci.md`               | Optional GitLab deployment and local image build.                                                                           |
| `kubernetes.md`              | Kubernetes delivery: Helm chart install, upgrade, secrets, rollback limits, backup, recovery.                               |
| `operations.md`              | Production runbook: first deploy, health triage, backups and restore, secret rotation, rollback.                            |
| `sdlc.md`                    | Lifecycle control map and fail-closed prerequisites for the first production point.                                         |
| `llm-report/`                | Current Report Assistant flow, component boundaries, and load-bearing invariants.                                           |
| `coming-soon.md`             | Canonical register of intentionally deferred product work awaiting direct owner instruction.                                |

Product tests are colocated with the code they verify. The disposable-database
boundary remains documented in `AGENTS.md` and `docs/onboarding.md`.
