---
tags: [todo, slides, redesign, v8.4.3]
created: 2026-05-25
milestone: v8.4.3
deferred-from: v8.4.2
---

# TODO: Slide Redesign — v8.4.3

**Источник:** density audit `.planning/notes/slide-density-audit-2026-05-25.md`

**Решение принято 2026-05-25:** defer в v8.4.3. Medium density работает
приемлемо для MVP; критичных поломок нет.

---

## Дефекты, которые нужно починить

### D1 — Пустое пространство при Medium/Sparse density

**Симптом:** нижние 30-50% slide-карточки пусты на medium seed; при sparse
(0-1 элементов) пустота ещё больше.

**Причина:** `grid grid-cols-2 auto-rows-fr` → строки равной высоты
независимо от количества элементов в ячейке.

**Кандидаты:**

| Вариант         | Описание                                     | Цена               |
| --------------- | -------------------------------------------- | ------------------ |
| A (рекомендуем) | `auto-rows-auto` + `min-h-[120px]` на секции | минимальный change |
| B               | vertical stack вместо 2×2                    | переработка layout |
| C               | 2×2 + `min-h-[160px]` + `line-clamp-3`       | компромисс         |

### D2 — Карточка не растягивается на viewport (Medium/Heavy, 1728+)

**Симптом:** на широких мониторах карточка занимает верхнюю треть
viewport, нижние 2/3 — серый фон страницы.

**Кандидат:** `flex flex-col` + `flex-1` на контент-области карточки.

---

## Что нужно сделать ПЕРЕД редизайном

1. **Heavy density тест** — создать seed с 4 current work (длинные тексты),
   3 risks, 2 decisions. Захватить скриншоты при всех 3 вьюпортах. Добавить
   в матрицу `.planning/notes/slide-density-audit-2026-05-25.md`.

2. **Fullscreen тест** — Playwright: `page.evaluate(() => document.documentElement.requestFullscreen())`.
   Medium density × fullscreen → скриншот.

3. **Принять решение по варианту** (A/B/C) на основе Heavy + Fullscreen
   результатов.

---

## Файлы для редизайна

| Файл                                                                                  | Что менять                                                       |
| ------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| `apps/web/src/components/slides/lead-unified-slide.tsx` или аналог                    | grid topology (D1)                                               |
| карточка `article.slide-frame` в `lead-slides-client.tsx` или `status-slide-deck.tsx` | flex + height (D2)                                               |
| CSS tokens при необходимости                                                          | `--status-*` semantic colors из ui-ux-pro-max Data-Dense pattern |

---

## ui-ux-pro-max паттерн (Data-Dense Dashboard)

Из skill `ui-ux-pro-max` рекомендован паттерн **Data-Dense Dashboard**:

- Fira Sans для body, Fira Code для статус-кодов/чисел
- Status colors через CSS custom properties: `--status-ontrack`, `--status-atrisk`, `--status-blocked`
- `tabular-nums` для численных данных (KPI тайлы, счётчики)

Приоритет внедрения: **после** выбора grid topology (не тащить typography
refactor одновременно с layout refactor).

---

## Условие выполнения

- [ ] Heavy density тест захвачен (скриншоты + матрица обновлена)
- [ ] Fullscreen тест захвачен
- [ ] Grid topology выбрана (A/B/C) на основе тестов
- [ ] D1 + D2 исправлены
- [ ] pnpm typecheck / lint / test PASS
- [ ] Ручной UAT: 3 density × 3 viewport — нет визуальных breaks
