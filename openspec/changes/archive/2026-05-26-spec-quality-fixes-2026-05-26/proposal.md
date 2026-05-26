# Spec Quality Fixes — 2026-05-26

## Purpose

Fix strict-audit findings from UAT session 2026-05-26. The audit ran all
11 specs against two criteria: (1) requirements use MUST/MUST NOT language;
(2) consumer surfaces are explicitly named. Nine specs failed one or both
criteria. One code drift was found (period.reopen allows only head; spec and
correct behavior require head + admin).

## Scope

- Category A (text-only, no semantic change): 5 specs
- Category B (user-decision-backed): 3 specs + 1 code fix
- No new requirements added; no behavioral change beyond the one code drift fix

## Changes

### Category A — text fixes, no semantic change

| Spec                     | Fix                                                                                       |
| ------------------------ | ----------------------------------------------------------------------------------------- |
| `archive-history-ia`     | Add `#` H1 header; remove "approximately"; add `ReportToolbar`/`ArchiveToggle` references |
| `landing-page-hero`      | Add `TaglineCycler` + `LANDING_TAGLINES` consumer surfaces                                |
| `repository-scope-guard` | Fill TBD Purpose; reframe Req 2 as durable invariant (not one-time artifact language)     |
| `status-slide-rendering` | Fill TBD Purpose; reword R1 as behavior invariant (not implementation step)               |
| `period-dual-state`      | Add atomicity test scenario to cover test-enforcement gap noted in audit                  |

### Category B — user-decision-backed

| Spec / File                      | Decision                           | Fix                                                                             |
| -------------------------------- | ---------------------------------- | ------------------------------------------------------------------------------- |
| `role-coverage-gate`             | Follow code: 8 builders            | Change "7" → "8"; list all 8 builders by name                                   |
| `period-lifecycle-ui`            | Spec correct; extend code          | Fill TBD Purpose; fix `closed` → `published`; add tRPC proc + component refs    |
| `report-routing`                 | Commit to path segment             | Fill TBD Purpose; drop "or query parameter" ambiguity; name route files         |
| `apps/api/…/trpc.router.ts:1832` | **No change needed** (false alarm) | `headProcedure` = `buildRoleMiddleware(["head","admin"])` — already covers both |

## Decisions made

1. **7 vs 8 builders**: Code exports 8 canonical builders.
   Decision: spec follows code → update to 8 and list names.

2. **period.reopen head-only vs head+admin**: Spec says "head or admin" is correct.
   Decision: extend `period.reopen` to use a builder that covers both roles.
