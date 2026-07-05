# Proposal: add-item-paused-postponed-statuses

## Why

A lead can only say an item is in progress, done, or blocked. Work that is deliberately on hold (paused) or pushed to a later period (postponed) has no honest status — leads misuse in_progress or delete the item, and the head loses the signal. Deferred follow-up from `redesign-lead-slide-by-product-grid` design.md (§6), requested by the owner.

## What Changes

- `ItemWorkflowStatus` enum grows `paused` and `postponed` (Prisma schema + shared Zod).
- Lead form status control offers the two new states wherever it offers blocked today.
- Read surfaces render them distinctly and without status words on slides (row treatment per the established visual language): report card view, lead slide grid, published/head/viewer surfaces, PDF export.
- Dashboard/analytics rollups: paused/postponed items count as not-done and MUST NOT trip the blocked/at-risk escalation paths.
- Dev DB reshape per MVP rules (`migrate reset`), no append migration.

## Capabilities

### New Capabilities

<!-- none -->

### Modified Capabilities

- `record-status-derivation`: the item workflow-status contract gains two states with defined rollup semantics — not-done, non-escalating.
- `status-slide-rendering`: slide rows render the two states within the no-status-words visual language.

## Non-goals

- No new statuses for risks or decisions.
- No auto-transitions (e.g. postponed items auto-carrying to the next period) — carry-over behavior stays as is.
- No slide-row editing (that is `edit-slide-item-inline`).

## Impact

- `prisma/schema.prisma` + seeds; `packages/shared` item schemas; `apps/api` write-path validation (existing mutations, no new endpoints).
- `apps/web` lead form status control, card renderers, slide grid mapping (`buildOwnItemRow`), weekly-report mappers, PDF export template.
- Memory anchor: overlay surfaces must coerce/derive consistently ([[overlay-must-coerce-before-derive]]) — every render site gets an explicit mapping for the new states.
