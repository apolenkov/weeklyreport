# Plan — Close point gaps in e2e/regression coverage

> Scope expanded per user feedback: also finish all actionable undone items
> from this session. Title kept per plan-mode rule; body covers the wider set.

## 0. TL;DR (для человека)

### Было

```text
+--- состояние на 2026-05-22 ---------------------------------+
| accumulated-work-audit прогнан → 112 items                  |
|   IN-PROGRESS 2 · NOT-STARTED 8 · LOOPS 5 · DONE 93         |
| e2e: 50-55 живых spec'ов, НО revoke-downstream = fixme-      |
|   заглушки (SC-162/163/164/166), head-dashboard поверхностно |
| 4 pending-todo из §23 kurzweil висят незакрытыми            |
| инструмент аудита (.planning/scripts/) НЕ закоммичен        |
| db:wipe:manual-uat ПАДАЕТ — tx.priority удалён в F1         |
+-------------------------------------------------------------+
```

### Проблема

```text
[fixme-заглушки revoke] → [ложное ощущение «не покрыто»] → re-investigation
[revoke боевой, downstream через status=draft работает] → тесты НЕ написаны
[pending-todo §23 без закрытия] → теряются между сессиями
[audit-инструмент в dirty tree] → работа не зафиксирована, исчезнет
[holidays / i18n названы «доделать»] → на деле крупные фичи, не doodle
```

### Станет

```text
было                                  │  станет
──────────────────────────────────────│───────────────────────────────────
revoke SC-162/163/164/166 = fixme      │  живой revoke-downstream.integration
head-dashboard только visibility       │  + KPI-значения против seed
3 pending-todo §23 (writable)          │  закрыты: тест + reason+toast
audit-инструмент uncommitted           │  закоммичен на ветке PRJ-2
holidays/i18n = «надо доделать»        │  явно классифицированы как фича-фаза
remind-aria-live                       │  помечен human-only (screen reader)
```

### Пайплайн фаз

```text
[P0]──[P0.5]────[P1]──────[P2]────────[P3]──────────[P4]──────[P5]
commit  wipe      e2e-gaps  todo-§23    head/viewer/  review    verify+
audit   regression revoke   (test+code) AI-summary    gate      handoff
tool    (URGENT)   downstream
```

## 1. Сейчас

