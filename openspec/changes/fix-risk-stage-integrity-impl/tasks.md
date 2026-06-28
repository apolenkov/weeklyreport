## 1. Shared schema — element validation

- [ ] 1.1 In `packages/shared/src/schemas/report-primitives.schema.ts`, change
      `requiredStageIdsField` from `z.array(z.string()).min(1).max(MAX_SELECTED_STAGES)`
      to `z.array(z.string().min(1).refine(noNullBytes, { message: "..." })).min(1).max(MAX_SELECTED_STAGES)`,
      reusing the existing `noNullBytes` predicate. Leave the loose read field
      `stageIdsField` untouched.
- [ ] 1.2 Confirm the message wording matches the existing `noNullBytes` usage in
      `safeText` ("Text must not contain null bytes" or a stage-specific variant)
      and stays English (prod schema strings).

## 2. Web — risk dialog zero-owned-stage guard

- [ ] 2.1 In `apps/web/src/components/lead/risk-edit-dialog.tsx`, add a branch in
      `handleSave` (and the render) so that when `availableStages.length === 0`
      the required-stage validation is skipped, Save is disabled, and the inline
      "no stages assigned — contact admin" message documented on the
      `stagesForProduct` prop JSDoc is shown.
- [ ] 2.2 Ensure the guard runs BEFORE the existing
      `effectiveStageIds.length === 0` → "Select at least one stage." error, so a
      zero-owned-stage product never surfaces the unsatisfiable error.
- [ ] 2.3 Keep the single-owned-stage auto-apply and the multi-owned required
      behaviour unchanged (`availableStages.length >= 1`).

## 3. Web — stage selector banner honesty

- [ ] 3.1 In `apps/web/src/components/lead/stage-multi-select.tsx`, gate the
      empty-selection banner branch (`All assigned stages will show as …`) on
      `required === false`, so required-mode empty selections render no banner.
- [ ] 3.2 Leave the one-stage and multi-stage banner branches unchanged.

## 4. Tests

- [ ] 4.1 Shared schema unit test: `requiredStageIdsField` rejects `[""]` and an
      element containing a null byte, and accepts `["Design"]`.
- [ ] 4.2 Risk-dialog component test: rendering on a zero-owned-stage product
      disables Save, shows the contact-admin message, and never shows
      "Select at least one stage."; a one-owned-stage product still saves.
- [ ] 4.3 Stage-multi-select component test: in `required` mode with no selection
      no banner renders; in non-required mode the empty-selection banner still
      renders; selecting a stage renders the per-stage banner.

## 5. Verification

- [ ] 5.1 Run `pnpm typecheck` and fix any errors.
- [ ] 5.2 Run `pnpm lint` and fix any warnings/errors.
- [ ] 5.3 Run `pnpm test` and confirm the new and existing
      `risk-stage-integrity` suites pass.
- [ ] 5.4 Run `pnpm build` and confirm it succeeds.
- [ ] 5.5 Run `openspec validate "fix-risk-stage-integrity-impl" --strict` and
      confirm it exits 0.
