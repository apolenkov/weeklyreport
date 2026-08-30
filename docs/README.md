# docs/

Curated product documentation only. Temporary review data and run artifacts do
not belong in this directory.

| Path                         | What it is                                                                                        |
| ---------------------------- | ------------------------------------------------------------------------------------------------- |
| `adr/`                       | Current accepted architectural and product decisions.                                             |
| `exemplary-code-standard.md` | Current code-quality and maintainability standard.                                                |
| `onboarding.md`              | New-contributor guide: setup, development, testing, workflows.                                    |
| `environment.md`             | Environment precedence, ownership, and safe contracts for dev, tests, Docker, production, and CI. |
| `operations.md`              | Production runbook: first deploy, health triage, backups and restore, secret rotation, rollback.  |
| `sdlc.md`                    | Lifecycle control map and fail-closed prerequisites for the first production point.               |

Product tests are colocated with the code they verify. The disposable-database
boundary remains documented in `AGENTS.md` and `docs/onboarding.md`.
