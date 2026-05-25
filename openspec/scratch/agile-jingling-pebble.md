# Audit: что съело 96k токенов на старте сессии

## Context

После одного слова `hi` в фоне статуса уже было **96.3k / 48%** контекста.
Пользователь спросил «что делать?» — выбран режим **разбора, без правок**.
Этот документ — карта источников, не план рефакторинга.

Замеры выполнены Explore-агентом (read-only) против дерева
`/Users/ap/.claude/*`, `/Users/ap/CLAUDE.md`, `customreport/CLAUDE.md`,
`memory/*`, `settings.json`. Токены — оценка по правилу 4 символа ≈ 1 токен.

## Карта источников

### 1. Дисковые файлы, автозагружаемые харнесом (~29.3k)

| Файл                                          | Токены  | Категория        |
| --------------------------------------------- | ------: | ---------------- |
| `~/.claude/CLAUDE.md`                         | ~9,400  | global baseline  |
| `~/.claude/rules/behavior.md`                 | ~7,460  | global rule      |
| `~/.claude/rules/language.md`                 | ~1,830  | global rule      |
| `~/.claude/rules/visuals.md`                  | ~1,720  | global rule      |
| `~/.claude/rules/parallelism.md`              | ~1,270  | global rule      |
| `~/.claude/rules/planning.md`                 | ~710    | global rule      |
| `~/.claude/rules/bash-defaults.md`            | ~600    | global rule      |
| `~/.claude/rules/pillars.md`                  | ~520    | global rule      |
| `~/.claude/rules/tools.md`                    | ~70     | global rule      |
| `~/CLAUDE.md` (RTK home overlay)              | ~1,270  | home overlay     |
| `customreport/CLAUDE.md`                      | ~1,820  | repo overlay     |
| `memory/MEMORY.md`                            | ~1,530  | memory index     |
| `~/.claude/RTK.md`                            | ~240    | global ref       |
| **Итого с диска**                             | **~29,340** |             |

### 2. System-reminders (инжектируются харнесом/плагинами)

Эти блоки приходят как `<system-reminder>` и не лежат на диске единым файлом —
они генерируются на старте.

| Блок                                                  | Токены (оценка) |
| ----------------------------------------------------- | --------------: |
| Skills listing (~190 строк описаний 100+ скиллов)     |   ~8,000–10,000 |
| Deferred tools (~330 имён через ToolSearch)           |    ~6,000–8,000 |
| Recent observations (50 obs из claude-mem)            |         ~11,583 |
| MCP server instructions (grafana, context7, MS, supa) |     ~1,500–2,000|
| **Итого system-reminders**                            |  **~27k–32k**   |

### 3. Платформа Claude Code (системный промпт + tool schemas)

| Блок                                          | Токены (оценка) |
| --------------------------------------------- | --------------: |
| Системный промпт Claude Code                  |     ~3,000–4,000|
| Schemas всегда-включённых инструментов (12)   |     ~5,000–8,000|
| `auto memory` блок                            |     ~1,500–2,000|
| Прочая обвязка харнеса                        |     ~1,000–2,000|
| **Итого платформа**                           |  **~10k–16k**   |

### Сводка

```text
┌─ Источники 96k токенов ────────────────────────────┐
│  Дисковые файлы            ~29k    30%             │
│  System-reminders          ~30k    31%             │
│  Платформа + schemas       ~13k    14%             │
│  Системный/пользовательский промпт + harness  ~24k │
│                                       25%          │
│                                                    │
│  ИТОГО                     ~96k                    │
└────────────────────────────────────────────────────┘
```

## Топ-5 «жирных» одиночных кусков

```text
1. ~/.claude/CLAUDE.md                    ~9,400  ▲ high
2. ~/.claude/rules/behavior.md            ~7,460  ▲ high
3. Recent observations (50 obs)          ~11,583  ▲ high — единый блок
4. Skills listing (system-reminder)    ~8k–10k    ▲ high
5. Deferred tools (system-reminder)    ~6k–8k     ▼ medium
```

## Заметки о памяти

`memory/` содержит **38 .md файлов** (~98 KB). `MEMORY.md` — индекс
на 1.5k токенов; остальные 37 файлов (feedback*, project*, session-handoff*)
**в этой сессии не загружены целиком** — иначе картина была бы +24k.
Харнес подгружает их по запросу через `mcp__plugin_claude-mem_*` или
прямой Read. Это хорошая новость: память «дешёвая» пока к ней не лезешь.

## Что больно резать (identity / стиль)

Эти файлы определяют поведение и язык — резать их = терять качество
ответов:

- `language.md` — Anti-Runglish gate, форматы статусов
- `visuals.md` — ASCII-кадры, status-reply format
- `pillars.md` — 11 столпов
- `behavior.md` — большая часть behavior triggers (но он самый жирный после
  CLAUDE.md и кандидат на splitting на on-demand куски)

## Дешёвые рычаги (если решишь чистить позже)

Перечислено в порядке token-payoff vs. риск потери возможностей:

| Действие                                                              | Экономия      | Риск    |
| --------------------------------------------------------------------- | ------------: | ------- |
| Сократить `recent observations` до 10–20 (claude-mem конфиг)          |       ~7k–8k  | низкий  |
| Архивировать 20+ старых файлов в `memory/` (feedback_*, session-*)    |    0 (не грузятся) | nil |
| Урезать `behavior.md` от 514 → ~150 строк (audit + dedup discipline + few-shot блоки можно вынести) | ~4k–5k | средний |
| Урезать `~/.claude/CLAUDE.md` (660 строк, дублирует router + manifesto) | ~3k–4k    | средний |
| Проверить и поджать `skillListingBudgetFraction` в settings.json      |       ~3k–5k  | низкий  |
| Отключить неиспользуемые плагины из 26 (clickhouse, sentry-cli, supabase если репозиторий их не трогает) | ~2k–4k | низкий |

