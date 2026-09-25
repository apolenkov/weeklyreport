## ПРОЕКТ ПЛАНА (goal mu6s113y-6vif62 — на согласовании, не исполнение)

- Режим: проект плана.
- Проверено на: 2026-09-18, HEAD `a41779cf5` (`feat/agentation-feedback`, ahead 1). Полное дерево: 141 строка (`git status --short`: 138 modified + 3 untracked `pi.jsonl`, `.reticle-setup-crash.log`, flow JSON) — включает ПРЕДСУЩЕСТВУЮЩУЮ кампанейскую дельту (не этой фазы, mtime 15–18.09 до окна фазы, не откатывать; атрибуция — P1). Собственная дельта фазы (mtime 12:56–12:57): ровно 3 файла этого change. Было 137 на 2026-09-17 (+4: crash-лог и mtime). Flows: 6 файлов (было 5); specs-каталогов: 161; `.reticle/spec-coverage-exclusions.json`: decision 2026-09-17, minimum 20, 153 excludedSpecs, 23 excludedOutcomes — без изменений.
- Сейчас: пакет `plan-draft` (цель `mu6s113y-6vif62`); предъявление проекта.
- Последний принятый результат: ACCEPTED 2026-09-17 (D1–D4) + challenge 7/7 TRUE; история исполнения 2026-09-18 (Tier A closeout, single-DB решение, P4/QE slices, Reticle infra wall) — свидетельства в `tasks.md`, не PASS продукта.
- Блокер: блокера самого проекта нет; execution permits отдельно (44.13 Astra/недоступность, dev-серверы/синтетика для P3, per-run guard+consent для single-DB).
- Следующее разрешённое действие: одно — challenge проекта + предъявление итога (`challenge-close`).
- Активные задания кампании: этим голом не запускались (дочерних работ гола нет).

# ACCEPTED audit plan (owner 2026-09-17 «принимаю»; D1–D4 via structured questionnaire in session same day). Read-only phase product; execution is separate. Owner statement: all touched files are one campaign — no third-party conflict; P1 still attributes file-level owners

## Audit status (draft)

- Mode: ACCEPTED by owner 2026-09-17 («принимаю»). Execution is a separate goal; no implementation started.
- Observed on: 2026-09-17, HEAD `a41779cf5` on `feat/agentation-feedback`, ahead of `origin/feat/agentation-feedback` by 1 (repository-class observation per `docs/sdlc.md`, not verification). Worktree delta: 136 modified + `?? pi.jsonl` (untracked) = 137 `git status` lines, grouped: `.agents/skills/openspec-*` 12, root dotfiles 2, `apps/api` 43, `apps/web` 48, `docs` 1, `eslint-config` 2, `openspec/changes` 9 (incl. this change), `openspec/specs` 4, `packages/ui` 1, `pnpm-lock.yaml` 1, `prisma` 13. Reproduce: `git status --short` at HEAD `a41779cf5`. This phase (owner orders, append-only): `proposal.md` plan sections, `tasks.md` tail P1–P7 checkboxes, `design.md` plan tail — exact ranges verifiable via `git diff`; all other dirt predates this audit goal by mtime but belongs to the same campaign per owner statement — prior campaign work, shown as unverified, not rolled back.
- Now: plan draft only; no work package active.
- Review wave returned 3/3 — outputs at `/Users/wrk/.pi/agent/sessions/--Users-wrk-work-weeklyreport--/subagent-artifacts/outputs/66d17d22-3c69-4ae5-a059-8cb483a63356/` (`exemplar-evidence.md`, `adapt-contract.md`, `quality-surface.md`), workflow receipt in async run `66d17d22-3c69-4ae5-a059-8cb483a63356` — returned, not owner-accepted. Challenge round 1 (reviewer run `fb9c9dca-543c-44e3-ae9d-0b12859db2cb`; transcript `/Users/wrk/.pi/agent/sessions/--Users-wrk-work-weeklyreport--/2026-09-17T15-35-59-748Z_01a0b002-aa04-745b-9491-5b62bca6957a/32955b96-343b-4eb0-aeb2-3584b24a9660/run-0/session.jsonl`) returned 7 material PLAN errors, all fixed in this block; the single permitted targeted follow-up (reviewer run `49cf99fe-af48-46e7-b1e4-cee2f7238452`; transcript `.../703c3827-3f32-45be-89ad-ac3e76701544/run-0/session.jsonl`) verified 7/7 fixes TRUE with no new material contradiction. F1–F7 below are REPO findings (plan content to execute), not plan errors. Contract challenge DoD met: round 1 found 7 plan errors (fixed above); the single permitted targeted follow-up verified 7/7 TRUE with no new material contradiction — zero open plan errors. F1–F7 are repo findings (execution content), not plan errors.
- Impact baseline note: the `87965704` snapshot + manifest in `## Impact` below is superseded for gate purposes — final acceptance must bind the frozen delivery SHA, not that baseline.
- Owner decisions D1–D4 (structured questionnaire, session 2026-09-17): (D1) 39.6 stays strict — 100% critical kept, P6 must close the full denominator; (D2) P4 covers all 231 accepted findings as bounded product patches; (D3) proceed with P1 first, final gates on a frozen SHA after attribution; (D4) the 3/3 review wave + challenge accepted as audit inputs with recorded limits. REMAINING execution permits (not plan blockers): single-DB readiness on `customreport_e2e` (reset+seed между фазами, guard + per-run consent каждый запуск; lanes отменены решением 2026-09-18), 44.13 Astra scheduling (or recorded unavailability), dev servers/synthetic records for P3.
- Owner acceptance source: session transcript (questionnaire answers D1–D4 + «принимаю»), not repo-greppable by construction; recorded verbatim in this block and the DRAFT decisions tail of `tasks.md`.
- Next allowed action: none under this goal — plan accepted, goal closes. Execution only by separate owner order.
- Active campaign jobs: none.

