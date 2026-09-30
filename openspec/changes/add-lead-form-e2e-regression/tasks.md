# Tasks

> **For agentic workers:** Use native subagents for the scoped implementation and one final independent code review. Do not use Devin. This plan stays with the requested OpenSpec change.

**Goal:** Deliver a complete Lead-form regression using `agent-browser` CLI and native TypeScript Node tests, with truthful coverage and a safe coordinator handoff.

**Architecture:** Root scenarios use the existing application and a thin real CLI wrapper. Each independent file registers explicit native before/beforeEach preparation hooks; one owned reset+overlay process group isolates and contains writes. The suite never starts the app.

**Tech Stack:** TypeScript, `node:test`, existing `tsx`, pnpm, installed `agent-browser` 0.38.1, existing guarded Prisma reset/seed tooling.

**Spec:** `specs/behavioral-ui-regression-gate/spec.md` and `design.md`.

## Global Constraints

- No E2E run, browser launch/session creation, database/Redis access, reset, seed or server startup now. Only browser CLI help/core-skill reads are authorized; the coordinator owns later runtime acceptance.
- Later preparation accepts only matching loopback `customreport_e2e` targets, Redis15, non-production and the exact consent `PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION='давай'`.
- Keep `pnpm test` and `.gitlab-ci.yml` unchanged. No product/schema changes or new browser framework/adapter.
- Use actual CLI roles/accessibility labels/snapshot references and waits; no CSS classes, test IDs, fixed sleeps or scripted UI mutation.
- Commit only task-owned paths with English Conventional Commit subjects and `Co-Authored-By: Codex <noreply@openai.com>`; do not push or archive.

## Review Focus

- A selected test must not inherit prior mutations or cookies: confirm previous owned browsers are closed before per-test reset, then use fresh owned session state; channel suffixes do not determine the role authenticated through UI.
- Hook cancellation must stop/reap all owned preparation writers; browser cleanup must use an independent context after a test aborts.
- Wrong target/consent/Redis values must fail before any connection or browser action.
- Local UI changes require saved refetch/reload proof; a click or snapshot command alone is not a passing flow.
- Same-test Head feedback, reopen decisions and S13 period publication/reopen use real UI; injected save faults and assistant tRPC-response stubs remain explicitly identified.
- Keep conditional/absent controls truthful: Slides-only Delete, immutable Previous with target-only historical replan, missing record-limit dialog and unreachable zero-stage Product.

## 1. Revised OpenSpec and coverage

- [x] 1.1 Revise proposal/design/tasks/delta for `agent-browser` plus `node:test`; run `pnpm spec:check` with exit 0 before the converted implementation.
- [x] 1.2 Retain the source capability inventory created in `e2e/lead-form/COVERAGE.md` before scenario implementation; update its final test paths/titles during conversion and preserve every explicit conditional/unavailable state.

## 2. Root CLI and Node acceptance infrastructure

- [x] 2.1 Remove the task-added browser test dependency/configuration and make `test:e2e` exactly `node --import tsx --test --test-concurrency=1 e2e/lead-form/*.test.ts`; register `before(globalSetup)`, guarded demo `beforeEach` and owned-session `afterEach` through `e2e/lead-form/fixtures.ts` in every independent file; verify no separate runner wrapper, unit/CI changes or new framework dependency.
- [x] 2.2 Add the thin `browser.ts` using `execFile` argument arrays without a shell and actual installed CLI commands for `open`, `findRole`, accessible-label `fill`, `waitText`, `getText`, `isVisible` and `snapshot`; retain real `DisclosureTriangle` summary roles and hierarchy scopes that may have no refs, and create the named `AGENT_BROWSER_SESSION` only during future setup/run.
- [x] 2.3 Align `e2e/tsconfig.json`, root typecheck and Knip with the actual Node test/setup/wrapper paths; verify all first-party TypeScript is checked without new exemptions or broad ignore lists.
- [x] 2.4 Preserve exact-target validation and implement `e2e/setup/reset.ts`'s `prepareE2eData(profile: "demo" | "minimal", signal: AbortSignal, scenario?: "archived-fill-only")` through the owned `e2e/setup/prepare.ts` child; reject the optional variant unless the profile is minimal in both parent and child before spawn/reset; run non-detached existing reset-hard(profile) then the selected fixture in that same group, passing hook `context.signal`, awaiting child close and keeping Prisma writes out of the parent; verify guard/cancellation contracts and stop/reap owned writers before another test without running destructive preparation now.
- [x] 2.5 Keep the narrow demo overlay for historical/open-work, one-owned-stage Product, owned reviewer comment and foreign-private sentinels; place explicit Next on the existing carried Current `nextStepText` rather than duplicate its section/stableId key; preserve ordinary minimal without overlay and use `e2e/setup/archived-fill.ts` only for the explicit F01 minimal + archived-fill-only condition, creating its own schema-valid archived published Planning source/frozen snapshot; keep N/A zero-stage Product documented and imports free of services/browser.
- [x] 2.6 Wire runtime-only `e2e/setup/shutdown.ts` before global preparation: terminal abort blocks future work, waits for owned preparation/CLI-client completion, independently closes own sessions/removes temporary CLI config even when close rejects, reports cleanup failures and exits 130/143 on SIGINT/SIGTERM; verify its synthetic Node-child contracts through `e2e/setup/shutdown.test.ts` without services.

