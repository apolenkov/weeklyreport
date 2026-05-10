---
phase: 48
title: Identity, Settings, Role Consistency
status: complete
plans: [48-A, 48-B, 48-C]
commits:
  - 3da9e4b # 48-C role-gate
  - 4abdaa6 # 48-A organization identity
  - c467388 # 48-B AppSettings expansion + 3 Settings tabs
---

# Phase 48 — Identity, Settings, Role Consistency

## Objective

Stop hard-coding "PEO / Core Development" in the chrome and the report
header; let admins configure organisation identity, period defaults, and
notification settings without a redeploy. At the same time, fix the role
visibility gaps where lead/viewer accounts saw admin-only links and a
sender bypassed the policy gate when emitting reminders.

Three plans, one outcome:

```
[48-C role-gate] ──┐
[48-A identity]  ──┼─ parallel ─→ [48-B settings] → admin tunes prod live
                                      ▲
                                      │
                          relies on 48-A's tab layout
```

48-A and 48-C were independent and shipped first; 48-B builds on the
tabbed Settings layout 48-A introduced.

## Plans Shipped

| Plan | Tag               | Commit    | What it delivered                                                                                                                                                                                                                                                 |
| ---- | ----------------- | --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 48-C | UFB-038 / UFB-040 | `3da9e4b` | Role-gated admin links in nav-bar + policy-driven `canSendReminder` (no per-rule sender bypass).                                                                                                                                                                  |
| 48-A | UFB-047           | `4abdaa6` | `Organization` singleton (shortName + fullName), landing-page rebrand, Settings restructured into 4-tab layout (Identity / Periods / Reminders / Notifications), Identity tab wired to the new `admin.getOrganization` / `admin.updateOrganization` tRPC surface. |
| 48-B | UFB-048           | `c467388` | 9 new AppSettings fields + `WorkingDays` enum + 6 new Periods controls + Reminders defaults sub-tab + Notifications from-email sub-tab + ReminderPolicy form prefill.                                                                                             |

## Tech Stack — Net Additions

| Layer         | What was added                                                                                                                                |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Prisma        | `Organization` model (48-A); `WorkingDays` enum + 9 columns on `AppSettings` (48-B).                                                          |
| Shared zod    | `organizationSchema` (48-A); `workingDaysSchema`, `reminderAudienceWireSchema`, expanded `appSettingsSchema` (48-B).                          |
| API           | `admin.getOrganization` / `admin.updateOrganization` (48-A); `WorkingDays` wire ↔ Prisma mappers + `rowToAppSettings` helper (48-B).          |
| Web           | Tabbed Settings (48-A); Identity sub-tab (48-A); Periods/Reminders/Notifications sub-tabs (48-B); `timezone-options.ts` shared module (48-B). |
| Role guards   | nav-bar consumes `auth.me` role to hide admin-only links (48-C).                                                                              |
| Policy gating | `canSendReminder` resolves through the policy chain instead of per-rule bypass (48-C).                                                        |

## Test Counts — Cumulative

| Suite                             | Pre-Phase 48 | Post-Phase 48 |   Delta |
| --------------------------------- | -----------: | ------------: | ------: |
| `@customreport/shared`            |          437 |           462 |     +25 |
| `@customreport/api` (unit)        |          720 |           730 |     +10 |
| `@customreport/api` (integration) |           60 |            65 |      +5 |
| `@customreport/web`               |          296 |           318 |     +22 |
| **Total delta**                   |              |               | **+62** |

(Per-plan deltas: 48-A +18 web, +6 shared, +4 api unit; 48-C +14 shared,
+5 api unit, +5 api integration, +1 web; 48-B +8 shared, +1 api unit,
+1 api integration, +7 web. Sums match within rounding for shared
because some 48-A tests were cross-cutting.)

## UAT Scenarios — by Role

### Head (apolenkov + 1 head per group)

1. Open `/` (landing) — hero shows the organisation full name from the
   singleton (PEO default; admin override possible).
2. Open `/admin?tab=settings` — tabs visible: Identity / Periods /
   Reminders / Notifications.
3. Identity tab — short/full names load from `admin.getOrganization`;
   edit + Save → toast «Organization identity saved» + nav-bar pill
   updates on the next page render.
4. Periods tab — change `periodLengthDays = 14`, `gracePeriodHours = 48`,
   toggle `allowLateSubmissions = false`; Save → toast «Period settings
   saved»; refresh — values persist.