## Draft plan (pending agreement)

Etalon areas A–M (repository-declared unless noted; local/external mostly unverified): A product/domain — spec-strong (`period-dual-state`, `publish/reopen-compare-and-set`, `report-section-write-gates`, `carry-over-automation`, lead/head/viewer families), gap: browser proofs only for 20-core. B simplicity — declared via `docs/exemplary-code-standard.md` + lint (`module-import-boundaries`, `web-shared-idioms`). C architecture — declared (`auth-module-layering`, `queue-worker-architecture`, `report-routing`). D types/contracts — strong (`packages/shared` Zod-first, `spec:check` + typecheck in CI). E data reliability — strong locally (`destructive-db-guard`, `admin-snapshot-restore`, serial integration on disposable DB), gap: no prod backup/restore drill. F security — partial (specs `jwt-session-integrity`, `role-coverage-gate`, `dependency-vulnerability-scanning` + audit workflow); secret scanning, push protection, CodeQL, branch protection — UNVERIFIED external. G testing — strong unit/integration (CI quality/coverage/migrate-reset gates); browser coverage not a gate. H UX/a11y desktop — strong spec-wise, verification manual + non-blocking gate. I performance — partial (no budgets/load tests in CI). J delivery — repo-only (pinned images, frozen lockfile); registry/SBOM/provenance absent, production blocked per `docs/sdlc.md`. K operations — runbook-only, no prod target/SLOs/loaded alerts. L docs/DX — covered, drift by review not CI. M AI/agent tooling — bounded (`REPORT_ASSISTANT_*` bounds, approval gate). Key findings: F1 39.6-vs-exclusions (DECIDED D1: strict kept); F2 `adapt-openspec-to-reticle/design.md:63` stale (six/3,114 vs declared 20 — refresh inside P7); F3 dirty tree unattributed (D3: P1 first); F4 44.3–44.7 planned but unexecuted; F5 44.11 lacks final-SHA browser matrix; F6 single-DB readiness gap (reset+seed между фазами на `customreport_e2e`, guard + per-run consent каждый запуск; lanes отменены решением 2026-09-18); F7 44.13 review-or-unavailability; F8 новый untracked `.reticle-setup-crash.log` + mtime-дельта (P1 атрибуция, P7 cleanup); F9 flows 6 файлов при 97 mapped именах (P7 re-measure на frozen SHA); F10 specs-каталогов 161 vs ~170 в прошлой сводке (разница методики подсчёта, P2 inventory перемерит).

