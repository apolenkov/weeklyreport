# Phase 44 — Reminder Policies — Closeout

**Requirement:** UFB-036 (parameterized reminder templates)
**Adjacent:** NOTIF-06 (audit visibility for policy mutations)
**Status:** closed
**Waves:** 5 (44-01 → 44-05), all merged on `main`

## What this phase delivered

The reminder system used to ship with hard-coded `ReminderRule` rows
per Report — every cadence change required a schema migration and a
manual rule reseed. Phase 44 turns the rules into derived state of a
new `ReminderPolicy` template model:

```
ReminderPolicy (kind, offsetMinutes, timezone, audience,
                active, validFrom, validUntil)
        │
        ▼  PolicyApplicatorService.applyToPeriod(period)
        │  (called from Period.create hook, idempotent on
        │   uq_rule_report_policy unique index)
        ▼
ReminderRule (reportId, policyId, fireAt, kind, timezone, status)
        │
        ▼  RemindersScheduler @Cron (unchanged from prior phases)
        │
        ▼
ReminderExecution (one per delivery, dedupeKey-uniq, queued via BullMQ)
```

After 44-05, the head can edit reminder cadence end-to-end from the
Admin → Reminders tab — pick `kind`, `offsetMinutes`, `timezone`,
`audience`, validity window — and the next `Period.create` will
produce the right per-Report rules without anybody touching the DB.

## Waves at a glance

| Wave  | Commit    | What it shipped                                                                                                                                                        |
| ----- | --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 44-01 | `88bc63b` | Prisma `ReminderPolicy` model + nullable FK from `ReminderRule.policyId`                                                                                               |
| 44-02 | `9a73778` | tRPC surface: `admin.listPolicies / savePolicy / removePolicy` + zod schema with audience/kind enums                                                                   |
| 44-03 | `d8d9508` | `PolicyApplicatorService` (DST-correct `fireAt` math via Luxon) + `admin.upsertPeriod` post-create hook + `backfill-policy-rules.ts` idempotent backfill               |
| 44-04 | `ebb36c4` | `RemindersTab` UI rework: policy editor with `validFrom/validUntil` window, derived-rules read-only expander, remove confirm with rule-count warning                   |
| 44-05 | `8b8b629` | Test lock — 11 contract tests, 6 real-DB integration tests, `policySave`/`policyRemove` audit events; pre-upsert existence check feeds create vs update audit `action` |

Adjacent commits during the phase: `dee18e6` (seed hotfix, distinct
admin name), `2fa84ec` (validity-window schema extension landed
mid-phase after the plan was already in flight).

## Key architectural decisions

1. **Nullable FK on `ReminderRule.policyId`.** Allows the migration to
   land before all rules are policy-derived. Existing manual rules
   keep working; the applicator only creates new rules through the
   policy seam.
2. **Idempotency via the unique index `uq_rule_report_policy`** on
   `(reportId, policyId)`. The applicator uses an upsert against this
   index, so concurrent applications (Period.create race, backfill
   re-run) cannot duplicate rows — the second writer hits P2002 and
   logs but the row count stays one.
3. **DST-correct math centralized in `PolicyApplicatorService.computeFireAt`.**
   The deadline is stored as UTC; the math shifts into the policy's
   TZ before adding `offsetMinutes`, then back to UTC. One place to
   reason about Luxon edge cases; the unit suite locks 13 cases
   including March-30 boundary and validity-gate cross-product.
4. **Validity gate via `policyAppliesTo(policy, period)` static helper.**
   Same boolean across applicator, unit tests, integration tests, and
   the backfill script — no chance for drift between gate and
   visible-rule reality.
5. **Soft-archive over hard-delete** in `archiveReminderPolicy`. When
   derived rules exist, the policy flips to `active=false` (rules
   stay valid, lookup still works); only when zero derived rules
   reference the policy does it get hard-deleted. Prevents orphaned
   `policyId` columns silently materializing under `ON DELETE SET NULL`.
6. **Audit events live in `app.log` (44-05), not `userActionLog`.**
   The generic `mutation` envelope written by `mutationAuditMiddleware`
   already populates the in-app Action Log tab with
   `procedure='admin.savePolicy'`. The new `admin.policy.save` /
   `admin.policy.remove` envelopes are the SIEM-friendly structured
   signal — filtered by `event`, no procedure-string parsing — and
   stay out of the in-app viewer.

## UAT scenarios

Run these end-to-end on a fresh dev container after Phase 44 deploy:

1. **Create policy → Period → rule.**
   Admin → Reminders → New Policy → set `kind=deadline`,
   `offset=-1440`, `tz=Europe/Moscow`, `audience=lead-with-draft`,
   `forever` checked → Save.
   Admin → Periods → create a new Period with deadline T+10 days.
   Expand the new policy row → derived-rules table shows exactly one
   rule per Report in the new Period, `fireAt = deadline - 24h`.

2. **Validity-window gate.**
   Edit the policy → uncheck `forever` → set `validUntil` to yesterday →
   Save.
   Admin → Periods → create another Period with deadline in 7 days.
   Expand the policy → derived-rules table for that Period is empty
   (policy was archived for the new period's deadline range).

3. **DST sanity.**
   Create a Period with deadline `2026-03-30T18:00:00Z` against a
   `-1440 min Europe/Moscow` policy.
   Verify `fireAt` is `2026-03-29T18:00:00Z` (Moscow has no DST since
   Oct 2014; the math should not introduce a 1-hour shift).

4. **Audit visibility.**
   Save then remove a policy.
   Admin → Action Log tab → both events visible (rows for
   `admin.savePolicy` and `admin.removePolicy` with the admin's
   userId, correlationId, status `success`).
   Inspect `app.log` (or the configured SIEM sink) — confirm two
   additional lines tagged `event=admin.policy.save` and
   `event=admin.policy.remove`. The save line carries
   `action: create` on the first save and `action: update` on
   subsequent saves of the same id.

5. **Idempotent backfill.**
   `pnpm --filter @customreport/api exec tsx prisma/backfill-policy-rules.ts`
   on a populated DB → first run creates rules for any policy/period
   combos that lack them; second run logs `skipped` for every combo
   already covered. No duplicate `ReminderRule` rows after either run.

## Deferred / out of scope

| Item                                                                    | Plan to address                                                                           |
| ----------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| E2E Playwright spec for the policy editor (full UI flow)                | Add to TOOL-02 leaf-fix sweep when regression catches drift                               |
| Performance test for fan-out with many active policies                  | Phase 47 (perf pass) — current ceiling ≤5 policies in prod                                |
| `cleanDatabase` race when running ALL integration tests in parallel     | Phase 47 (perf pass) — design per-suite Prisma fixture; pre-existing issue                |
| Translating audit-event labels (`admin.policy.*`) in the Action Log tab | `humanizeProcedure` already splits on `.` and works correctly; no translation work needed |

## What's ready to close

```
┌─ Phase 44 closeout ─────────────────────────────────────────┐
│ ReminderPolicy model           done — 88bc63b               │
│ tRPC + zod surface             done — 9a73778               │
│ Validity window extension      done — 2fa84ec               │
│ PolicyApplicator + hook        done — d8d9508               │
│ Reminders Tab UI rework        done — ebb36c4               │
│ Audit + test lock              done — 8b8b629               │
│ Total commits (phase)          8 (6 features + 1 hotfix + 1 docs) │
│ TS strict + ESLint             clean on api + web           │
│ Unit tests                     api 710, web 292 — all green │
│ Integration (isolated)         6/6 passed for 44-05         │
└─────────────────────────────────────────────────────────────┘
```
