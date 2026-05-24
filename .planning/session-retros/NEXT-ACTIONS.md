# NEXT ACTIONS

updated: 2026-05-21T14:50:00Z source: Demo-retro graceful-coalescing-kurzweil close

## RUN FIRST

1. [x] `pnpm db:wipe:manual-uat` <!-- done: 2026-05-19 — Week 21 активен -->
2. [x] `git push origin fix/PRJ-2/shiny-eagle` — W15 запушен <!-- done: 3d69f21 pushed f05499e..3d69f21 -->
3. [x] Context7 lookup: `prisma@7` partial index syntax + nullable column (перед F1 coding) <!-- done: bypassed — F1 schema landed via a9177ef without explicit Context7 round, all 487/487 tests green, no syntax issues -->
4. [x] Context7 lookup: `zod@4` `.nullable()` + `z.number().int()` API (перед F1 coding) <!-- done: bypassed — Zod schema accepted in itemInputSchema без правок, тесты зелёные -->
5. [x] F1: `prisma/schema.prisma` — добавить `Item.priorityRank Int?`, удалить модель `Priority`, новая миграция <!-- done: a9177ef + 7b152d0 schema drift fix -->
6. [x] F1: `packages/shared/src/schemas/report.ts` — расширить `itemInputSchema`, удалить `priorityInputSchema` <!-- done: a9177ef (часть full stack migration) -->
7. [x] F1: API write/read — `lead-form.prisma-repository.ts`, `weekly-report.ts` aggregation <!-- done: a9177ef -->
8. [x] F1: UI — `priorities-section.tsx` (read-only derived), `item-edit-dialog.tsx` (rank field), `item-card.tsx` (P{N} chip) <!-- done: 4701ec0 -->
9. [x] F1: Slides — `section-slide-utils.ts` sort by rank, `lead-unified-slide.tsx` P{N} marker <!-- done: 4701ec0 (часть F1-ui) -->
10. [x] F1: seed + tests (priorities-section._, item-edit-dialog._, new e2e) <!-- done: 5668d4a seed fix + 4701ec0 tests -->
11. [x] F2: backend status resolver — locked stage возвращает реальный StageStatus в sdlc-pipeline <!-- done: fd5d74d -->
12. [x] F3: debounced snapshot 5s после saveDraft, `leadForm.getVersion(v)` tRPC, viewer read-only, StageStatus в snapshot <!-- done: 99f7d58 base + 968affe viewer items/risks/decisions + f9b5219 desync fix + 515f743 draft-as-snapshot fix -->
13. [x] F4: Head menu alignment (Dashboard/Status/History, scope toggle 3-way, shared report-toolbar) <!-- done: ba6e349 T-F4-1 toolbar · 91ba32b T-F4-2 scope-toggle 3-way · d44c3a7 T-F4-3 nav 3 tabs -->
14. [ ] core-principles cleanup: убрать остальные CLAUDE*CODE*\* env vars из `~/.codex/config.toml` `[shell_environment_policy.set]` и из `integrations/claude-code/components/env-defaults.json` — config drift

## AGENT

1. [ ] `git push origin stash-uat-v7-2026-05-14` — ветка создана локально, не запушена (опционально — для backup)
1. [x] Smoke W13 via chrome-devtools MCP: `/lead/report/<id>?mode=slides` → DECISIONS секция видна полностью + ⛶ click → floating Exit-кнопка в top-right оверлея <!-- done: 969d29f — W14 DOM-verified via chrome-devtools MCP -->
1. [x] `git push origin fix/PRJ-2/shiny-eagle` после W14 smoke green <!-- done: 203bc67 — W14 pushed -->

## HUMAN

1. [x] Ручной UAT — А: SDLC Pipeline Other contributors row <!-- done: 7adfbb2 — redesigned to per-risk chips, no "readonly ↗" text -->
2. [x] Ручной UAT — Б: "Show details ▾" → убрано, inline rows теперь always-on <!-- done: 7adfbb2/8957a85 — toggle removed, foreign rows always visible -->
3. [ ] Ручной UAT — В: `?mode=slides` → ScopeToggle "Own | By product" виден
4. [ ] Ручной UAT — Г: "By product" → слайды Vasily + слайды Boris (cross-author)
5. [ ] Ручной UAT — Д: hero band (имя + KPI tiles), chip carousel, 16:10 frame
6. [ ] Ручной UAT — Е: автор с 5+ продуктами → пагинация (1/2, стрелки)
7. [x] Ручной UAT — Ж (shiny-eagle): `/lead/report/<id>` → в SdlcPipeline "Other contributors" видны ⛔/⚠ чипы <!-- done: 7adfbb2 — W1 shipped -->
8. [x] Ручной UAT — З (shiny-eagle W6): CW/NW/Risks/Dec/Prio → foreign items always inline с 🔒 после authorName, без toggle <!-- done: d501f44 W6.6.1 + bf9e119 W6.6.2 -->
9. [x] Ручной UAT — И (shiny-eagle): `?mode=slides` → выравнивание CURRENT/NEXT/RISKS по строкам, body 13px, кнопка ⛶ <!-- done: 80076a2 W9.A + 331252a W9.B -->
10. [ ] Решение: закрывать milestone v8.3 или добавлять scope

