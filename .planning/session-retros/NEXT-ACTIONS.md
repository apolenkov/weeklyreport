# NEXT ACTIONS

updated: 2026-05-17T00:30:00Z source: Demo-retro

## RUN FIRST

1. [ ] `git push origin fix/PRJ-2/uat-v7-2026-05-12` (когда forge.example.org доступен)

## AGENT

1. [ ] Исправить stageName депрекацию: apps/web/src/components/lead/lead-form.tsx:1187
2. [ ] UI-аудит F1: восстановить полные подписи в toolbar
3. [ ] UI-аудит F2: выровнять SDLC pipeline по центру
4. [ ] Playwright регрессия последовательно (не параллельно по группам):
       pnpm --filter @customreport/web exec playwright test --config=e2e/regression/playwright.regression.config.ts

## HUMAN

1. [ ] Approve + merge PR #5 в GitHub UI после CI green
2. [ ] Подтвердить Q4a: стиль submit-блока — outline / filled / ghost?
3. [ ] Подтвердить Q4b: удалить дубль chip после имени автора — да/нет?

## BLOCKED

1. [ ] git push — SSL_ERROR_SYSCALL на forge.example.org:443

## VERIFY

    git log --oneline 6eb0184..HEAD
    pnpm --filter @customreport/web typecheck
    pnpm --filter @customreport/web lint
    pnpm --filter @customreport/web exec vitest run src/components/lead/ src/components/slides/ src/components/navigation/
