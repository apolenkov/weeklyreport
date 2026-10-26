# Proposal

## Why

Leads repeat stage selection and week switching, while contradictory Overview requirements leave “Move to next week” and empty cells open to incompatible implementations. TASK-707 records the owner's decisions: editable defaults, direct Current/Next creation, and postponement rather than implicit continuation.

## What Changes

- Permit one editable stage default: the last chosen stage for that Product in this draft; retain the sole-owned-stage shortcut and prohibit defaulting to all stages.
- Keep the unit-header `+` and allow contextual Current/Next `+` controls on hover/focus and always on touch. Creating directly in Next starts as Planned.
- Define `Move to next week` as moving the occurrence out of Current into Next without rewriting progress; keep `Continue next week` distinct.
- Reconcile empty cells with the existing `—` and screen-reader text `No item in this period`.
- Record P1's inline Paused reason (autofocus, Enter-to-save) and Clear-and-Done without Plan; Done plus a new Next item remains separate future work.
- Reconcile P2: autosave with error-only Retry instead of permanent Save, focus-safe busy/Saved recovery, and a non-overlay completion rail beside the content scrollport.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `lead-status-overview`: contextual creation, one composer, accessible emptiness, and move semantics.
- `record-status-derivation`: inline Paused/Clear-and-Done and placement-only move versus continuation, preserving progress and rollover rules.
- `risk-stage-integrity`: draft/Product-scoped editable stage defaults in Item, Risk, and Decision creation.
- `status-risk-unification`: preserve explicit risk-stage prefill and prohibit automatic all-stage coverage while permitting the agreed draft default.
- `lead-completion-guidance`: separate content scrollport and non-overlay completion rail with safe-area/focus clearance.
- `lead-plan-verdict`: pending-review count and submit blocker without a Save cluster.
- `report-toolbar-layout`: Retry-only completion, canonical header/rail handoff, unchanged role/context separation.
- `lead-report-controls-integrity`: recovery-only Retry, busy identity, Saved flash, and focus-safe removal.

## Impact

This submission changes planning artifacts only; application code and durable specs remain untouched. Future consumers are the Lead Report Overview, record editors, and the existing canonical draft-save path; no API, Prisma, dependency, authorization, or lifecycle change is proposed.

Sources: [TASK-707](</Users/wrk/work/backlog/backlog/tasks/task-707 - WR-форма-Lead-—-максимально-простой-быстрый-ввод-по-итогам-арены-26.10.md>), [owner decisions](/Users/wrk/work/handoffs/wr-513/s26/lead-form/SPEC-decisions.md), and [arena synthesis, sections (в), (д), (е)](/Users/wrk/work/handoffs/wr-513/s26/arena-lead-form/SVOD-fable.md). Verified code anchors and unresolved boundaries are in [design](./design.md); implementation packages 14–16 are in [tasks](./tasks.md).

## Non-goals

- Implementing the UI or declaring browser/click-count acceptance.
- Unifying the broader status/verdict vocabulary or changing `Continue next week`.
- Removing editor blocking, adding browser-persisted prose, or auto-confirming carried work.
- Relaxing stage ownership, required pause reason, Impact/Mitigation, or server `safeText`.
- Changing W+1 precedence/deduplication, Previous immutability, or atomic `periodState`/lifecycle writes.