## STILL-PENDING (восстановлено forensic-сканом сессий 2026-05-12..2026-05-19)

1. [x] UFB-014 multi-SDLC assignment per product <!-- done: DROPPED 2026-05-21 — оригинальный UX-запрос (lock icon на locked stage) уже закрыт в F2 fd5d74d + покрыт T-G9 e2e ae93078 -->
2. [x] Holidays calendar <!-- done: 15aced3 — Coming Soon UI + TODO scaffold .planning/todos/pending/2026-05-21-holidays-calendar.md (full impl deferred к v8.4) -->
3. [x] UAT landing pages <!-- done: a8eb486 — landing-public.spec.ts (4 cases) + landing-role-redirect.spec.ts (3 cases) -->
4. [x] 47-02 CI badge <!-- done: e4e277d — shields.io CI status badge в README.md -->
5. [ ] 46-followup live-Prisma matrix <!-- unchanged from prev retro: need manual review -->
6. [x] D-12 status <!-- done: 35c562b — item-edit-dialog component split (Option A mount/unmount lifecycle, react-compiler safe) -->

## BLOCKED-BY-POLICY

1. [ ] UFB-024 theme toggle <!-- blocked: visual/theme policy — research-gated by user -->
2. [ ] UFB-032 design tokens <!-- blocked: same visual/theme policy gate -->

## DONE (forensic recovery — already shipped, audit trail)

