## Context

`apps/web/src/components/admin/periods-tab-dialog.tsx` is the Period
management create/edit dialog (Admin → Periods, per CONTEXT.md "Period
management"). It holds three temporal inputs as controlled string state:

- `periodStart` — `<input type="date">`
- `periodEnd` — `<input type="date">`
- `deadline` — `<input type="datetime-local">`

Stored `Date` values are rendered into the fields with UTC helpers:
`dateInputValue` → `toISOString().slice(0,10)` and `dateTimeInputValue` →
`toISOString().slice(0,16)`. Both produce UTC wall-clock strings.

On submit (`handleSubmit`):

- `periodStart` → `new Date(\`${periodStart}T00:00:00.000Z\`)` — UTC, correct
- `periodEnd` → `new Date(\`${periodEnd}T23:59:59.999Z\`)` — UTC, correct
- `deadline` → `new Date(deadline)` — **local time, the bug**

The deadline parse is the inverse mismatch: display is UTC, parse is local.
The same `new Date(deadline)` local parse also appears in the in-dialog
`deadlineError` range validation, where it is compared against UTC-parsed
start/end bounds — a second instance of the same defect.

## Goals / Non-Goals

**Goals:**

- Make the deadline display→parse round-trip stable in every timezone.
- Fix both deadline parse sites (submit + range validation) consistently.
- Lock the existing-correct `periodStart` / `periodEnd` UTC parse as a spec
  invariant so a later edit cannot reintroduce drift.

**Non-Goals:**

- No change to the API, Prisma schema, or shared Zod contracts.
- No change to how deadlines are stored (already UTC `Date`).
- No timezone-picker or per-user-timezone feature; fields stay UTC
  wall-clock by convention.

## Decisions

**Decision: Align the parse to the existing UTC display, not vice versa.**
The fix appends `:00.000Z` to the deadline string before `new Date(...)`,
matching `toISOString().slice(0,16)` on the read side. Alternative — switch
the display to local time and keep the local parse — was rejected: it would
diverge from the `periodStart` / `periodEnd` convention (which is UTC), and
the stored value is UTC, so a UTC field is the least surprising. The spec
scenarios pin the field as UTC wall-clock on both read and write so a future
reader does not "fix" the display back to local and reintroduce the skew.

**Decision: Treat the range-validation parse as part of the same fix.**
Both sites must agree on the instant, or validation would pass/fail on a
different value than the one submitted. Fixing only the submit parse leaves
validation drifting.

## Risks / Trade-offs

- [A `datetime-local` field has no timezone affordance, so a non-UTC admin
  types a wall-clock that is interpreted as UTC] → This matches the existing
  `periodStart` / `periodEnd` convention and the stored-UTC model; documented
  in the spec. A real per-user-timezone affordance is out of scope.
- [Two parse sites could drift apart again on future edits] → The spec adds
  the UTC-parse invariant for all three fields and a regression test guards
  the round-trip.

## Migration Plan

Pure client-side logic fix; no migration, no rollback concern. Verify with
`pnpm typecheck`, `pnpm lint`, and the new component regression test (the real
`PeriodsTab` → `CreatePeriodDialog` submit path, run under a non-UTC process
timezone), then `pnpm build`.

## Open Questions

None.
