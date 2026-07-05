# Mapping — api-mod-telegram (2026-07-02)

Source catalog: `docs/architecture/catalog/api-mod-telegram-2026-07-02.md`.
Target-structure reference: `docs/architecture/TARGET-STRUCTURE-2026-07-02.md`.

`telegram` is not one of the three invariant-bearing api modules (period,
report-sections/review, publication) — it has no non-trivial long-lived
invariant to protect (it's a mock adapter + a thin BullMQ dispatch worker
mirroring the EmailReminderProcessor pattern). Per the Grouping-rules
determinism knob #2 ("a module stays flat until it either bears a load-bearing
invariant or exceeds ~6 files"), telegram (4 files) stays **flat** at
`apps/api/src/modules/telegram/` — no `domain/application/infrastructure`
split. All four files already sit at their target path.

| Current path                                           | Target path                                            | Layer         | Domain   | Move? | Note                                                                                                                                        |
| ------------------------------------------------------ | ------------------------------------------------------ | ------------- | -------- | ----- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| apps/api/src/modules/telegram/mock-telegram.adapter.ts | apps/api/src/modules/telegram/mock-telegram.adapter.ts | adapter       | telegram | no    | Thin module stays flat (rule #2); stub adapter, no infra subfolder needed yet.                                                              |
| apps/api/src/modules/telegram/telegram.adapter.ts      | apps/api/src/modules/telegram/telegram.adapter.ts      | type          | telegram | no    | Pure port interface + DI token; flat module has no `domain/` — stays at module root.                                                        |
| apps/api/src/modules/telegram/telegram.module.ts       | apps/api/src/modules/telegram/telegram.module.ts       | module-wiring | telegram | no    | Module-root wiring file; canonical location regardless of split.                                                                            |
| apps/api/src/modules/telegram/telegram.queue.ts        | apps/api/src/modules/telegram/telegram.queue.ts        | scheduler     | telegram | no    | BullMQ worker; would move to `infrastructure/` only if telegram graduates to a full internal split (not warranted — 4 files, no invariant). |

## Summary

- Files in area: 4
- Rows with Current != Target: **0**
- Rationale: telegram is THIN CRUD-adjacent (mock + queue dispatch), below the
  6-file/invariant threshold that triggers the internal `domain/application/infrastructure`
  split; the target tree keeps it flat at `modules/telegram/`, matching its current layout.