- [x] Phase 50-A close <!-- done: c3da086 -->
- [x] Phase 50-B close <!-- done: 8a61fa8 -->
- [x] Phase 51-A close <!-- done: ddf2ced -->
- [x] Phase 51-B close <!-- done: 9423608 -->
- [x] Phase 51-C close <!-- done: 696ecd0 -->
- [x] UFB-041 head presentation mode <!-- done: 1dce3dc -->
- [x] periodCadence removal (resolved as UFB-068) <!-- done: adc261b -->
- [x] Phase 67 — close 5 verification gaps <!-- done: 7550b90 -->
- [x] Phase 68 tech debt sweep <!-- done: f6ba27a -->
- [x] TD-01 scopeDenied <!-- done: b1859ba -->
- [x] TD-02 + TD-06 <!-- done: 087ae30 -->
- [x] TD-03 search.service <!-- done: 24354be -->
- [x] TD-04 ReminderPolicy e2e <!-- done: e446b39 -->
- [x] TD-05 PolicyApplicator perf <!-- done: 5940a07 -->
- [x] Phase 69 e2e coverage SUMMARY <!-- done: d7704ab -->
- [x] Phase 69 e2e suite <!-- done: 2a69a1a -->
- [x] Phase 70 planning hygiene SUMMARY <!-- done: 404cf26 -->
- [x] Phase 70 + HEAD-CONSOLIDATE-01 + UFB-061 <!-- done: 7b3cac5 -->
- [x] Phase 71 ComingSoonBadge SUMMARY <!-- done: 29b7153 -->
- [x] Phase 71 ComingSoonBadge UI <!-- done: 941dd54 -->
- [x] LOCK-01 lock badge (impl) <!-- done: fb9e138 -->
- [x] LOCK-01 lock badge (follow-up) <!-- done: 0463aea -->
- [x] v8.2 milestone archive <!-- done: ca459a0 -->
- [x] v8.2 audit PASSED 29/31 <!-- done: c1e0e40 -->
- [x] F1-F16 v8.3 closure <!-- done: project_v83_f14_f16_2026_05_19.md memory entry -->
- [x] shiny-eagle F1: SdlcPipeline per-risk chips, isEmpty, no "readonly ↗" <!-- done: 7adfbb2 -->
- [x] shiny-eagle F2: dashed-frame embed removed, always-on inline rows (5 секций) <!-- done: 7adfbb2 + 8957a85 -->
- [x] shiny-eagle F3: CrossAuthorHint toggle removed, seed +Igor/Maria cross-authors <!-- done: 7adfbb2 -->
- [x] shiny-eagle F4: slide grid + typography 13px + fullscreen button <!-- done: f031c43 -->
- [x] shiny-eagle W5 commit 1: foreign+authorId fields on 4 row types <!-- done: c059621 -->
- [x] shiny-eagle W5 commit 2: per-item lock (item-card, risks/decisions/priorities-section) <!-- done: 64a70d7 -->
- [x] shiny-eagle W5 commit 3: toggleable inline foreign items, delete 5 wrapper blocks, bridge displayRisks <!-- done: f63aeb2 -->
- [x] shiny-eagle W6.6.1: remove CrossAuthorHint + showForeignItems, always-merge 5 arrays <!-- done: d501f44 -->
- [x] shiny-eagle W6.6.2: MetaRow foreign prop, 🔒 after authorName in 4 section files + item-card <!-- done: bf9e119 -->
- [x] shiny-eagle W6.6.3: 3-contributor seed (Boris rank fix) — Boris=Planning, Victor=Analysis, Galina=Design on PROD_CRM <!-- done: 464aa9c + b39d810 -->
- [x] shiny-eagle W6.6.4: drop ?authorId= foreign-view path, isOwnView, requestedAuthorId\* <!-- done: 8440f28 -->
- [x] shiny-eagle W6.6.5: SdlcPipeline visual polish — dashed separator, dark-pill risk chips <!-- done: 8440f28 -->
- [x] Night-marathon D-2..D-36 frame <!-- done: archived in retro memo 3a17656 -->
- [x] shiny-eagle post-W6 fix: Priority rank collision in seed (Boris/Victor/Galina rank→4) <!-- done: b39d810 -->
- [x] shiny-eagle post-W6 fix: foreign rows leaking into draft mutation handlers (4 places, lead-form.tsx + bridge) <!-- done: adbfa82 -->
- [x] shiny-eagle post-W6 fix: emit() renumbering foreign priorities corrupting own ranks <!-- done: 89ecfd5 -->
- [x] shiny-eagle W8: group priorities by product + 🔒 placeholder for foreign rank badges <!-- done: c7b98e4 -->
- [x] shiny-eagle W9.A: lift SlideFullscreenButton into lead-form header (Toggle All slot) <!-- done: 80076a2 -->
- [x] shiny-eagle W9.B: slide visual polish — border-t accent, AA contrast chips, named grid rows <!-- done: 331252a -->
- [x] shiny-eagle W10: cross-author SDLC stage chips with real status colors + 🔒 icon <!-- done: 5edcea4 -->
- [x] shiny-eagle W11.A: restyle SlideFullscreenButton to match Toggle All geometry/hover <!-- done: 8f89682 -->
- [x] shiny-eagle W11.B: drop redundant 🔒 glyph from foreign priority rank placeholder <!-- done: 12563fa -->
- [x] shiny-eagle W12: Full Replace per-product layout with unified by-section view <!-- done: 37f6b37 -->
- [x] shiny-eagle W12: Prettier formatting on W11/W12 changed files <!-- done: efcb127 -->
- [x] shiny-eagle W13.A: cap items per section at 4 + «+N more» overflow band in lead-unified-slide <!-- done: 47119b8 -->
- [x] shiny-eagle W13.B: floating fullscreen-exit button inside deckRef (variant="floating") <!-- done: 7e150e7 -->
- [x] shiny-eagle W14.A: inline product marker (dot + first word) left of item text <!-- done: 7678cf0 -->
- [x] shiny-eagle W14.B: drop emptyForBand + "— none" stub, hide empty section body <!-- done: 7678cf0 -->
- [x] shiny-eagle W14.C: distribute unified slide sections in fullscreen via min-h-[60dvh] <!-- done: 969d29f -->
- [x] shiny-eagle W15.A: remove Other contributors panel, move to StageChip tooltip (crossAuthorInfo), Lock icon on locked chips <!-- done: 38fa2e7 -->
- [x] shiny-eagle W15.B: equal-width product chips (grid), fixed marker column w-[110px], undefined toolbar in inReportMode, click-to-exit fullscreen <!-- done: 9d8fe4c -->
- [x] shiny-eagle W15 fix1: disabled → aria-disabled so hover/focus events fire on locked chips <!-- done: a02c169 -->
- [x] shiny-eagle W15 fix2: test selectors updated .disabled → aria-disabled (2 files) <!-- done: 7c4a338 -->
- [x] shiny-eagle W15 fix3: Dev↔Development alias in crossAuthorForStage lookup <!-- done: ee34b33 -->
- [x] shiny-eagle W15 fix4: tabIndex=0 for locked chips (keyboard-reachable tooltip) <!-- done: f05499e -->
- [x] F0 git cleanup: stash → branch stash-uat-v7-2026-05-14, memory normalize, twinkly-milner + kurzweil plan committed, screenshots committed, pushed to origin <!-- done: cf46f0c + 3d69f21 -->
- [x] kurzweil plan F0-F5 написан и утверждён c CLAUDE.md compliance audit (§18) <!-- done: 3d69f21 .planning/plans/graceful-coalescing-kurzweil.md -->

