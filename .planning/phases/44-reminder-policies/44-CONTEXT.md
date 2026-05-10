# Phase 44: Reminder Policies — Context

**Gathered:** 2026-05-10 (in-chat surface during UFB-035 timezone work)
**Status:** Ready for planning
**Mode:** Standard horizontal — schema → contract → service → UI → tests
**Driver:** UFB-036 (admin frustration: rule-per-period model is unusable)

<domain>
## Phase Boundary

Replace the per-period `ReminderRule` admin model with a global `ReminderPolicy`
model that auto-derives per-period rules whenever a new `ReportPeriod` is
created. Today an admin must recreate the same deadline reminder every week —
the rule binds to one `reportId` (one Period). Real-world usage is a _recurring
behavior_ ("send T-24h deadline reminder for every weekly report") not a
one-shot date.

**In scope:**

- `ReminderPolicy {id, kind, offsetMinutes, timezone, audience, active}` Prisma model
- Data migration backfilling existing `ReminderRule` rows into deduped policies
- `policyId` FK on `ReminderRule` (nullable during migration window, enforced post-cutover)
- `Period.create` hook (NestJS service-layer, not DB trigger) that generates one `ReminderRule` per active policy at `period.deadline + policy.offsetMinutes` resolved in `policy.timezone`
- Backfill cron for already-open Periods so existing data is covered
- tRPC contract: `admin.savePolicy`, `admin.removePolicy`, `admin.listPolicies`
- Drop `admin.saveReminderRule` write path (read remains for visualization)
- Reminders Tab UI rework: list policies, derived rules shown read-only inside an "Active rules per period" expander
- Reuse `TIMEZONE_OPTIONS` from UFB-035 (commit `301f366`)
- Tests: contract, integration, UI

**Out of scope:**

- Multi-channel delivery (Slack/Teams) — still email-only via existing `email-reminder` BullMQ queue
- Per-group policies (one global policy applies to all groups in v8.1; per-group split is v9.0)
- Recurrence beyond weekly periods (no monthly/quarterly cadence — the weekly Period IS the cadence)
- Migrating in-flight `ReminderExecution` rows — they keep their existing `ruleId` FK
  </domain>

<decisions>
## Implementation Decisions

- **Policy is global, not per-group:** UFB-036 framing was "one configured policy → fires for every Period". Per-group differentiation is a v9.0 multi-tenancy concern; mixing it in here doubles the schema surface.

- **`offsetMinutes` (signed integer), not `offsetHours`:** signed integer keeps the math trivial in JS Date arithmetic and lets us support future "T-90min" or "T+15min" without schema change. Negative = before deadline (deadline reminder), positive = after (escalation).

- **Timezone stored, not pre-computed:** the same policy must DST-correct itself across summer/winter transitions. Storing `Europe/Moscow` and resolving `period.deadline + offset` at hook-execution time is the only correct approach. Pre-computing `fireAt` UTC at policy-creation time would freeze DST.

- **Period.create hook lives in NestJS service-layer, not DB trigger:** the trigger would need to invoke the JS-side TZ math and policy lookup; service-layer is where Prisma + Luxon live. Triggers stay reserved for true DB invariants (FK cascade, audit columns).

- **`ReminderRule` table preserved:** the BullMQ scheduler already queries `ReminderRule.findMany({ where: { fireAt: { lte: now } } })`. Replacing it would force scheduler rewrite. Keeping rule rows as derived artifacts means scheduler is unchanged.

- **Backfill is one-shot, not idempotent-on-restart:** runs once during 44-03 deploy, log-reports any conflicts, then never again. Future Period.create hook covers steady state. Idempotent backfill would need a complex "did this policy run for this period yet?" check that we don't need.

- **Migration window keeps `policyId` nullable:** lets the rollout proceed in two commits (schema first, then enforce). Reduces deploy risk if the data backfill needs adjustment.
  </decisions>

<code_context>

## Existing Code Insights

- `prisma/schema.prisma` — `ReminderRule` model lives here. Add `ReminderPolicy` and `policyId` field in 44-01.

- `apps/api/src/modules/reminders/reminders.scheduler.ts` — hourly cron, queries due rules. **Untouched** by this phase: rules are still the on-disk artifact; only their _creation_ path changes.

- `apps/api/src/modules/reminders/reminders.prisma-repository.ts:77` — `findDueDeadlineRules` and `findDueEscalationRules`. Keep as-is.

- `apps/api/src/modules/admin/admin.prisma-repository.ts:204` — current `reminderRule.findMany` for the AdminSnapshot. Replace with `reminderPolicy.findMany` in 44-02. Snapshot shape change is a coordinated breaking edit (admin tab consumes it).

- `apps/api/src/modules/admin/admin.service.ts:152` — `upsertReminderRule` lives here. Move to `upsertPolicy`. Old endpoint stays for one release as no-op throwing `MethodNotAllowed`.

