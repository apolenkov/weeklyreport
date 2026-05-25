# Phase 69 — Repo Dislocation + Stack Smoke + Observability MCP

> **Контекст**: Phase 68 (Full Local Observability) **закрыта** — 12 коммитов
> в worktree `obs/v8.3-full-observability` (`/Users/ap/work/customreport-obs`),
> все 10 done-conditions ✅, ничего не запушено (corp DNS недоступен).
>
> Пользователь просит три параллельных вещи:
>
> 1. **Перенести репо** с корпоративного `ghe.example.org/apolenkov/customreport`
>    на личный **`apolenkov/yourpulse` (приватный)** — старый origin удалить
>    полностью.
> 2. **Запустить стэк локально** и сделать смок-проверку (Grafana, Bugsink,
>    API, traceId в логах) — без участия пользователя.
> 3. **Поставить MCP-серверы** для Grafana (`grafana/mcp-grafana`, official)
>    и решить дилемму с Bugsink (official Sentry MCP **несовместим** с
>    Bugsink REST — нужен либо OpenAPI-bridge, либо замена на real Sentry).

## 0. TLDR — Было / Проблема / Станет

```text
┌─ Было (текущее состояние customreport + customreport-obs) ───────────┐
│ origin = https://ghe.example.org/apolenkov/customreport.git        │
│ corp DNS недоступен → push заморожен                                  │
│ gh auth: apolenkov ✓ active, sovavibe в keyring, apolenkov invalid  │
│ Phase 68 worktree: clean, 1871cab obs-w4, 12 коммитов obs-w*          │
│ MCP-серверы: 28 plugins, observability MCP отсутствуют целиком        │
│ sentry-cli плагин enabled (CLI ≠ MCP); Sentry MCP в disabled-list     │
│ Стэк не запускался → traceId / Bugsink / Web Vitals не проверены      │
└──────────────────────────────────────────────────────────────────────┘
```

### Проблема

1. **Push заморожен** — corp host недоступен, ветка `obs/v8.3-full-observability`
   живёт только локально, риск потерять 12 коммитов при сбое диска.
2. **Стэк не верифицирован** — Phase 68 закрыта по done-conditions (compose
   config, typecheck, lint), но не по runtime smoke (Grafana up? Bugsink up?
   traceId реально пишется в `app.log`?).
3. **Bugsink не agent-readable** — выбор Bugsink в Phase 68 закрыл задачу
   error-tracking по UI, но **нет official MCP**: Sentry MCP читает
   `/api/0/organizations/{slug}/issues/`, а Bugsink REST живёт на
   `/api/canonical/0/*` (Sentry-INGEST-compatible, не Sentry-REST). Это
   означает что агент не может читать ошибки из Bugsink через MCP.
4. **Grafana MCP не установлен** — `grafana/mcp-grafana` (official) покрывает
   Loki / Tempo / Prometheus / Dashboards в одном сервере, но требует
   service-account token, а admin/admin basic-auth не подходит.

### Станет

```text
┌─ Целевое состояние (после Wave 4) ──────────────────────────────────┐
│ origin = git@github.com:apolenkov/yourpulse.git (private, personal) │
│ corp origin удалён полностью, в .git/config только personal         │
│ оба worktree (main + obs) указывают на новый origin                 │
│ branches pushed: main + obs/v8.3-full-observability + tags          │
│                                                                      │
│ Стэк локально up:                                                    │
│   ├── otel-lgtm @ :3003 (Grafana UI + Loki + Tempo + Prom)          │
│   ├── bugsink   @ :8000                                              │
│   ├── api       @ :3002 (metrics + /api/web-vitals)                 │
│   └── web       @ :3000 (Web Vitals reporter wired)                 │
│                                                                      │
│ Smoke verified:                                                      │
│   ├── curl 200 на Grafana / Bugsink / API health                    │
│   ├── /metrics содержит web_vital_lcp, http_request_duration         │
│   ├── tail app.log | jq → traceId присутствует в JSON               │
│   └── скриншоты Grafana и Bugsink UI (для пользователя)             │
│                                                                      │
│ MCP-серверы:                                                         │
│   ├── grafana/mcp-grafana   ✓ установлен, GLSA token в env          │
│   └── bugsink → DECISION needed (см. секцию 7)                      │
└──────────────────────────────────────────────────────────────────────┘
```

### Поток выполнения

