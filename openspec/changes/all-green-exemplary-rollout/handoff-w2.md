# Handoff — All-Green Campaign, волны 1–2 в main (2026-07-18)

Repo: `/Users/wrk/work/customreport`, main @ `0cd07326` (pushed, дерево чистое,
кроме untracked `openspec/audit/` — чужая живая Sisyphus-сессия, не трогать).

## Портативность (для другого ноутбука)

ВСЁ нужное для продолжения лежит В РЕПО, в этом каталоге change'а:
`campaign-plan.md`, `scoreboard.md`, `phase0-inventory.json` (инвентаризация
22 слайсов), `inventory-seed.json` (632 живых minor-находки),
`harness-template.js` (скрипт Волны 2 — шаблон следующих волн),
`mass-review-artifact.html` + `mass-review-data.json` (артефакт ревью 1166
файлов). Пути в текстах ниже на `~/work/customreport-archive/` — это старый
ноутбук; на новой машине читай локальные копии отсюда.

## Кампания

Саша заказал: ВЕСЬ репозиторий до exemplary (1166/1166), не «просто без блокеров».
Канон кампании: `~/work/customreport-archive/2026-07-18-all-green-campaign/`
(PLAN.md — цель/рамки/фазы; SCOREBOARD.md — 22 слайса, объёмы, порядок волн;
phase0-inventory.json — детальная инвентаризация; inventory-seed.json — 632
живых minor-находки mass-review по файлам).
OpenSpec: change `all-green-exemplary-rollout` (валиден strict; tasks.md = чеклист волн).

## Состояние

- Волна 1 (4ea2a790): pdf-export, viewer, analytics, dashboard — готово.
- Волна 2 (0cd07326): web-shared+lib, api-lib, api-auth-admin, api-analytics-
  activity-obs (Grok-лейн) — готово. **Не сделан: api-report-pub-search** —
  лейн упал на StructuredOutput, правок не оставил; перезапустить одиночной волной.
- Дальше по SCOREBOARD: волны 3+ = M-слайсы, потом L (web-report-pages,
  api-sections-review), финал — teardown exempt-записей + контрольный свип.

## Харнес (работает, откалиброван)

Workflow: план (Sonnet/Opus) → реализация (лейн на слайс, дизъюнктные пути) →
2 adversarial Opus-верификатора (+Codex agentType `codex:codex-rescue` на
нагруженных). Скрипты волн: `.../796bace1.../workflows/scripts/all-green-wave*.js`
— брать за шаблон. Гейты ПОСЛЕ волны гонит оркестратор сам.

## Грабли этой сессии

- `cmd | tail; echo $?` меряет exit код tail → ложно-зелёный lint (память
  `pipe-tail-exit-code-false-green`). Гейты только через redirect в файл + $?.
- Quality-верификатор — не формальность: поймал реальный регресс (client-logger
  `const`+push → `let`+spread с новым eslint-disable); реверт сделан.
- Grok-лейн не гоняет eslint на тестах → unsorted imports; добавить в спеку лейна.
- knip валит push за экспорт без импортёра — новые типы держать локальными.
- Defect-тесты из mass-review оказались уже починены (64834f55, 4d3e4051) —
  всегда re-grade перед фиксом, находки 2026-07-17 частично протухли.

## Следующий шаг новой сессии

1. Прочитать PLAN.md + SCOREBOARD.md.
2. Перезапустить api-report-pub-search (одиночная волна, шаблон wave2-скрипта).
3. Волны 3+ по SCOREBOARD (M-слайсы), тем же харнесом, коммит на волну.
