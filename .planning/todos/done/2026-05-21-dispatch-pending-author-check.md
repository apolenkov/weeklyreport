---
tags:
  - backend
  - trpc
  - error-handling
  - low
aliases:
  - dispatch-pending-author-check
related:
  - graceful-coalescing-kurzweil
---

## Background

Identified in Codex review §23 of
`.planning/plans/graceful-coalescing-kurzweil.md`. The `dispatchPending`
mutation in the tRPC router calls `reportSection.findMany` filtered by
`leadId`. When `authorId` does not belong to `reportId`, `findMany` returns
`[]` and the mutation returns `{ sent: 0, skipped: 0, errors: 0 }` with no
explicit reason. The frontend currently shows a "Retry" fallback on a zero-sum
result, but the user cannot distinguish "no pending sections" from "wrong
lead/report combination".

## Why deferred

LOW severity — the system is functionally correct (no data is corrupted, no
false reminders sent). The UX gap is visible only in edge-case misconfiguration.
Deferred to avoid scope creep on the §23 hotfix cycle.

## Acceptance criteria

- When `input.leadId` is defined and `draftSections.length === 0`, the mutation
  returns `{ sent: 0, skipped: 0, errors: 0, reason: "no-matching-section" }`.
- Frontend toast distinguishes this case from a successful dispatch with zero
  pending sections (e.g. "No sections matched this lead" vs "Nothing pending").
- Existing unit tests for `dispatchPending` pass; new test covers the empty
  `draftSections` branch with `leadId` set.

## Estimate

~10 LoC backend (`apps/api/src/...trpc.router.ts`) + ~5 LoC frontend toast
(`apps/web/src/...RemindLeadButton.tsx` or equivalent). Total ~15 LoC.