```text
[Wave 0 pre-flight]
  ├── verify gh apolenkov auth + create gh repo apolenkov/yourpulse --private
  └── snapshot обоих worktrees (status, log, branch)
          │
          ▼
[Wave 1 dislocation] ────parallel────┐
  ├── customreport (main repo)        │
  │   git remote remove origin        │
  │   git remote add origin <new>     │
  │   git push origin main + tags     │
  └── customreport-obs (worktree)     │
      git push origin obs/v8.3-...    │
      git push origin main            │
          │                           │
          ▼                           │
[Wave 2 stack smoke] ◄────────────────┘
  ├── pnpm install (worktree)
  ├── pnpm observability:up
  ├── curl + jq verify endpoints
  ├── trigger web vitals (browse /)
  └── screenshots → .planning/audits/
          │
          ▼
[Wave 3 MCP install] ────parallel────┐
  ├── Grafana: mint service-acct token │
  │   claude mcp add-json grafana ...  │
  └── Bugsink: research + present opts │
          │                           │
          ▼                           │
[Wave 4 verification + ship] ◄────────┘
  ├── 9 done-conditions self-check
  ├── 69-SUMMARY.md + memory entry
  └── push final state
```

## 1. Locked decisions (3)

```text
┌─ User-confirmed via AskUserQuestion ────────────────────────────────┐
│ D1. Target repo  │ apolenkov/yourpulse (private, личный GitHub)     │
│ D2. Old origin   │ Удалить полностью (corp DNS всё равно не дышит)  │
│ D3. Bugsink MCP  │ Поресёрчить — пользователь раздражён выбором     │
│                  │ Bugsink в Phase 68 (не agent-readable). Решение  │
│                  │ принимается в Wave 3 после варианты-таблицы.     │
└─────────────────────────────────────────────────────────────────────┘
```

## 2. Архитектура: git layout после переноса

```text
┌─ Текущее (linked worktree) ─────────────────────────────────────────┐
│                                                                      │
│  /Users/ap/work/customreport/.git/  ← single .git dir                │
│           │                                                          │
│           ├── config: [remote "origin"] = ghe.example.org/...        │
│           └── worktrees/customreport-obs/  ← linked worktree state   │
│                                                                      │
│  /Users/ap/work/customreport         ← branch fix/PRJ-2/shiny-eagle  │
│  /Users/ap/work/customreport-obs     ← branch obs/v8.3-...           │
│                                                                      │
│  Обе ветки разделяют ОДИН remote origin (corp, недоступен).          │
└──────────────────────────────────────────────────────────────────────┘

┌─ Целевое (после dislocation) ────────────────────────────────────────┐
│                                                                      │
│  Один git remove origin + git remote add origin <new> в main repo   │
│  → autoматически применяется к обоим worktree (shared .git dir)     │
│                                                                      │
│  origin = git@github.com:apolenkov/yourpulse.git                    │
│  /Users/ap/work/customreport         ← push main + fix/PRJ-2/...    │
│  /Users/ap/work/customreport-obs     ← push obs/v8.3-...             │
└──────────────────────────────────────────────────────────────────────┘
```

## 3. Стратегия выполнения

### 3.1 Sequential между Wave 1 → 2 → 3, parallel внутри Wave 1

Wave 1A (main repo) и Wave 1B (worktree) могут идти параллельно — это
независимые `git push` команд на разные ветки.

Wave 2 (smoke) идёт после Wave 1 потому что хочется убедиться что
новый origin рабочий **до** того как тратить 10+ минут на runtime smoke.

Wave 3 (MCP) идёт после Wave 2 потому что Grafana service-account token
можно создать только когда Grafana UI поднят.

### 3.2 Cheap-first delegation

- **Inline (Sonnet, без агентов)** — все Wave 0/1/2/3 шаги в этом плане
  механические: `gh repo create`, `git remote`, `git push`, `curl`,
  `claude mcp add-json`, `jq`. Спавнить subagent overhead больше чем сама
  работа. Inline execution через Bash tool.
- **Один Haiku-агент для Bugsink research** — если в Wave 3 нужно глубже
  копать варианты Bugsink-MCP (OpenAPI bridge package validation, поиск
  forks). Spawn только если пользователь отклонит обе предложенные опции.

### 3.3 Anti-conflict matrix

