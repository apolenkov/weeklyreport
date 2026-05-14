# CustomReport Repo Remaining - 2026-05-14

Scope: only `/home/user/work/customreport` repo work recovered from unfinished
Claude Code sessions and Plannotator plans.

Out of scope here: global Codex/Claude runtime, other repositories, generic
process improvements.

## NOW

| Priority | Item                              | Repo action                                                                                                             | Evidence / file surface                                                                                                                                                      |
| -------- | --------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ▲ P0     | PR #5 CI and merge                | Watch the latest PR run; merge PR #5 only after green. If queued stays stuck, record runner/policy blocker.               | `gh run list --limit 5`, `gh pr view 5 --json statusCheckRollup`                                                                                                           |
| ▲ P0     | Commit current repo recovery docs | Commit ledgers, memory mirror files, and corrected handoff/state docs without reverting existing evidence JSON changes. | `.planning/session-retros/*2026-05-14.md`, `.planning/memory/*`, `.planning/STATE.md`                                                                                        |
| ▲ P0     | `D-12` item dialog status pill    | Design and implement react-compiler-safe reset-on-reopen fix, then add regression test.                                 | `apps/web/src/components/lead/item-edit-dialog.tsx`, `apps/web/src/components/lead/item-edit-dialog.test.tsx`, optional `apps/web/e2e/regression/agent-b-lead-items.spec.ts` |
| ▲ P1     | `UFB-011` head/lead top spacing   | Add Playwright bounding-box regression; fix layout only if test proves overlap.                                         | `apps/web/e2e/regression-uat-v7.spec.ts`, dashboard/lead page layout components                                                                                              |

## NEXT

| Priority | Item                                            | Repo action                                                                                        | Current state                        |
| -------- | ----------------------------------------------- | -------------------------------------------------------------------------------------------------- | ------------------------------------ |
| ▲ P1     | Archive snapshot policy (`D-6`)                 | Convert research/admin-settings plan into concrete ADR + implementation ticket before schema work. | Not implemented; behavior undefined. |
| ▲ P1     | Period any-day UX (`D-8`)                       | Convert research into product spec and phase task; do not code until behavior is defined.          | Research only.                       |
| ▲ P1     | Period navigator display (`D-17`)               | Implement only after copy/layout target is accepted.                                               | Research only.                       |
| ▲ P1     | Priority chip style (`D-16`)                    | Implement first-letter/color chip if approved; then add visual/regression test.                    | Research only.                       |
| ▼ P2     | Surface/background token regression (`UFB-032`) | Keep screenshot research; no UI implementation until Phase 40 decision.                            | Explicitly research-only.            |
| ▼ P2     | Head KPI metrics (`D-29`)                       | Needs feature spec before code.                                                                    | Research only.                       |
| ▼ P2     | Viewer vs head semantics (`D-34`)               | Needs role/product decision before code.                                                           | Research only.                       |

## DO NOT DO IN THIS REPO NOW

- Do not reopen `E-04`: covered by `apps/web/src/components/dashboard/alert-bar.test.tsx` in `45e1cac`.
- Do not add duplicate `E-08`: covered by `apps/web/e2e/dashboard-advanced.spec.ts` SC-176.
- Do not reopen `UFB-024`: `phase16-17-uat.spec.ts` records SC-16-02 as `SKIPPED`.
- Do not implement Phase 40 visual identity/background changes from screenshot research.
- Do not activate Phase 54/55 real AI/Telegram paths without provider/token decisions.
- Do not treat `agent-browser` as repo regression runner; use Playwright.

## Repo Closeout Path

```
[commit recovery docs] -> [verify markdown/tests] -> [push] -> [watch latest CI]
                                                       ├── green -> [merge PR #5]
                                                       └── stuck -> [record blocker]
```
