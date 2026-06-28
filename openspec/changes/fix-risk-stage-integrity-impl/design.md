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
"Select at least one stage." error is never reached for a zero-owned product.

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

### 3. Element validation reuses the existing `noNullBytes` predicate

`report-primitives.schema.ts` already defines `noNullBytes` and a `safeText`
helper. Constrain `requiredStageIdsField` elements with
`z.string().min(1).refine(noNullBytes)` so `[""]`, `[" "]` (after the dialog
trims) and null-byte strings are rejected. The looser read-side `stageIdsField`
stays as-is so stage-less legacy rows still load; only the strict write field is
tightened. The `MAX_SELECTED_STAGES` cap and `.min(1)` array-length rule remain.

## Risks / Trade-offs

- Tightening the element schema could in theory reject a previously-accepted
  payload, but no legitimate client sends empty/null-byte stage strings; the
  loose read field already covers legacy loads.
- The dialog branch must run BEFORE the required-stage error so a zero-owned
  product never shows the unsatisfiable "Select at least one stage." message.

## Out of Scope

- The `stageIds → stageNames` rename (`TODO(STAGE-NAMING-01)`).
- Item and decision dialog zero-owned-stage UX (already covered by the shipped
  requirement; this change only adds the risk dialog's explicit save guard).
