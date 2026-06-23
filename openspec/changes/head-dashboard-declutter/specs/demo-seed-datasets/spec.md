## ADDED Requirements

### Requirement: The small tier seeds at least one submitted lead

The `small` demo tier (`prisma/seed-demo.ts`) MUST seed at least one active-period
lead section as `submitted` so the head can see and exercise the existing per-lead
Revoke / Revoke All affordance (the form returns to Draft). This MUST NOT submit
every lead — at least one lead MUST stay draft so the period remains `open` and
both Revoke and Remind affordances are visible on one screen.

1. The submitted lead choice MUST be orthogonal to product health: it MUST NOT
   move the three-color mapping (Маркетинговый портал red, Платформа интеграций
   yellow, Внутренний BI green) required by "The small tier shows at least one
   fully-green product".
2. It MUST NOT remove any foreign co-owner content — the Mine/Everyone toggle
   scenarios in the existing small-tier requirements stay intact.
3. The choice MUST remain deterministic and idempotent: fixed ids and statuses,
   no wall-clock or random values, stable across reseed (consistent with
   `seed-determinism`).

#### Scenario: the head sees a Revoke affordance

- **WHEN** the small tier is seeded and the head opens the dashboard
- **THEN** at least one lead row shows status `Submitted` with a Revoke action
- **AND** at least one other lead row stays in progress, so the period is not
  fully submitted

#### Scenario: submission does not move product health

- **WHEN** the small tier is seeded with one submitted lead
- **THEN** Маркетинговый портал still reads blocked (red), Платформа интеграций
  still reads at-risk (yellow), and Внутренний BI still reads on-track (green)

### Requirement: The small tier seeds one active reminder rule for the active period

The `small` demo tier (`prisma/seed-demo.ts`) MUST seed one active
`ReminderPolicy` whose validity window covers the active period's deadline AND
one active `ReminderRule` scoped to `reportId = ACTIVE_REPORT_ID`, so the head's
per-lead Remind action both renders (the `hasActiveReminderRule` gate is true)
and actually dispatches a reminder (the `dispatchPending` rule lookup succeeds)
in the demo.

1. The seeded `ReminderPolicy` MUST be `active: true` with `validFrom` no later
   than the active report deadline and no `validUntil` before it, so
   `hasActiveReminderRule` resolves true.
2. The seeded `ReminderRule` MUST be `status: active`, reference
   `ACTIVE_REPORT_ID`, and carry a deterministic `fireAt` derived from the
   active period deadline (no wall-clock or random value).
3. Both rows MUST use fixed UUIDs and be idempotent across reseed (consistent
   with `seed-determinism`).

#### Scenario: the Remind action dispatches in the demo

- **WHEN** the small tier is seeded and the head triggers Remind on a draft lead
- **THEN** the reminder is dispatched (not `reason: "no-active-rule"`)

#### Scenario: reseed is deterministic

- **WHEN** the small tier is reseeded after `prisma migrate reset`
- **THEN** the same reminder policy and rule ids, statuses, and `fireAt` are
  produced, with no wall-clock or random drift
