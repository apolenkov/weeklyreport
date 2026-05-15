<!-- markdownlint-disable MD003 MD013 MD022 -->

---

generated: 2026-05-15T17:35:00+03:00
repo: /Users/ap/work/customreport
branch: fix/PRJ-2/uat-v7-2026-05-12
scope: recovered Claude/Codex UAT feedback for Lead Form only
status: active recovery matrix

---

# Lead Form UAT Recovery - 2026-05-15

Цель: отдельно восстановить все замечания пользователя по Lead Form, которые
потерялись при общем session intake. Нельзя больше закрывать форму одной строкой
`UFB-014`; у формы есть отдельная матрица по Item, Risk, Decision, Priority.

## Why This Exists

Предыдущий intake слишком сильно доверился итоговым `.planning/regression/*`
матрицам. Из-за этого был потерян важный нюанс из Claude-плана: пользователь не
просил откатить pre-fill стадий, наоборот, он просил включать все назначенные
стадии по умолчанию.

Точный восстановленный запрос:

```text
Когда я заполняю лидом все эти айтомы, наверное, по умолчанию нужно включать
все четыре, все стадии, на которые меня записали. Это тоже для лида дополнение.
Чтобы я постоянно их не выбирал.
```

Правильная интерпретация:

```text
keep pre-fill
  -> represent it as stageIds[]
  -> show compact chips / +N more
  -> do not store or validate it as one long joined display string
```

## Source Evidence

| Source                                                        | What it proves                                                                                                  |
| ------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `.sisyphus/plans/humble-hugging-goblet.md:5-17`               | v4 incorrectly wanted to revert UFB-073; correct behavior is to keep pre-fill and fix representation.           |
| `.sisyphus/plans/humble-hugging-goblet.md:167-181`            | R1/R2/R3 acceptance explicitly includes 4 dialogs, compact chips, risk saveDraft, and Unexpected error cleanup. |
| `.sisyphus/plans/humble-hugging-goblet.md:196-220`            | Final UAT checklist includes Add Item, pre-fill all stages, Save Item, Save Risk inline, Add Decision/Priority. |
| `.sisyphus/plans/humble-hugging-goblet.md:237-269`            | R1 solution: state as array, pre-fill all stages, compact chips, save `stageIds`.                               |
| `.planning/quick/uat-feedback-2026-05-11/FEEDBACK.md:156-168` | UFB-073 also says: if lead owns one stage, pre-select it and hide the picker.                                   |
| `.planning/regression/USER-FEEDBACK-BACKLOG-2026-05-08.md:22` | UFB-014 says current/next/risk/decision/priority need optional multi-SDLC stages.                               |

## Recovery Matrix

| ID    | User request / finding                                                             | Current status       | Evidence                                                                                                                                                                   | Missing action                                                                                                        |
| ----- | ---------------------------------------------------------------------------------- | -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| LF-01 | Item/Risk/Decision/Priority should pre-select all owned stages on create.          | CODE DONE            | `item-edit-dialog.tsx`, `risk-edit-dialog.tsx`, `decision-edit-dialog.tsx`, `priority-edit-dialog.tsx` initialize `stageIds` from `stagesForProduct` or `availableStages`. | Browser smoke all 4 dialogs, not only Risk.                                                                           |
| LF-02 | Do not revert UFB-073; the bug was representation, not the pre-fill idea.          | RECOVERED            | Claude plan explicitly says `НЕ revert`; current dialogs keep pre-fill.                                                                                                    | Keep this file as guard against future mistaken revert.                                                               |
| LF-03 | Store/send form scope as `stageIds[]`, not a long joined UI string.                | CODE DONE, DB LEGACY | Shared schemas accept `stageIds`; web saves arrays; API maps arrays. Prisma still stores legacy CSV in `stageName`.                                                        | Decide later whether DB normalization is worth a migration; not required for current MVP if API contract stays array. |
| LF-04 | Compact chips and overflow `+N more` should prevent dialog overflow.               | DONE                 | `stage-multi-select.tsx` shows first 2 selected stages plus `+N more`; `stage-multi-select.test.tsx` asserts it.                                                           | Browser smoke in full form flow.                                                                                      |
| LF-05 | Empty stage selection means "all assigned stages".                                 | CODE DONE            | `StageMultiSelect` helper says empty applies to all; saves `undefined` when `stageIds.length === 0`.                                                                       | Verify wording in browser; clarify whether explicit-all and omitted-all should render differently.                    |
| LF-06 | If lead owns only one stage, pre-select it and hide the picker.                    | DONE                 | `StageMultiSelect` now renders a static applied stage pill and no checkbox when only one assigned stage exists; unit test covers it.                                       | Browser smoke in full form flow.                                                                                      |
| LF-07 | A13: typed text must not reset during parent rerender/autosave invalidation.       | TESTED               | Four dialog tests cover rerender text preservation; dialog code excludes unstable refs from effect deps.                                                                   | Browser smoke during autosave/reload flow.                                                                            |
| LF-08 | D-12: Item dialog reopen should reset stale draft state correctly.                 | TESTED               | `item-edit-dialog.test.tsx` covers text/status/stageIds/errors reset on reopen.                                                                                            | Browser smoke.                                                                                                        |
| LF-09 | A15: choosing `Blocked` in Risk should persist after save and refresh.             | DONE                 | Commit `f0b6d55`; shared schema, Prisma field, API mapping, web draft mapping; Docker smoke confirmed reload persists `Blocked`.                                           | Keep regression test and migrate any stale DBs.                                                                       |
| LF-10 | Risk save/edit should call `reports.saveDraft`; no silent no-op.                   | DONE FOR TESTED PATH | Docker browser smoke saved Risk and saw `reports.saveDraft` 200.                                                                                                           | Add/check browser coverage for add/edit variants if needed.                                                           |
| LF-11 | Optional multi-SDLC stages are needed for Current, Next, Risk, Decision, Priority. | CODE DONE            | API integration test persists `stageIds` for Item/Risk/Decision/Priority; web dialogs expose selectors.                                                                    | Browser smoke all entity types.                                                                                       |
| LF-12 | Risk card stage label must not hide useful selected-stage information.             | PARTIAL / VERIFY     | `risks-section.tsx` renders `All stages` when selected count equals owned stage count; other cards show explicit chips when `stageIds` is non-empty.                       | Product decision: keep compact `All stages` or distinguish explicit-all from omitted-all.                             |
| LF-13 | "All Stages" label may be wrong when subset selected.                              | NEEDS VERIFY         | Current risk logic handles subset as chips; full explicit selection collapses to `All stages`.                                                                             | Add a focused visual/unit test for subset vs explicit-all.                                                            |
| LF-14 | Unexpected error points from form flows must be closed or ticketed.                | PARTIAL              | The plan had R3 for four error points, but this recovery only verified the Risk severity path.                                                                             | Re-run form UAT with console/network capture.                                                                         |

## Current Verdict

```text
Lead Form core business logic:
  mostly implemented

Still not honestly closed:
  LF-12/LF-13 stage-label semantics
  LF-14 full browser UAT sweep for all 4 dialogs
```

## Next Steps

1. Run a focused browser sweep on the Docker stack:
   - Add Item -> verify all owned stages pre-selected -> save -> reload.
   - Add Risk -> choose `Blocked` -> save -> reload.
   - Add Decision -> verify stages -> save -> reload.
   - Add Priority -> verify stages -> save -> reload.
2. Decide LF-12:
   - keep `All stages` when every owned stage is explicitly selected, or
   - show explicit chips so user can distinguish "selected all" from "left empty".
3. Add missing test for risk stage-label semantics.
