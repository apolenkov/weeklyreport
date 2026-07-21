# All-Green Campaign — весь репозиторий до exemplary (2026-07-18)

Заказ: Саша хочет 1166/1166 «exemplary», не просто «без блокеров».
База: main @ 261a255d, дерево чистое, бэклог OpenSpec пуст (только `deferred`).

## Определение «зелёного» (механическое, не вкусовое)

Файл считается exemplary, когда — по `docs/exemplary-code-standard.md`:

1. `eslint --max-warnings 0` чист БЕЗ exempt-записи в `eslint.config.ts`
   (кроме ратифицированных JUSTIFIED PERMANENT — их НЕ трогаем: data/generated/god-files,
   `report.schema.ts` reshard отклонён навсегда).
2. Файл < 250 строк, функции ≤ 50, cognitive complexity < 10.
3. Ноль `let` / реассайнов / мутаций (вне ратифицированных исключений lint-режима).
4. No-fallback rule: без `?? default` для product-config.
5. Ноль живых minor-находок mass-review (632 шт. в 472 файлах, seed:
   `inventory-seed.json` рядом) — кроме классов из reject-листа.

## Рамки (финальные, не пересматривать)

- `VERDICT.md` reject-лист: НЕ делать `&&`→тернарники, TODO-зачистку, `.js`-консистентность,
  логирование пустых catch, mass magic-strings, explicit-return-types-свип.
- Complexity-бюджет линта остаётся 15; <10 — целевая планка rollout, достигается
  пофолдерно, НЕ глобальной ручкой.
- АВТО-прогон exemplary-rollout деградирует код (память 2026-07-07) — работаем
  волнами по фолдерам с сильной верификацией, паттерн waveb-\*.
- Гейты перегоняет оркестратор сам, с exit-code (ложный PASS фонового vitest — свежие грабли).
- Никаких коммитов красного дерева; MVP: пуш в main преавторизован.

## Объём (замер 2026-07-18)

- 973 файла поднимать: 860 good, 111 needs-attention, 2 defect (96 уже exemplary).
- 632 живых неотклонённых minors в 472 файлах.
- ~23 exempt-блока в eslint.config.ts, из них часть JUSTIFIED PERMANENT (остаются).

## Фазы

- **Фаза 0 — инвентаризация** (read-only workflow, Sonnet-сканеры по слайсам):
  по каждому слайсу — файлы ≥240 строк, функции >50, complexity-хотспоты,
  let/мутации, покрывающие exempt-записи, seed-minors. Выход: SCOREBOARD.md
  (слайс → счёт нарушений → оценка объёма S/M/L → порядок волн).
- **Фаза 1 — defect + needs-attention** (113 файлов): первые волны, самый гнилой хвост.
- **Фаза 2..N — good→exemplary по слайсам**: каждая волна = OpenSpec change
  на слайс, реализация Grok (дефолт) / Codex (рисковые места), 2 adversarial
  Claude-верификатора (Opus), полный гейт + при runtime-изменениях live-verify,
  коммит на волну. Харнесы: waveb-autorun / waveb-codex-autorun / waveb-batch.
- **Финал**: снятие снятых exempt-записей из eslint.config.ts (teardown — основная
  работа), контрольный `pnpm lint` + полный vitest + depcruise + knip, спот-ревью
  Codex по случайной выборке, обновление артефакта mass-review не требуется
  (грейды пересчитаем собственным контрольным свипом).

## Роутинг моделей

Haiku/Sonnet — сканы и объём; Grok — дефолтный имплементер; Codex — кросс-вендор
на рисковых; Opus — верификаторы/ревью; Fable — только вердикты и синтез.
`model` явно в каждом agent()/fan-out.

## Слайсы (волновая сетка, ~22)

web: features/{admin, analytics, dashboard, report-pages, report-sections, review,
slides, pdf-export, viewer+telemetry, landing+organization+period}, app/, shared/, lib/
api: infrastructure/, lib/, modules/{auth+admin, report-sections+review,
weekly-report+publication+search, period+carry-over+archive, reminders+email+telegram,
analytics+activity+project-activity+observability+telemetry, organization+pdf-export}
packages: shared, ui. Прочее: prisma+e2e+scripts-корень.