- Branch: `fix/PRJ-2/shiny-eagle` (PR #7 open, ~84 commits ahead of `origin/main`).
- Task: `PRJ-2` (ttt active).
- Dirty tree: `M package.json` (audit-work script), `?? .planning/scripts/`,
  `?? .planning/audits/.gitignore`, `?? goals/`, `?? .planning/plans/needs-research-2-*.md`.
- Milestone: v8.3 UAT Final Review, `in_review`.

## 2. Git audit

- HEAD on feature branch, not `main` — safe to commit.
- No tag for in-flight work; closeout is PR #7 merge (human-gated in GitHub UI).
- Stray plan file `needs-research-2-virtual-starlight-agent-a1b7c2a14e87dd472.md`
  (989 lines) is a background-agent artifact → superseded by this plan; delete
  or leave untracked (do not adopt).

## 3. GSD / audit state

- `.planning/STATE.md`: v8.3 in_review, 5/5 phases.
- accumulated-work-audit JSON/MD: source of the undone-item list (read-only ledger).
- Pending todos live in `.planning/todos/pending/` (4 from §23 kurzweil + holidays + telemetry).

## 4. Recovered intent

User wants two things: (A) close the named e2e/regression coverage gaps; (B)
"finish everything from the session that wasn't done". Investigation shows the
undone set is heterogeneous — some are quick test/code closes, some are large
features, one is human-only. This plan does the writable work and explicitly
classifies the rest so nothing is silently dropped or falsely marked done.

## 5. Classification of the undone set

| Item                                                               | Type                                              | Verdict                 |
| ------------------------------------------------------------------ | ------------------------------------------------- | ----------------------- |
| `wipe-manual-uat.ts:185` `tx.priority` crash (F1 dropped Priority) | regression bug                                    | P0.5 — URGENT, fix now  |
| Commit audit tool (`.planning/scripts/`, `package.json`)           | chore                                             | P0 — do now             |
| revoke-downstream SC-162/163/164/166                               | test gap (feature exists)                         | P1 — write              |
| head-dashboard deeper KPI asserts                                  | test gap                                          | P3 — write              |
| viewer full-route walk                                             | test gap                                          | P3 — write              |
| deactivate-user TODO asserts                                       | test gap                                          | P3 — write              |
| AI-summary structure assert                                        | test gap                                          | P3 — write              |
| `activity24h-querykey-assertion`                                   | test nit (~20 LoC)                                | P2 — write              |
| `dispatch-pending-author-check`                                    | code+test (`reason` field + toast)                | P2 — write              |
| `remind-aria-live`                                                 | manual screen-reader QA                           | HUMAN-ONLY              |
| `holidays-calendar`                                                | large feature (schema+seed+logic+UI)              | OUT — needs own phase   |
| i18n switcher                                                      | large feature, frozen by CLAUDE.md UI-string rule | OUT — frozen            |
| `future-ui-telemetry-coming-soon`                                  | research/coming-soon                              | OUT — frozen            |
| SC-160 dashboard revoke btn / SC-165 bulk revoke                   | feature gap                                       | OUT — feature           |
| email-dispatch e2e (Mailpit)                                       | heavier integration                               | OUT — separate decision |
| AI/RAG, dark theme                                                 | NEEDS-RESEARCH                                    | OUT — frozen by user    |

[!NOTE] Decisive evidence for P1: `revokeSectionSubmission`
(`apps/api/src/modules/report-sections/lead-form.prisma-repository.ts:76`) sets
`status:"draft"` + `revokedAt`; aggregations filter `status==="submitted"`
(`weekly-report.prisma-repository.ts:107,142`; `analytics.prisma-repository.ts:99`).
So KPI drop / weekly removal / re-edit already work via the status transition —
SC-162/163/164/166 are test gaps, not feature gaps. The stale comment "UI not
yet implemented" is wrong (Reopen SC-156/157/158 and revoke SC-161/167 are live).

## 6. Boundaries / Не трогать

- In: `apps/web/e2e/**`, `apps/api/src/infrastructure/trpc/trpc.router.ts`
  (dispatchPending `reason`), the dispatch toast in web, the audit-tool commit.
- Out: holidays/i18n feature builds, runtime files, neighbouring repos, the
  4937-line `REGRESSION-SCENARIOS.md` (already exists — reuse, don't rewrite),
  SC-160/SC-165 features, NEEDS-RESEARCH topics.

## 7. Phases

### P0 — Commit the audit tool (chore)

- Stage the audit tool + npm script; commit on `fix/PRJ-2/shiny-eagle`.
- Files: `.planning/scripts/**`, `package.json` (`audit-work`),
  `.planning/audits/.gitignore`. Leave `goals/` and reports per existing gitignore.
- Commit: `chore(planning): accumulated-work-audit tool (streaming scan + 9-bucket report)`.

### P0.5 — Fix `db:wipe:manual-uat` regression (URGENT)

[!WARNING] Live failure: `pnpm db:wipe:manual-uat` →
`TypeError: Cannot read properties of undefined (reading 'deleteMany')` at
`prisma/wipe-manual-uat.ts:185`. Root cause: F1 (`feat(F1): drop Priority table`)
removed the `Priority` model; seed files were updated but this wipe script was
missed → `tx.priority` is `undefined`. Confirmed: only stale ref in `prisma/`;
`Priority` absent from schema; `Item.priorityRank` (schema:299) is the replacement.

- Delete line 185 `priority: (await tx.priority.deleteMany({})).count,` in
  `prisma/wipe-manual-uat.ts`; remove the `priority` key from the `CountMap`
  type if typed there (else `tsc` error). `item.deleteMany` (line 188) already
  clears `priorityRank` (a column on Item now).
- Bug = two fixes: also add a smoke that exercises wipe against the test DB so a
  dropped-model regression in any wipe/seed script fails CI (e.g. an integration
  test calling the wipe transaction, or `tsc` over prisma scripts in CI).
- Verify: `pnpm db:wipe:manual-uat` exits 0; `pnpm db:seed:advanced` still works.
- Commit: `fix(prisma): wipe-manual-uat drops stale Priority deleteMany (F1 regression)`.

### P1 — revoke-downstream e2e (test gap)

- NEW `apps/web/e2e/integration/revoke-downstream.integration.spec.ts`.
- Reuse DB-backed pattern from `apps/web/e2e/integration/pdf-export.integration.spec.ts:32`
  with fixtures `apps/web/e2e/fixtures.ts` and seed UUIDs (`LEAD_MARIA …-012`).
- Cover SC-162 (KPI drop), SC-163 (weekly removal), SC-164 (revoke→edit→resubmit),
  SC-166 (revoke blocked while published → reopen first) via tRPC `revoke`
  (`trpc.router.ts:2030`) + Prisma assertions on `status`/`revokedAt`.
- In `publish-revoke.spec.ts`: drop migrated `fixme` blocks, fix stale header,
  annotate SC-160/SC-165 as documented feature gaps (no false green).

### P2 — §23 pending todos (test + small code)

- `activity24h-querykey-assertion`: Vitest unit asserting `Activity24hCard` and
  `ActivityLivePanel` resolve identical `trpc.activity.live` queryKey (Option A, ~20 LoC).
- `dispatch-pending-author-check`: in `dispatchPending`, when `leadId` set and
  `draftSections.length===0`, return `{…, reason:"no-matching-section"}`; web toast
  distinguishes it; add unit test for the empty-branch. Move both todos to `done/`.

### P3 — shallow-coverage deepening (test gap)

- `head-dashboard.spec.ts`: assert KPI numbers vs seed (not just visibility).
- viewer-role full route walk (regression spec) beyond the single redirect.
- deactivate/activate-user TODO assertions (ADM-USERS-06..08).
- AI-summary card: assert structure/placeholder renders for a seeded period
  (not exact AI text).

### P4 — Review gate (separate phase)

- `/peo-plan review --domain tests,react,node` on the diff. Output PASS/BLOCK
  with `file:line`. Checks: tests cover the bug class, no hidden fallback zeros,
  no stale comments, no unrelated dirty files.

### P5 — Verify + handoff

- Run the verification block; update `.planning/todos/` (move closed todos);
  note holidays/i18n as backlog; surface `remind-aria-live` as human QA.

## 8. Skill routing

- `peo-plan` (this) — plan + later review/verify modes.
- `peo-session-scan` / accumulated-work-audit — already produced the undone ledger (reused, not re-run).
- `peo-retro` — closeout handoff at P5.
- Skipped: `gsd-*` phase machinery (work is repo-local edits, not a new milestone);
  `ui-orchestration` (no new UI design); `peo-confluence`/`peo-jira` (no doc/ticket change).

## 9. Subagent roadmap

| Agent                  | Tier          | Scope                                                               | R/W           | Output                   | Trigger     |
| ---------------------- | ------------- | ------------------------------------------------------------------- | ------------- | ------------------------ | ----------- |
| Orchestrator           | Opus          | sequence, commit, merge-conflict guard                              | write (git)   | final                    | always      |
| A — todo/test edits    | Claude: Haiku | P2 activity24h test + P3 deactivate/AI-summary asserts              | write, scoped | green specs              | after P0    |
| B — revoke integration | Sonnet        | P1 `revoke-downstream.integration.spec.ts` + publish-revoke cleanup | write, scoped | passing integration spec | after P0    |
| C — dispatch code      | Sonnet        | P2 `dispatchPending` reason + toast + unit                          | write, scoped | passing unit             | after P0    |
| D — review             | Haiku→Sonnet  | P4 read-only review of diff                                         | no write      | PASS/BLOCK + file:line   | after P1-P3 |

File-boundary matrix: A=test files only; B=`e2e/integration/` + `publish-revoke.spec.ts`;
C=`trpc.router.ts` + dispatch toast + its unit. No overlap.

## 10. Token economy

| Work                                    | Model  | Writes                                    |
| --------------------------------------- | ------ | ----------------------------------------- |
| read todo bodies, grep selectors        | Haiku  | no                                        |
| activity24h test, deactivate/AI asserts | Haiku  | yes, scoped                               |
| revoke integration spec, dispatch code  | Sonnet | yes, scoped                               |
| synthesis / conflict / final commit     | Opus   | yes (git only)                            |
| deep model                              | —      | not used (no verified high-risk conflict) |

## 11. Agent does / Human does

```text
✓ Я ДЕЛАЮ САМ
  ├── P0 commit audit tool
  ├── P1 revoke-downstream integration spec + publish-revoke cleanup
  ├── P2 activity24h test + dispatch reason/toast/test
  ├── P3 head-dashboard/viewer/deactivate/AI-summary asserts
  ├── P4 peo-plan review gate
  └── P5 run verification, update todos, write handoff

▲ ОТ ТЕБЯ
  ├── merge PR #7 in GitHub UI (protected branch) — when ready
  ├── remind-aria-live: ~30 min screen-reader QA (VoiceOver/NVDA)
  └── decision on holidays-calendar / i18n / email-dispatch (own phases)
```

## 12. Open questions (with defaults)

| #   | Question                              | Default                               | Ask human when                |
| --- | ------------------------------------- | ------------------------------------- | ----------------------------- |
| 1   | Build SC-160/SC-165 features too?     | No — test-only; leave documented gaps | user wants the features       |
| 2   | Email-dispatch e2e via Mailpit?       | Defer — separate task                 | reminder-delivery prioritised |
| 3   | Start holidays-calendar feature now?  | No — large, needs own phase           | user reprioritises            |
| 4   | activity24h: unit test vs dev-assert? | Option A (unit test)                  | —                             |
| 5   | Commit audit tool reports too?        | No — keep gitignored (privacy)        | user wants them tracked       |

## 13. Verification

```bash
pnpm db:wipe:manual-uat                                    # P0.5 — must exit 0 (was crashing)
pnpm db:seed:advanced                                      # P0.5 — seed still works after wipe
pnpm --filter @customreport/web exec tsc --noEmit          # P1-P3 specs typecheck
pnpm test:e2e:integration -- revoke-downstream             # P1 (needs E2E_DATABASE_URL + advanced seed)
pnpm test:e2e -- publish-revoke head-dashboard             # P1/P3
pnpm --filter @customreport/web test -- activity24h        # P2 unit
pnpm --filter @customreport/api test -- dispatchPending    # P2 unit
pnpm lint:md                                               # planning docs
git status --short                                         # P0/P5 tree clean of intended files
```

Scenarios to confirm green:

- (a) revoke submitted section → DB `status==="draft"`, `revokedAt` set
- (b) analytics submissions KPI decremented after revoke
- (c) weekly report omits revoked lead's product items
- (d) revoked lead re-edits + re-submits → data reappears
- (e) revoke blocked while period `published` (must reopen first)
- (f) activity24h queryKeys deeply equal across both call sites
- (g) dispatchPending returns `reason:"no-matching-section"` on empty+leadId
- (h) SC-160/SC-165 remain `fixme` with explicit feature-gap notes (no false green)
- (i) `pnpm db:wipe:manual-uat` exits 0 (no `tx.priority` crash); seed re-runs clean

## 14. Review gate

- Pre-impl: this plan (read-only strategy) — done.
- Post-impl (P4): `/peo-plan review` → PASS/BLOCK with `file:line`. BLOCK requires
  evidence. Checks source-of-truth alignment, bug-class test coverage, no hidden
  fallback zeros, no stale comments, no unrelated dirty files.

## 15. Iteration reserve / Self-review

Reserve ~15% for plan hardening + post-impl review. Self-check before exit:

- [x] Skill-first route stated (§8) and what's skipped
- [x] TL;DR has Было/Проблема/Станет + phase pipeline (ASCII, square-friendly)
- [x] Undone set classified; large features + human-only split out (no false "done")
- [x] Reuse named (fixtures, reseed, seed UUIDs, existing 4937-line scenarios, revoke mutation) — no reinvention
- [x] Subagent roadmap has tier/scope/ownership/output; no file overlap
- [x] Token economy: Haiku scan/small, Sonnet impl, Opus orchestrate, no deep model
- [x] Agent/Human split — human only for protected-branch merge + screen-reader QA + feature decisions
- [x] All open questions have defaults
- [x] Concrete lint/test/verify commands + scenario checklist
- [x] Closeout: commit (P0/P5), PR #7 merge flagged human, todos updated

## Дальше

Current round: P0-P5 above. Named backlog (own phases / decisions):
holidays-calendar, i18n switcher, email-dispatch e2e, SC-160/SC-165 features.
Frozen (user): AI/RAG, dark theme, future-ui-telemetry.