Cap для всех мер вместе: ~20–25k экономии, т.е. старт уйдёт с 48% к
**25–30%**. Меньше уже нельзя без потери функционала.

## Дорогие рычаги (теряем capability)

- Отключить ToolSearch deferred tools → теряем 330 MCP-инструментов
- Удалить плагин `claude-mem` → теряем поиск по памяти
- Сжать `pillars.md`/`visuals.md`/`language.md` → ломаем выходной стиль

## Verification — как пересчитать в следующий раз

После любой правки запустить новую сессию и:

```bash
# В Claude Code:
/context             # точная разбивка по бакетам (если доступна)

# или замеры с диска:
wc -c ~/.claude/CLAUDE.md ~/.claude/rules/*.md \
      ~/CLAUDE.md \
      /Users/ap/work/customreport/CLAUDE.md \
      ~/.claude/projects/-Users-ap-work-customreport/memory/MEMORY.md
```

Снять стартовый %, сравнить с базой `48%`.

## Открытые вопросы (никого не блокируют)

| #   | Вопрос                                                                | Как решу автономно           |
| --- | --------------------------------------------------------------------- | ---------------------------- |
| 1   | Реальный budget `skillListingBudgetFraction: 0.03` — соблюдается?     | Замер listing в новой сессии |
| 2   | Грузит ли харнес `memory/*.md` целиком при autoMemoryEnabled?         | Логи харнеса / `/context`    |
| 3   | Можно ли резать `recent observations` на стороне claude-mem конфига?  | Чтение `~/.claude/plugins/claude-mem` |

## Что НЕ нужно делать в эту сессию

- Не править `~/.claude/CLAUDE.md` — это репо-managed (см. core-principles)
- Не резать `customreport/CLAUDE.md` — уже минимальный
- Не трогать `MEMORY.md` — индекс, не контент
- Не начинать customreport-работу (`fix/PRJ-2/save-disc` ждёт push) пока
  пользователь сам не позовёт

## Инвентарь инструментов (что есть «в мире и в Клауд»)

### A. Built-in Claude Code (всегда доступны, не из плагинов)

| Инструмент            | Назначение                                          |
| --------------------- | --------------------------------------------------- |
| `Read`/`Edit`/`Write` | файловые операции                                   |
| `Bash`                | shell-команды (`git`, `pnpm`, `docker`, `rtk` ...)  |
| `Agent`               | spawn subagent (fork либо named subagent_type)      |
| `Skill`               | invoke skill                                        |
| `ToolSearch`          | подгрузить схемы deferred tools по имени            |
| `AskUserQuestion`     | вопрос пользователю с предзаготовленными вариантами |
| `advisor`             | second opinion от Opus 4.7 с полным контекстом      |
| `ScheduleWakeup`      | self-pacing в `/loop`                               |
| `TaskCreate`/`Update` | трекинг прогресса                                   |
| `WebFetch`/`WebSearch`| внешние URL и поиск                                 |
| `EnterPlanMode`/`Worktree` | спец-режимы                                    |

Always-on schemas сидят в системном промпте (~5–8k токенов).

### B. MCP-серверы (через плагины, 26 enabled)

| Категория       | Серверы                                            |
| --------------- | -------------------------------------------------- |
| Браузер         | `chrome-devtools`, `playwright`                    |
| Данные          | `supabase`                                         |
| Observability   | `grafana`, `bugsink`, `sentry-cli`, `claude-mem`   |
| Репо            | `github`                                           |
| Документация    | `context7`, `microsoft-docs`                       |
| Деплой          | `vercel`                                           |
| Аннотации       | `agentation`, `plannotator`                        |
| AI helper       | `codex-app-server`                                 |
| Прочее          | `clickhouse-best-practices`                        |

Tool schemas грузятся по требованию через `ToolSearch` — в стартовом
контексте лежат только имена (~6–8k токенов на ~330 имён).

### C. Skills (100+ через плагины)

| Группа             | Ключевые скиллы                                              |
| ------------------ | ------------------------------------------------------------ |
| superpowers        | brainstorming, writing-plans, executing-plans, TDD,          |
|                    | debugging, verification, parallel-agents                     |
| openspec           | explore, propose, apply, archive                             |
| peo                | plan, jira, confluence, retro, radar, session-scan           |
| code-review        | review-pr, code-reviewer, security-review                    |
| code-modernization | assess, transform, extract-rules, map, reimagine, harden     |
| claude-mem         | make-plan, do, mem-search, oh-my-issues, weekly-digests      |
| UI / frontend      | ui-ux-pro-max, frontend-design, react-best-practices, slides |
| стеки              | typescript-*, nestjs, jmix, spring-boot, docker, postgres-pro|
| vercel             | bootstrap, deploy, env, ai-sdk, workflow                     |
| supabase           | supabase, postgres-best-practices                            |
| codex              | codex-rescue, setup, gpt-5-4-prompting                       |

Описания skills сидят в system-reminder (~8–10k токенов) — это часть
«system-reminders» в основной таблице выше.

### D. «В мире» — shell-утилиты под рукой через `Bash`

`git`, `gh`, `pnpm`, `node`, `prisma`, `docker`, `playwright`, `openspec`
CLI, `rtk` (твой token-killer для git/gh/test/build с экономией 60–90%).
