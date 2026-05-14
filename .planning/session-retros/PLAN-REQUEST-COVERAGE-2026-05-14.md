# Plan Request Coverage - 2026-05-14

Purpose: reconcile Claude sessions, Plannotator plans, repo evidence, and current PR #5 status so the next action list does not drift again.

Repo-only remaining work is split out in `CUSTOMREPORT-REPO-REMAINING-2026-05-14.md`.

## Status Matrix

| Bucket     | Requests                                                        | Evidence                                                                    |
| ---------- | --------------------------------------------------------------- | --------------------------------------------------------------------------- |
| DONE       | TOOL-01 clean checkout compile fix                              | `d19a1b9`, `apps/web/next-env.d.ts`                                         |
| DONE       | TOOL-02 regression baseline                                     | `.planning/regression/COVERAGE-GAP-2026-05-14.md`, 179/179 noted in handoff |
| DONE       | CI startup action-version fix                                   | `e4a6bfd`, `ffb3a15`, `.github/workflows/ci.yml`                            |
| DONE       | `E-04` reminder failure feedback                                | `45e1cac`, `apps/web/src/components/dashboard/alert-bar.test.tsx`           |
| DONE       | `E-08` archive previous-boundary                                | `apps/web/e2e/dashboard-advanced.spec.ts` SC-176                            |
| DONE       | `UFB-024` SC-16-02 status                                       | `apps/web/e2e/regression/phase16-17-uat.spec.ts` uses `SKIPPED`             |
| DONE       | Memory mirror missing Claude files                              | Copied six missing files into `.planning/memory/`                           |
| DONE-DOC   | Phase 44/46/47/48/49 evidence exists                            | Phase summary files under `.planning/phases/`                               |
| DONE-DOC   | Phase 52/54/55/56/57 evidence exists                            | `*-PHASE-SUMMARY.md` files under `.planning/phases/`                        |
| OPEN       | PR #5 merge                                                     | PR is mergeable, but CI must finish green first.                            |
| OPEN       | CI current state                                                | Latest run is queued after fixes; previous runs were `startup_failure`.       |
| DEFERRED   | `D-12`, `UFB-014`, `D-6`, `D-8`, `D-16`, `D-17`, `D-29`, `D-34` | Product/design/architecture decisions required.                             |
| SUPERSEDED | Old PR #3/#4 closure tasks                                      | PR #4 merged; PR #5 is the active closure surface.                          |

## CustomReport-Only Active Work

| Priority | Item                           | Why still active                                                                       |
| -------- | ------------------------------ | -------------------------------------------------------------------------------------- |
| P0       | PR #5 green + merge            | Branch is mergeable, but current CI run must finish green.                             |
| P0       | Recovery docs commit           | Claude/Plannotator ledgers and memory mirror are repo artifacts and must be preserved. |
| P0       | `D-12` item-dialog status pill | Bug unresolved; previous fix was reverted due to react-compiler conflict.              |
| P1       | `UFB-011` layout spacing       | Still open and lacks bounding-box regression.                                          |

## Current Execution Rule

```
[ledger complete] -> [CI watch] -> [green?]
                              ├── yes -> [merge PR #5]
                              └── no  -> [record blocker + exact run evidence]
```

## Do Not Reopen

- Do not add duplicate `E-08` or `UFB-024` tests.
- Do not implement Phase 40 visual changes from screenshot research.
- Do not treat `agent-browser` as the regression runner; this repo uses Playwright.
- Do not delete repo-only `.planning/memory/` files while syncing Claude memory.
