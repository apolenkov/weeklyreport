# Слой возможностей: внешние Claude Code automations поверх установленного

**Суть (1 строка):** это инструментальный слой (skills, plugins, MCP-серверы), который ДОБАВЛЯЕТ возможности к уже установленному набору — он не заменяет текущую конфигурацию, а закрывает дыры в 22-эпиковой дорожной карте.

## Заметка о безопасности

Сторонние skills и MCP-серверы исполняют чужой код с доступом к репозиторию.

- Ставить только после явного одобрения пользователя.
- Предпочитать first-party (Anthropic) каналы community-источникам.
- Важная находка: ряд инструментов, которые во входных данных проходили как «сырые» MCP-серверы (`semgrep`, `sentry`, `prisma`, `github`), на деле существуют как **first-party plugins** в `claude-plugins-official`. Это более безопасный канал установки, чем подключение стороннего MCP напрямую. Я проверил только наличие имени в манифесте (234 плагина), но не инспектировал содержимое — нельзя утверждать, что официальный `sentry`-плагин тождественен `getsentry/sentry-mcp`.

## 1. Поставить (INSTALL)

Проверено: имя присутствует в манифесте `claude-plugins-official` (cached на диске).

| tool                | kind   | эпик                                                            | install command                                                   | trust       | risk | verified-source                                        |
| ------------------- | ------ | --------------------------------------------------------------- | ----------------------------------------------------------------- | ----------- | ---- | ------------------------------------------------------ |
| `pr-review-toolkit` | plugin | Ось 1 (code quality) + Ось 4 (processes): multi-agent PR-review | `claude plugin install pr-review-toolkit@claude-plugins-official` | FIRST_PARTY | LOW  | manifest `claude-plugins-official` (verified локально) |

Это единственная строка с рекомендацией INSTALL во входных данных — и её наличие подтверждено. Остальное намеренно не добавляю сюда.

## 2. Рассмотреть (CONSIDER)

Существование плагина подтверждено в official-манифесте; ставить под конкретный эпик после решения пользователя.

| tool                       | kind   | эпик                                           | install command                                                          | trust       | risk                       | verified-source     |
| -------------------------- | ------ | ---------------------------------------------- | ------------------------------------------------------------------------ | ----------- | -------------------------- | ------------------- |
| `code-review`              | plugin | Ось 1: параллельный multi-agent аудит PR       | `claude plugin install code-review@claude-plugins-official`              | FIRST_PARTY | LOW                        | manifest (verified) |
| `commit-commands`          | plugin | Ось 4: git-workflow                            | `claude plugin install commit-commands@claude-plugins-official`          | FIRST_PARTY | LOW                        | manifest (verified) |
| `session-report`           | plugin | Ось 3 (traceability) + Ось 5 (onboarding)      | `claude plugin install session-report@claude-plugins-official`           | FIRST_PARTY | LOW                        | manifest (verified) |
| `explanatory-output-style` | plugin | Ось 5: teaching-grade вывод                    | `claude plugin install explanatory-output-style@claude-plugins-official` | FIRST_PARTY | LOW                        | manifest (verified) |
| `learning-output-style`    | plugin | Ось 5: teaching-grade вывод                    | `claude plugin install learning-output-style@claude-plugins-official`    | FIRST_PARTY | LOW                        | manifest (verified) |
| `plugin-dev`               | plugin | Ось 5: расширять exemplar (авторство плагинов) | `claude plugin install plugin-dev@claude-plugins-official`               | FIRST_PARTY | LOW                        | manifest (verified) |
| `hookify`                  | plugin | Ось 4: авторство кастомных guardrail-хуков     | `claude plugin install hookify@claude-plugins-official`                  | FIRST_PARTY | LOW                        | manifest (verified) |
| `github`                   | plugin | Ось 4 + Ось 3: issues/PR/CI                    | `claude plugin install github@claude-plugins-official`                   | FIRST_PARTY | LOW (через official-канал) | manifest (verified) |
| `prisma`                   | plugin | Ось 2 + Ось 5: schema/migrations               | `claude plugin install prisma@claude-plugins-official`                   | FIRST_PARTY | LOW (через official-канал) | manifest (verified) |
| `semgrep`                  | plugin | Ось 1 + Ось 4: SAST/secrets/supply-chain       | `claude plugin install semgrep@claude-plugins-official`                  | FIRST_PARTY | LOW (через official-канал) | manifest (verified) |
| `code-modernization`       | plugin | Ось 2: модернизация архитектуры                | `claude plugin install code-modernization@claude-plugins-official`       | FIRST_PARTY | LOW                        | manifest (verified) |

