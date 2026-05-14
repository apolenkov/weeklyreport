---
name: UI Visual Changes Require Research First
description: Визуальные изменения (фоны, градиенты, тёмная тема, ребренд) реализуются ТОЛЬКО после research memo + явного user sign-off
type: feedback
originSessionId: 32223757-8778-4d1b-8910-37480c159bf7
---

Визуальные изменения (фоны, акценты, gradient, тёмная тема, ребренд) —
**только после research memo + явного решения пользователя**.

**Why:** Пользователь 2026-05-14 явно сказал: «это просто исследование пока.
Не надо больше ничего делать, потому что на основе исследования будем уже принимать
решение.» Агент не должен по собственной инициативе добавлять CSS/design tokens
на основе «идей из скриншотов» или «казалось бы улучшений».

**How to apply:**

- При любом запросе «поменяй фон», «добавь gradient», «сделай тёмную тему» —
  сначала проверить: есть ли явный user sign-off в этой же сессии?
- Если нет — напомнить о research memo (`.planning/memory/2026-05-14-background-research.md`)
  и спросить «какое конкретно направление реализуем?»
- Снимать скриншоты через `apps/web/e2e/screenshots.spec.ts` — можно без sign-off.
- Добавлять идеи в research memo — можно без sign-off.
- Менять `*.tsx`, `*.css`, design tokens — только после «делаем вот это».

**Cross-refs:**

- Project CLAUDE.md § "UI/визуал — research before implementation (2026-05-14)"
- `.planning/memory/2026-05-14-background-research.md` (frozen contract callout)
- `apps/web/e2e/screenshots.spec.ts` (screenshot spec)
