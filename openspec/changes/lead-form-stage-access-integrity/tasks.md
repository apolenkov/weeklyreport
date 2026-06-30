## 1. Server guard

- [ ] 1.1 Add a pure `validateStageOwnership(section, input)` (mirrors `validateSubmitInput`): for each new/changed row (per-row-id diff vs the server-loaded section), assert every stage name is in the section author's `ownedStages` for that row's product (canonical compare via `stageNamesMatch`).
- [ ] 1.2 Add a `STAGE_NOT_OWNED` domain error (`BAD_REQUEST`).
- [ ] 1.3 Call the validator in BOTH `saveDraft` and `submitSection`, before persistence; scope the reference to the section **author's** owned stages (not the editor's).
- [ ] 1.4 Grandfather unchanged rows (validate only diffed new/changed rows); preserve `fix-lead-surface-name-resolution` behavior.

## 2. Client dialogs

- [ ] 2.1 Item / risk / decision dialogs: re-scope stage options to the author's owned stages on the selected product; re-scope on product change.
- [ ] 2.2 Single owned stage → visibly pre-select + lock (non-deselectable); two+ → clear on product change, require a pick (verify existing behavior).
- [ ] 2.3 Zero owned stages on the selected product → disable Save + inline "no stages assigned on <product> — contact admin"; make the keyboard save shortcut a no-op. Extend the existing risk-dialog rule to item + decision.

## 3. Default mine-only

- [ ] 3.1 Confirm `use-record-visibility.ts` defaults to Mine per `{userId, reportId}`; keep the existing `RecordVisibilityToggle` as the single show-all control (add no second button).

## 4. Tests

- [ ] 4.1 Server: a lead (owns Testing on P) is rejected `STAGE_NOT_OWNED` adding a DevOps record on P, on BOTH `saveDraft` and `submitSection`; an owned-stage write succeeds.
- [ ] 4.2 Server: a head editing on-behalf cannot inject an unowned stage (author-scoped reference).
- [ ] 4.3 Server: an unchanged legacy/cross row is grandfathered (save succeeds without re-validation).
- [ ] 4.4 Client: single-stage pre-select+lock; product change re-scopes; zero-stage disables Save — for item, risk, and decision dialogs.

## 5. Verification

- [ ] 5.1 `pnpm --filter @customreport/api db:generate`, then `pnpm typecheck` and `pnpm lint` until green.
- [ ] 5.2 `pnpm test` (api section-write + web dialog tests) until green.
- [ ] 5.3 `openspec validate "lead-form-stage-access-integrity" --strict` until it exits 0.
- [ ] 5.4 Coordinate with the parallel session on `risk-stage-integrity` / `fix-risk-stage-integrity-impl` before staging overlapping service hunks.
