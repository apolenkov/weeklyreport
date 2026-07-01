## 1. Server guard

- [x] 1.1 Add a pure `validateStageOwnership(section, input)` (mirrors `validateSubmitInput`): for each new/changed row (per-row-id diff vs the server-loaded section), assert every stage name is in the section author's `ownedStages` for that row's product (canonical compare via `stageNamesMatch`). Lives in `packages/shared/src/schemas/section.schema.ts`; `stageNamesMatch`/`normalizeStageName` lifted into `packages/shared/src/schemas/stage-names.ts`.
- [x] 1.2 Add a `STAGE_NOT_OWNED` domain error (`BAD_REQUEST`). Added to `DraftSaveValidationErrorCode`; maps to BAD_REQUEST via the class-keyed `mapDomainError`.
- [x] 1.3 Call the validator in BOTH `saveDraft` and `submitSection`, before persistence; scope the reference to the section **author's** owned stages (not the editor's). Private `assertStageOwnership` on the service; reference is `section.projects[].ownedStages` (author-scoped by construction).
- [x] 1.4 Grandfather unchanged rows (validate only diffed new/changed rows); preserve `fix-lead-surface-name-resolution` behavior. Grandfather requires stableId match AND identical product AND identical canonical stage set — a stableId match alone is insufficient (stableId is client-authoritative).

## 2. Client dialogs

- [x] 2.1 Item / risk / decision dialogs: re-scope stage options to the author's owned stages on the selected product; re-scope on product change. (Risk dialog already shipped via `fix-risk-stage-integrity-impl`; item + decision now source `StageMultiSelect` from `availableStages`.)
- [x] 2.2 Single owned stage → visibly pre-select + lock (non-deselectable); two+ → clear on product change, require a pick. (Single-stage lock is the `StageMultiSelect` "Applied automatically" pill; product-change clear already shipped.)
- [x] 2.3 Zero owned stages on the selected product → disable Save + inline "no stages assigned on <product> — contact admin"; make the keyboard save shortcut a no-op. Extended the risk-dialog dead-end pattern to item + decision via a shared `stage-ownership.ts` helper (risk dialog untouched, keeps its own copy).

## 3. Default mine-only

- [x] 3.1 Confirmed `use-record-visibility.ts` defaults to Mine per `{userId, reportId}` (hooks/use-record-visibility.ts:74 + per-key re-default); the existing `RecordVisibilityToggle` stays the single show-all control. No code change; spec-homed in `report-toolbar-parity`.

## 4. Tests

- [x] 4.1 Server: a lead (owns Testing on P) is rejected `STAGE_NOT_OWNED` adding a DevOps record on P, on BOTH `saveDraft` and `submitSection`; an owned-stage write succeeds.
- [x] 4.2 Server: an on-behalf edit cannot inject an unowned stage (author-scoped reference; the guard never reads `actorUserId`).
- [x] 4.3 Server: an unchanged legacy/cross row is grandfathered (save succeeds without re-validation).
- [x] 4.4 Client: single-stage pre-select+lock; product change re-scopes; zero-stage disables Save + Ctrl/Cmd+Enter no-op — for item and decision (risk owned by the neighbor).
- [x] 4.5 Server (SMUGGLE): a payload row reusing an existing stableId but with a CHANGED stage set — or the SAME stage set moved to an unowned product — is rejected `STAGE_NOT_OWNED`, not grandfathered.

## 5. Verification

- [x] 5.1 `pnpm --filter @customreport/api db:generate`, then `pnpm typecheck` (5/5) and `eslint --max-warnings 0` on all touched files — green.
- [x] 5.2 Focused tests green: api service (26) + contract (63) + web item/decision/stage dialogs + mappers (101) + web lead sweep (569) + api report-sections unit (155). Full `pnpm test` left for the gate.
- [x] 5.3 `openspec validate "lead-form-stage-access-integrity" --strict` — valid.
- [x] 5.4 Coordinated with `fix-risk-stage-integrity-impl` (already landed): did NOT edit the risk dialog's dead-end nor the report-primitives hunks it owns; item/decision reuse the pattern via a shared helper.
