# NEXT ACTIONS

updated: 2026-05-18T09:30:00Z source: Demo-retro (Phase 61c closure)

## RUN FIRST

1. [x] ~~`git push origin feat/head-report-history-slides`~~ — сделано 2026-05-18, PR #6 открыт

## AGENT

1. [ ] Визуальный screenshot `/lead/report/<id>?mode=slides` для sign-off (Playwright browser пока занят):

   ```
   browser_navigate http://localhost:3000/auth/dev-login?role=lead
   browser_navigate http://localhost:3000/lead/report/<active-id>?mode=slides
   browser_take_screenshot review-slides-v2.png
   ```

2. [x] ~~Открыть PR~~ — PR #6 открыт: https://forge.example.org/apolenkov/customreport/pull/6
3. [ ] `git mv .planning/plans/image-1-velvet-pixel.md .planning/plans/done/` + коммит (после PR слит)
4. [ ] Playwright regression spec (уже создан):
       `pnpm --filter @customreport/web exec playwright test --config=e2e/regression/playwright.regression.config.ts --grep "lead-slides-read-only"`

## HUMAN

1. [ ] Визуальный sign-off на review-slides-v2.png (скриншот slides-режима после V2)
2. [ ] Восстановить сетевой доступ к forge.example.org (SSL — вне scope агента)
3. [ ] Approve + merge PR в GitHub UI после CI green

## BLOCKED

1. [x] ~~git push~~ — выполнено, PR #6: https://forge.example.org/apolenkov/customreport/pull/6
2. [ ] playwright screenshot — browser locked (другая сессия держит MCP-экземпляр)

## VERIFY

```bash
git log --oneline -5
# ожидаем увидеть:
# 3192cf0 fix(web): show archive toggle in head history even when all periods archived
# 14acb79 chore(web): Phase 61 closeout — TODO marker + STATE.md update
# 9575f01 style(web): apply Prettier formatting to V2 slides files
# 2f5724e feat(web): V2 slides — unified header, slide-look product cards, delete SlideHeader
# 16a3940 feat(web): head report + history pages with inline form/slides toggle

pnpm typecheck     # ожидаем: Tasks: 5 successful
pnpm lint          # ожидаем: Tasks: 4 successful
pnpm --filter @customreport/web test   # ожидаем: 472 passed
```
