## Why

BL-04 (P0), `docs/reviews/repo-excellence-review-2026-07-14.md`.

`reminderPolicySchema` (`packages/shared/src/admin/reminder-policy.schema.ts`,
line 34) validates `timezone` only as `z.string().min(1)` — any non-empty
string passes, including a typo or a malicious client bypassing the React
admin UI. The schema already `.refine()`s the sibling `validUntil >=
validFrom` invariant at this exact "malicious admin write" boundary
(lines 56-64, with a docblock explicitly calling out the bypass threat
model) — `timezone` is the one field at the same boundary left unvalidated.

The unvalidated value reaches `PolicyApplicatorService.computeFireAt`
(`apps/api/src/modules/reminders/policy-applicator.service.ts`, lines
44-51): `DateTime.fromJSDate(deadline, { zone: 'utc' }).setZone(tz)` — Luxon
does not throw on an invalid zone name, it returns an invalid `DateTime`,
which then serializes to `Invalid Date` via `.toUTC().toJSDate()`. That
`Invalid Date` reaches the `reminderRule.upsert` call (lines 129-149) inside
`applyToPeriod`'s per-policy loop; Prisma rejects it, the error is not a
`P2002` so the loop's `catch` block re-throws (line 176), and the `for`
loop over `policies` (line 111) aborts — every policy after the bad one in
iteration order never gets a `ReminderRule` row for that period, silently
denying reminders for the whole period, not just the misconfigured policy.

## What Changes

- `reminderPolicySchema`'s `timezone` field gains a refine (or `.check()`
  in the same style as the existing `validUntil >= validFrom` refine)
  rejecting any value that is not a valid IANA time zone identifier, at the
  same wire boundary the existing refine already protects.
- A bad timezone is now rejected at admin-save time with a clear validation
  error, before it ever reaches `PolicyApplicatorService` or
  `Report`/`ReminderRule` persistence.

## Claim disposition

| Sub-claim                                                                                                 | Disposition   | Note                                                                                                                                                                                                                                                                                |
| --------------------------------------------------------------------------------------------------------- | ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `timezone` is validated only as a non-empty string today                                                  | **Confirmed** | read directly from `reminder-policy.schema.ts` line 34                                                                                                                                                                                                                              |
| An invalid IANA zone reaches `computeFireAt` without erroring there                                       | **Confirmed** | Luxon `setZone` on an invalid zone returns an invalid `DateTime`, not a throw                                                                                                                                                                                                       |
| The eventual Prisma rejection aborts reminder-rule creation for the WHOLE period, not just the bad policy | **Confirmed** | the non-`P2002` `catch` branch re-throws, aborting the `for` loop over all policies                                                                                                                                                                                                 |
| Fix belongs in `PolicyApplicatorService` (defensive check before `computeFireAt`) rather than the schema  | **Refuted**   | the sibling `validUntil`/`validFrom` invariant is enforced at the schema/wire boundary specifically so a bypass-the-UI client cannot persist a bad value at all; timezone should follow the same boundary, not a downstream defensive check that still lets bad data land in the DB |

## Non-goals

- Not adding a defensive re-validation inside
  `PolicyApplicatorService.computeFireAt` as the primary fix — the schema
  refine is the fix; a defensive check there would be redundant belt-and-
  suspenders, not the load-bearing boundary. (Acceptable as an _additional_
  hardening line if trivial, but not a substitute for the schema fix.)
- Not changing `computeFireAt`'s DST-crossing arithmetic or the
  `policyAppliesTo` validity-window gate — those are unrelated, already-
  correct logic this change does not touch.
- Not adding a new runtime dependency to `packages/shared` to perform the
  validation — `Intl.supportedValuesOf('timeZone')` is a built-in (Node 18+
  / modern browsers) and needs no new package; prefer it over pulling
  `luxon` into `packages/shared` (currently dependency-free apart from
  `zod`/`@trpc/server`) unless the implementer finds a concrete reason
  `Intl.supportedValuesOf` is insufficient (check its availability in the
  API's and web's target runtimes before ruling it out).
- Not retroactively fixing already-persisted bad timezone values in the DB —
  MVP-phase DBs are disposable per the project's CLAUDE.md; if a bad value
  already exists in dev/uat, `prisma migrate reset` clears it rather than
  needing a backfill script.

## File manifest

- `packages/shared/src/admin/reminder-policy.schema.ts` — add the IANA
  timezone refine to `reminderPolicySchema`.
- `packages/shared/src/admin/reminder-policy.schema.test.ts` (create if it
  does not exist; check first) — tests: a valid IANA zone (e.g.
  `"Europe/Moscow"`) passes; a garbage string (e.g. `"Not/AZone"`,
  `"UTC+3"`) is rejected with a clear error path on `timezone`.
- `apps/api/src/modules/reminders/policy-applicator.service.ts` — read-only
  reference; not expected to change unless a defensive hardening check is
  added per Non-goals (optional, not required).
- `apps/api/src/modules/reminders/policy-applicator.test.ts` — preservation
  test: confirm `applyToPeriod` still aborts the loop on a genuinely
  unexpected non-`P2002` Prisma error (the existing re-throw behavior for
  errors other than the unique-violation race is intentional and must not
  be silently swallowed by this change).
- `apps/api/src/modules/admin/reminder-admin.service.ts` — read-only
  reference (consumes the schema on admin policy save); confirm it surfaces
  the schema's rejection as a client-visible validation error rather than a
  generic 500.

## Verification

- `pnpm --filter @customreport/api db:generate`
- `pnpm typecheck && pnpm lint && pnpm test`
- `cd apps/api && pnpm test:integration` — recommended: confirm an admin
  policy-save request with an invalid timezone is rejected end-to-end
  (through the tRPC procedure, not just the unit-level schema parse) and
  never reaches `PolicyApplicatorService`/the DB.
- Manual/live check (optional): attempt to save a reminder policy via the
  admin UI or a direct tRPC call with `timezone: "Not/AZone"` and confirm a
  validation error surfaces instead of a period silently losing all its
  reminders.

## Sequencing

Independent of the other three P0 changes (different subsystem: shared
schema + reminders module). No ordering dependency.
