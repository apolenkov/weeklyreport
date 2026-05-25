# Plan — Accumulated Work Audit

## Solution approach

Расширяем существующий `Demo-session-scan` skill, не изобретаем заново. Skill уже умеет читать Claude transcripts, Codex sessions, planning ledgers и git evidence (`scanClaude()`, `scanCodex()`, `scanPlanning()`, `scanGit()`). Не покрывает 6 facts: RETRO aggregator, LOOPS detector, DECISIONS-LOG, JSON ledger parallel emit, dynamic per-item recommendation, 9-category strict status enum.

Создаём один новый скрипт `.planning/scripts/accumulated-work-audit.ts` который импортирует scan-функции из `Demo-session-scan` и добавляет 6 extensions поверх. Output — параллельные `.planning/audits/accumulated-work-status-<YYYY-MM-DD>.md` + `.json`.

Запуск — `pnpm audit-work` (новый script в root `package.json`) или `/goal goals/accumulated-work-audit/goal.md`.

## Files / systems

| Path                                                          | Action  | Purpose                                                               |
| ------------------------------------------------------------- | ------- | --------------------------------------------------------------------- |
| `.planning/scripts/accumulated-work-audit.ts`                 | NEW     | Entry point, оркестрирует scan + extensions                           |
| `.planning/scripts/lib/retro-aggregator.ts`                   | NEW     | GOOD/BAD/LEARNED keyword scan + sentiment                             |
| `.planning/scripts/lib/loops-detector.ts`                     | NEW     | Cross-session topic match, ≥2 mentions threshold                      |
| `.planning/scripts/lib/decisions-log.ts`                      | NEW     | «решено/default/locked/outcome» pattern extract                       |
| `.planning/scripts/lib/status-classifier.ts`                  | NEW     | 9-category strict enum + per-item recommendation                      |
| `.planning/scripts/lib/emit-md.ts`                            | NEW     | Markdown rendering (summary header + 9 sections)                      |
| `.planning/scripts/lib/emit-json.ts`                          | NEW     | JSON ledger (matching schema)                                         |
| `~/.claude/skills/Demo-session-scan/scripts/session-intake.ts` | IMPORT  | Reuse scanClaude / scanCodex / scanPlanning / scanGit                 |
| `package.json`                                                | EDIT    | Add `"audit-work": "tsx .planning/scripts/accumulated-work-audit.ts"` |
| `.planning/audits/`                                           | NEW dir | Output destination                                                    |
| `.planning/audits/.gitignore`                                 | NEW     | Ignore generated reports (audit may include sensitive summaries)      |
| `goals/accumulated-work-audit/goal.md`                        | NEW     | Goal package entry — see Phase 5                                      |

## Ordered steps

1. **Bootstrap directory + gitignore.** `mkdir -p .planning/audits .planning/scripts/lib && echo "*.md\n*.json\n!.gitignore" > .planning/audits/.gitignore`. Verify: `ls .planning/audits/.gitignore`.

2. **Import contract for Demo-session-scan.** Прочитать `~/.claude/skills/Demo-session-scan/scripts/session-intake.ts` чтобы убедиться что `scanClaude`, `scanCodex`, `scanPlanning`, `scanGit` exported. Если нет — добавить export через локальную patched-copy в `.planning/scripts/lib/scan-engine.ts` (документировать как `vendored from Demo-session-scan@<sha>`). Verify: `node -e "import('./.planning/scripts/lib/scan-engine.ts').then(m => console.log(Object.keys(m)))"`.

3. **Implement `status-classifier.ts`.** Принимает RecoveredItem из scan layer, возвращает один из 9 status enum + 120-char recommendation. Rule chain:
   - landing commit found → `done`
   - explicit `[ ]` in NEXT-ACTIONS без commit → `not-started`
   - mentioned but no commit + no [x] и [ ] → `ideas-unfiled`
   - keyword «research», «explore», «не понял» → `needs-research`
   - mention `BLOCKED:` или external dep → `blocked`
   - matches loop detector → `loops`
   - mentioned and has some commit but unclosed → `in-progress`
     Verify: unit test `.planning/scripts/lib/status-classifier.test.ts` со 18 примерами (по 2 на категорию).

4. **Implement `loops-detector.ts`.** Cross-session match topic strings (нормализованных через lemmatize/lowercase/strip-punct). Если topic встречается в ≥2 sessions без landing commit / без `<!-- done: <sha> -->` в ledger → loops. Verify: dry-run на mock-data → expect ≥1 known loop (например «UFB-014 multi-SDLC» обсуждался W11→W22 multiple раз до DROP).

5. **Implement `retro-aggregator.ts`.** Mine GOOD/BAD/LEARNED sentences из transcripts. Keywords: «работало», «отлично», «провалилось», «учли», «learned», «good:», «bad:», «fixed:», `Demo-retro` skill mentions с extraction. Output: array of `{kind, text, session-id, timestamp}`. Verify: на текущей сессии возвращает ≥3 GOOD + ≥2 BAD + ≥2 LEARNED.

6. **Implement `decisions-log.ts`.** Patterns: «применяю default», «решение:», «locked», «DROP/DROPPED», «default:», «outcome:», `AskUserQuestion` ответы. Extract decision text + timestamp + session-id. Verify: на текущей ветке возвращает ≥5 known decisions (UFB-014 DROP, Q1-Q9 defaults, Node 25 vs 24, и т.д.).

