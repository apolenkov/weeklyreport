# Plannotator Plan Ledger - 2026-05-14

Source directory: `~/.plannotator/plans`

This ledger preserves the plan lineage that was easy to skip during resume. Approved plans, denied plans, and annotations are all treated as inputs.

## Relevant Files

```
Plannotator
├── PRJ-2 resume
│   ├── customreport-fit-2-resume-plan-2026-05-14-approved.md
│   ├── customreport-fit-2-resume-plan-2026-05-14-denied.md
│   └── customreport-fit-2-resume-plan-2026-05-14.annotations.md
├── Repo completion
│   ├── customreport-repo-completion-p-2026-05-14-approved.md
│   ├── customreport-repo-completion-p-2026-05-14-denied.md
│   └── customreport-repo-completion-p-2026-05-14.annotations.md
├── Claude/session audit
│   └── claude-session-2026-05-14-approved.md
├── UAT repair / marathon
│   ├── uat-2026-05-11-v5-gsd-parallel-2026-05-12-approved.md
│   ├── uat-repair-plan-v3-2026-05-13-approved.md
│   ├── night-marathon-uat-v74-wipe-un-2026-05-14-approved.md
│   └── v81-sprint-plan-revised-2026-0-2026-05-14-approved.md
└── Admin/settings plans
    ├── admin-settings-data-invariants-2026-05-13-approved.md
    └── admin-uat-round-9-bugfeature-f-2026-05-13-approved.md
```

## User Feedback That Changed The Plan

| Feedback                                               | Ledger response                                                                                                                 |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| Отдельно проревьюрить все сессии Claude                | Added `CLAUDE-SESSIONS-AUDIT-2026-05-14.md` before execution.                                                                   |
| Почти все, что просили согласно планам, было пропущено | Added this Plannotator ledger and request coverage matrix.                                                                      |
| Обратить внимание на Plannotator                       | Approved, denied, and annotation files are listed as sources.                                                                   |
| Использовать дополнительно skill `Demo-plan`            | Loaded `Demo-plan` and aligned closure plan around repo-only audit, Git audit, GSD audit, consolidation, and verification.       |
| Сделать автономно и реализовать остатки                | Repo completion plan adds `Implement all + ADR first`; Phase 65 now owns ADR-backed implementation for repo-local product gaps. |
| NO UI background implementation                        | Phase 40 / background work remains research-only until explicit sign-off.                                                       |

## Obligation Map

| Plan family                          | Required outcome                                                                                                | Current classification                                                                         |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `claude-session-2026-05-14-approved` | Audit all Claude sessions, no raw JSONL, produce sanitized repo ledger.                                         | DONE in this ledger set.                                                                       |
| PRJ-2 resume plan                    | Fix CI, reconcile coverage, update STATE/memory, merge only after green.                                        | PARTIAL: CI/test/memory done; merge blocked by CI.                                             |
| UAT v5 R1-R13                        | Preserve R1-R13 and UFB tickets; do not duplicate already closed work.                                          | MOSTLY DONE; open/deferred items tracked in coverage matrix.                                   |
| UAT repair v3                        | Domain invariants, role scoping, report persistence, viewer/head semantics.                                     | MOSTLY DONE; unresolved design items remain deferred.                                          |
| Admin B1-B9                          | GroupProduct uniqueness, filters/search, ActionLog wipe, Coming Soon cards.                                     | DONE by repo evidence and prior commits.                                                       |
| Admin settings/data invariants       | Index cleanup, immutable archive snapshots, settings copy, integration cards.                                   | PARTIAL: covered where implemented; unresolved policy items deferred.                          |
| Night marathon D/H                   | Wipe unblock, D matrix, H hardening, research memos, Playwright proof.                                          | DONE/PARTIAL by matrix; design-only items remain deferred.                                     |
| v8.1 sprint plan                     | CI baseline, markdownlint, planning consolidation, no Phase 40 UI code.                                         | DONE except PR #5 final green/merge.                                                           |
| Repo completion plan                 | Consolidate into v8.1 Closure & Recovery, execute phases 61-66, ADR first, then implement repo-local leftovers. | ACTIVE: phases scaffolded; Phase 65 must implement after ADR where no external blocker exists. |

## Explicitly Deferred

- `D-12`: item-dialog status pill reset needs a react-compiler-safe design.
- Phase 40 visual identity implementation: research only.
- Phase 41 AI eval: parked until real AI path is activated.
- Phase 54/55 real activation: needs provider/token decisions.
- Runtime `director` role: deferred unless explicitly reopened.

## Now Implementation-Eligible After ADR

- `UFB-014`: verify and complete stage multi-select round-trip coverage.
- `D-6`: archive snapshot policy.
- `D-8`: period any-day UX.
- `D-16`: priority stage chip style.
- `D-17`: period navigator display.
- `D-29`: head KPI/lead metrics.
- `D-34`: viewer vs head read-only semantics.
- `A35`: director-facing UAT through the existing viewer role.
