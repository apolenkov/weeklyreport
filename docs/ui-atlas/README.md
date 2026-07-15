# Wave 35 — полный поведенческий обход UI (драйв-спека)

Цель Саши: пройти буквально каждую возможность интерфейса по всем ролям, со скриншотом каждого состояния; скриншоты копятся в «карту» (атлас) для будущего UI-ревью; логи анализируются; найденные баги чинятся как после UAT.

## Матрица (итог инвентаря, полный текст — в отчёте scenario-inventory)

- lead: 5 живых роутов, ~55 состояний (тулбар формы, 3 диалога записей с валидациями, StageChip 4 варианта, preview, /reports, trends, landing).
- head: 4 живых, ~35 (dashboard c 5-состоянием Remind, publish/reopen/archive конфирмы, report-тулбар).
- admin: 7 живых, ~90 (8 табов админки, 6 саб-табов settings, head-набор прав).
- viewer: 4 живых, ~15 (read-only контроль отсутствия мутирующих кнопок).
- Итого ~195 состояний; диалоговый chrome (Cancel/Esc/backdrop) снимается один раз, не на каждый диалог.

## Дыры каталогов (11) — главное

1. ВЕСЬ review-воркфлоу (SectionVerdictControl 4 состояния, ReviewAcknowledgeBar, ReopenTab, RecordComments add/delete) — нет ни в одном каталоге.
2. Risk severity-toggle Blocked⇄At-Risk одним кликом.
3. ActivityStatusSection "Refused"-toggle.
4. Slides: fullscreen (`f`, esc), carousel, inline-edit по double-click, стрелки, 3 уровня empty, tooltips.
5. Fill-From — двухшаговый (dropdown → confirm), в каталоге один шаг.
6. StageChip locked-foreign и risk-floored no-op.
7. ItemEditDialog: paused→reason, dead-end stage, risk-locked.
8. PdfExportComingSoon для lead на форме.
9. Dev-role-switcher в шапке (dev-only, возможно исключён намеренно).
10. Trends: hover/tooltip/Legend recharts.
11. Groups: guard последней группы; product-attach-locked.

## Драйв-механика

- Вход: `GET /auth/dev-login?role=X&email=<seed>&redirect=<path>`; lead1@/head@/admin@/viewer@customreport.local; Finance-группа (olga@, sergey@) для group-scope контроля.
- Стек из исходников (docker-образы стейлые): api :3002 (pnpm dev, фон), web :3000; перед прогоном свежий `db:reset:hard`+seed-simple; api-stdout → файл для фазы C.
- ОДИН Playwright MCP браузер ⇒ волкеры строго ПОСЛЕДОВАТЕЛЬНЫ. Чанки по 6–10 состояний; Haiku на чанк (механика по точному скрипту), Opus — триаж вердиктов по индексу+логам (лестница «дёшево ищем — дорого проверяем»).
- Скриншоты: `docs/ui-atlas/2026-07-15/<role>/<route-slug>/<NN>-<state>.png` + `index.jsonl` (append: file, role, route, state, путь достижения, console-error count). Playwright MCP browser_take_screenshot пишет в свой outputDir — забирать/переименовывать после чанка.
- Порядок: read-only состояния сначала; мутирующие (publish/reopen/revoke/archive, delete-\*) — последними в роли, в фиксированной последовательности; wipe+reseed из dev-switcher — ИСКЛЮЧЁН из прогона.
- Ловушка сидов: risk с покрытием стадии делает её chip non-interactive — chip-toggle сценарии идут ДО создания перекрывающих рисков.
- Фаза C: Opus разбирает console/network/api-логи + аномалии волкеров → находки; мелкое чиним сразу, крупное — openspec-change. Фаза D: артефакт-атлас поверх index.jsonl.

## Статус

- [x] Фаза A (инвентарь) — готова.
- [ ] Фаза B — после финиша бэклога (ждём 2 последних change'а).
- [ ] Фаза C, D.