Obligations per ID (done / evidence+applicability / remains): 39.6 — gates partial (registry+exclusions+5 flows, `spec:check` 173/173 narrative); NOT applicable as PASS (task text: R13 18/19/6 unresolved); remains: full inventories, missing flow `activity-reporting-unit-lead-form`, criteria≥2, unreviewed=blocked=0 — D1 strict. 44.3 — P01 planning done (167 blocks); remains per-requirement disposition vs commits. 44.4 — P02 done (2,701 paths/335 assignments); remains hashed manifest at final SHA. 44.5 — 335 packets defined; remains full path/line/spec findings. 44.6 — remains explicit gaps + unsupported-claim list. 44.7 — 7 arch packets defined; remains actual trace. 44.11 — 39.3 partial pass 2026-09-11 (then-current sources); remains finite matrix + browser evidence at final SHA. 44.12 — 5 packets defined; remains bounded patches for all 231 (D2) + regression. 44.13 — binding only; remains review or explicit unavailability. 44.14 — planning FINAL-01–08 only; remains full runs on frozen SHA. 44.15 — order defined; remains counts/delivery/CI-verify/cleanup + separate external-readiness report.

Packages with bounds, risk, permits, stop condition: P1 (44.3+44.4) — bounds: change docs + git metadata, read-only; risk: low; permits: none; stop: two failed attribution attempts → blocker. P2 (44.5+44.6+44.7) — bounds: `apps/*`, `packages/*`, `prisma/*`, specs; read-only; risk: medium (volume); stop: same two-attempt rule. P3 (44.11) — bounds: `apps/web`; needs dev servers + synthetic records (permit at execution); acceptance `verified: yes` only. P4 (44.12) — bounds per finding; all 231 as bounded patches (D2); permits per patch; stop: new scope → child change. P5 (44.13) — read-only review of final diff; outcome review or recorded unavailability. P6 (44.14+39.6 strict) — bounds: repo + CI; needs single-DB readiness on `customreport_e2e` (reset+seed между фазами, guard + per-run consent) + servers; strict bar full denominator. P7 (44.15 + adapt 6.4 incl. design.md:63 refresh) — bounds: change docs, `.reticle/`, CI; stop: production items stay a separate track. Related changes keep their own tasks; linked by ID, no copies.

Proposed pilot: P1 — smallest, fully read-only, unlocks every SHA-bound package; proves manageability (status questions trigger no work, pause stops new actions) before any product touch.

Definition of Done (audit/plan): every applicable area statused or honestly unverified with a next step; obligations mapped; material claims source-checked; packages + acceptance clear; challenge findings dispositioned by owner; draft presented. This is NOT product readiness.

Definition of Done (repository after implementation): agreed mandatory conditions on final source; critical user journeys verified; required checks green; no unresolved confirmed P0/P1; any further severity bar only by explicit owner decision; docs synced; independent final review passed; owner-approved exceptions labelled separately; external/production unknowns never count as PASS.

## Compact summary

ГДЕ МЫ: draft audit plan in `openspec/changes/complete-exemplary-mvp-review/proposal.md` (this block). Pre-existing campaign tasks (NOT plan tasks): `openspec/changes/complete-exemplary-mvp-review/tasks.md` (11 open: 39.6, 44.3–44.7, 44.11–44.15); related `openspec/changes/adapt-openspec-to-reticle/tasks.md` (10 open). Plan items P1–P7 transcribed into `tasks.md` (owner order B, one campaign, append-only) and plan design into `design.md`; this section stays the readable overview.
ЧТО ПОДТВЕРЖДЕНО: review wave 3/3 returned; validator matches `{kind, surface, reference, detail}` contract (reference must resolve to a repo file); `spec:reticle` non-blocking in CI; `openspec validate --changes` 13/13.
ЧТО НЕ ПРОВЕРЕНО: F1–F7 above; external sdlc items (secrets/CodeQL/branch protection/backup drill); live browser matrix; dirty-tree ownership.
ПАКЕТЫ И ПОРЯДОК: P1→P7 above; related changes linked by ID.
КРИТЕРИИ ПРИЁМКИ: the two DoDs above.
ПРЕДЛАГАЕМЫЙ ПИЛОТ: P1 (read-only reconciliation).
РЕШЕНИЯ ВЛАДЕЛЬЦА: D1–D4 above (questionnaire, session 2026-09-17) plus accept/reject the 3/3 review inputs.

## Detailed execution plan (owner-ordered 2026-09-17, strict, ~3124 outcomes)

