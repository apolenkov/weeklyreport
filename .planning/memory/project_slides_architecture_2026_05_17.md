---
name: Slides mode architecture 2026-05-17/18 (V2)
description: V2 slides — single unified page-header with slim sub-row, slide-look cards, Lead flat read-only article; SlideHeader deleted; commits on feat/head-report-history-slides
type: project
originSessionId: 15caa287-e7ea-476e-8bdf-71f0dad632c9
---

V2 slides shipped (коммиты 2f5724e + 9575f01, ветка `feat/head-report-history-slides`).

**Что изменилось от V1:** V1 дал двойной заголовок (SlideHeader + page-header). V2 убирает SlideHeader полностью: slim sub-row с `currentUser.name · period · status badge · ↩ Edit` добавлен прямо внутри page-header в `lead-form.tsx`.

**Ключевые файлы после V2:**

- `lead-form.tsx`: `isSlidesMode` → slim sub-row; Submit/Toggle/PeriodNav/VersionNav скрыты
- `lead-slides-client.tsx`: рендерит только `<StatusSlideDeck>` (никаких wrapper'ов)
- `status-slide-deck.tsx`: slide-look — h3→`text-3xl font-bold`, SDLC chips → inline «Planning · Development», нет sidebar-grid
- `head-present-client.tsx`: SlideHeader удалён, nav-кнопки prev/next/counter/F остались как были (keyboard logic не трогали)
- `slide-header.tsx`: **УДАЛЁН**, файл не существует
- Regression spec: `apps/web/e2e/regression/lead-slides-read-only.spec.ts`

**Состояние (2026-05-18):** CLOSED локально. SSL_ERROR_SYSCALL блокирует push на forge.example.org. Visual sign-off от пользователя pending. Playwright browser был locked в другой сессии при попытке screenshot.

**How to apply:** При следующей сессии — `git push origin feat/head-report-history-slides`, затем `gh pr create`, показать screenshot пользователю. SDLC-секция в slides теперь inline-текст («Planning · Development»), не chip-кнопки.
