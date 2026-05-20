# NEXT ACTIONS

updated: 2026-05-20T21:40:00Z source: peo-retro shiny-eagle W15

## RUN FIRST

1. [x] `pnpm db:wipe:manual-uat` <!-- done: 2026-05-19 — Week 21 активен -->
2. [ ] `git push origin fix/PRJ-2/shiny-eagle` — W15 не запушен

## AGENT

1. [x] Smoke W13 via chrome-devtools MCP: `/lead/report/<id>?mode=slides` → DECISIONS секция видна полностью + ⛶ click → floating Exit-кнопка в top-right оверлея <!-- done: 969d29f — W14 DOM-verified via chrome-devtools MCP -->
2. [x] `git push origin fix/PRJ-2/shiny-eagle` после W14 smoke green <!-- done: 203bc67 — W14 pushed -->

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

1. [ ] UFB-014 multi-SDLC assignment per product <!-- unchanged from prev retro: no commit found 2026-05-12..2026-05-19 -->
2. [ ] Holidays calendar <!-- unchanged from prev retro: no commit found -->
3. [ ] UAT landing pages <!-- unchanged from prev retro: need manual review -->
4. [ ] 47-02 CI badge <!-- unchanged from prev retro: need manual review -->
5. [ ] 46-followup live-Prisma matrix <!-- unchanged from prev retro: need manual review -->
6. [ ] D-12 status <!-- unchanged from prev retro: revert произошёл 2026-05-14T12:49, нужен manual review -->

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
- `peo-retro` SKILL.md обновлён 2026-05-19 для APPEND-ONLY enforcement —
  будущие retro не могут silently снести `[ ]` пункты.
- `STILL-PENDING` пункты помечены `<!-- unchanged from prev retro -->` —
  их статус нужно проверить вручную (commit search не дал результата).
