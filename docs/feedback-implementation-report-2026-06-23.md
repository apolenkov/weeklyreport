# Отчёт по реализации обратной связи (на 2026-06-23)

Сводка: что из твоего фидбэка реализовано, что отложено осознанно, и
единственный найденный пробел (навбарный мёртвый `?tab`), который закрывается
отдельно. Всё «SHIPPED» — в `main`, заархивировано в `openspec/changes/archive/`.

Легенда: ✓ реализовано+в main · ⚠ пробел/в работе · ⏸ отложено осознанно.

---

## 1. Демо 2026-06-23 — head-дашборд (D1–D6)

Change `head-dashboard-declutter` — SHIPPED + live-verified + archived.

| Пункт | Фидбэк                                               | Статус                                                               |
| ----- | ---------------------------------------------------- | -------------------------------------------------------------------- |
| D1    | Таблица лидов «квадратная» + неожиданный скролл      | ✓ `w-full`, паддинги `px-3`, влезает на 1440px                       |
| D2    | «ProductKpiCard пока уберём?»                        | ✓ удалён целиком (recharts оставлен — нужен в trends/ui)             |
| D3    | Дубль «flagged red» по co-owner'ам (проверить)       | ✓ см. раздел 4 (отдельный change)                                    |
| D4    | Убрать Activity24hCard (дублирует ActivityLivePanel) | ✓ удалён                                                             |
| D5    | Seed: один лид submitted, чтобы показать Revoke      | ✓ Мария К. submitted; +фикс затенения submitted-строки               |
| D6    | Remind не слал письмо (нет правила)                  | ✓ seed-правило + гейт; live: письмо в Mailpit, повтор «Already sent» |

## 2. Демо 2026-06-23 — head-форма, аккордеон (R1–R2)

Research-трек `head-report-accordion-redesign` — ⏸ ОТЛОЖЕНО (research-first).

| Пункт | Фидбэк                                     | Статус                                                                        |
| ----- | ------------------------------------------ | ----------------------------------------------------------------------------- |
| R1    | ProductAccordion «топорный», текст прыгает | ⏸ нужен выбор направления (правило репо: визуальный редизайн research-first) |
| R2    | Лейауты не вровень, нет чёткости           | ⏸ то же — спека намеренно не писалась                                        |

## 3. Демо 2026-06-23 — head-слайды (S1–S6)

Change `head-slides-lead-parity` — SHIPPED + live-verified + archived (PR #22).

| Пункт | Фидбэк                                         | Статус                                                      |
| ----- | ---------------------------------------------- | ----------------------------------------------------------- |
| S1    | Зонтик: слайды head как у lead                 | ✓ сверено с lead-раскладкой                                 |
| S2    | Убрать заголовок «Group Status Slides» целиком | ✓ band удалён + мёртвые пропсы вычищены                     |
| S3    | «Open focused report» → в верхний toolbar      | ✓ на линию шапки рядом с Export-PDF (обновляется по слайду) |
| S4    | Карусель — НЕ трогать (похвала)                | ✓ не тронута                                                |
| S5    | Убрать ReadinessStrip совсем                   | ✓ удалён                                                    |
| S6    | Agent-review → в toolbar, как у lead           | ✓ в context-row, ровно один                                 |

## 4. Демо 2026-06-23 — дедуп эскалаций (D3)

Change `fix-flagged-red-escalation-dedup` — SHIPPED + live-verified + archived (PR #22).

| Пункт | Фидбэк                                    | Статус                                                                                 |
| ----- | ----------------------------------------- | -------------------------------------------------------------------------------------- |
| D3    | Дубль «flagged red» на каждого co-owner'а | ✓ дедуп по `projectId` в общем билдере; published не сломан; +тест; live: 2 строки → 1 |

## 5. Демо 2026-06-23 — lead-история и Submit

Change `lead-history-and-submit-label` — SHIPPED + live-verified + archived (PR #23).

| Пункт | Фидбэк                          | Статус                                                                                         |
| ----- | ------------------------------- | ---------------------------------------------------------------------------------------------- |
| 1     | «Submit Section» → «Submit»     | ✓ кнопка + диалог «Submit your report?»                                                        |
| 2     | История сортируется неверно     | ✓ `myHistory` по `periodStart desc`                                                            |
| 3     | Знаменатель футера не совпадает | ✓ «across N periods» = только submitted                                                        |
| 4     | Мёртвый `?tab` убрать           | ⚠ redirect-страницы ✓; **навбарная ссылка `?tab` осталась — закрывается отдельно (раздел 8)** |

## 6. Демо 2026-06-23 — лендинг

Change `landing-hero-weekly-report` — SHIPPED + archived.

| Пункт | Фидбэк                                 | Статус    |
| ----- | -------------------------------------- | --------- |
| 1     | Бренд «YOUR / PULSE» → «Weekly Report» | ✓         |
| 2     | Убрать pulse-анимацию (дыхание + ЭКГ)  | ✓ удалена |

## 7. Более ранние партии (2026-06-16 … 06-22)

Все реализованы и заархивированы ранее — детали в `openspec/changes/archive/`
и в хендофф-доках `docs/handoff-*`. Кратко:

- 06-16: seed/card/toolbar партия — ✓
- 06-17: own-scope + Mine/Everyone toggle + W6 floor — ✓
- 06-18: seed-breadth, sticky-toolbar, pipeline, stage-schema, slides flagship — ✓
- 06-19: lead-demo #88–#91, close-slides-tails, pipeline-tooltip — ✓
- 06-20/21: lead-report-feedback (6 changes, PR #21) — ✓
- 06-22: carousel-fullscreen, demo-feedback-polish, slide-capacity, overflow/alignment fixes — ✓

## 8. Единственный пробел в работе

`?tab` в навбаре — `reports/page.tsx` явно не читает `tab` (мёртвый параметр),
но навбарные History-ссылки всё ещё шлют `/reports?tab=drafts` (lead) и
`/reports?tab=published` (head/viewer). Это противоречит фидбэку «убрать мёртвый
`?tab`». Закрывается change `remove-dead-history-tab-param` (этот заход).

## 9. Запарковано осознанно (не делать без отдельной команды)

- R1/R2 accordion-редизайн — research-first, ждёт выбора направления.
- code-health-audit-map + north-star-роадмапы — `openspec/deferred/`.
- versions-v2, ComingSoon-фичи (Phase 54/55) — намеренно отложены.
