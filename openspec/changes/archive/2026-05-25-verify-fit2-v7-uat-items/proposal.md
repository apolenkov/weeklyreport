# Verify PRJ-2 v7 UAT items

## Problem

PRJ-2 v7 UAT cycle (2026-05-16) introduced several edge-case risks across lead
report sections, stage management, and cross-author locking. The changes need
verification before v8.5 release:

1. **Risk severity persistence** — risk severity (Critical/High/Medium/Low)
   must persist through save/reload without drift.
2. **Draft section lock badge** — sections authored by other leads show a lock
   badge; the badge must reflect the correct author name from
   `draftSection.authorName`, not `currentUser.name`.
3. **Status pill reset** — after a lead submits their section, the status pill
   must reset to "Draft" if the head hasn't published yet.
4. **Lock-badge edge cases** — cross-author view, archive toggle, and multi-tab
   sync must not break the lock badge.

## Solution

Walk through the UAT test cases manually and verify each invariant:

- Run `pnpm test:uat` (Playwright spec for v7) and confirm 0 failures.
- Inspect `apps/web/src/components/lead/risk-severity-badge.tsx` and verify
  the severity enum persists in the section model.
- Check `apps/web/src/components/lead/lock-badge.tsx` — confirm it reads
  `draftSection.authorName`, not `currentUser.name`.
- Verify status-pill reset in `apps/web/src/hooks/use-lead-form-autosave.ts:112`
  after section submission.
- Test cross-author view, archive, and reload in two-tab scenario.

## Non-goals

- Refactor the lock-badge or status-pill logic.
- Change the severity enum or persistence layer.
- Add new UAT tests (reuse existing Playwright spec from Phase 43).
- Touch the head-role report view.

## Source

- Pending UAT verification list (planned 2026-05-16, deferred by schedule).
- Memory: Phase 43 coverage-gap handoff (2026-05-14).

## Activation trigger

(Active — no deferred state.)
