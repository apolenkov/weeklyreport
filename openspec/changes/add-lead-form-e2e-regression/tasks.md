# Tasks

> **For agentic workers:** Use native subagents for the scoped implementation and one final independent code review. Do not use Devin. This plan stays with the requested OpenSpec change.

**Goal:** Deliver a complete Lead-form regression using `agent-browser` CLI and native TypeScript Node tests, with truthful coverage and a safe coordinator handoff.

**Architecture:** Root scenarios use the existing application and a thin real CLI wrapper. Each file's `before` validates configuration and initializes sessions without reset; `beforeEach` performs the guarded independent reset/seed. One owned reset+overlay process group contains writes. The suite never starts the app.

**Tech Stack:** TypeScript, `node:test`, existing `tsx`, pnpm, installed `agent-browser` 0.38.1, existing guarded Prisma reset/seed tooling.

**Spec:** `specs/behavioral-ui-regression-gate/spec.md` and `design.md`.

## Global Constraints

- The preparation stage's runtime prohibition ended with the coordinator's exclusive handoff on 2026-09-30. The live correction stage may run E2E and guarded reset/seed against only `customreport_e2e` and Redis DB 15; no lane creation or DB 0 access.
- Preserve the running web/API from `/Users/wrk/work/weeklyreport` on ports 3000/3002; the owner's clean application checkout advanced from the initial main `33d853b6a` to `c9ffc8c8df0fce0b9ca3800ee04fe3256236612b` before run11. Do not stop, restart or launch servers. Use dev-login only with each email's native role and record the current application revision.
- Preparation accepts only matching loopback `customreport_e2e` targets, Redis15, non-production and the exact consent `PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION='давай'`, read from the repository's canonical consent constant.
- Before returning the shared target, execute the guarded canonical `pnpm db:reset:hard full` from `/Users/wrk/work/weeklyreport` and require exit 0.
- Keep `.gitlab-ci.yml` unchanged; `pnpm test` gains only the browser-free `test:e2e-setup` contract suite, never browser tests. No product/schema changes or new browser framework/adapter.
- Use actual CLI roles/accessibility labels/snapshot references and waits; no CSS classes, test IDs, fixed sleeps or scripted UI mutation.
- Commit only task-owned paths with English Conventional Commit subjects and `Co-Authored-By: Codex <noreply@openai.com>`; do not push or archive.
- Final-SHA review must use a different model and include ponytail review. Same-SHA CI must be green before claiming complete acceptance; with push forbidden, record CI as NOT VERIFIED and leave its coordinator handoff open.

## Review Focus

- A selected test must not inherit prior mutations or cookies: confirm previous owned browsers are closed before per-test reset, then use fresh owned session state; channel suffixes do not determine the role authenticated through UI.
- Hook cancellation must stop/reap all owned preparation writers; browser cleanup must use an independent context after a test aborts.
- Wrong target/consent/Redis values must fail before any connection or browser action.
- Local UI changes require saved refetch/reload proof; a click or snapshot command alone is not a passing flow.
- Same-test Head feedback, reopen decisions and S13 period publication/reopen use real UI; injected save faults and assistant tRPC-response stubs remain explicitly identified.
- Keep conditional/absent controls truthful: Slides-only Delete, immutable Previous with target-only historical replan, absent standalone count-limit modal with the real 100-item alert and 500-character dialog covered, and unreachable zero-stage Product.

## 1. Revised OpenSpec and coverage

- [x] 1.1 Revise proposal/design/tasks/delta for `agent-browser` plus `node:test`; run `pnpm spec:check` with exit 0 before the converted implementation.
- [x] 1.2 Retain the source capability inventory created in `e2e/lead-form/COVERAGE.md` before scenario implementation; update its final test paths/titles during conversion and preserve every explicit conditional/unavailable state.

## 2. Root CLI and Node acceptance infrastructure