```text
┌─ Файл / ресурс                  │ Wave │ Конфликт ─────────────────┐
│ /Users/ap/work/customreport/    │ 1A   │ нет (один remote, single  │
│   .git/config                   │      │  команда)                  │
│ /Users/ap/work/customreport-obs │ 1B   │ нет (linked worktree —    │
│   inherits same config          │      │  фактически тот же .git)  │
│ GitHub repo apolenkov/yourpulse │ 0+1  │ нет (новый, пустой)        │
│ docker-compose.observability    │ 2    │ нет (только compose up)    │
│ ~/.claude/settings.json (MCP)   │ 3    │ нет (новые MCP entries)    │
│ ~/.claude.json                  │ 3    │ нет (top-level config)     │
│ .planning/phases/69-*           │ 4    │ NEW (создаём)              │
└──────────────────────────────────────────────────────────────────────┘
```

## 4. Files / systems

| Path                                           | Action     | Wave | Purpose                                      |
| ---------------------------------------------- | ---------- | ---- | -------------------------------------------- |
| `gh repo create apolenkov/yourpulse --private` | CMD        | 0    | Создать пустой репозиторий                   |
| `/Users/ap/work/customreport/.git/config`      | EDIT (git) | 1A   | `remote remove origin` + `remote add origin` |
| `git push origin main`                         | CMD        | 1A   | Push основной ветки + tags                   |
| `git push origin fix/PRJ-2/shiny-eagle`        | CMD        | 1A   | Push активной PRJ-2 ветки                    |
| `git push origin obs/v8.3-full-observability`  | CMD        | 1B   | Push Phase 68 worktree-ветки                 |
| `~/.claude.json` (mcpServers section)          | EDIT       | 3    | Добавить grafana MCP entry                   |
| `.planning/phases/69-dislocation-smoke-mcp/`   | NEW        | 4    | Phase scaffold (CONTEXT/PLAN/SUMMARY)        |
| `.planning/audits/phase-69-smoke-*.png`        | NEW        | 2    | Скриншоты Grafana + Bugsink UI               |
| `.planning/memory/2026-05-24-phase-69-mcp.md`  | NEW        | 4    | Memory entry: новый origin, MCP, Bugsink dec |

## 5. Ordered steps

### Wave 0 — pre-flight (Sonnet inline, ~2 min)

1. **Проверить `gh auth status`** под `apolenkov` (active GITHUB_TOKEN). Если
   token не имеет scope `repo` — fail-fast с инструкцией пересоздать.
2. **Создать пустой репозиторий**:

   ```bash
   gh repo create apolenkov/yourpulse \
     --private \
     --description "CustomReport / YourPulse: weekly status reports automation" \
     --disable-issues=false \
     --disable-wiki
   ```

3. **Снимок состояния** обоих worktree:

   ```bash
   git -C /Users/ap/work/customreport status --short --branch
   git -C /Users/ap/work/customreport-obs status --short --branch
   git -C /Users/ap/work/customreport branch -a | head -20
   git -C /Users/ap/work/customreport tag --sort=-creatordate | head -5
   ```

### Wave 1A — main repo dislocation (parallel with 1B)

1. **Удалить старый origin**:

   ```bash
   cd /Users/ap/work/customreport
   git remote remove origin
   git remote add origin git@github.com:apolenkov/yourpulse.git
   git remote -v   # verify
   ```

2. **Push основных веток + tags**:

   ```bash
   git push -u origin main
   git push -u origin fix/PRJ-2/shiny-eagle
   git push origin --tags   # v8.2.0 и др.
   ```

3. **Verify upstream**:

   ```bash
   git branch -vv | grep -E "main|shiny-eagle"
   ```

### Wave 1B — worktree dislocation (parallel with 1A)

1. **Worktree наследует тот же `.git`** — origin уже сменился после Wave 1A.
   Просто пушим ветку:

   ```bash
   cd /Users/ap/work/customreport-obs
   git push -u origin obs/v8.3-full-observability
   ```

2. **Verify**:

   ```bash
   git -C /Users/ap/work/customreport-obs branch -vv
   gh repo view apolenkov/yourpulse --json defaultBranchRef,visibility,pushedAt
   ```

### Wave 2 — stack smoke (Sonnet inline, ~10 min)

1. **Установка зависимостей** (worktree независимо от main pnpm-store):

   ```bash
   cd /Users/ap/work/customreport-obs
   pnpm install --frozen-lockfile
   ```

2. **Поднять observability стэк**:

    ```bash
    pnpm observability:up
    docker compose ps | grep -E "otel-lgtm|bugsink|api|web|postgres|redis"
    ```

