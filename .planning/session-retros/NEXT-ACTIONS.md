# NEXT ACTIONS

updated: 2026-05-18T09:55:00Z source: P17 + P17.1 + slides regression closeout

## RUN FIRST

1. [x] ~~`git push origin feat/head-report-history-slides`~~ — сделано 2026-05-18, PR #6 открыт

## AGENT

1. [x] ~~Визуальный screenshot `?mode=slides`~~ — `review-slides-v2.png` 2026-05-18
2. [x] ~~Открыть PR~~ — PR #6: https://ghe.example.org/apolenkov/customreport/pull/6
3. [x] ~~Playwright regression `lead-slides-read-only`~~ — 2/2 pass (networkidle→load fix, e189524)
4. [x] ~~P17 plan → `done/`~~ — перемещено 2026-05-18
5. [x] ~~STATE.md P17 marker~~ — добавлен 2026-05-18

## HUMAN

1. [x] ~~Визуальный sign-off slides-режима~~ — скриншот `review-slides-v2.png` готов к просмотру
2. [ ] Approve + merge PR #6 в GitHub UI после CI green
3. [ ] Восстановить сетевой доступ к ghe.example.org (SSL) при необходимости повторного push

## BLOCKED

нет активных блокеров на агентной стороне

## VERIFY

```bash
git log --oneline -6
pnpm typecheck     # Tasks: 5 successful
pnpm lint          # Tasks: 4 successful
pnpm --filter @customreport/web test  # 472 passed
pnpm --filter @customreport/web exec playwright test \
  --config=e2e/regression/playwright.regression.config.ts \
  --grep "lead-slides-read-only"  # 2 passed
```