- [x] 2.1 Remove the task-added browser test dependency/configuration and make `test:e2e` exactly `node --import tsx --test --test-concurrency=1 e2e/lead-form/*.test.ts`; register `before(globalSetup)`, guarded demo `beforeEach` and owned-session `afterEach` through `e2e/lead-form/fixtures.ts` in every independent file; verify no separate runner wrapper, unit/CI changes or new framework dependency. The live correction stage removes the initial redundant global reset.
- [x] 2.2 Add the thin `browser.ts` using `execFile` argument arrays without a shell and installed CLI commands for `open`, `findRole`, accessible-label `fill`, `waitText`, `getText`, `isVisible` and `snapshot`; use hierarchy scopes that may have no refs and create the named `AGENT_BROWSER_SESSION` only at authorized runtime. Native summary controls use observed AX `DisclosureTriangle` counts and the supported native finder when refs are absent, without claiming that tree name is an ARIA role.
- [x] 2.3 Align `e2e/tsconfig.json`, root typecheck and Knip with the actual Node test/setup/wrapper paths; verify all first-party TypeScript is checked without new exemptions or broad ignore lists.
- [x] 2.4 Preserve exact-target validation and implement `e2e/setup/reset.ts`'s `prepareE2eData(profile: "demo" | "minimal", signal: AbortSignal, scenario?: "archived-fill-only" | "section-item-limit")` through the owned `e2e/setup/prepare.ts` child; validate the scenario/profile in the shared pure parser in both parent and child before spawn/reset, accepting archived-fill-only only with minimal and section-item-limit only with demo; run non-detached existing reset-hard(profile) then the selected fixture in that same group, passing hook `context.signal`, awaiting child close and keeping Prisma writes out of the parent; verify browser-free guard/cancellation contracts and stop/reap owned writers before another test. The preparation stage did not execute destructive setup.
- [x] 2.5 Keep the narrow demo overlay for historical/open-work, one-owned-stage Product, owned reviewer comment and foreign-private sentinels; place explicit Next on the existing carried Current `nextStepText` rather than duplicate its section/stableId key; preserve ordinary minimal without overlay and use `e2e/setup/archived-fill.ts` only for the explicit F01 minimal + archived-fill-only condition, creating its own schema-valid archived published Planning source/frozen snapshot; keep N/A zero-stage Product documented and imports free of services/browser.
- [x] 2.6 Wire runtime-only `e2e/setup/shutdown.ts` before global preparation: terminal abort blocks future work, waits for owned preparation/CLI-client completion, independently closes own sessions/removes temporary CLI config even when close rejects, reports cleanup failures and exits 130/143 on SIGINT/SIGTERM; verify its synthetic Node-child contracts through `e2e/setup/shutdown.test.ts` without services.

## 3. Convert complete Lead scenarios to native tests

- [x] 3.1 Convert the inventory's login/report/viewing scenarios to `e2e/lead-form/*.test.ts`: guarded minimal-profile F01, Report/Slides, visibility, expansion, period/archive/snapshot and Fill From; replace driver-specific locators with real CLI role/name or snapshot-reference commands and bind assertions to observable/refetched state.
- [x] 3.2 Convert Overview creation/progress/menu/outcome/recovery scenarios for Product and Activity Items: every applicable More actions, move this/next week, workflow states, Won't do reason, restore and carried confirmation; verify Previous cannot mutate its occurrence while Plan this work creates target work without altering history.
- [x] 3.3 Convert section CRUD, Product/Activity status, priorities, sole/multiple owned-stage and field validation scenarios using actual dialogs and Slides-only item Delete; set/clear native Deadline with native click/focus and individual digit presses on fresh scoped spinbutton refs selected by actual ARIA ranges, asserting its ISO value before Save without an English accessibility-locale assumption; construct S13 published lineage through the same test's real minimal-baseline Lead submit and Head period publish/reopen; require persisted reload or confirmed removal and exclude invented catalogue CRUD/zero-stage inputs.
- [x] 3.4 Convert draft persistence and text-limit scenarios; add retained-input retry under a reproducible native CLI save fault only if supported, identifying injection; preserve explicit coverage limitations for an unreproducible save error and absent standalone count-limit modal, without hiding the real item-count composer alert.
- [x] 3.5 Convert submit/read-only/Lead Request reopen with same-test Head approval and rejection, and Lead submit -> Head Request changes with reason -> owning Lead feedback/editability; assert exact returned reason/state after reload and use no happy-path review mock.
- [x] 3.6 Convert remaining assistant/completion/readiness controls using browser-CLI tRPC-response stubs for availability/assistant outcomes, identifying the UI response boundary rather than a backend provider stub; do not issue unauthorized remote provider requests; reconcile every COVERAGE row with the final Node test title and explicit implemented/pending/unavailable status.

## 4. Preparation-stage static acceptance and delivery

- [x] 4.1 Complete one independent final code review with adversarial refutation, covering source denominator, CLI semantics, setup guard, import-time effects, file organization, string paths and stale runner references; fix confirmed findings without weakening checks.
- [x] 4.2 Run `pnpm typecheck`, `pnpm lint`, `pnpm format:check` and `pnpm spec:check`, requiring four exit codes 0; record existing unit/build or pure contract results separately. No E2E or purported discovery mode was executed during that stage's prohibition.
- [x] 4.3 Update `/Users/wrk/.local/state/session-review/weeklyreport-20260929/e2e-lead/report.md` and `status.txt` with coverage/limitations, exact static exit codes, final coordinator command/env/ports and browser runtime pending; verify paths against actual infrastructure.
- [x] 4.4 Commit only task-owned changes with the required subject/coauthor; verify final scope, clean task residue and no task-created runtime processes; do not push or archive.

## 5. Coordinator runtime acceptance

- [x] 5.1 Run documented `pnpm test:e2e` against the existing source web/API with the exact database and Redis15: full `pnpm test:e2e` run: 123 tests, 123 pass, 0 fail, exit 0 (runner fa2f03160, application main c9ffc8c8d); evidence kept outside the repository.