Recorded owner orders: D1 strict 39.6 kept (full coverage, criteria≥2, unreviewed=blocked=0, 100% critical); lane permit SUPERSEDED by owner single-DB decision 2026-09-18 — no lanes are provisioned; all local activity shares `customreport_e2e` with reset+seed between phases (each run still gated by destructive-guard + per-run consent); freeze procedure below — no SHA frozen yet, freeze only after P1 attribution, else proofs cannot bind. Outcome/batch figures below are owner-provided; step 2 re-measures them on the frozen SHA.

### ASCII-карта

```text
  D1 strict + single-DB (lanes отменены решением 2026-09-18) + freeze = едем
    P1 атрибуция -> freeze SHA -> inventory
      -> Tier A детерминированное (параллельно, без браузеров)
      -> single-DB readiness: reset + migrate + seed customreport_e2e
      -> Tier B браузер по ролям последовательно (reset+seed между ролями)
      -> P6 гейт + 39.6 на том же SHA
```

0. Fixed: strict 39.6; single-DB (lanes superseded 2026-09-18); code frozen after P1; R13 external (18/19/6) not counted in 39.6 PASS.
1. P1 + freeze (read-only, single owner): attribute dirty files (incl. `.agents/skills/*` m-edits — revert or keep with an owner); then `git rev-parse HEAD` = frozen SHA. All steps below bind to it + hashes of task-owned uncommitted files. Any spec edit after freeze resets affected outcomes to unclassified — only via decision.
2. Inventory on frozen SHA (single pass, no parallelism): re-measure totals (~3124; excluded ~3081/153 specs; mandatory ~43 in 7 specs incl. ~20 with refs; unclassified; missing refs ~1663; flows 6 files vs 97 names). Output: deterministic-vs-browser table per batch — batch sizes are estimates until then.
3. Tier A deterministic (bulk, parallel authors; single writer to `spec-coverage.json` — registry merge is the bottleneck): proof `{kind, surface, reference, detail}`, reference must resolve to a repo file (`assertRepositoryFile`), empty proofs forbidden. Batches per excluded counts (refine by inventory): LEAD ~565 (21 specs, max lead-slide-by-product-grid 77), ADMIN ~254 (8 specs, max admin-settings-ui 64), HEAD ~119 (4 specs), VIEWER ~51 (2 specs), SHARED ~2092 (incl. authenticated-product-feedback 125, reliable-reminder-delivery 112, pdf-export-integrity 111) + OTHER ~1396 — split by fitness for deterministic proof, not by name. Checks: `vitest run scripts/gates/reticle-spec-coverage.test.ts`, `pnpm spec:check` (blocking), `pnpm test:reticle` (non-blocking) — green. Stop: mandatory floor ≥20 holds; unclassified/missing/unknown/duplicate/stale in mandatory = 0.
4. Single-DB readiness (single owner, owner decision 2026-09-18 SUPERSEDES lanes): reset + migrate + seed `customreport_e2e`, consent strictly per run, loopback host, `NODE_ENV!=production`, dev servers up, synthetic seed; reset+seed между фазами/ролями. Check: guard accepts `customreport_e2e`; один browser/fixture owner последовательно, иначе cross-talk и flaky `verified: yes`.
5. Tier B browser by roles×URLs (sequentially on single DB): LEAD→`/lead/*` (+ narrow `/lead/report/:id/preview` lead-only); HEAD→`/head/*` (head+admin); ADMIN→`/admin/*` (admin-only); VIEWER→`/reports/*`, `/reports/latest`, `/print/*`. Flow requirements: non-empty intent, consequence signal/net/state only (console/text supplemental), presence-only/action-only rejected, then native replay `verified: yes` + successful replay. 6 files vs 97 names: missing ~90+ flows must be written first or recorded excluded-or-todo — do not batch them. Serialization: strictly sequential per role (one login, one session) with reset+seed between roles; no parallel across lanes on one DB.
6. P6 + 39.6 on the frozen SHA: 44.14 gates with commands+results+source identity logged; 39.6 full coverage/criteria≥2/0/critical green; 44.15 counts/delivery/cleanup; 44.13 Astra review or recorded unavailability.

Risks: mid-pass spec edits reset progress (reset→unclassified); browser parallelism on one single DB flakes — strictly sequential with reset+seed between roles; ~90+ missing flows are the main time sink, not the deterministic part.

