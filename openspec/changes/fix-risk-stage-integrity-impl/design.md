## Context

`risk-stage-integrity` is already shipped: write schemas reject empty `stageIds`,
the risk/item/decision dialogs require a stage, and read models tolerate
stage-less legacy rows behind a loud "No stage set" marker. This change is a
narrow follow-up that fixes three implementation gaps the review surfaced; it
does not reopen the capability's design.

## Goals

- A lead is never permanently dead-ended on a product where they own zero stages.
- The required-mode stage banner never claims an outcome the required rule forbids.
- The "require at least one stage" intent is enforced at the element level, not
  only at the array-length level, and malformed strings never reach the DB.

## Decisions

### 1. Zero-owned-stage path lives in the dialog, not the schema

The schema (`requiredStageIdsField`) keeps demanding a non-empty array — that is
the correct write contract. The zero-owned-stage situation is a UI-only state:
there is no stage to pick, so the dialog must not submit at all. The dialog
already documents this in the `stagesForProduct` JSDoc; the fix wires that
documented behaviour (disabled Save + "no stages assigned — contact admin"
inline message) ahead of the existing required-stage block, so the unsatisfiable
"Select at least one stage." error is never reached for a truly dead-ended row.

The guard must make `handleSave` an early-return no-op, not merely skip the
required-stage error branch. If the branch only suppressed the error and let
execution continue, `handleSave` would call `onSave` with an empty `stageIds`
array and surface server validation instead of the documented contact-admin
state. So the zero-owned-stage condition `return`s before `onSave`, emitting
nothing. Because `handleSave` is the single save entry point — the click handler
AND the Ctrl/Cmd+Enter shortcut in `handleKeyDown` both call it — guarding inside
`handleSave` covers the keyboard path automatically; the shortcut never bypasses
the disabled-Save state. (A belt-and-braces option is to also early-return from
`handleKeyDown` when the guard is active, but routing both through `handleSave`
is sufficient and is the contract.)

The guard is scoped to `availableStages.length === 0 && effectiveStageIds.length
=== 0`, NOT to `availableStages.length === 0` alone. A cross-stage risk can
arrive in edit mode already carrying `stageIds` while its product lies outside
the lead's stage-owned list (so `stagesForProduct` returns `[]`). That row is
valid and must stay saveable — disabling Save on `availableStages.length === 0`
alone would regress the shipped cross-stage-product-preservation behaviour
(`risk-edit-dialog.test.tsx` "keeps the original product on save when its id is
outside the stage-owned list"). The dead-end only exists when there is no stage
to pick AND no stage already selected, so both conditions gate the guard.

This mirrors point 3 of the existing "Items and decisions require a concrete
stage in the edit dialog" requirement ("a product with no owned stages … the
dialog MUST NOT force a stage — there is none to pick") and extends the same
treatment to the risk dialog's save path explicitly.

### 2. Banner suppression is gated on `required`, not on selection emptiness

The banner is a consequence preview. The misleading line is specifically the
empty-selection branch (`All assigned stages will show as <severity>.`). That
branch is only wrong when the host requires a stage. So suppress the
empty-selection banner when `required` is true; the one-stage and many-stage
banner branches are unchanged, and non-required hosts keep the existing copy.

### 3. Element validation reuses the existing `noNullBytes` and `noInvisibleOnly` predicates

`report-primitives.schema.ts` already defines both `noNullBytes` and
`noInvisibleOnly` — the same visible-content pair that `safeText` composes.
`z.string().min(1).refine(noNullBytes)` alone would still accept `[" "]` (one
space passes `.min(1)` and carries no null byte), so it does not enforce the
require-a-real-stage intent. Constrain `requiredStageIdsField` elements with
`z.string().min(1).refine(noNullBytes).refine(noInvisibleOnly)` so `[""]`,
`[" "]`, zero-width-only strings, and null-byte strings are all rejected at the
schema boundary — independent of any dialog trimming. The looser read-side
`stageIdsField` stays as-is so stage-less legacy rows still load; only the strict
write field is tightened. The `MAX_SELECTED_STAGES` cap and `.min(1)`
array-length rule remain.

## Risks / Trade-offs

- Tightening the element schema could in theory reject a previously-accepted
  payload, but no legitimate client sends empty/null-byte stage strings; the
  loose read field already covers legacy loads.
- The dialog branch must run BEFORE the required-stage error so a stage-less
  zero-owned product never shows the unsatisfiable "Select at least one stage."
  message.
- The branch must `return` from `handleSave` before `onSave`, not just skip the
  error. A skip-only edit would emit an empty `stageIds` array and trip server
  validation instead of the documented contact-admin state — and because the
  Ctrl/Cmd+Enter shortcut also calls `handleSave`, the keyboard path would be the
  silent leak. Guarding inside `handleSave` closes both the click and keyboard
  entry points.
- The guard must be gated on both `availableStages.length === 0` AND
  `effectiveStageIds.length === 0`; gating on the owned-stage count alone would
  disable Save for a valid cross-stage risk that already carries `stageIds` and
  regress the shipped cross-stage-product-preservation test.

## Out of Scope

- The `stageIds → stageNames` rename (`TODO(STAGE-NAMING-01)`).
- Item and decision dialog zero-owned-stage UX (already covered by the shipped
  requirement; this change only adds the risk dialog's explicit save guard).
