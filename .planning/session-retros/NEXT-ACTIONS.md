# NEXT ACTIONS

updated: 2026-05-18T12:15:00Z source: peo-retro (small-MVP seed + lead authorId fix)

## RUN FIRST

1. [ ] В 13:26 MSK включить `stopReviewGate: true` в:
       `~/.claude/plugins/data/codex-openai-codex/state/customreport-5aa77affdf95f161/state.json`

## AGENT

1. [ ] e2e спецификация `?authorId=<BORIS>` → read-only секция (нет кнопок Add/Edit)
       файл: `apps/web/e2e/regression/lead-form-foreign-author.spec.ts`
       автор Boris: `a0000000-0000-4000-8000-00000000002b`

2. [ ] TODO(LOCK-01): UI-иконка-замочек на секции когда `isPinnedAuthorView=true`
       точка входа: `apps/web/src/components/lead/lead-form.tsx` (комментарий LOCK-01 ~строка 832)

## HUMAN

1. [ ] Ручная UAT: `vasily@customreport.local` → `/lead/report`
   - увидеть 4 продукта (switcher активен)
   - переключить period ← → read-only submitted
   - открыть `?authorId=a0000000-0000-4000-8000-00000000002b` → read-only секция Бориса

## BLOCKED

1. [ ] Codex quota до 13:26 MSK — stopReviewGate отключён вручную (state.json)

## VERIFY

```bash
# stopReviewGate включён
cat ~/.claude/plugins/data/codex-openai-codex/state/customreport-5aa77affdf95f161/state.json \
  | python3 -c "import json,sys; print(json.load(sys.stdin)['config']['stopReviewGate'])"
# expected: True

# 4 продукта у Васи
psql "$DATABASE_URL" -c "SELECT id, name FROM \"Project\" WHERE \"leadId\" = 'a0000000-0000-4000-8000-000000000011';"

# overlay Бориса
psql "$DATABASE_URL" -c "SELECT rs.id, rs.status FROM \"ReportSection\" rs WHERE rs.\"authorId\" = 'a0000000-0000-4000-8000-00000000002b';"
```
