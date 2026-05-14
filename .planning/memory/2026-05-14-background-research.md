---
name: Background Design Research 2026-05-14
description: Визуальное исследование бэкграундов — скриншоты + идеи направлений. Только research, никакой реализации без явного решения пользователя.
type: project
---

> **FROZEN CONTRACT — research-only**
>
> Этот документ — результат **исследования**, не задание на реализацию.
>
> **Что НЕ должно произойти из этого memo:**
>
> - Никаких gradient-классов, design tokens, CSS variables для бэкграундов
> - Никакого dark theme toggle или ребренда
> - Никакого «давай попробуем X на странице Y» без явного «делаем вот это» от пользователя
>
> **Как активировать реализацию:** пользователь читает этот документ,
> смотрит скриншоты в `apps/web/playwright-report/screenshots/`,
> и говорит конкретно что делать. До этого момента — только исследование.
>
> **Cross-refs:**
>
> - `CLAUDE.md § "UI/визуал — research before implementation (2026-05-14)"`
> - `~/.claude/projects/-Users-ap-work-customreport/memory/feedback_ui_visual_research_first.md`
> - `apps/web/e2e/screenshots.spec.ts` — spec для воспроизводства скриншотов

# Background Design Research — 2026-05-14

**Контекст:** пользователь 2026-05-14 — «бэкграунд помо подумать, как можно
бэкграунд изображения сделать более не просто фоном, а какими-то, не знаю, линиями,
ну, что-нибудь поинтереснее сделать». Ребренд, тёмная тема — только исследование.
Решение принимается на основе этого документа + скриншотов.

## Как воспроизвести скриншоты

```bash
# Stack должен быть запущен (docker compose up -d postgres redis api web)
pnpm --filter @customreport/web exec playwright test e2e/screenshots.spec.ts
# PNG → apps/web/playwright-report/screenshots/
```

## Текущее состояние фонов (анализ по коду)

| Страница               | Роль       | Текущий фон                    | Комментарий                                                            |
| ---------------------- | ---------- | ------------------------------ | ---------------------------------------------------------------------- |
| `/lead/report`         | lead       | subtle green gradient (D-11)   | Единственная страница с gradient. `linear-gradient` на `#main-content` |
| `/head/dashboard`      | head       | чистый белый / `bg-background` | Нейтральный. KPI-карточки «плавают» без якоря                          |
| `/admin`               | admin      | чистый белый / `bg-background` | Таблицы на белом — low contrast-frame                                  |
| `/reports`             | lead, head | чистый белый / `bg-background` | Tabs + cards на белом                                                  |
| `/admin?tab=reminders` | admin      | чистый белый                   | Coming Soon badge единственный акцент                                  |
| `/admin?tab=settings`  | admin      | чистый белый                   | Форма на белом                                                         |
| `/head/dashboard`      | viewer     | чистый белый                   | Viewer видит те же дашборды что и head                                 |

## Идеи направлений (research, не commitment)

### 1. Тонкие геометрические линии (приоритет — рекомендую рассмотреть первым)

Вдохновение: blueprint-grid, dot-grid, топографические карты.

```
Реализация: CSS background-image с SVG data-uri или `tailwind-bg-grid` паттерном
Примеры:
  background-image: url("data:image/svg+xml,<svg>...grid pattern...</svg>");
  opacity: 0.04 — почти незаметно, но добавляет «текстуру»
```

**Плюсы:** работает на светлых и тёмных темах, минималистично, не отвлекает.
**Минусы:** могут «плыть» при zoom, нужна проверка на mobile.

Конкретные стили для изучения:

- `bg-grid-slate-100` (tailwindcss-bg-patterns)
- Dot grid: `radial-gradient(circle, #cbd5e1 1px, transparent 1px)` с `background-size: 24px 24px`
- Blueprint: `linear-gradient` 2 направления, 1px, opacity 0.06

### 2. Per-role accent tinting

Каждая роль получает свой тонкий тон фона:

