# Goal — Feature completion (virtual-starlight plan, autonomous)

Реализовать до конца оставшиеся фазы плана
`.planning/plans/needs-research-2-virtual-starlight.md` автономно: P3.1
(deactivate/activate regression), P6 (SC-160 dashboard Revoke button), P7
(SC-165 bulk "Revoke All" — backend mutation + UI), P8 (email-dispatch e2e через
локальный Mailpit). holidays-calendar / i18n / dark mode / AI/RAG / Telegram —
ЗАМОРОЖЕНЫ, не трогать.

## Source of truth

- Plan: [`../../.planning/plans/needs-research-2-virtual-starlight.md`](../../.planning/plans/needs-research-2-virtual-starlight.md)
  (approved da6b391; phases P0-P5 already shipped). This goal covers P3.1/P6/P7/P8.

## Done condition

Считается завершённым когда:

1. **P6 SC-160**: dashboard Revoke button реализован (reuse `revoke` mutation +
   confirm dialog), web `tsc` green, committed.
2. **P7 SC-165**: backend `revokeAllSubmitted` mutation + contract test + UI
   "Revoke All" реализованы, api unit green, web `tsc` green, committed.
3. **P8 email-dispatch**: integration test против Mailpit написан, `tsc` green;
   live-assertion если Mailpit reachable (иначе skip-guard + flagged), committed.
4. **P3.1 deactivate/activate**: regression-спек расширен, `tsc` green, committed.
5. `pnpm typecheck` exits 0; `pnpm lint:md` 0 errors.
6. `pnpm --filter @customreport/api test` и `pnpm --filter @customreport/web test`
   без новых падений.
7. Каждая фаза — атомарный commit на `fix/PRJ-2/shiny-eagle`; рабочее дерево
   чистое (кроме `goals/` и gitignored audit reports).
8. Финальный handoff-отчёт: что зелёное, что требует живого стека (e2e/Mailpit),
   что осталось человеку (PR #7 merge, remind-aria-live screen-reader QA).

## Out of scope (frozen)

holidays-calendar, i18n switcher, dark mode, AI/RAG (Phase 54), Telegram
(Phase 55), Director workflow, future-ui-telemetry. Не реализовывать без явного
нового решения пользователя.