Примечания:

- `github`/`prisma`/`semgrep` — это official-плагины с тем же именем; они предпочтительнее, чем raw MCP-сервер (`github/github-mcp-server`, `prisma/mcp`, semgrep MCP), который во входных данных шёл с риском MED.
- `code-modernization` во входных данных стоял SKIP, но это first-party плагин и прямо ложится на Ось 2 — выношу в CONSIDER как дешёвую опцию.

## 3. Пропустить / избыточно (SKIP)

Кратко, с причиной.

1. **Дубликаты уже установленного** — `code-simplifier`, `typescript-lsp`, `context7`, `playwright`, `chrome-devtools-mcp`, `frontend-design`, `security-guidance`, `claude-code-setup`, `claude-md-management`: уже стоят (подтверждено `claude plugin list`).
2. **`skill-creator`** — установлен, но в статусе **disabled**; включить локально, а не ставить заново.
3. **`claude-plugins-official` (marketplace)** — уже подключён как marketplace.
4. **`sentry` (MCP / plugin)** — продуктовая причина из входных данных (избыточно к текущему Bugsink/Sentry-стеку); риск HIGH у raw-MCP `getsentry/sentry-mcp`. Уточнение: official-плагин с именем `sentry` существует (first-party канал, ниже риск), но содержимое не инспектировал — не равняю их.
5. **`anthropic-agent-skills`, `webapp-testing`, `mcp-builder`, `claude-api`, `doc-coauthoring`** — first-party example-skills; полезны, но либо дублируют установленное (`claude-api`, `webapp-testing`), либо это разовый bundle, а не постоянный инструмент. Подключать точечным skill-копированием, а не как marketplace.
6. **Reference MCP-серверы** (`Fetch`, `Filesystem`, `Git`) — функционал уже покрыт встроенными инструментами и codegraph.

## 4. Не подтверждено (needs-checking — НЕ устанавливать как факт)

Звучит полезно, но я НЕ смог привязать к конкретному authoritative-репозиторию + точной команде установки. Подаю честно как требующее проверки.

1. **`Grafana MCP Server` (`grafana/mcp-grafana`)** и **`Postgres MCP Pro` (`crystaldba/postgres-mcp`)** — это чистые MCP-серверы, а official-плагина с таким именем нет. Команду `claude mcp add ...` в этой сессии я не проверял — не печатаю её как готовый факт. Для Postgres предпочесть official `prisma`-плагин (проверен); для Grafana — отдельно проверить `claude mcp add` против README сервера.
2. **`wshobson/agents` (marketplace)** — репозиторий существует и подтверждён (37k звёзд). Двухшаговая установка: `claude plugin marketplace add wshobson/agents`, затем `claude plugin install <plugin>@<marketplace>`. Но конкретные имена под-плагинов (включая `documentation-generation`) я не перечислял — итоговое имя плагина не подтверждено.
3. **`compound-engineering`** — наиболее вероятный источник `EveryInc/compound-engineering-plugin` существует (21.8k звёзд, подтверждён). Точное имя устанавливаемого плагина внутри него не сверял — нужно открыть его `marketplace.json`.
4. **`anthropics/skills`** — репозиторий существует («Public repository for Agent Skills»). Является ли он source'ом, который принимает `claude plugin marketplace add`, я НЕ проверил — нужно сверить структуру репо перед командой.
5. **Диаграммные skills** — `c4-model (cheriftj)`, `c4-skill (bitsmuggler)`, `mermaid-skill (Agents365-ai)`, `oh-my-mermaid` — авторитетный репозиторий по заявленным именам авторов я НЕ нашёл (поиск `cheriftj c4` пуст; найденный `chaye7417/claude-skill-mermaid-visualizer` имеет 0 звёзд и НЕ тождественен заявленному). Не подтверждено — не выдумываю команду.
6. **`changelog-generator` / `codebase-onboarding` / `documentation-generation` (ComposioHQ / wshobson)** — головной репозиторий `ComposioHQ/composio` существует, но точный путь к этим skills и команда установки не подтверждены; `codebase-onboarding` во входных данных уже помечен `verified:false`.
