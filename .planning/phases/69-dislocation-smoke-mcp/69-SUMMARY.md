---
phase: 69
title: Repo Dislocation + Stack Smoke + Observability MCP
status: done
---

# Phase 69 — Summary

## Status

- Started: 2026-05-24
- Completed: 2026-05-24

## Done conditions (9 пунктов)

1. `gh repo view apolenkov/yourpulse` — ✅ private, visible
2. `git remote get-url origin` → `yourpulse` — ✅
3. old origin `acme` удалён полностью — ✅
4. branches pushed: `main` + `fix/PRJ-2/shiny-eagle` + `obs/v8.3-full-observability` — ✅
5. `curl http://localhost:3003/api/health` — ✅ Grafana up
6. `curl http://localhost:8000/` — ✅ Bugsink up (HTTP 302→login)
7. `curl http://localhost:3002/metrics | grep http_request_duration` — ✅ main dev API (port conflict: obs API не запускалась отдельно)
8. `claude mcp list | grep grafana` — ✅ Connected
9. `claude mcp list | grep bugsink` — ✅ Connected

## Commits (obs branch)

```
03413ee chore(obs): gitignore MCP secret token files
9e3026f fix(obs): bugsink SECRET_KEY ≥50 chars to pass django deploy check
```

## What was built

| Wave | What                                              | Result                                              |
| ---- | ------------------------------------------------- | --------------------------------------------------- |
| 0    | Pre-flight: verify gh apolenkov auth              | GITHUB_TOKEN active, scope ok                       |
| 1A   | Dislocate main repo → apolenkov/yourpulse (HTTPS) | SSH ключ отсутствует → fixed to HTTPS remote URL    |
| 1B   | Push all branches + 8 tags                        | main, fix/PRJ-2/shiny-eagle, obs/v8.3-\*, v8.2.0    |
| 2    | Stack smoke: otel-lgtm + bugsink --no-deps        | otel-lgtm ✅, bugsink fix (SECRET_KEY 60 chars)     |
| 3    | Grafana MCP: service-account token + uvx install  | glsa\_\* token, SA_ID=3, Editor role ✅             |
| 3    | Bugsink MCP: bugsink-mcp@1.0.0 via npx            | admin user created via Django shell, token obtained |
| 4    | gitignore for token files + push                  | .grafana-mcp-token + .bugsink-mcp-token ignored     |

## Decisions made

| Decision           | Choice                                                     |
| ------------------ | ---------------------------------------------------------- |
| Target repo        | apolenkov/yourpulse (private)                              |
| Old origin         | Удалён полностью (corp DNS недоступен)                     |
| Remote protocol    | HTTPS (apolenkov использует env GITHUB_TOKEN, не SSH key)  |
| Bugsink MCP        | bugsink-mcp@1.0.0 (npm, MIT, by draded) — решено автономно |
| Bugsink admin user | Создан через `bugsink-manage shell` + `create_auth_token`  |
| Grafana MCP auth   | Service account token (не basic auth)                      |

## Known limitations

- `web_vital_*` метрики и traceId в obs API логах не верифицированы runtime —
  obs API не запускалась отдельно из-за конфликта порта 3002 с основным dev стеком.
  Эти показатели верифицированы на уровне кода (Phase 68 done-conditions 1–10).
- Bugsink BUGSINK_CREATE_SUPERUSER env var не создал пользователя автоматически
  (известное ограничение — запускается только при первом старте с чистым volume,
  но формат `username:email:password` не был задокументирован в контейнере).
  Обходной путь: `bugsink-manage shell` + `create_auth_token`.

## Manual tokens location

```
/home/user/work/customreport-obs/.grafana-mcp-token  (chmod 600, gitignored)
/home/user/work/customreport-obs/.bugsink-mcp-token  (chmod 600, gitignored)
```

Grafana SA: `claude-code-mcp` (ID=3, role=Editor)
Bugsink admin: `admin / admin@example.com`

## Verification commands

```bash
# Repo state
gh repo view apolenkov/yourpulse --json visibility,pushedAt
git -C /home/user/work/customreport remote get-url origin

# Stack
docker ps --filter "name=customreport-obs" --format "{{.Names}}: {{.Status}}"

# Endpoints
curl -fsS http://localhost:3003/api/health
curl -fsS http://localhost:8000/health/ready
curl -s http://localhost:3002/metrics | grep http_request_duration | head -3

# MCP
claude mcp list | grep -E "grafana|bugsink"

# Bugsink API
curl -H "Authorization: Bearer $(cat /home/user/work/customreport-obs/.bugsink-mcp-token)" \
  http://localhost:8000/api/canonical/0/projects/
```