3. **Дождаться healthy** (30s):

    ```bash
    until curl -fsS http://localhost:3003/api/health; do sleep 3; done
    until curl -fsS http://localhost:8000/; do sleep 3; done
    until curl -fsS http://localhost:3002/health/live; do sleep 3; done
    ```

4. **Endpoint smoke**:

    ```bash
    curl -fsS http://localhost:3003/api/health    # Grafana → {"database":"ok"}
    curl -fsS http://localhost:8000/              # Bugsink → HTML
    curl -fsS http://localhost:3002/health/live   # API → {"status":"ok"}
    curl -fsS http://localhost:3000/              # Web → HTML
    ```

5. **Метрики**:

    ```bash
    curl -s http://localhost:3002/metrics | grep -E "^(http_request_duration|trpc_request_total|web_vital_)" | head -20
    ```

6. **traceId в логах** (дёрнуть запрос → проверить):

    ```bash
    curl -fsS -H 'x-request-id: smoke-69-001' http://localhost:3002/health/ready
    sleep 2
    tail -n 30 /Users/ap/work/customreport-obs/apps/api/.logs/app.log \
      | jq 'select(.correlationId != "no-context") | {ts:.timestamp, level, correlationId, traceId, spanId, msg:.message}' \
      | head -20
    ```

7. **Trigger Web Vitals** (открыть Web → метрики автоматически отстреливают):

    ```bash
    # browser visit через chrome-devtools MCP или curl
    curl -fsS http://localhost:3000/ > /dev/null
    sleep 5
    curl -s http://localhost:3002/metrics | grep "^web_vital_" | head -10
    ```

8. **Скриншоты UI**:

    Через chrome-devtools-mcp: открыть `http://localhost:3003` (Grafana home),
    `http://localhost:3003/dashboards` (3 наши дашборда), `http://localhost:8000`
    (Bugsink home, пустое состояние). Сохранить в
    `.planning/audits/phase-69-smoke-*.png`.

### Wave 3 — MCP installation

1. **Создать Grafana service-account token** через API (admin/admin):

    ```bash
    SA_RESPONSE=$(curl -fsS -u admin:admin -X POST \
      http://localhost:3003/api/serviceaccounts \
      -H "Content-Type: application/json" \
      -d '{"name":"claude-code-mcp","role":"Editor"}')
    SA_ID=$(echo "$SA_RESPONSE" | jq -r .id)

    TOKEN_RESPONSE=$(curl -fsS -u admin:admin -X POST \
      "http://localhost:3003/api/serviceaccounts/$SA_ID/tokens" \
      -H "Content-Type: application/json" \
      -d '{"name":"claude-code-mcp-token"}')
    GRAFANA_TOKEN=$(echo "$TOKEN_RESPONSE" | jq -r .key)
    echo "$GRAFANA_TOKEN" > /Users/ap/work/customreport-obs/.grafana-mcp-token
    chmod 600 /Users/ap/work/customreport-obs/.grafana-mcp-token
    ```

2. **Добавить Grafana MCP**:

    ```bash
    claude mcp add-json grafana "$(jq -n --arg token "$GRAFANA_TOKEN" '{
      command: "uvx",
      args: ["mcp-grafana"],
      env: {
        GRAFANA_URL: "http://localhost:3003",
        GRAFANA_SERVICE_ACCOUNT_TOKEN: $token
      }
    }')"
    ```

3. **Verify MCP** (требует перезапуска Claude Code):

    После рестарта Claude Code: `/mcp grafana` → доступны tools
    `list_dashboards`, `query_loki_logs`, `query_prometheus` и т.д.

4. **Bugsink MCP — DECISION POINT** (см. секцию 7 «Open questions»). Текущий
    research даёт три опции:

    | Опция                                        | Усилия            | Риски                                                                  | Что получаем                                                                             |
    | -------------------------------------------- | ----------------- | ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
    | A. OpenAPI-bridge через `openapi-mcp-server` | средние (~1ч)     | bridge unmaintained, может ломаться на schema changes                  | read-only Bugsink через generic OpenAPI tool — agent может listing issues / fetch events |
    | B. Заменить Bugsink на self-hosted Sentry    | большие (~1 день) | 20+ containers (clickhouse, kafka, snuba), сложный setup, ARM64 quirks | full official MCP support                                                                |
    | C. Пропустить Bugsink MCP, читать UI вручную | 0                 | агент не видит ошибки                                                  | UI :8000 для пользователя, Bugsink остаётся как ingest-only sink                         |

    Default action: предложить пользователю выбор через `AskUserQuestion` в
    Wave 3 после остального Grafana MCP setup.

