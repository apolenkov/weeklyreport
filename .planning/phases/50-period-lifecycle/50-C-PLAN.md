# Phase 50-C — workingDays math + business-date utility

**Status:** ready
**Depends on:** none (independent of 50-A and 50-B, but 50-B benefits
from this for cron deadline calc)
**Requirement:** workingDays toggle must affect deadline math, not just
sit as metadata

## Goal

Promote `workingDays` from metadata-only to actual logic. New utility
`apps/api/src/lib/business-date.ts` provides business-day-aware date
math; every Period date computation routes through it.

## Acceptance Criteria

- New module `apps/api/src/lib/business-date.ts` exports:
  - `isBusinessDay(date: Date, workingDays: WorkingDays, tz: string): boolean`
  - `nextBusinessDay(date: Date, workingDays: WorkingDays, tz: string): Date`
  - `addBusinessDays(date: Date, n: number, workingDays: WorkingDays, tz: string): Date`
  - `computeDeadline(periodStart: Date, deadlineDays: number,
workingDays: WorkingDays, tz: string, deadlineHour: number): Date`
- Implementation uses Luxon (already installed via Phase 44-03).
- `nextBusinessDay` skips Sat+Sun for `mon-fri`, skips Sun for
  `mon-sat`, never skips for `mon-sun`.
- `addBusinessDays(start, n, mon-fri, tz)` = «advance n business
  days from start», so e.g. Monday + 4 business days = Friday;
  Monday + 5 business days = next Monday.
- `computeDeadline` returns a Date in UTC representing
  «deadlineHour:00 in `tz` of the `deadlineDays`-th business day
  after `periodStart`».
- Replace every existing `+ N days` Period date math (found via grep
  in 50-A) with calls into this utility.
- Test suite covers Russia (Mon-Fri default), Sunday-as-start
  cultures, and `mon-sun` (all days are business).
- Unit tests: 20+ cases — across the 3 enums × edge cases (week
  boundary, month boundary, DST transition).
- Period.create logic (50-A) updated to use `computeDeadline`
  instead of the hardcoded `+ 18:00` stamp.

## Steps

1. Create `apps/api/src/lib/business-date.ts` per acceptance.

2. Reference implementation skeleton:

   ```ts
   import { DateTime } from "luxon";

   export type WorkingDays = "mon-fri" | "mon-sat" | "mon-sun";

   function workingDaySet(wd: WorkingDays): ReadonlySet<number> {
     // Luxon weekday: 1=Mon, 7=Sun
     switch (wd) {
       case "mon-fri":
         return new Set([1, 2, 3, 4, 5]);
       case "mon-sat":
         return new Set([1, 2, 3, 4, 5, 6]);
       case "mon-sun":
         return new Set([1, 2, 3, 4, 5, 6, 7]);
     }
   }

   export function isBusinessDay(
     date: Date,
     wd: WorkingDays,
     tz: string,
   ): boolean {
     const dt = DateTime.fromJSDate(date).setZone(tz);
     return workingDaySet(wd).has(dt.weekday);
   }

   export function addBusinessDays(
     date: Date,
     n: number,
     wd: WorkingDays,
     tz: string,
   ): Date {
     const set = workingDaySet(wd);
     let dt = DateTime.fromJSDate(date).setZone(tz);
     let remaining = n;
     while (remaining > 0) {
       dt = dt.plus({ days: 1 });
       if (set.has(dt.weekday)) remaining--;
     }
     return dt.toJSDate();
   }

   export function computeDeadline(
     periodStart: Date,
     deadlineDays: number,
     wd: WorkingDays,
     tz: string,
     deadlineHour = 18,
   ): Date {
     const result = addBusinessDays(periodStart, deadlineDays, wd, tz);
     return DateTime.fromJSDate(result)
       .setZone(tz)
       .set({ hour: deadlineHour, minute: 0, second: 0, millisecond: 0 })
       .toJSDate();
   }
   ```

3. Test file `apps/api/src/lib/business-date.test.ts`:
   - Mon-Fri: Monday + 4 business days = Friday
   - Mon-Fri: Monday + 5 business days = next Monday
   - Mon-Fri: Friday + 1 business day = next Monday
   - Mon-Sat: Friday + 1 = Saturday
   - Mon-Sat: Saturday + 1 = next Monday
   - Mon-Sun: every day counts
   - DST boundary: March last Sunday in Europe/Moscow (no DST since
     2014 — pick a tz that DOES observe DST, like Europe/Berlin)
   - Month boundary: Apr 30 + 2 business days = May 2 (or 4 if
     May 1-2 are weekend)
   - Year boundary: Dec 30 + 3 business days
   - computeDeadline: 18:00 wall-clock in tz

4. Replace existing date math in Period.create (the file 50-A
   identified) — use `computeDeadline` with `settings.workingDays`
   and `settings.defaultTimezone`.

5. Surface in UI: settings-tab.tsx → Periods sub-tab, the
   `workingDays` field help text shifts from «метаданные, не
   влияет» to «влияет на deadline-математику».

6. Verify locally + Docker.

## Verification Commands

```bash
rtk pnpm --filter @customreport/api test -- business-date
# expected: all unit cases pass

# Manual smoke:
# set workingDays=mon-fri, create period starting on a Mon, deadlineDays=4
# → deadline lands on Friday
# set workingDays=mon-sun, same input → deadline lands on Friday still
# (Mon + 4 calendar days = Friday). Then set deadlineDays=5 → Saturday under mon-sun
# but Monday under mon-fri.
```

## Commit

`feat(api): UFB-050 — business-date utility + workingDays drives deadline math (50-C)`

Body:

- New apps/api/src/lib/business-date.ts with Luxon-based utilities
- 20+ unit tests covering 3 working-days enums × edge cases
- Period.create deadline now respects workingDays + defaultTimezone
- Settings UI help text updated
- Co-Authored-By: Claude Opus 4.7 (1M context)
