# docs/

Curated durable documentation only. Session artifacts (handoffs, review data
dumps, run plans, pipeline scripts) do NOT live here — they go to
`~/work/customreport-archive/` (outside git, see its `INDEX.md`). The
pre-commit guard enforces this; the policy lives in `CLAUDE.md`.

| Path                                                         | What it is                                                                                              |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------- |
| `adr/`                                                       | Accepted architectural and product decisions (ADRs 0001+).                                              |
| `architecture/TARGET-STRUCTURE-2026-07-02.md`                | Canonical target architecture: domain vocabulary, placement rules, module-boundary model.               |
| `architecture/lead-report-assistant-decision-summary.md`     | Russian-language owner summary of the native Lead report assistant decisions and infrastructure impact. |
| `architecture/lead-report-assistant-prompt-contract.md`      | Versioned planner, repair, grounded-answer and citation-repair prompt contract.                         |
| `architecture/lead-report-assistant-search-plan-contract.md` | Exact strict `SearchPlan` function-calling wire shape, derived decision vocabularies and refinements.   |
| `exemplary-code-standard.md`                                 | The mandatory code standard: limits, ratchets, completion criteria.                                     |
| `onboarding.md`                                              | New-contributor guide: setup, development, testing, workflows.                                          |
| `operations/lead-report-assistant-rollout.md`                | Command-level production rollout, preflight, smoke, monitoring, and rollback runbook for Lead Chat.     |
| `operations/postgres-pgvector-rollout.md`                    | PostgreSQL 15 pgvector image inventory and non-disposable volume/backup verification checklist.         |
| `quality-program.md`                                         | The quality system in one page: enforced gates, measured outcomes, ongoing rollout.                     |
| `research/`                                                  | Evidence-backed research underpinning standing standards.                                               |
| `reviews/`                                                   | Consolidated review reports that still drive open work; superseded reports move to the archive.         |
| `ui-atlas/`                                                  | Visual baseline: capture manifest, console baseline, role screenshots.                                  |

Anything moved to the archive stays in git history; `git log --follow` finds it.
