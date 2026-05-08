# User Feedback Closure Matrix - 2026-05-08

Purpose: reconcile user feedback from the active session with live repo/GSD state.
This file is a working closure map, not a PASS report.

## Current Live State

```text
repo: customreport
branch: main
gsd health: healthy
audit-open: 8 items
working tree: dirty
local-testable: yes; web localhost:3000, api localhost:3002 health ready
latest live proof: admin groups + stage reassignment Playwright PASS
```

## Closure Matrix

| ID      | User request                                               | Current fact              | Gap                                                                  | Evidence target                                          |
| ------- | ---------------------------------------------------------- | ------------------------- | -------------------------------------------------------------------- | -------------------------------------------------------- |
| UFB-001 | Admin stage reassignment Igor -> Maria                     | DONE live Playwright pass | none for current slice                                               | apps/web/e2e/regression/admin-stage-reassignment.spec.ts |
| UFB-002 | Reporting scope by StageAssignment, not Product.owner      | DONE                      | none for current backend scope                                       | report-sections repo/service tests                       |
| UFB-003 | Submit validation ignores unassigned products/stages       | DONE                      | none for current backend scope                                       | submitSection validation                                 |
| UFB-004 | No-cookie protected pages redirect, not skeleton hang      | DONE                      | none for auth-guard route scope                                      | apps/web/src/proxy.ts + proxy/auth integration tests     |
| UFB-010 | Empty products muted/collapsed/non-expandable              | PARTIAL                   | need live visual regression and hover bbox                           | weekly report portfolio components                       |
| UFB-011 | Top spacing/layout does not merge into header              | OPEN                      | need token + visual assertions                                       | head/report weekly/report layouts                        |
| UFB-012 | Remove misleading Collapse/Toggle when empty               | OPEN                      | need semantics decision implemented per route                        | dashboard/weekly report controls                         |
| UFB-013 | Activity This Period vs Lead Reports duplicated            | OPEN                      | need rename or merge route semantics                                 | head dashboard                                           |
| UFB-014 | Optional multi-SDLC stages for item/risk/decision/priority | OPEN                      | schema currently stageName single optional; needs multi-select model | shared schemas + DB + modals                             |
| UFB-015 | Author/owner fields read-only/defaulted                    | OPEN                      | need modal audit/fix                                                 | lead form modals                                         |
| UFB-016 | Groups admin model and user assignment                     | DONE                      | head multi-group scoping intentionally deferred                      | ReportingGroup model + admin groups/users                |
| UFB-017 | Search on every list form                                  | PARTIAL                   | need inventory all list surfaces                                     | admin tabs/report lists                                  |
| UFB-018 | Reminders real configuration                               | PARTIAL                   | config UI exists; dispatch/queue proof still needed                  | admin reminders tab                                      |
| UFB-019 | Action Log readable and useful                             | PARTIAL                   | need hide proof/internal rows + labels                               | admin actions tab + mutation audit                       |
| UFB-020 | Unexpected error logs with cause/correlation id            | PARTIAL                   | need forced-failure regression                                       | api logger + web error boundary/toasts                   |
| UFB-030 | base-empty wipe clears StageAssignment                     | DONE                      | add browser regression later if needed                               | prisma/wipe-manual-uat.ts                                |
| UFB-031 | Grafana/Prometheus/log onboarding docs                     | OPEN                      | need README/RUNBOOK exact URLs/logins/commands                       | docs/RUNBOOK/README                                      |
| UFB-032 | Full UI/design review with listed skills                   | IN_PROGRESS               | review lane artifacts running; token batch remains                   | UI review artifacts + code                               |

## Immediate Local-Test Gate

```text
[current dirty schema]
  -> review lane agents finish
  -> graphify update
  -> gsd health/audit-open
  -> git commit
  -> push
  -> user manual UAT on localhost:3000
```

## Review Factory Draft

```text
inventory
  -> shard by domain/module/route
  -> deterministic scanners
  -> skill-agent review
  -> file:line findings
  -> dedupe
  -> P0/P1 fix batches
  -> Playwright/API evidence
```

Skill lanes:

- design: frontend-design, bencium-controlled-ux-designer, ui-ux-pro-max, design-audit, typography, web-design-guidelines, gsd-ui-review
- code: Demo-review domains typescript, architecture, node, tests, security, react
- data: Prisma schema, migrations, seed, wipe modes, StageAssignment/ReportingGroup invariants
- ops: logs, Action Log, Prometheus/Grafana, queue/DLQ, correlationId
- product: role matrix, report lifecycle, submit validation, reminders, empty-state semantics