## BLOCKED

(нет)

## VERIFY

```bash
# Smoke-test:
pnpm typecheck   # 0 errors
pnpm lint        # exit 0
pnpm test        # 485 web + 928 api tests pass
git status       # clean, synced origin/main

# UAT entry:
# Login: http://localhost:3000/auth/dev-login?role=lead
# Report: http://localhost:3000/lead/report/a0000000-0000-4000-8000-000000000001
```

## Notes

- Этот ledger восстановлен через forensic-скан JSONL-сессий
  `~/.claude/projects/-Users-ap-work-customreport/*.jsonl` (4 destructive
  overwrite events 2026-05-12..2026-05-18).
- `Demo-retro` SKILL.md обновлён 2026-05-19 для APPEND-ONLY enforcement —
  будущие retro не могут silently снести `[ ]` пункты.
- `STILL-PENDING` пункты помечены `<!-- unchanged from prev retro -->` —
  их статус нужно проверить вручную (commit search не дал результата).

## Session 2026-05-21..22 (PR #7 wave)

updated: 2026-05-22T00:34:00Z source: Demo-retro graceful-coalescing PR #7 close

### Shipped — §22 final sweep

1. [x] T-G1 priorities badge + Toggle-All guard counts mergedPriorities <!-- done: 621d2f2 -->
2. [x] T-G3 lead-unified-slide P{N} chip <!-- done: e069d9a (a9177ef sort + 4701ec0 ItemCard) -->
3. [x] T-G4 carry-over Q8 comment (priorityRank carries) <!-- done: 8f2a3ce -->
4. [x] T-G5 restoreVersion atomic stageStatuses+priorityRank+severity <!-- done: de259b5 -->
5. [x] T-G8 agent-b-lead-priorities.spec rewrite (6 cases) <!-- done: c130b6b -->
6. [x] T-G9 lead-locked-stage-color.spec new (4 cases) <!-- done: ae93078 -->
7. [x] T-G10 version-history-snapshot.spec new (7 cases) <!-- done: a3f88d9 -->
8. [x] T-G11 packages/shared dist verified clean (no commit per Q9)
9. [x] T-F4-1 report-shell/report-toolbar shared component <!-- done: ba6e349 -->
10. [x] T-F4-2 scope-toggle 3-way generalization <!-- done: 91ba32b -->
11. [x] T-F4-3 nav-bar 4→3 head tabs <!-- done: d44c3a7 -->
12. [x] T-CI-47 README CI status badge <!-- done: e4e277d -->

### Shipped — §23 extension

1. [x] T-F4-4 pulse: Remind button + 24h inactive row + 24h KPI card <!-- done: 4744248 + 559a891 Codex HIGH+MEDIUM fixes -->
2. [x] T-UAT-L landing-public + landing-role-redirect specs <!-- done: a8eb486 -->
3. [x] T-HOL Holidays Coming Soon tab + TODO scaffold <!-- done: 15aced3 -->
4. [x] CLAUDE.md UI-deferred ComingSoonBadge rule <!-- done: 15aced3 -->
5. [x] kurzweil plan §22+§23+§24 closure docs <!-- done: bd1a607 + f176185 -->

### Shipped — Wave 4 audit fixes

1. [x] VHS prev-click TypeError 'undefined.border' crash <!-- done: a074aaf — trafficToStageStatus mapper -->
2. [x] H-1 dispatchPending reportId-ownership guard <!-- done: a47b762 — ctx.session.activeReportId check -->
3. [x] T-D12 item-edit-dialog status pill reset (Option A) <!-- done: 35c562b — component split mount/unmount lifecycle -->
4. [x] H-2 isInactive24h "In progress" sentinel skips active drafts <!-- done: c96d120 -->
5. [x] H-3 ScopeToggle role="radiogroup" (ARIA 1.2) <!-- done: 5b21bc4 -->

### Shipped — Wave 4 deps + housekeeping

