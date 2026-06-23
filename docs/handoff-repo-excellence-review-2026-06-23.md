# Handoff — запуск repo-excellence-review из новой сессии

**Дата:** 2026-06-23. **Кому:** свежей сессии, которая ЗАПУСКАЕТ ревью.

## Bottom line (что сделать)

1. Запустить готовый workflow `repo-excellence-review` (он в фоне, длинный).
2. Дождаться результата, записать отчёт в `docs/`, показать backlog пользователю.
3. Правки НЕ делать — это ревью→backlog. Фиксы потом, по одному изменению.

Команда запуска:

```text
Workflow({ scriptPath: '.claude/workflows/repo-excellence-review.js' })
```

## Что уже готово (не переделывать)

1. **Скиллы:**
   - `code-review-skill` — **глобальный** (`~/.claude/skills/`), по решению
     пользователя. Скрипт ссылается на абсолютный путь
     `/Users/wrk/.claude/skills/code-review-skill` (script не разворачивает `~`).
     Агентам дана fallback-подсказка искать через `ls ~/.claude/skills`.
   - 3 Vercel-скилла — **в репо** (`.claude/skills/`):
     `vercel-react-best-practices`, `vercel-composition-patterns`,
     `web-design-guidelines`. Версии пинятся в `skills-lock.json`.
2. **Workflow-скрипт:** `.claude/workflows/repo-excellence-review.js` — полный,
   проверенный.
3. **Дизайн-док с диаграммой моделей:** `docs/repo-excellence-review-workflow.md`.
4. **Smoke-тест субагента:** см. раздел «Проверки» ниже.

## Заблокированные решения (приняты пользователем)

1. Результат — **ревью → backlog** (отчёт + список OpenSpec-изменений). Без правок.
2. Охват — **весь репозиторий** по подсистемам: web / api / shared / ui / prisma.
3. Next-слой — Vercel-скиллы поставлены **в рамках репо** (project-level), не глобально.
4. Дедуп с уже одобренной `docs/code-health-map.md` — на фазе приоритизации.
5. Запуск — **из новой сессии** (это она), не из проектировочной.

## Распределение моделей

- Ф0 Инвентаризация — **Sonnet** (задаёт покрытие и выбор модели; не дешевить).
- Ф1 Review — **Opus** на горячих путях, **Sonnet** на medium, **Haiku** на low.
- Детерминированный override: пути с auth/prisma/report/контрактами форсятся на Opus.
- Ф2 Verify — **Opus** при severity≥High или security, иначе **Sonnet**.
- Ф3 Приоритизация и Ф4 Синтез — **Opus**.

Принцип: Opus там, где суждение; без token-бюджетирования; качество в приоритете.

## Что делать ПОСЛЕ завершения workflow

Workflow возвращает объект (файлы сам НЕ пишет):
`{ unitsReviewed, coverage, confirmedCount, backlog[], reportMarkdown, recommendedChanges[] }`.

1. Записать `reportMarkdown` в `docs/repo-excellence-review-2026-06-23.md`.
2. Показать пользователю: счётчики P0/P1/P2/P3 + таблицу P0+P1.
3. Сверить `recommendedChanges` с активным backlog (`openspec list`) и с
   `docs/code-health-map.md` — не плодить дубли.
4. С согласия пользователя — каркасить верхние OpenSpec-изменения (`opsx:propose`),
   НЕ реализовывать.
5. Перед «готово» — вызвать advisor, затем краткая сводка.

## Гейты и гигиена

- Гейты репо: `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`.
- Скрипт workflow — это `.claude/workflows/*.js`, в lint/typecheck-поверхность не
  входит. Диагностика IDE «synth unused» — ложная (используется в `return`).
- `eslint.config.ts` имеет пре-существующие TS-ошибки (был `M` до этой работы) —
  НЕ наши, не трогать в рамках этой задачи.
- RTK: префиксовать git-команды через `rtk`.

## Состояние репозитория

- Ветка: `demo-feedback-2026-06-22` (коммитить с ветки, не в main).
- Возможна параллельная сессия — проверить `git status` перед действиями.
- Незакоммиченное на момент handoff (untracked, ничего коммитить не нужно для запуска):
  - `.claude/skills/vercel-*`, `.claude/skills/web-design-guidelines`
    (Vercel-скиллы в репо; code-review-skill — глобальный, в дереве его НЕТ)
  - `skills-lock.json` (M — обновлён установкой скиллов)
  - `.claude/workflows/repo-excellence-review.js` (новый)
  - `docs/repo-excellence-review-workflow.md`, этот handoff (новые)
  - прочие docs/openspec из прошлой сессии (north-star-roadmap и т.п.) — не наши.

## Проверки (smoke) — ПРОЙДЕНЫ

Три smoke-прогона на дефолтном workflow-субагенте (Haiku):

1. `hasBash: true` — Bash + чтение репо работают (вернул реальные пути).
2. Первый прогон поймал баг: скрипт искал скилл по относительному пути, а тот
   только глобальный. Сначала пробовал вендорить в репо (smoke зелёный), затем
   по решению пользователя вернул скилл в глобал.
3. Финальный smoke по абсолютному глобальному пути: `skillReadable: true`,
   `refReadable: true`. ✓

Вывод: дефолтный субагент годится, читает и репо, и абсолютные пути вне репо;
`agentType` менять НЕ нужно. Если когда-то понадобится — ставить
`agentType: 'general-purpose'` (НЕ 'Explore': он молча сажает агента на Haiku).

## Решение про code-review-skill: ГЛОБАЛЬНЫЙ

Пользователь оставил скилл глобальным (`~/.claude/skills/code-review-skill`).
Репо-копия удалена. В скрипте `SKILL_DIR` указывает на абсолютный путь
`/Users/wrk/.claude/skills/code-review-skill`. Smoke подтвердил: субагент читает
его вне репо. Workflow-субагенты НЕ подхватывают глобальные скиллы автоматически
— поэтому ссылка идёт явным путём, а не через skill-механизм. Сменишь машину/
`$HOME` — поправь одну константу `SKILL_DIR` (агентам дана fallback-подсказка
`ls ~/.claude/skills`). Vercel-скиллы — в репо, путь относительный.