### Wave 4 — verification + ship

1. **9 done-conditions self-check** (см. секцию 6).
2. **Phase scaffold**:

    ```bash
    mkdir -p .planning/phases/69-dislocation-smoke-mcp
    # CONTEXT.md, PLAN.md (ref to this file), SUMMARY.md
    ```

3. **Memory entry** в `.planning/memory/2026-05-24-phase-69-mcp.md`: новый
    origin (`git@github.com:apolenkov/yourpulse.git`), Grafana MCP installed
    (GLSA token in `.grafana-mcp-token`), Bugsink MCP decision: `<user's choice>`,
    Phase 68 smoke results: traceId ✅, web*vital*\* ✅.

4. **Финальный push**:

    ```bash
    git -C /Users/ap/work/customreport-obs push origin obs/v8.3-full-observability
    git -C /Users/ap/work/customreport push origin fix/PRJ-2/shiny-eagle
    ```

## 6. Done condition (9 пунктов)

```text
┌─ Machine-checkable ──────────────────────────────────────────────────┐
│  1. gh repo view apolenkov/yourpulse                    exit 0       │
│  2. git -C customreport remote get-url origin            grep yourpulse│
│  3. git -C customreport remote get-url origin            NOT contains  │
│                                                          acme        │
│  4. gh api repos/apolenkov/yourpulse/branches            contains main │
│                                                          + obs/v8.3-*  │
│  5. curl http://localhost:3003/api/health                exit 0       │
│  6. curl http://localhost:8000/                          exit 0       │
│  7. curl http://localhost:3002/metrics | grep web_vital  ≥1 match     │
│  8. tail app.log | jq 'select(.traceId)' | wc -l        ≥1           │
│  9. claude mcp list | grep grafana                       exit 0       │
└──────────────────────────────────────────────────────────────────────┘
```

## 7. Open questions

| #   | Вопрос                          | Как решу автономно                                                                   | Когда эскалирую                                 |
| --- | ------------------------------- | ------------------------------------------------------------------------------------ | ----------------------------------------------- |
| 1   | Bugsink MCP-стратегия           | После Wave 3.A: present таблицу с 3 опциями (A/B/C из шага 20) через AskUserQuestion | Решение блокирует Wave 3 closure                |
| 2   | Имя phase-папки                 | `69-dislocation-smoke-mcp`                                                           | если roadmap уже занимает 69                    |
| 3   | Default branch на personal repo | `main` (как в corp)                                                                  | если пользователь явно скажет иное              |
| 4   | Push PRJ-2 ветки?               | Да, `fix/PRJ-2/shiny-eagle` — активная                                               | если пользователь скажет "только обзёрвэбилити" |
| 5   | Tags                            | Push all tags (`v8.2.0`, etc.)                                                       | если в tags есть corp-specific                  |
| 6   | Grafana token storage           | `.grafana-mcp-token` (gitignored)                                                    | если пользователь хочет vault                   |
| 7   | gh repo description / topics    | "weekly status reports" + topics: nextjs, nestjs, observability                      | если хочется ребрендинг под "yourpulse"         |

## 8. Я делаю сам (агент)

```text
┌─ Self-driving ───────────────────────────────────────────────────────┐
│ ✓ gh repo create apolenkov/yourpulse --private                      │
│ ✓ git remote remove origin + git remote add origin (main repo)      │
│ ✓ git push -u origin main + fix/PRJ-2/shiny-eagle + --tags          │
│ ✓ git push -u origin obs/v8.3-full-observability (worktree)         │
│ ✓ pnpm install + pnpm observability:up                              │
│ ✓ curl smoke на все 4 endpoint + /metrics + app.log jq              │
│ ✓ скриншоты UI через chrome-devtools MCP в .planning/audits/        │
│ ✓ create Grafana service-account token через API                    │
│ ✓ claude mcp add-json grafana ...                                   │
│ ✓ AskUserQuestion на Bugsink MCP-стратегию                          │
│ ✓ если выбор A — install openapi-bridge; B — отдельная Phase 70;    │
│   C — задокументировать в memory + skip                              │
│ ✓ Phase 69 scaffold + memory entry + finalize push                  │
└──────────────────────────────────────────────────────────────────────┘
```

## 9. От тебя