5. `autoPublishAfterDeadline` toggle is **disabled** until `autoCreatePeriods`
   is on; help text states scheduler is deferred.
6. Reminders tab — change `defaultTimezone = Asia/Yekaterinburg`,
   `defaultReminderAudience = head-of-late`; Save.
7. Reminders tab → `/admin?tab=reminders` → «New Policy» — timezone select
   pre-selects `Asia/Yekaterinburg`, audience pre-selects `head-of-late`.
8. Notifications tab — enter `reports@peo.local`, Save → success toast;
   clear the field, Save → success (sends `null`).
9. Send a reminder via the Reminders tab — head can send as long as the
   policy chain allows (UFB-040 gating).

### Admin (heads also have admin permissions in this app)

- All head scenarios apply.
- Plus: nav-bar admin link visible (UFB-038).
- Plus: «Audit log» tab visible if applicable.

### Lead (6 leads, one per reporting group)

1. nav-bar shows Reports / Profile only — admin link **hidden** (UFB-038).
2. Direct visit to `/admin` → 403 (role guard).
3. Lead sees the head-saved identity in the report header (no override
   in the lead view).
4. With `allowLateSubmissions = true` + grace = 24h, lead submitting
   25h past deadline → «late» badge but accepted; with the toggle off →
   submission blocked at the API.

### Viewer (Дарья)

1. nav-bar admin link **hidden** (UFB-038).
2. Visits a published report — shows the new identity in the header.
3. Views are scoped to the `ViewerGroupAccess` rows; UFB-040 ensures
   she cannot fire reminders even if she crafts a request manually.

## Deferred Items

These were intentionally **not** shipped in Phase 48 and are queued for
follow-up plans:

| Item                                       | Owner plan                | Why deferred                                                                                                                                                                                           |
| ------------------------------------------ | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Drop `AppSettings.departmentName`          | follow-up                 | One release of co-existence with `Organization.fullName` so `lead-form` and `weekly-report` consumers can rewire one at a time without a flag flip.                                                    |
| BullMQ payload `org` propagation           | follow-up                 | Reminder/escalation email job payloads should carry `org.shortName` + `org.fullName` so MailHog templates render the new identity end-to-end. Currently emails read from `AppSettings.departmentName`. |
| `autoPublishAfterDeadline` scheduler logic | follow-up (cron consumer) | Toggle is persisted in 48-B but no cron actually fires `deadline + grace` to auto-publish missing-section periods yet. UI help text says so.                                                           |
| `workingDays` deadline-math change         | future plan               | Currently metadata only; deadline math hard-codes Mon-Fri. Will need a calendar utility refactor + audit of every `addBusinessDays`-like call site.                                                    |
| `autoArchiveWeeksAfterPublish` consumer    | follow-up                 | Toggle persists, but no batch job actually filters/archives published periods after N weeks.                                                                                                           |

## Decisions Log

1. **`Organization` is a singleton, not a tenancy table.** `id='singleton'`
   via Prisma default. Future multi-tenant migration adds rows; no DB
   CHECK constraint blocks that path.
2. **`AppSettings.departmentName` co-exists with `Organization.fullName`
   for one release.** Admins are warned via a banner; consumers migrate
   one PR at a time.
3. **Wire format stays lowercase-hyphen on both `ReminderAudience` and
   `WorkingDays`.** The screaming-snake DB convention is contained in
   the repository layer; nothing past the API boundary sees it.
4. **`autoPublishAfterDeadline` ships as a UI-only toggle in 48-B.**
   Decoupling the toggle from the scheduler implementation lets the
   product team validate the UX independently of the cron rollout.
5. **Per-tab PATCH semantics on Save.** Each Settings sub-tab sends only
   its own fields. Two admins editing different sub-tabs concurrently
   never clobber each other's input.
6. **`canSendReminder` is policy-driven, not sender-role-driven.** UFB-040
   removes the sender-id bypass that allowed any session-id to fire a
   reminder if it was attached to the rule.

## Phase Status

```
┌─ Phase 48 ─────────────────────────┐
│ 48-A  identity      ✓ shipped      │
│ 48-B  settings      ✓ shipped      │
│ 48-C  role-gate     ✓ shipped      │
│ Phase 48            ✓ COMPLETE     │
└────────────────────────────────────┘
```

Three plans, three commits, no rollback steps required. Ready for next
phase planning.