- `packages/shared/src/admin/...` — `adminReminderRuleSchema` lives here; add `reminderPolicySchema`.

- `apps/web/src/components/admin/reminders-tab.tsx` — current per-period form. UFB-035 added `TIMEZONE_OPTIONS`; reuse the constant in the new policy form (44-04).

- `apps/api/src/modules/admin/admin.service.ts` — `Period`/Report creation likely lives in `weekly-report.service.ts` or a periods-specific service. Verify location in 44-03 before adding the hook.

- `apps/api/src/lib/audit-logger.ts` — existing structured event helper. Add `policySave` and `policyRemove` events in 44-05.
  </code_context>

<specifics>
## Specific Ideas

- **44-01 Prisma model:**

  ```prisma
  model ReminderPolicy {
    id             String   @id @default(uuid())
    kind           ReminderKind  // existing enum: deadline | escalation | follow_up
    offsetMinutes  Int           // negative = before deadline; positive = after
    timezone       String        // IANA, e.g. "Europe/Moscow"
    audience       ReminderAudience  // new enum: lead-with-draft | head-of-late
    active         Boolean  @default(true)
    createdAt      DateTime @default(now())
    updatedAt      DateTime @updatedAt
    rules          ReminderRule[]
  }
  // ReminderRule gains:
  //   policyId String?
  //   policy   ReminderPolicy? @relation(fields: [policyId], references: [id])
  ```

- **44-02 contract surface:**

  ```ts
  admin.listPolicies()           : ReminderPolicy[]
  admin.savePolicy(input)        : ReminderPolicy
  admin.removePolicy({ id })     : void
  // saveReminderRule kept for one release, throws MethodNotAllowed; remove in v8.2
  ```

- **44-03 Period.create hook flow:**

  ```
  PeriodService.create(input)
    → prisma.reportPeriod.create(...)
    → policies = prisma.reminderPolicy.findMany({ where: { active: true } })
    → for each policy:
        fireAtUtc = computeFireAt(period.deadline, policy.offsetMinutes, policy.timezone)
        prisma.reminderRule.create({ reportId, policyId, fireAt, kind, active: true })
  ```

  Use Luxon (`DateTime.fromJSDate(...).setZone(tz).plus({ minutes: offset })`) for DST-correct math.

- **44-04 UI:**
  - Top form: kind (select), offset (numeric input + "before/after deadline" toggle), timezone (reuse `TIMEZONE_OPTIONS`), audience (select), active toggle, Save button.
  - List below: each policy row + "▼ derived rules per period" expander showing read-only `ReminderRule[]` filtered by `policyId`.

- **44-05 tests:**
  - `reminders.policy.contract.test.ts`: zod parses, missing fields rejected, audience enum guards.
  - `reminders.policy.integration.test.ts`: create policy → create Period → assert one ReminderRule exists with correct `fireAt` (DST boundary case included).
  - `reminders-tab.test.tsx`: render policy list, click new-policy form, assert Save calls tRPC mutation.
    </specifics>

<deferred>
## Deferred Ideas

- Per-group policies (different reminder cadence for the QA group vs the Backend group). v9.0 multi-tenancy phase.
- Webhook delivery (POST to a Slack incoming webhook URL on each fire). Out of v8.1 — `email-reminder` BullMQ queue stays the only delivery path.
- "Pause for one week" toggle (e.g. holiday week skip). Manageable today by deactivating the policy for one week then re-activating; UX improvement deferred.
- Bulk policy import via JSON. Two policies (deadline T-24h, escalation T+2h) cover ~all known cases; bulk import is YAGNI.
  </deferred>

## Verification Targets

After Phase 44 lands:

```bash
# 1. Schema migrated, policies table exists
docker exec customreport-postgres-1 psql -U customreport -d customreport_dev \
  -c "\d \"ReminderPolicy\""

# 2. Backfill produced one policy per unique (kind, offsetMinutes, timezone) tuple
docker exec customreport-postgres-1 psql -U customreport -d customreport_dev \
  -c "SELECT count(*) FROM \"ReminderPolicy\";"

# 3. New Period auto-generates rules
# create a Period via admin UI → assert ReminderRule rows exist for it with policyId set

# 4. Scheduler still fires correctly
pnpm --filter @customreport/api test -- reminders.scheduler

# 5. UI shows policies, not raw rules
pnpm --filter @customreport/web test -- reminders-tab
```

## Acceptance Gate

Phase 44 closes when:

1. ✓ `ReminderPolicy` model exists with at least 2 backfilled rows (deadline + escalation policies)
2. ✓ Creating a new ReportPeriod auto-generates `ReminderRule` rows for every active policy
3. ✓ Admin UI shows a single editable list of policies; per-period rules are read-only
4. ✓ `reminders.scheduler` test still green (no rule-side regression)
5. ✓ `admin.savePolicy` covered by contract + integration tests
6. ✓ Audit log captures `admin.policy.save` and `admin.policy.remove` events