```text
┌─ ОТ ТЕБЯ ────────────────────────────────────────────────────────────┐
│ • approve plan через ExitPlanMode                                    │
│ • в Wave 3 шаг 20 — выбрать одну из 3 опций Bugsink MCP             │
│ • визуально подтвердить Grafana дашборды и Bugsink UI после Wave 2   │
│   (открыть http://localhost:3003 и http://localhost:8000)            │
│ • после Wave 4 — merge worktree obs/v8.3-* в main (твой выбор: merge │
│   или rebase) или оставить как long-lived feature branch             │
└──────────────────────────────────────────────────────────────────────┘
```

## 10. Риски и митигация

```text
┌─ Риск                                  │ Митигация ───────────────────┐
│ gh repo create fails (token scope)     │ Wave 0 шаг 1: gh auth status │
│                                        │ проверка scope `repo`, fail- │
│                                        │ fast + указание на gh auth   │
│                                        │ refresh -s repo              │
│ Push отвергает push (rejected)         │ нечего — repo пустой         │
│ Большой push (12 commits + история main│ git push --progress; если    │
│ + tags) занимает время                 │ >5 мин — split на ветки      │
│ Bugsink OpenAPI bridge не стартует     │ задокументировать как known  │
│                                        │ limitation, оставить C       │
│ Grafana 3003 уже занят другим          │ Wave 2 шаг 10: docker compose│
│ контейнером                            │ ps проверка, kill stale      │
│ pnpm install в worktree пересобирает   │ ожидаемо — worktree не       │
│ всё (10+ мин)                          │ шерит node_modules           │
│ Session compaction в середине Wave 2   │ результаты пишутся в         │
│ smoke                                  │ .planning/audits + memory    │
│                                        │ — durable artifacts          │
└──────────────────────────────────────────────────────────────────────┘
```

## 11. Side deliverables

- `.planning/phases/69-dislocation-smoke-mcp/{69-CONTEXT.md, 69-PLAN.md,
69-SUMMARY.md}` — phase scaffold.
- `.planning/audits/phase-69-smoke-grafana.png` + `phase-69-smoke-bugsink.png`
  - `phase-69-smoke-app-log.png` — UI evidence.
- `.planning/memory/2026-05-24-phase-69-mcp.md` — locked decisions + Bugsink
  outcome.
- `.grafana-mcp-token` в `customreport-obs/` (chmod 600, gitignored).
- `~/.claude.json` — новый `mcpServers.grafana` entry.

## 12. Verification (manual smoke после автономного run)

```bash
# 1. Repo state
gh repo view apolenkov/yourpulse --json visibility,defaultBranchRef,pushedAt
git -C /Users/ap/work/customreport remote -v
git -C /Users/ap/work/customreport-obs remote -v
gh api repos/apolenkov/yourpulse/branches --jq '.[].name'

# 2. Stack
docker compose -f docker-compose.yml -f docker-compose.dev.yml \
  -f docker-compose.observability.yml -f docker-compose.errors.yml ps

# 3. Endpoints
curl -fsS http://localhost:3003/api/health
curl -fsS http://localhost:8000/
curl -fsS http://localhost:3002/health/live

# 4. Metrics
curl -s http://localhost:3002/metrics | grep -E "^(web_vital|http_request_duration|trpc_)" | head

# 5. traceId
tail -n 50 /Users/ap/work/customreport-obs/apps/api/.logs/app.log \
  | jq 'select(.traceId) | {ts:.timestamp, traceId, correlationId, msg:.message}'

# 6. MCP
claude mcp list | grep grafana
# затем рестарт Claude Code → /mcp grafana → tool list
```

## 13. Self-review checklist (pre-ExitPlanMode)

- [x] TLDR с Было/Проблема/Станет — есть, ASCII + проза.
- [x] Архитектурная схема git layout — есть.
- [x] Done condition — 9 machine-checkable пунктов.
- [x] Files / systems table — секция 4.
- [x] Ordered steps с verification per step — секция 5.
- [x] Open questions с автономным решением — секция 7.
- [x] Я ДЕЛАЮ САМ / ОТ ТЕБЯ split — секции 8+9.
- [x] Anti-conflict matrix — секция 3.3.
- [x] Cheap-first delegation — секция 3.2.
- [x] Risks + mitigation — секция 10.
- [x] Side deliverables — секция 11.
- [x] Bugsink MCP gap addressed — 3 опции в шаге 20 + question 1 в секции 7.
- [x] Locked decisions cited — секция 1 (D1/D2/D3).