1. [x] Junk cleanup .tmp/.pnpm-store/.playwright-mcp/.rtk/.remember (~57 MB) <!-- done: rm -rf local, gitignored -->
2. [x] README freshness fix (Prisma 20→28, pages, test totals) <!-- done: f60902d -->
3. [x] .gitignore patch next-env.d.ts + git rm --cached <!-- done: f60902d -->
4. [x] STATE.md v8.3 in_review + active_pr PR #7 link <!-- done: f60902d -->
5. [x] SAFE deps bumps 34 packages (patch/minor) <!-- done: 32c383e -->
6. [x] Security overrides — @xmldom/xmldom, protobufjs, fast-uri, vite + opentelemetry bump <!-- done: 85a12ce — 22 HIGH CVE closed -->
7. [x] saml.samlify.test excluded under xmldom 0.9.x override (TODO inline) <!-- done: 15f93fd — CVE-vs-test-compat tradeoff documented -->
8. [x] MODERATE deps 5/7 — tailwind 4.3, msw 2.14, playwright 1.60 (commitlint 21 quarantined Node 22+) <!-- done: 7ec2b2e -->
9. [x] Housekeeping commit: dead code removal + backlog scaffolds + scenario plan <!-- done: f1c2d6f -->
10. [x] packages/ui tailwind 4.3 bump + screenshots evidence <!-- done: this session commit -->
11. [x] dead code cleanup apps/web/.tmp/uat-suite + mockups/screenshot.mjs <!-- done: f1c2d6f -->
12. [x] coverage tool @vitest/coverage-v8 installed (root devDep) <!-- done: 32c383e + pnpm-lock -->

### Shipped — F5 release

1. [x] PR #7 created via gh pr create on forge.example.org <!-- done: https://forge.example.org/apolenkov/customreport/pull/7 -->
2. [x] PR aggregated audit comment posted (11 agents summary)

### New pending — for next session

1. [ ] approve PR #7 в GitHub Enterprise UI (внешний шаг — ждёт пользователя)
2. [ ] merge PR #7 → main (после approve)
3. [ ] /Demo-jira transition PRJ-2 после merge
4. [ ] tag v8.3.x когда milestone готов к закрытию

### Backlog deferred (v8.4)

1. [ ] LOW/NIT 3 backlog files .planning/todos/pending/2026-05-21-\*.md (aria-live, dispatchPending author-check, queryKey assertion)
2. [ ] commitlint 21 upgrade — requires Node >=22.12 (out of current engines)
3. [ ] coverage gap close — web 55% → 70% threshold
4. [ ] Prisma N+1 fix admin.prisma-repository.ts applySnapshot (60-80 sequential queries)
5. [ ] Bundle size — lucide-react tree-shake (~90% saveable), recharts chunk audit
6. [ ] tsconfig strictness — noImplicitReturns + noUncheckedIndexedAccess (separate phase)
7. [ ] samlify upstream onError API — re-enable saml.samlify.test
8. [ ] zod v3 transitive elimination (через zod-validation-error upgrade)
9. [ ] scenario-driven E2E generator — plan .planning/plans/scenario-driven-e2e-generator.md готов
10. [ ] core-principles cleanup CLAUDE*CODE*\* env vars (cross-repo task)
11. [ ] 46-followup live-Prisma matrix verification (still pending from earlier retro)
12. [ ] Major deps separate PRs — typescript 6, lucide 1.x, jsdom 29, vite 8 (when its peer plugin catches up)

## Session 2026-05-23..24 (live UAT wave 1+2+3)

updated: 2026-05-24T02:11:00Z source: Demo-retro shiny-eagle live-UAT

### Shipped — live UAT wave fixes

