# docs/

Curated product documentation only. Temporary review data and run artifacts do
not belong in this directory.

| Path                         | What it is                                                                                        |
| ---------------------------- | ------------------------------------------------------------------------------------------------- |
| `adr/`                       | Current accepted architectural and product decisions.                                             |
| `exemplary-code-standard.md` | Current code-quality and maintainability standard.                                                |
| `onboarding.md`              | New-contributor guide: setup, development, testing, workflows.                                    |
| `environment.md`             | Environment precedence, ownership, and safe contracts for dev, tests, Docker, production, and CI. |
| `gitlab-ci.md`               | GitLab CI lint/test lanes: job map, in-job loopback database topology, and limits.                |
| `ci-runner.md`               | Legacy self-hosted GitHub Actions runner: setup, boundaries, operation, and recovery.             |
| `operations.md`              | Production runbook: first deploy, health triage, backups and restore, secret rotation, rollback.  |
| `sdlc.md`                    | Lifecycle control map and fail-closed prerequisites for the first production point.               |
| `llm-report/`                | Current Report Assistant flow, component boundaries, and load-bearing invariants.                 |
| `coming-soon.md`             | Canonical register of intentionally deferred product work awaiting direct owner instruction.      |

Product tests are colocated with the code they verify. The disposable-database
boundary remains documented in `AGENTS.md` and `docs/onboarding.md`.
