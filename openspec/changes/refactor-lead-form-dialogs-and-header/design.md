## Context

`apps/web/src/features/report-sections/ui/lead-form.tsx` is 698 lines after
`refactor-lead-form-edit-sections`. The remaining JSX bulk splits into three
chrome clusters: the page header + document-action group, the dialog cluster,
and the sticky toolbar's context controls. This slice takes the first two; the
toolbar and the title/archive effects are the final slice, after which the
`max-lines` exemption teardown is attempted.

This slice follows the council blueprint recorded in the edit-sections slice
(the Codex seat's file split for the JSX phase; the deep-reasoning seat's
grouped-prop contract), applied here to the header/dialog clusters. Codex
remains unavailable for stop-time review (auth token requires interactive
re-login).

Load-bearing invariants:

- Period dual-state, role-coverage gate: untouched (no write-path or API
  changes).
- The submit-confirmation summary MUST keep counting the lead's OWN records
  only (`ownCurrentWeekItems` / `ownNextWeekItems` / `ownRisks` /
  `ownDecisions`), never the Everyone display arrays (7c.5).
- `unsetOwnStageCount` MUST stay derived from `draftPayload.stageStatuses` in
  `LeadForm` (it feeds both the dialog warning and the submit coercion — one
  count, single source) and be passed down as a value.
- Render-phase ref assignments stay in `LeadForm`, before the JSX return.
- Rendered markup stays byte-identical; the end-to-end suites are the pins.

## Goals / Non-Goals

**Goals:**

- Move the header + document-action group into `LeadFormHeaderActions` and the
  dialog cluster into `LeadFormDialogs`; both files < 250 lines, no new lint
  exemptions.
- Continue the grouped-prop contract: `viewModel`, `merges`, and
  `writeActions` passed wholesale.
- Update `architecture-refactor-backlog` with actual post-slice LOC evidence.

**Non-Goals:**

- No toolbar/context-controls extraction; no title/archive effect moves.
- No hook, view-model, data-loading, or styling changes.
- No backend, shared schema, Prisma, tRPC, route, or UI-string changes.
- No broad `ReportDataCoordinator` or `FormStateManager`.

## Decisions

### D1: `writeActions` joins the grouped-prop contract

`useLeadFormWriteActions` is currently destructured into ~18 names consumed
almost entirely by the header buttons and dialogs — exactly the JSX moving
out. `LeadForm` keeps the whole `writeActions` object and passes it to both
new components; the few residual reads (`autosave` badge input) stay local.

Alternative rejected: threading 18 individual callbacks/flags — the flat prop
bag again.

### D2: Two components, split by surface not by size

`LeadFormHeaderActions` owns the `<header>` element (title, status badge,
`DocumentActionGroup` with deferred controls, Fill-From, Save, Request
Reopen / Revoke, Quick-add, Submit). `LeadFormDialogs` owns the four dialogs
(submit-confirm, quick-add `ItemEditDialog` host, `RequestReopenDialog`,
`ConfirmDeleteDialog`). The split matches user-facing surfaces, so each file
reads as one concern and future slices don't need to re-cut it.

### D3: Pure relocation, existing tests are the pins

Markup moves verbatim (classNames, aria attributes, testids, button labels,
dialog roles). No new tests: the end-to-end suites assert these surfaces by
role/label through `<LeadForm>`. The autosave badge label derivation
(`autosaveLabel`) moves with the header since it is header-only presentation.

## Risks / Trade-offs

- Submit summary switched to display arrays (foreign rows counted) -> the
  invariant above; `lead-form-visibility.test.tsx` 7d.5 pins own-only counts
  and fails loudly.
- Silent prop-miswiring -> mechanical relocation, no logic edits in the same
  commit; full unit suite; adversarial verifier diffs old vs new.
- Dialog conditional rendering drift (`showSubmitConfirm && …` vs `open`
  props) -> keep each dialog's mount/`open` semantics exactly as in HEAD.

## Migration Plan

1. Add `lead-form-header-actions.tsx` and `lead-form-dialogs.tsx`.
2. Rewire `LeadForm` to render them; keep toolbar, edit/slides branch, and
   effects unchanged.
3. Update the backlog spec and delta with actual post-slice LOC evidence.
4. Run focused tests, scoped ESLint, `pnpm typecheck`, `pnpm lint`,
   `pnpm test`, `pnpm format:check`, `git diff --check`, and OpenSpec
   validation.

Rollback is a normal git revert; no persisted data or API surface changes.

## Open Questions

- None blocking.