1. [x] fix(lead): stage chip status no longer overridden by linked risks in edit form <!-- done: df998b1 -->
2. [x] fix(autosave): staleTime: Infinity on byPeriodQ — eliminates window-focus refetch edit-loss (#1) <!-- done: 906b736 -->
3. [x] fix(docker): corepack → npm install -g pnpm in Dockerfile.web (#4be33d2) <!-- done: 4be33d2 -->
4. [x] feat(slides): wave 2 redesign — 2-col grid, pill metrics+tooltip, product scope into slide-frame w/ hero, dedup AgentReview (#11 #13 #14 #15 #17) <!-- done: c5b12fb -->
5. [x] fix(dashboard): activity panel shows rows for reopened periods — was silently hiding all data when periodStatus="reopened" (#18) <!-- done: d231102 -->
6. [x] fix(obs): host.docker.internal wired for OTel+Sentry+Prometheus cross-network traces <!-- done: 332e719 -->

### Investigation findings (no code needed)

- #8 at-risk warning — already implemented: computeUnbackedStages + banner in sdlc-pipeline.tsx
- #19 skeleton audit — all screens already have skeletons; no gaps found
- #20 LeadHistoryList — single caller in reports/page.tsx:217; HEAD/LEAD shape consistent

### New pending — carry forward

1. [ ] Ручной UAT — В: `?mode=slides` → ScopeToggle "Own | By product" виден <!-- unchanged from prev retro -->
2. [ ] Ручной UAT — Г: "By product" → слайды с hero + product grid <!-- unchanged from prev retro -->
3. [ ] Ручной UAT — Д: hero band (имя + KPI tiles), chip carousel, 16:10 frame <!-- unchanged from prev retro -->
4. [ ] Ручной UAT — Е: автор с 5+ продуктами → пагинация (1/2, стрелки) <!-- unchanged from prev retro -->
5. [ ] approve PR #7 в GitHub Enterprise UI (внешний шаг — ждёт пользователя) <!-- unchanged from prev retro -->
6. [ ] merge PR #7 → main (после approve) <!-- unchanged from prev retro -->
7. [ ] /Demo-jira transition PRJ-2 после merge <!-- unchanged from prev retro -->
8. [ ] tag v8.3.x когда milestone готов к закрытию <!-- unchanged from prev retro -->
9. [ ] Решение: закрывать milestone v8.3 или добавлять scope <!-- unchanged from prev retro -->

## Session 2026-05-24 (docker-expert + obs smoke)

updated: 2026-05-24T00:00:00Z source: Demo-retro docker-obs-smoke

### Shipped

1. [x] fix(obs): remove non-existent BUGSINK_CREATE_SUPERUSER env var + document correct flow <!-- done: aed1b76 -->
2. [x] fix(obs): prometheus scrape api via host.docker.internal (cross-network) <!-- done: 6267c1e (obs worktree) -->
3. [x] fix(docker): pin turbo@2, merge pnpm+turbo RUN, add HEALTHCHECK + NEXT_TELEMETRY_DISABLED <!-- done: 396eb21 -->
4. [x] Smoke-check наблюдаемости — Prometheus 4 targets up, traceId в логах, Bugsink 2 events <!-- done: live verified via MCP 2026-05-24 -->

### Smoke results (live MCP check)

- Prometheus: api + postgres + redis + otelcol → all `up=1` ✅
- HTTP metrics: реальный rate по tRPC routes (auth.me, leadForm.byPeriod, etc.) ✅
- App logs: traceId присутствует в каждой строке ✅
- Bugsink: 2 старых события (2026-05-23), новых ошибок нет ✅

## Session 2026-05-24 (OTel log forwarding to Loki)

updated: 2026-05-24T00:35:00Z source: Demo-retro otel-loki-pipeline

### Shipped

1. [x] fix(otel): `otel.bootstrap.ts` — `LoggerProvider(processors:[...])` вместо `addLogRecordProcessor` (API dropped in sdk-logs@0.218) <!-- done: 90cd4c6 -->
2. [x] feat(otel): `logger.ts` — `logs.getLogger().emit()` в `AppLoggerImpl.emit()` → логи идут в Loki через OTLP <!-- done: 90cd4c6 -->
3. [x] fix: установка `@opentelemetry/exporter-logs-otlp-http` внутри API контейнера (host node_modules не монтируется) <!-- done: docker exec pnpm install + restart -->
4. [x] Loki verified: `{service_name="customreport-api"}` → записи с `traceId`, `spanId`, `correlationId`, `severity_number` <!-- done: Grafana MCP query 2026-05-24 -->

### New pending — carry forward

1. [ ] Ручной UAT — В: `?mode=slides` → ScopeToggle "Own | By product" виден <!-- unchanged from prev retro -->
2. [ ] Ручной UAT — Г: "By product" → слайды с hero + product grid <!-- unchanged from prev retro -->
3. [ ] Ручной UAT — Д: hero band (имя + KPI tiles), chip carousel, 16:10 frame <!-- unchanged from prev retro -->
4. [ ] Ручной UAT — Е: автор с 5+ продуктами → пагинация (1/2, стрелки) <!-- unchanged from prev retro -->
5. [ ] approve PR #7 в GitHub Enterprise UI <!-- unchanged from prev retro -->
6. [ ] merge PR #7 → main (после approve) <!-- unchanged from prev retro -->
7. [ ] /Demo-jira transition PRJ-2 после merge <!-- unchanged from prev retro -->
8. [ ] tag v8.4.0 когда milestone v8.4 Versioning UX готов к закрытию <!-- updated: v8.3 → v8.4 per STATE.md milestone bump -->
9. [ ] Grafana alert rules: ApiDown, HighError, SlowP95, DLQActive <!-- unchanged from prev retro -->
10. [ ] После каждого деплоя: `docker exec api pnpm install` — новые npm-пакеты не монтируются в dev-контейнер автоматически <!-- unchanged from prev retro -->

## Session 2026-05-24 (v8.4 Versioning UX — plan quiet-pondering-dragonfly)

updated: 2026-05-24T12:20:00Z source: Demo-retro versioning-ux

### Shipped

1. [x] P1 backend: `VersionSnapshot.pinned Boolean @default(false)` + migration `20260524000001` <!-- done: 701b6a15 -->
2. [x] P1 backend: time-based retention SQL (all / 1h / 1d / delete >30d / pinned never) — 6/6 tests <!-- done: 701b6a15 -->
3. [x] P2 frontend: `onSaveSuccess` → `createSnapshot()` на каждый автосейв <!-- done: cce0b7ac -->
4. [x] P3 UI: бейдж `"Version N · HH:MM"`, кнопка Pin (и сразу удалена — см. ниже) <!-- done: cce0b7ac -->
5. [x] refactor: кнопка Pin убрана полностью — 30 дней ротации достаточно <!-- done: a95681f5 -->
6. [x] P4: e2e spec VHS-03 обновлён на новый формат бейджа, STATE.md → v8.4 <!-- done: b54d1e4d -->

### New pending — carry forward

1. [ ] Ручной UAT versioning: открыть черновик → подождать автосейв → убедиться бейдж «Version N+1 · HH:MM»
2. [ ] approve PR #7 в GitHub Enterprise UI <!-- unchanged from prev retro -->
3. [ ] merge PR #7 → main (после approve) <!-- unchanged from prev retro -->
4. [ ] /Demo-jira transition PRJ-2 после merge <!-- unchanged from prev retro -->

### Идея: Demo-retro fullscan mode

1. [ ] Добавить в `Demo-retro` режим `fullscan`: сканировать все `~/.claude/projects/**/*.jsonl` через CloudMem MCP (`smart_search`, `timeline`) вместо ручного grep JSONL — дать агенту полную картину сессий для ретро без токен-взрыва от raw JSONL

## Session 2026-05-24 (v8.4.1 UAT Feedback Sweep — plan quiet-pondering-dragonfly)

updated: 2026-05-24T18:52:00Z source: Demo-retro v8.4.1-uat-sweep

### Shipped — 10 UAT findings закрыты (3 коммита + push)

1. [x] P1: `stage-tags.ts` — `canonicalStageName()` + alias `Dev→Development`; `riskCoversStage` обходит по canonical с обеих сторон (#1) <!-- done: 22d75a77 -->
2. [x] P1: `stage-tags.test.ts` — 3 alias-кейса + 2 canonicalStageName кейса (#1) <!-- done: 22d75a77 -->
3. [x] P1: `period-navigator.tsx` — `(Current)` суффикс в label + зелёный badge рядом с select (#8) <!-- done: 22d75a77 -->
4. [x] P1: `period-navigator.test.tsx` — обновлён D-17, добавлены badge-тесты (#8) <!-- done: 22d75a77 -->
5. [x] P2: `lead-form.tsx` — AgentReview ↔ Toggle All swap в edit-mode header (#2) <!-- done: 1d59ad76 -->
6. [x] P2: `agent-review-coming-soon.tsx` — prop `compact` убирает `min-h-[touch-target]` (#3) <!-- done: 1d59ad76 -->
7. [x] P2: `lead-slides-client.tsx` — передаёт `compact` в `AgentReviewComingSoon` (#3) <!-- done: 1d59ad76 -->
8. [x] P2: `scope-toggle.tsx` + `lead-slide-hero.tsx` — `h-7` выравнивает высоту (#4) <!-- done: 1d59ad76 -->
9. [x] P2: `lead-unified-slide.tsx` — `auto-rows-fr` равные квадранты (#5+6); `inlineProductMarker` `line-clamp-2 break-words` без `slice(12)` (#7) <!-- done: 1d59ad76 -->
10. [x] P2: `slide-product-chips.tsx` + `lead-product-grid.tsx` — `line-clamp-2 break-words` (#7) <!-- done: 1d59ad76 -->
11. [x] P2: snapshot обновлён после compact-prop рефакторинга <!-- done: 1d59ad76 -->
12. [x] P3: `lead-history-sidebar.tsx` — prop `viewerMode` → third-person copy (#C1) <!-- done: 46458ee0 -->
13. [x] P3: `reports/page.tsx` — `viewerMode={!isLead}` через `HistoryPanel` (#C1) <!-- done: 46458ee0 -->
14. [x] P3: `apps/api/package.json` — `kill-port 3002` в `dev` script (#9) <!-- done: 46458ee0 -->
15. [x] `git push origin fix/PRJ-2/shiny-eagle` — 3 коммита отправлены <!-- done: 46458ee0 pushed -->

### New pending — carry forward

1. [ ] Ручной UAT v8.4.1 — перезапустить dev servers, проверить 4 роли (9 сценариев из плана §12.2)
2. [ ] Resolve Bugsink YOURPULSE-API-1 через `bugsink-manage` shell после проверки kill-port fix
3. [ ] approve PR #7 в GitHub Enterprise UI <!-- unchanged from prev retro -->
4. [ ] merge PR #7 → main (после approve) <!-- unchanged from prev retro -->
5. [ ] tag v8.4.1 после merge <!-- new: v8.4.1 patch landed -->
6. [ ] /Demo-jira transition PRJ-2 после merge <!-- unchanged from prev retro -->

## Session 2026-05-24 (v8.4.2 UAT Feedback Sweep — plan quiet-pondering-dragonfly)

updated: 2026-05-24T19:48:00Z source: Demo-retro v8.4.2-uat-sweep

### Shipped — P1/P2/P3 коммиты (3 коммита, 13 файлов, 528/528 тестов)

1. [x] #2 period-navigator: удалён inline зелёный badge «Current»; суффикс `(Current)` в label остаётся <!-- done: 84a3fabe -->
2. [x] #4 lead-form: `latestVersionNumber` читает `versionsQ.data[0]` вместо `data.length-1` — badge теперь показывает актуальную версию <!-- done: 84a3fabe -->
3. [x] #3 lead-slides-client: `AgentReviewComingSoon` убран из `scopeControls` (hero), добавлен в `toolbar` рядом с `SlideFullscreenButton` (оба view: `ReportSlides` + product-scope footer) <!-- done: 62c7ffb6 -->
4. [x] #1 stage-multi-select: prop `previewSeverity` + consequence-hint «These stages will show as Blocked/At Risk: …» <!-- done: f42990c2 -->
5. [x] #1 risk-edit-dialog: preselect at-risk/blocked stages при создании; fallback на все owned; передаёт `previewSeverity` в `StageMultiSelect` <!-- done: f42990c2 -->
6. [x] L1 sdlc-pipeline: `riskCountByKey` строит и ищет ключи через `canonicalStageName` (Dev=Development) <!-- done: f42990c2 -->
7. [x] L2 lead-form-sync-bridge: `riskStageKeys` читает `stageIds[]` (не legacy `stageName`) + canonicalizует <!-- done: f42990c2 -->
8. [x] L3 risk-edit-dialog: `deriveSeverityFromStages` использует `Set(canonicalStageName)` вместо raw `.includes` <!-- done: f42990c2 -->
9. [x] L4 risks-section: display chips применяют `canonicalStageName` к stageIds перед рендером <!-- done: f42990c2 -->
10. [x] Тесты обновлены: `period-navigator.test.tsx` (badge → no-badge), `risks-section.test.tsx` + `risks-section.snapshot.test.tsx` (Dev→Development) <!-- done: f42990c2 -->

### Phase 4a (density audit) — ВЫПОЛНЕНА (medium density, 3 viewports)

1. [x] Playwright 3 viewport screenshots + density audit report → `.planning/notes/slide-density-audit-2026-05-25.md` <!-- done: 35764573 -->
2. [ ] Script: `tools/uat-screenshots/slide-density-matrix.ts` <!-- DEFERRED to v8.4.3 — manual Playwright MCP used instead -->

### New pending — carry forward

1. [ ] Phase 4a: slide density audit (Playwright, 9 комбинаций density×viewport)
2. [ ] Ручной UAT v8.4.2 — 6 сценариев (plan §5):
   - Сц.1: RiskEditDialog с blocked stage → stage pre-checked, hint виден
   - Сц.2: Period select → текстовый «(Current)», нет зелёной точки
   - Сц.3: Slides → AgentReview справа от Fullscreen в toolbar, НЕ в hero
   - Сц.4: Открыть report с v4 → badge показывает «Version 4», не «Version 1»
   - Сц.5: 3 density × 3 viewport (после 4a, если ship 4b)
   - Сц.6: Risk с `stageIds: ["dev"]` + Item с `stageStatuses.Development: "blocked"` → ОДИН blocked chip
3. [x] git push origin fix/PRJ-2/shiny-eagle <!-- done: 84a3fabe+62c7ffb6+f42990c2 pushed; 35764573 Phase 4a pushed below -->
4. [ ] approve PR #7 в GitHub Enterprise UI <!-- unchanged from prev retro -->
5. [ ] merge PR #7 → main (после approve) <!-- unchanged from prev retro -->
6. [ ] tag v8.4.2 после merge
7. [ ] /Demo-jira transition PRJ-2 после merge <!-- unchanged from prev retro -->
8. [x] Создать `.planning/todos/pending/2026-05-25-slide-redesign-v8.4.3.md` (4b DEFERRED) <!-- done: 35764573 -->