| Роль   | Accent     | CSS                |
| ------ | ---------- | ------------------ |
| lead   | зелёный    | `hsl(142 50% 98%)` |
| head   | синий      | `hsl(217 50% 98%)` |
| admin  | фиолетовый | `hsl(270 50% 98%)` |
| viewer | серый      | `hsl(220 10% 98%)` |

**Плюсы:** моментально показывает «чья» страница. Уже есть прецедент — lead/report зелёный.
**Минусы:** может выглядеть «детскими» цветами, нужна правка дизайн-системы.

### 3. Asymmetric accent-зоны (header stripe + sidebar fade)

Верхний `64px` header получает насыщенный tint (`hsl(role-color / 8%)`),
остальное тело — чистый белый. Или левая 4px border-bar по роли.

**Плюсы:** структурирует страницу без изменения body.
**Минусы:** может конфликтовать с shadcn Sheet/Dialog.

### 4. Noise texture overlay

Очень тонкая шумовая текстура (PNG 64×64, opacity 0.03-0.05) поверх белого.
Добавляет «бумажное» ощущение без явного паттерна.

**Плюсы:** совместима с любой цветовой схемой, не требует redesign.
**Минусы:** лишний PNG-запрос, нужен preload.

### 5. Gradient-mesh (современный UI тренд 2026)

Несколько точечных radial-gradients в разных углах, overlap с низкой opacity.
Пример: `after:` pseudo на body с 3 кружками opacity 0.03-0.05.

**Плюсы:** визуально современно, хорошо смотрится на дашбордах.
**Минусы:** сложнее поддерживать, может дать «шум» в PDF-экспорте.

## Что можно улучшить (per-страница, top observations)

### `/lead/report` — subtle green gradient (D-11, уже есть)

- Фон есть, но он gradient только на `#main-content`, не на всей странице.
- Секция items/priorities на светло-зелёном фоне «читается» хорошо.
- **Идея:** добавить едва заметную dot-grid overlay поверх gradient для текстуры.

### `/head/dashboard` — чистый белый

- KPI-карточки (ProductKpiCard) теряются на белом — нет визуального якоря.
- Activity panel на белом похожа на простую таблицу, нет «живости».
- **Идея:** per-role tint (`hsl(217 50% 98%)`) ИЛИ subtle dot-grid на header zone.
  Это сразу покажет что это «head view».

### `/admin` — чистый белый

- Таблица пользователей/групп на белом — монотонна.
- Tab bar (Settings/Users/Reminders) мог бы иметь accent-border снизу.
- **Идея:** тонкая фиолетовая accent-линия (`border-b-2 border-purple-100`) под tab bar.

### `/reports` (both roles)

- Coming Soon и реальный контент соседствуют — страница выглядит «незаконченной».
- Нет визуальной иерархии между разделами.
- **Идея:** subtle `bg-muted/30` на Coming Soon areas, чтобы отличать «работает» от «скоро».

### `/admin?tab=settings`

- Форма интеграций на белом — ничего не выделяет CI/Telegram секции.
- **Идея:** card-style с `bg-slate-50/80` под каждый integration block.

## Открытые вопросы для пользователя

1. **Приоритет направления:** линии (dot-grid / blueprint) vs per-role tints vs gradient-mesh?
2. **Тёмная тема:** делать вообще? Если да — отдельная Phase 40 по roadmap.
3. **PDF-совместимость:** gradient-mesh и noise texture нужно проверить
   что они не ломают PDF-экспорт (`Puppeteer/Playwright`).
4. **Per-role tinting:** ок или «слишком пёстро» для корпоративного приложения?
5. **Scope Phase 40:** roadmap содержит `40-01..40-05` (PRD, design tokens, theme toggle,
   component audit, screenshots). После чтения этого memo — брать в работу Phase 40 или
   ограничиться конкретным micro-change?

---

_Скриншоты: `apps/web/playwright-report/screenshots/` — запустить `screenshots.spec.ts`._
_Этот документ создан 2026-05-14 как часть исследовательского прохода. Реализация — только после явного решения пользователя._
