# Goal — Accumulated Work Audit

Полный forensic скан всех Claude Code transcripts, Codex sessions, `.planning/` ledgers, memory store и GSD artifacts репозитория customreport, со статусом по каждой накопленной задаче / идее / решению. Результат — markdown + JSON отчёт в `.planning/audits/`, в котором каждый recovered item классифицирован в один из 9 buckets (DONE / IN-PROGRESS / NOT-STARTED / NEEDS-RESEARCH / BLOCKED / LOOPS / IDEAS-UNFILED / RETRO / DECISIONS-LOG) с per-item recommendation и session-id ref.

## Shared understanding

- **Facts:** [`facts.md`](./facts.md) — 16 принятых фактов (что именно audit делает, какие data sources, format output, политика privacy, reuse strategy).

## Execution plan

- **Plan:** [`plan.md`](./plan.md) — 12 шагов с file/system map, verification commands, risks. Plan approved через Plannotator gate.

## Done condition

Audit считается завершённым когда:

1. `pnpm audit-work` выходит с exit code 0.
2. Создан `.planning/audits/accumulated-work-status-<YYYY-MM-DD>.md` с 9 секциями и summary header'ом с counts.
3. Создан `.planning/audits/accumulated-work-status-<YYYY-MM-DD>.json` с матчингом schema (audit_date / counts / items[] / retro / decisions[]).
4. `jq . <json>` — valid JSON.
5. `pnpm lint:md .planning/audits/` — зелёный.
6. Counts non-zero для DONE, DECISIONS-LOG и LOOPS (sanity check на текущем репо state).
7. `git status .planning/todos/` чистый (audit не модифицирует никаких state-файлов, только пишет в `.planning/audits/`).
