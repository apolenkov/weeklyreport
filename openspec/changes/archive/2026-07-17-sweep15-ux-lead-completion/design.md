## Context

`LeadFormHeaderActions` owns Save, Quick Add, and Submit, while `LeadForm` already computes unset owned stages and `useLeadFormWriteActions` owns the risk-stage coupling gate and auto-promotion payload. The edit form has no equivalent action/readiness surface at its end.

## Goals / Non-Goals

**Goals:** keep completion actions reachable on long forms and explain the exact current readiness state immediately before submission.

**Non-Goals:** add validation rules, duplicate mutations, make slides sticky, or replace the existing context toolbar.

## Decisions

### 1. One action model, two mutually visible presentations

Extract a small `LeadCompletionActions` presentation fed by the existing autosave, merge, and write-action objects. The header and compact sticky cluster render the same state/handlers. An `IntersectionObserver` sentinel on the header action group controls which presentation is available: the sticky cluster is hidden and non-focusable while the header actions intersect; it appears only after they leave the viewport. A CSS fallback may keep the header usable when observation is unavailable, but MUST NOT show duplicate focus targets.

The sticky cluster contains Save state/action, Add, and Submit only. Fill From, version/PDF placeholders, reopen, and revoke remain contextual header actions.

### 2. Readiness is a pure projection of submit inputs

Create `deriveLeadSubmitReadiness` from the draft payload, products, own risks, autosave state, and pending state. It returns:

- unset owned product/activity/stage statuses;
- the count/list that the existing submit payload will auto-promote to On Track;
- blocking risk-stage coupling issues and any missing draft payload;
- whether submit confirmation can open.

Both `handleSubmit` and the readiness summary consume the same projection so copy and gating cannot diverge. Server validation remains authoritative.

### 3. End-of-form summary is actionable and concise

After edit sections, render a labeled summary with Ready/Needs attention status, grouped lines for "Will be set to On Track" and "Blocks submission", and a final Submit button wired to the same handler. When ready, say explicitly that unset eligible statuses will be promoted; do not imply every field is mandatory. Blocking items identify the affected product/activity/stage where the existing data permits.

### 4. Responsive and accessibility behavior

The compact cluster respects safe-area inset, does not cover the final summary, has at least 40px targets, announces save errors/pending status, and preserves logical focus order. It is absent in read-only, submitted, and slides modes.

No load-bearing backend invariant changes.

## Risks / Trade-offs

- [Two presentations trigger duplicate mutations] → Share handlers/state and enforce mutually visible/focusable DOM with tests.
- [Readiness becomes a second validator] → Derive it from the same pure function used by `handleSubmit`; label server validation as authoritative.
- [Sticky bar obscures mobile content] → Reserve bottom spacing while visible and include safe-area inset.

## Migration Plan

Extract readiness first and route submit gating through it, then add the end summary, then the observed sticky presentation. No data migration or flag is needed.

## Open Questions

None.
