# Add holidays calendar

## Problem

The deadline calculation function `computeDeadline()` in
`apps/api/src/lib/business-date.ts` currently treats all weekdays as business
days. When leads set reporting deadlines, holidays (public holidays, company
shutdowns) are not factored in, leading to unrealistic deadline estimates.

The JSDoc already promises this: `@param holidays {Date[]} ...` but no
implementation exists.

## Solution

Implement a holidays calendar:

- Create `apps/api/src/lib/holidays.ts` with a `HOLIDAYS_2026` array (or
  populate from a config or database).
- Update `computeDeadline()` to accept an optional `holidays` parameter.
- Modify the business-day calculation to skip both weekends and holiday dates.
- Wire the calendar into report-deadline calculations in the report-shell or
  lead-form services.

## Non-goals

- Make holidays user-configurable via UI (future phase).
- Handle recurring holidays (e.g., Easter) — use a fixed list for MVP.
- Integrate with Google Calendar or Jira holiday calendar.

## Source

- JSDoc promise in `business-date.ts` (unimplemented).
- `.planning/todos/pending/2026-05-21-holidays-calendar.md` — research doc
  pending.

## Activation trigger

When product locks in a holidays calendar (2026 custom holidays defined, or
when lead feedback indicates deadline misses due to holiday skipping). Current
ETA: v8.6.