## 6. Rebased live correction and restoration

- [x] 6.1 Align fixture imports with main cleanup; replace the removed `PROD_PORTAL` export without modifying the canonical application seed.
- [x] 6.2 Verify installed CLI behavior and current labels in the live browser, including native summary disclosures, uppercase AX headings/week groups, Chrome touch and the visible floating fullscreen Exit; correct scenarios or record unsupported coverage explicitly without weakening observable assertions. Selected runtime evidence verifies native Chrome swipe and fullscreen/keyboard behavior; complete acceptance remains separate.
- [x] 6.3 Reuse shared snapshot/helper functions, remove redundant global reset, use canonical `E2E_DESTRUCTIVE_CONSENT`, and replace markup-based waits with supported role/text or bounded AX polling where they express the same condition. Reuse the existing catalog `superjson` to decode complete observed tRPC inputs before canonical schema validation. Validate both explicit fixture variants through the shared pure parser and the separate 39-case browser-free contract suite.
- [x] 6.4 Iterate selected-file and complete live runs until the suite passes: full `pnpm test:e2e` run: 123 tests, 123 pass, 0 fail, exit 0 (runner fa2f03160, application main c9ffc8c8d); evidence kept outside the repository.
- [x] 6.5 Run current `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm test` and `pnpm spec:check`, all exit 0.
- [ ] 6.6 Restore the canonical full dataset through guarded `pnpm db:reset:hard full` from `/Users/wrk/work/weeklyreport`, record exit 0, and leave the existing web/API running.
- [ ] 6.7 Commit only task-owned corrections with the required Conventional Commit/coauthor, without push; obtain independent final-SHA review by a different model including ponytail and verify task residue.
- [ ] 6.8 Hand same-final-SHA remote CI verification to the coordinator; remain unchecked and report NOT VERIFIED until its green result is available. Do not claim complete acceptance from local gates or an earlier SHA's CI.
- [x] 6.9 Inventory the real historical-plan 100-item rejection before adding `historical plan item limit retains input without changing saved work` as case 121; narrow G01 to the absent standalone count modal, use guarded demo-only `section-item-limit` preparation in the owned cancellable group with owner/count assertions before mutation, and verify two genuine alert rejections, retained input and unchanged saved work/history after reload. The case passed in run5's selected run; final complete acceptance remains separate.
- [x] 6.10 Inventory then split Item/Risk/Decision validation and discard into 123 authored cases (Sections 23): retain `canonical record dialogs validate required fields and discard unsaved changes` for Item; add `risk dialog validates required fields and discards unsaved changes` and `decision dialog validates required fields and discards unsaved changes`, each with its own guarded baseline. Execute the independent run8 trio: exit 1, 2 pass / 1 fail, with Risk/Decision passing and Item's strict focus assertion failing on that earlier application revision; the unchanged Item case passes as run11 case 107 after the upstream fix. Reproduce Item through native Enter as well as pointer, retaining the exact MAIN/one-connected-visible-opener diagnostic without product changes or weaker assertions. Complete full-run acceptance remains open under 6.4.
- [x] 6.11 Apply the four independent-review scenario corrections: reuse `waitScope` from shared `scopedRef`, await actual dialogs before direct snapshots, use the observed S1E2E citation label, and share strict read-only `assertFocused` through `focus.ts` without lint exemptions or scripted restoration. Preserve the section-only modal precondition without imposing `aria-modal` on chat Sheet. Reconcile selected run10 evidence (twelve cases: exit 1, 8 pass / 4 fail; chat repeat: exit 1, 2 pass / 1 fail) and the corrected source-navigation case (exit 0, 1 pass / 0 fail). Retain the strict Item focus assertion; the historical failure is fixed upstream and the case passes in run11. Run9's interrupted 39-result transcript and these selections do not complete 6.4, final gates, restoration, final review or CI.

- [x] 6.12 Reconcile the application advance to c9ffc8c8 and run11 full evidence (123 tests, 121 pass / 2 fail, exit 1); retain the strict Item focus assertion that now passes after the upstream fix. Move auth/report-entry helpers to access.ts and reuse existing 25-second AX scope/snapshot waits plus getUrl pathname; replace the assistant-answer and reopen-notification native waits with their actual heading/Notifications scopes, preserving assertions and deadlines. The corrected full run, final gates, restoration, final review and CI remain pending.
- [x] 6.13 Reuse a shared 25-second `waitNotification(text, session)` for exact StaticText inside Notifications alt+T; apply it to pending Fill/reopen and observe three pending Slides success toasts before their retained modal-close checks. Use named-button readiness after navigation reconnect and exact recovery-region/error-toast waits for the real conflict. Retain all persistence, count and dialog assertions across the ten offline cases. Implementation is complete; run15's selected result and the next complete run remain pending. Run14 was stopped after seven emitted results (6 pass / 1 fail, exit 1), without complete TAP counts.