## P1 result (2026-09-17, read-only)

- Attribution: all 137 status paths map to pre-existing commits (latest `b2c84df49` 2026-09-15; top groups `9b89b67cf`×24, `b2c84df49`×18, `37e64c821`×16, `c7766a20b`×12; nothing committed by this campaign). Reproduce: per-path `git log -1` at HEAD `a41779cf5`. Tree left dirty per contract — no cleanup performed.
- Frozen basis: HEAD `a41779cf5` + the inventoried uncommitted delta above.
- Inventory on that basis: 3124 outcomes; classified 3082 / unclassified 42; deterministic proofs 1683 (1663 without `reference`); reticle proofs 1482; empty proofs 42 (= unclassified); excludedSpecs 153 / excludedOutcomes 23 / minMandatory 20; saved flows 5 files vs 97 mapped names.
- Next: Tier A batches per step 3 (parallel authors, single writer to `spec-coverage.json`).

## P1 execution (goal 3c96657e, 2026-09-18, read-only)

- Method: per-path `git log -1` over all 141 status paths at HEAD `a41779cf5`; first attempt, zero failures. Full per-path table kept outside the repo (`/tmp/wr-p1-attrib-20260918.txt`); reproduce by re-running the loop.
- Result: 138 tracked-modified paths map to pre-existing commits, all by Aleksandr Polenkov (one campaign, incl. merge `bb121540b` PR #70). Top groups: `9b89b67cf`×24 (web authoring UI), `b2c84df49`×19 (lead authoring simplify), `37e64c821`×16 (api lifecycle), `c7766a20b`×12 (skills refresh), `73e646da9`×11 (MVP), `6272693e7`×11 (specs alignment), `95203545b`×10 (quality campaign). `.reticle/spec-coverage.json` maps to HEAD `a41779cf5` itself (further worktree-modified). 3 untracked: `pi.jsonl` (session export 17.09), `.reticle-setup-crash.log` (reticle setup 18.09), `activity-reporting-unit-lead-form.json` (Tier B flow 18.09).
- Delta vs 17.09: 137→141 (+4). Nothing committed by this goal.
- Frozen SHA: `a41779cf5` (full `a41779cf557308d266c7e64d8819a130adc8728f`), branch `feat/agentation-feedback`, ahead 1 of origin. All later steps bind to it + hashes of task-owned uncommitted files.
- Keep/revert per path: owner decision 2026-09-18 — KEEP ALL (все 141 путь остаются; это одна цель доведения репо до эталона). Tree left dirty per contract — no cleanup, no commits. P1 checkbox untouched (acceptance by owner).

## Why

The complete source review found concrete problems in report data preservation, pending edits, query recovery, projections, test accuracy, and delivery checks. This change tracks their correction and final desktop acceptance so that finishing a review cannot be mistaken for delivering the working MVP.

## What Changes

- Carry all 231 accepted in-scope findings into traceable engineering tasks, with no dropped or duplicate IDs.
- Reconcile changed files with current report-authoring and feedback work before editing them.
- Correct confirmed behavior against existing specifications; create focused child changes with spec deltas when a missing or changed requirement needs to become durable.
- Complete architecture and desktop UI/UX verification, then run the full final acceptance against identified sources.

### Non-goals

- Mobile testing or redesign; the current visual direction is preserved.
- Security, access-control, credential, and cryptographic assessment, excluded by the user's scope correction.
- External publication, production readiness claims, or destructive database actions without their separately required authority.
- Copying raw review cards, logs, screenshots, or generated inventories into product documentation.

## Capabilities

### New Capabilities

None in this coordination change.

### Modified Capabilities

None directly. Individual repairs must read their owning existing requirements and carry any necessary deltas in a focused child change before behavior edits. File existence in the ownership map is a navigation aid, not proof that a requirement covers a finding.

## Impact

The work spans shared contracts, API, web, repository gates, seeds, and documentation. The initial review covers 2,466 source files at baseline HEAD `8796570475e7e94af00f0fce38472fccab1f8efc`, with SHA-256 manifest digest `a967de1b4bf21c5555d2ddd78a7cc91ca41de8d69fe4e4ed61c3bac6a979dc74`. That snapshot includes pre-existing worktree content. Final acceptance must also cover subsequent relevant source changes. Detailed evidence remains in the external execution artifact set for this review.
