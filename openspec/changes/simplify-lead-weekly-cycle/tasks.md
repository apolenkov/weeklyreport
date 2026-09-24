# Tasks

## 1. Shared contracts and safe handoff

- [x] 1.1 Obtain a TASK-047 ownership handoff for the overlapping carry-over and Overview files, record `git rev-parse HEAD` plus task-owned baseline hashes in TASK-048, and verify no concurrent writer remains on those paths.
- [x] 1.2 Re-read the canonical Item schemas and `carriedOver` consumers; verify with existing shared/Web tests that no Prisma or shared-schema change is needed, and stop for owner approval if a migration is discovered.

## 2. API rollover selection

- [x] 2.1 Add failing cases in `apps/api/src/modules/carry-over/carry-over-planned-status.test.ts` and/or `carry-over.service.test.ts` for commitment precedence independent of source order, Current in-progress fallback, exclusion of resolved/done/paused/postponed/uncommitted planned items from active targets, one target per `stableId`, preserved source/audit fields, and replay idempotency; run the focused Vitest files and confirm the new cases fail for the intended reason.
- [x] 2.2 Change only the existing pure planner/cloner in `apps/api/src/modules/carry-over/carry-over-plan.ts` and `carry-over-clones.ts` so selection occurs once per lineage and the clone receives `planned` for commitments or `in_progress` for fallback continuations; rerun the focused Vitest files and verify every new case passes.
- [x] 2.3 Extend the existing carry-over integration coverage for persisted status, `carriedOver`, `stableId`, `CarryOverRecord`, section version, duplicate/replay behavior, and unchanged pause/resolution history; run `pnpm --filter @customreport/api test -- carry-over` and, only if no reset/reseed is required, the guarded existing integration target.

## 3. Web action model and presentation

- [x] 3.1 Add failing pure/model tests around `status-overview-items.ts`, `open-work-register-model.ts`, and action component tests around `status-overview-item-actions.tsx` for carried planned, carried in-progress, automatically paused uncommitted planned, ordinary active, paused, postponed, done/resolved, restorable, historical-replan, and read-only Previous; verify exact labels/action names and no competing Plan/Confirm/Update/move primaries.
- [x] 3.2 Reuse the existing canonical editor, confirmation patch, open-work register, and focus keys to derive one primary progress interaction, one secondary overflow, and the automatic-pause projection; make the minimum changes in existing Overview/open-work files and rerun their focused Vitest suites.
- [x] 3.3 Add component coverage in `lead-status-overview.test.tsx` and `status-overview.test.tsx` for “Planned/Continued · not updated this week” copy, immutable Previous, three visible temporal lanes, keyboard open/cancel/focus return, one mounted editor, and no horizontal overflow regression; run those focused suites and Web typecheck/lint for touched files.

## 4. Acceptance and durable record

- [x] 4.1 Run `pnpm spec:check`, `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm test`, and `pnpm build`; record exact commands, source identity, pass/fail output, and exclusions in TASK-048 without treating blocked checks as passes.
- [x] 4.2 Create a named agent-browser session, read its core skill, and verify the finite synthetic local matrix on `/lead/report/:reportId`: rollover branches, action counts, read-only Previous, three lanes, keyboard/focus, 200% zoom/overflow, and axe; capture DOM/screenshot/network evidence bound to the tested source and close the session.
- [x] 4.3 Inspect the task-owned diff against the recorded baseline, run the available adversarial review fallback plus `requesting-code-review`, then obtain one Astra High independent final review with no mandatory findings; resolve findings and rerun affected checks.
- [ ] 4.4 Reconcile the four delta specs, design, TASK-048 decisions/results, and the implementation; only after all acceptance passes, add a short non-duplicative weekly-cycle rule to project `AGENTS.md`, run `pnpm spec:check`, and verify the final diff preserves all pre-existing/concurrent edits.