## 3. Convert complete Lead scenarios to native tests

- [x] 3.1 Convert the inventory's login/report/viewing scenarios to `e2e/lead-form/*.test.ts`: guarded minimal-profile F01, Report/Slides, visibility, expansion, period/archive/snapshot and Fill From; replace driver-specific locators with real CLI role/name or snapshot-reference commands and bind assertions to observable/refetched state.
- [x] 3.2 Convert Overview creation/progress/menu/outcome/recovery scenarios for Product and Activity Items: every applicable More actions, move this/next week, workflow states, Won't do reason, restore and carried confirmation; verify Previous cannot mutate its occurrence while Plan this work creates target work without altering history.
- [x] 3.3 Convert section CRUD, Product/Activity status, priorities, sole/multiple owned-stage and field validation scenarios using actual dialogs and Slides-only item Delete; set/clear native Deadline with native click/focus and individual digit presses on fresh scoped spinbutton refs selected by actual ARIA ranges, asserting its ISO value before Save without an English accessibility-locale assumption; construct S13 published lineage through the same test's real minimal-baseline Lead submit and Head period publish/reopen; require persisted reload or confirmed removal and exclude invented catalogue CRUD/zero-stage inputs.
- [x] 3.4 Convert draft persistence and text-limit scenarios; add retained-input retry under a reproducible native CLI save fault only if supported, identifying injection; preserve explicit coverage limitations for an unreproducible save error and absent record-limit dialog.
- [x] 3.5 Convert submit/read-only/Lead Request reopen with same-test Head approval and rejection, and Lead submit -> Head Request changes with reason -> owning Lead feedback/editability; assert exact returned reason/state after reload and use no happy-path review mock.
- [x] 3.6 Convert remaining assistant/completion/readiness controls using browser-CLI tRPC-response stubs for availability/assistant outcomes, identifying the UI response boundary rather than a backend provider stub; do not issue unauthorized remote provider requests; reconcile every COVERAGE row with the final Node test title and explicit implemented/pending/unavailable status.

## 4. Static acceptance and delivery

- [x] 4.1 Complete one independent final code review with adversarial refutation, covering source denominator, CLI semantics, setup guard, import-time effects, file organization, string paths and stale runner references; fix confirmed findings without weakening checks.
- [x] 4.2 Run `pnpm typecheck`, `pnpm lint`, `pnpm format:check` and `pnpm spec:check`, requiring four exit codes 0; record existing unit/build or pure contract results separately. Do not execute the E2E command or a purported discovery mode during the current prohibition.
- [x] 4.3 Update `/Users/wrk/.local/state/session-review/weeklyreport-20260929/e2e-lead/report.md` and `status.txt` with coverage/limitations, exact static exit codes, final coordinator command/env/ports and browser runtime pending; verify paths against actual infrastructure.
- [x] 4.4 Commit only task-owned changes with the required subject/coauthor; verify final scope, clean task residue and no task-created runtime processes; do not push or archive.

## 5. Coordinator runtime acceptance

- [ ] 5.1 After exclusive target handoff, verify source web/API use the exact database and Redis15, then run documented `pnpm test:e2e`; record node:test/CLI results against the delivered SHA and retain failed snapshots outside the repository. This remains pending while the owner uses the shared target.
