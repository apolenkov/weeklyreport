# Proposal

## Why

C4929: after a failed save of an Overview item the editor keeps its fields and
its Active week radios enabled, but `changeWeek` ignores every call while a
submission exists. The lead clicks "Next week", nothing happens, and the only
way out is closing the editor. A control that looks usable must not be a silent
no-op.

## What Changes

- While a failed submission is shown, each Active week radio either applies the
  chosen week or is disabled. Which of the two is decided before the repair
  (recommended: disabled while a submission exists, because the retry token and
  receipt scope are bound to the submitted week).
- The text the lead typed stays intact in both cases.
- Everything else in the submission flow (receipt scope, acknowledgement,
  single-flight save) is unchanged.

## Remaining clauses of TASK-503.21 (no RED here, reason recorded)

| Clause | Why no RED from source                                                                                          |
| ------ | --------------------------------------------------------------------------------------------------------------- |
| C4801  | Delivered earlier (display floor, main a7f3e795b); raw-toggle policy stays own-only.                            |
| C4783  | Needs native keyboard/AT observation; jsdom exposes `title` as a description, so it cannot separate the states. |
| C4844  | Needs a public mounted Overview with real focus and fragment scrolling.                                         |
| C4854  | Divergence of `isInFlight` and `state` is not shown; the owner gates both announcement branches.                |
| C4867  | `lead-section-preview-auth.tsx` is claimed by wr-claude-E (C5223, paused).                                      |
| C4924  | Receipts, attempt latch and acknowledgement are guarded in source; needs a runtime ordering trace.              |
| C4926  | Supported environment without `crypto.randomUUID` is not established.                                           |
| C4989  | Server transaction rejects locked lineage; the client-side late-lock trigger is unobserved.                     |

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `lead-status-overview`: Active week control after a failed save.
