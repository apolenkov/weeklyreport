# NEXT ACTIONS

updated: 2026-05-19T21:20:00Z source: Demo-retro shiny-eagle W5 session

## RUN FIRST

1. [x] `pnpm db:wipe:manual-uat` <!-- done: 2026-05-19 — Week 21 активен -->

## AGENT

(пусто — F1-F16 + WS-A/B/C/D закоммичены и запушены на origin/main)

## HUMAN

1. [x] Ручной UAT — А: SDLC Pipeline Other contributors row <!-- done: 7adfbb2 — redesigned to per-risk chips, no "readonly ↗" text -->
2. [x] Ручной UAT — Б: "Show details ▾" → убрано, inline rows теперь always-on <!-- done: 7adfbb2/8957a85 — toggle removed, foreign rows always visible -->
3. [ ] Ручной UAT — В: `?mode=slides` → ScopeToggle "Own | By product" виден
4. [ ] Ручной UAT — Г: "By product" → слайды Vasily + слайды Boris (cross-author)
5. [ ] Ручной UAT — Д: hero band (имя + KPI tiles), chip carousel, 16:10 frame
6. [ ] Ручной UAT — Е: автор с 5+ продуктами → пагинация (1/2, стрелки)
7. [x] Ручной UAT — Ж (shiny-eagle): `/lead/report/<id>` → в SdlcPipeline "Other contributors" видны ⛔/⚠ чипы <!-- done: 7adfbb2 — W1 shipped -->
8. [ ] Ручной UAT — З (shiny-eagle W5): CW/NW/Risks/Dec/Prio → кнопка "Show contributors ▼" (default hidden); по клику foreign items появляются inline с 🔒 без кнопок edit/delete
9. [ ] Ручной UAT — И (shiny-eagle): `?mode=slides` → выравнивание CURRENT/NEXT/RISKS по строкам, body 13px, кнопка ⛶
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
- [x] Night-marathon D-2..D-36 frame <!-- done: archived in retro memo 3a17656 -->

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
