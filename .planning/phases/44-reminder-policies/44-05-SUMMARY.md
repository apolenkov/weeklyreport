# Phase 44-05 — Tests + audit log — Summary

**Status:** done
**Commit:** `8b8b629`
**Requirements:** UFB-036, NOTIF-06
**Depends on:** 44-02, 44-03, 44-04

## What landed

1. **Dedicated audit events for policy mutations.** `audit-logger.ts`
   exposes two new helpers — `policySave({userId, policyId, kind, action})`
   and `policyRemove({userId, policyId})` — mirroring the `scopeDenied`
   precedent from Phase 46-05. Both emit at `info` with the event tags
   `admin.policy.save` / `admin.policy.remove` so SIEM rules can filter
   on `event` (no procedure-string parsing). Wired from the tRPC router
   in `admin.savePolicy` / `admin.removePolicy` where
   `ctx.auditLogger` + `ctx.session.userId` are available.
2. **Pre-upsert existence check** in `AdminService.policyExists(id)` so
   the audit `action` is `'create'` vs `'update'` based on the actual
   pre-state rather than guessed from the payload.
3. **Wire-format contract test** (`reminders.policy.contract.test.ts`):
   11 zod-only cases — valid parses, `validFrom` default-fill,
   `validUntil` default-fill, rejects for empty timezone, unknown
   audience/kind, non-integer offset, malformed UUID id, and the new
   `validUntil < validFrom` invariant.
4. **Schema-level validity-window refine** in
   `reminder-policy.schema.ts`: a `.refine()` rejects `validUntil <
validFrom` at the API boundary so a malicious admin client cannot
   bypass the React-layer disabled-Save UI guard.
5. **Real-DB integration test** (`reminders.policy.integration.test.ts`):
   6 cases through `PolicyApplicatorService` against the live Postgres
   test database —
   - happy path: T-24h, Europe/Moscow → `fireAt = deadline - 1440min`
   - March-30 Moscow boundary (no DST since 2014; locks the math)
   - `validUntil` BEFORE deadline → zero rules created
   - `validFrom` AFTER deadline → zero rules created
   - zero active policies → zero rules created
   - re-run idempotency: second `applyToPeriod` updates instead of
     creating; row count stays at one.
6. **`cleanDatabase` extension** in `prisma-test-helper.ts` — now wipes
   `reminderPolicy` between tests so the integration suite is repeatable
   without manual DB resets.

## New audit envelopes

```
admin.policy.save   { userId, role, ip, policyId, kind, action: create|update }
admin.policy.remove { userId, role, ip, policyId }
```

These are _additional_ to the generic `mutation` envelope already
captured by `mutationAuditMiddleware` and persisted to `userActionLog`
(which feeds Admin → Action Log tab). The new events live in
`app.log` only — they are the structured signal for off-app SIEM
filtering, not for the in-app log viewer.

## Test counts

| Suite                                                  | Before | After | Delta |
| ------------------------------------------------------ | -----: | ----: | ----: |
| `@customreport/api` unit                               |    695 |   710 |   +15 |
| `@customreport/web` unit                               |    292 |   292 |     0 |
| `@customreport/api` integration (44-05 file, isolated) |    n/a |     6 |    +6 |

The +15 api unit delta = 11 contract tests + 4 audit-logger tests.
Web tests stay at 292 because the policy-tab tests landed in 44-04 and
already covered save/remove/edit flows.

## Deviations from plan

- **Step 2 (wire from `admin.service`)** — moved the audit emission
  point to the tRPC router instead of `admin.service.savePolicy`
  because `ctx.auditLogger`, `ctx.session.userId`, and `ctx.ip` only
  exist at the request boundary. The service exposes a `policyExists`
  helper so the router can still detect create vs update. Semantically
  identical to the plan; structurally cleaner (no need to inject an
  `AuditLogger` into the singleton `AdminService` provider).
- **Step 5 (rewrite `reminders-tab.test.tsx`)** — skipped. The file
  already had 7 comprehensive tests from 44-04 covering the same
  acceptance criteria (save shape, remove confirm, edit populate,
  validity-window disable). No rewrite needed.
- **Step 6 (extend `action-log-tab.test.tsx`)** — skipped. The file
  doesn't exist; there is no test for the action-log tab to extend.
- **Step 4 (4 integration cases)** — landed 6 cases instead of the
  plan-specified 4. The plan listed `validUntil < deadline` but not
  `validFrom > deadline`; both gates exist in code and both got tests.
- **Inline (Rule 3) — pre-existing TS errors.** Two pre-existing
  lint-blocking errors that the prior wave never noticed (44-02 made
  `policyId` required on `AdminReminderRule` but the unit-test fixture
  didn't get the field): fixed `reminders.service.test.ts` and the
  `mutation-audit.test.ts` `AuditLogger` mock.

## Known infra issue (not introduced here)

`vitest run --config vitest.integration.config.ts` (parallel discovery
of all `*.integration.test.ts` files) shows ~26/64 failing tests due
to a shared `PrismaClient` singleton race between files —
pre-existing on `main` before this wave (verified by `git stash` +
re-run, identical failure count). Each integration test passes in
isolation. Will deferred to Phase 47 (perf pass) which is the right
place to redesign the per-suite Prisma fixture.

## Self-Check: PASSED

- file `apps/api/src/modules/reminders/reminders.policy.contract.test.ts` — FOUND
- file `apps/api/src/modules/reminders/reminders.policy.integration.test.ts` — FOUND
- commit `8b8b629` — FOUND in git log
