# Facts — Accumulated Work Audit

- Audit создаёт `.planning/audits/accumulated-work-status-<YYYY-MM-DD>.md` с 9 разделами: DONE, IN-PROGRESS, NOT-STARTED, NEEDS-RESEARCH, BLOCKED, LOOPS, IDEAS-UNFILED, RETRO, DECISIONS-LOG.
- Параллельно создаётся `.planning/audits/accumulated-work-status-<YYYY-MM-DD>.json` с той же структурой в machine-readable виде для будущего resume tooling.
- Audit сканирует ВСЕ `.jsonl` файлы из `~/.claude/projects/-Users-ap-work-customreport/` (Claude Code transcripts, все доступные сессии); скан также включает `.planning/` папку (план/state/handoff/memory/phases) и GSD artifacts (ROADMAP.md, MILESTONES.md, phase docs).
- Audit сканирует ВСЕ Codex sessions из `~/.codex/sessions/**` (фильтруя по cwd customreport).
- Audit читает `.planning/STATE.md`, `.planning/session-retros/NEXT-ACTIONS.md`, `.planning/HANDOFF.json` и cross-ref'ит их с transcripts.
- Audit включает `.planning/memory/*.md` + claude-mem observations как источник прошлых решений и learnings.
- Каждый recovered item в отчёте имеет: `id`, `title` (≤80 chars), `status` (одна из 9 категорий), session-id ref для drill-down, first-mention timestamp, last-touch timestamp, и per-item recommendation в одну строку.
- Topic классифицируется как LOOP если упомянут в ≥2 разных sessions без landing commit / locked decision evidence.
- RETRO секция содержит три под-раздела GOOD / BAD / LEARNED, агрегированные по всему накоплению работы (не одной сессии).
- DECISIONS-LOG записывает locked решения (что было принято и когда) с session-id ref и краткой формулировкой каждого decision.
- Output НЕ содержит verbatim transcript quotes — только summary + session-id ref для drill-down.
- Primary engine — существующий `Demo-session-scan` skill. Новый код только в extensions: RETRO aggregation, LOOPS detection, DECISIONS-LOG, JSON ledger emit.
- Полный audit запускается одной командой через `/goal goals/accumulated-work-audit/goal.md` (или эквивалентный invocation).
- Markdown отчёт открывается summary блоком с total counts по каждой из 9 категорий (например: `DONE 47 · IN-PROGRESS 3 · LOOPS 5 · UNFILED 12`).
- Каждый item в категориях NOT-STARTED, NEEDS-RESEARCH, BLOCKED, IDEAS-UNFILED имеет рекомендацию: `next-step: <конкретное действие>` (≤120 chars).
- Audit — read-only: не создаёт автоматически новые TODO файлы и не модифицирует state-файлы. Только генерирует отчёт.