7. **Implement `emit-md.ts`.** Output template:

   ```markdown
   # Accumulated Work Audit — <DATE>

   `DONE 47 · IN-PROGRESS 3 · NOT-STARTED 8 · NEEDS-RESEARCH 2 · BLOCKED 1 · LOOPS 5 · IDEAS-UNFILED 12 · RETRO · DECISIONS 23`

   ## DONE (47)

   ### <item-id> — <title>

   - status: done
   - first-mention: <ts> · last-touch: <ts> · session: <session-id>
   - next-step: (none — closed)

   ## IN-PROGRESS (3)

   ...

   ## RETRO

   ### GOOD

   - ...

   ### BAD

   - ...

   ### LEARNED

   - ...

   ## DECISIONS-LOG (23)

   - <date> · <session> · <decision text>
   ```

   Verify: `pnpm lint:md .planning/audits/<output>.md` зелёный.

8. **Implement `emit-json.ts`.** Schema:

   ```json
   {
     "audit_date": "2026-05-22",
     "repo": "customreport",
     "scan_scope": {"claude_jsonl_count": N, "codex_sessions_count": M, ...},
     "counts": {"done": 47, "in-progress": 3, ...},
     "items": [
       {"id": "...", "title": "...", "status": "done|in-progress|...",
        "session_id": "...", "first_mention": "ISO", "last_touch": "ISO",
        "recommendation": "..."}
     ],
     "retro": {"good": [...], "bad": [...], "learned": [...]},
     "decisions": [{"date": "...", "session": "...", "text": "..."}]
   }
   ```

   Verify: `jq . .planning/audits/<output>.json > /dev/null` — valid JSON. Schema match: `node -e "const a = require('./.planning/audits/...'); console.assert(a.audit_date && a.items && a.retro && a.decisions)"`.

9. **Entry point `accumulated-work-audit.ts`.** Wire всё вместе:

   ```ts
   const items = await scan({claude, codex, planning, memory});
   const classified = items.map(classify);
   const loops = detectLoops(classified);
   const retro = aggregateRetro(items);
   const decisions = extractDecisions(items);
   await emitMd({classified, loops, retro, decisions});
   await emitJson({...});
   ```

   Verify: `pnpm audit-work` exits 0 и пишет 2 файла в `.planning/audits/`.

10. **Add npm script.** `package.json` → `"scripts": {"audit-work": "tsx .planning/scripts/accumulated-work-audit.ts"}`. Verify: `pnpm audit-work --dry-run` (или без аргументов) проходит.

11. **Smoke run.** `pnpm audit-work` на текущем repo state. Sanity check: `cat .planning/audits/accumulated-work-status-2026-05-22.md | head -30`. Counts должны быть в разумном диапазоне (DONE > 30 учитывая 80+ commits в текущей ветке, LOOPS ≥1 учитывая UFB-014, DECISIONS ≥10).

12. **Documentation.** Update `goal.md` (Phase 5 of skill workflow) ссылается на этот plan + facts.

## Verification

```bash
# (a) Scaffold + types
ls .planning/scripts/accumulated-work-audit.ts .planning/scripts/lib/*.ts
pnpm exec tsc --noEmit .planning/scripts/accumulated-work-audit.ts

# (b) Unit tests
pnpm exec vitest run .planning/scripts/lib/status-classifier.test.ts

# (c) Smoke
pnpm audit-work
test -f .planning/audits/accumulated-work-status-$(date +%Y-%m-%d).md
test -f .planning/audits/accumulated-work-status-$(date +%Y-%m-%d).json

# (d) Schema validity
jq . .planning/audits/accumulated-work-status-$(date +%Y-%m-%d).json > /dev/null

# (e) Markdown lint
pnpm lint:md .planning/audits/

# (f) Read-only invariant
git status --short .planning/todos/  # должен быть пуст (audit не модифицирует)

# (g) Sanity: counts > 0
jq '.counts' .planning/audits/accumulated-work-status-$(date +%Y-%m-%d).json
```

## Risks / open questions

- **Transcript volume.** `~/.claude/projects/-Users-ap-work-customreport/` может содержать сотни `.jsonl` файлов с миллионами строк. Нужно streaming-парсер (line-by-line через readline), не `JSON.parse(readFile)`. Иначе OOM.
- **Demo-session-scan dependency drift.** `session-intake.ts` импортирует `core-principles/tools/src/lib/session-evidence.ts` — если у пользователя core-principles не клонирован, скрипт падает. Mitigation: detect missing dep и fallback на `~/.claude/projects` raw scan без graph enrichment.
- **LOOP false positives при threshold ≥2.** Топик «commit и push» упоминается в каждой сессии — нужен blacklist generic keywords. Mitigation: stop-word список + min-len 4 word topic.
- **Privacy / sensitive content.** Transcripts могут содержать credentials, API keys, личные данные. Mitigation: redaction regex pass (sk-_, ghp\__, password=, AUTH\_\*) перед emit.
- **Decision pattern recall.** «применяю default» паттерн может пропустить implicit-locked decisions. Mitigation: после v1.0 — collect missed examples и расширить regex.
- **9-category enum strictness.** Item может legitimately в 2 категориях (e.g. blocked + needs-research). Mitigation: priority chain (blocked > loops > needs-research > in-progress > not-started > ideas-unfiled > done), один primary status + `secondary?: status[]` field.
- **Performance budget.** Полный scan на 200+ sessions может занять >2 минуты. Mitigation: progress indicator + `--since <date>` flag для incremental runs (default — all-time).
- **First-mention timestamp accuracy.** transcript jsonl имеет per-message timestamp, но «mention» может быть в человеческом сообщении (точно) или в tool output (косвенно). Mitigation: фиксировать только user-role messages как first-mention.
- **Goal-file vs CLI invocation.** Skill говорит запускать через `/goal goals/<slug>/goal.md`, но runtime тоже должен работать через `pnpm audit-work`. Документировать оба пути в goal.md.
