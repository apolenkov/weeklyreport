---
phase: 44
plan: 44-04
subsystem: web/admin
tags: [UFB-036, reminders, policy-editor, ui]
requires: [44-02, 44-03]
provides: [reminders-tab-policy-editor, derived-rules-panel]
affects: [reminderPolicySchema, adminReminderRuleSchema]
key-files:
  created:
    - apps/web/src/components/admin/derived-rules-panel.tsx
  modified:
    - apps/web/src/components/admin/reminders-tab.tsx
    - apps/web/src/components/admin/reminders-tab.test.tsx
    - apps/web/src/components/admin/admin-panel.tsx
    - apps/web/src/components/admin/mock-data.ts
    - apps/web/src/lib/mappers/admin.ts
    - apps/web/src/lib/mappers/index.ts
    - packages/shared/src/admin/reminder-policy.schema.ts
    - packages/shared/src/schemas/report.ts
    - apps/api/src/modules/admin/admin.prisma-repository.ts
    - apps/api/src/modules/admin/admin.service.test.ts
    - apps/api/src/modules/reminders/reminders.contract.test.ts
    - apps/api/src/modules/reminders/reminders.scheduler.test.ts
decisions:
  - Validity window edited via "forever" checkbox + conditional date input; Save disabled when validUntil < validFrom (no toast spam)
  - Pre-44-01 rules with policyId=null are filtered out of the expander rather than dumped under a synthetic "orphans" bucket — they still exist in the DB and the rule scheduler still runs them, they just have no policy row to attach to in the UI
  - validFrom/validUntil added to reminderPolicySchema with z.coerce.date() defaults so older fixtures and in-memory test repos parse without per-fixture edits
metrics:
  duration_minutes: ~25
  completed: 2026-05-10T18:52:00Z
  commit: ebb36c4
---

# Phase 44 Plan 44-04: Reminders Tab Policy Editor — Summary

Rebuild Reminders Tab as a ReminderPolicy editor (UFB-036). Top: policy list + add/edit form including the Phase-44 scope-extension validity window. Each row: expander with read-only derived rules from PolicyApplicator (44-03). Schema-side: surface `validFrom`/`validUntil` on the wire and add `policyId` to the rule schema so the UI can group derived rules under their owning policy.

## ASCII sketch — new form layout

```
┌─ Reminder Policies (2 policies) ─────────────────────────────────────┐
│ [Search reminder policies…]                       [ + New Policy ]  │
├──────────────────────────────────────────────────────────────────────┤
│ ┌─ form ──────────────────────────────────────────────────────────┐ │
│ │ Kind                Offset (min)        Timezone                │ │
│ │ [deadline ▾]        [24] [before ▾]     [Europe/Moscow ▾]       │ │
│ │                                                                 │ │
│ │ Audience            Valid from          Valid until             │ │
│ │ [lead-with-draft ▾] [2026-05-10]        ☑ forever (no end date) │ │
│ │                                         (date input hidden)     │ │
│ │                                                                 │ │
│ │ ☑ Active            [Cancel]   [Create policy]                  │ │
│ └─────────────────────────────────────────────────────────────────┘ │
│                                                                      │
│ Kind     │ Offset │ TZ            │ Audience        │ Validity         │ Status   │ Actions                  │
│ deadline │ T-24h  │ Europe/Moscow │ lead-with-draft │ since 2026-05-01 │ Active   │ [Show rules (1)] [Edit] [Remove] │
│   └─ Week 19 (2026-05-04 → 2026-05-10) · deadline · 2026-05-07 10:00 UTC · Active                          │
│ escalation │ T+2h │ Europe/Moscow │ head-of-late    │ 2026-05-01 →     │ Disabled │ [Show rules (0)] …       │
│            │      │               │                 │ 2026-12-31       │          │                          │
└──────────────────────────────────────────────────────────────────────┘
```

## Files changed (13)

- **New**: `apps/web/src/components/admin/derived-rules-panel.tsx` — read-only table of per-period derived rules (period label, kind, fireAt UTC + tz, active badge); empty-state hint when no rules yet.
- **Rewrite**: `apps/web/src/components/admin/reminders-tab.tsx` (1007 lines) — `RemindersTab` now takes `policies`, `derivedRulesByPolicyId`, `periods`. Form has kind/offset/timezone/audience/active + validFrom/validUntil ("forever" checkbox). Save disabled when validity invalid. Wires `admin.savePolicy` / `admin.removePolicy`; on success invalidates `admin.snapshot`.
- **Rewrite**: `apps/web/src/components/admin/reminders-tab.test.tsx` — 7 tests (list render, empty-state, save payload shape, validity guard, expander + derived rules, derived-rules-empty hint, remove dialog with derived count, edit populates form).
- **Edit**: `apps/web/src/components/admin/admin-panel.tsx` — group `data.reminders` by `policyId` and pass through.
- **Edit**: `apps/web/src/components/admin/mock-data.ts` — add `MockReminderPolicy` type, add `policyId: string | null` to `MockReminder`.
- **Edit**: `apps/web/src/lib/mappers/admin.ts` — add `MockReminderPolicy`, `mapReminderPolicy()`, `AdminReminderPolicyFormInput`, `toReminderPolicyInput()`. Add `policies` to `MappedAdminSnapshot`. Map `policyId` on `MockReminder`.
- **Edit**: `apps/web/src/lib/mappers/index.ts` — re-export new types/helper.

### Schema/repository (Rule-2 scope-extension on read path)

- **Edit**: `packages/shared/src/admin/reminder-policy.schema.ts` — `validFrom: z.coerce.date().default(() => new Date())`, `validUntil: z.coerce.date().nullable().default(null)`.
- **Edit**: `packages/shared/src/schemas/report.ts` — `adminReminderRuleSchema.policyId: z.string().uuid().nullable().default(null)`.
- **Edit**: `apps/api/src/modules/admin/admin.prisma-repository.ts` — surface `validFrom`/`validUntil` on read+write of policies, and surface `policyId` when listing rules.
- **Edit**: 3 api tests — explicit `policyId: null` on inline `AdminReminderRule` fixtures (the schema default covers JSON wire input; inline TS literals still need the field for the type to satisfy structural typing).

## Mapper additions

| Helper                                     | Direction | Notes                                                                          |
| ------------------------------------------ | --------- | ------------------------------------------------------------------------------ |
| `MockReminderPolicy`                       | type      | 1:1 with `reminderPolicySchema`; `validFrom: Date`, `validUntil: Date \| null` |
| `mapReminderPolicy(api)`                   | read      | Field-for-field; preserves Date                                                |
| `AdminReminderPolicyFormInput`             | type      | Form-state shape with `validFromIso`/`validUntilIso` strings                   |
| `toReminderPolicyInput(form, existingId?)` | write     | YYYY-MM-DD → midnight-UTC Date; `validUntilIso === null` → `validUntil: null`  |

## Test coverage (web)

| File                              | Tests           | Status   |
| --------------------------------- | --------------- | -------- |
| `reminders-tab.test.tsx`          | 7 (Phase 44-04) | all pass |
| Web suite total                   | 292/292         | all pass |
| API suite total                   | 695/695         | all pass |
| Lint (`tsc --noEmit && eslint .`) | —               | clean    |

New tests assert:

1. Policy list renders kind / offset (T-24h / T+2h) / audience / validity (forever vs `→`).
2. Empty-state copy when no policies.
3. "New Policy" → form opens → Save fires mutation with correct payload (id, kind, offsetMinutes, timezone, audience, active=true, validFrom Date, validUntil null).
4. validUntil < validFrom → Save disabled, hint shown.
5. Expander click → derived-rules table shows period label + kind + tz.
6. Expander click on policy with no derived rules → empty hint.
7. Remove → confirm dialog mentions derived rule count → confirm fires removeMutation with `{ id }`.
8. Edit on existing policy → form populated; "forever" unchecked when validUntil set.

## Deviations from plan

### Rule 2 (auto-add missing critical functionality)

**1. `validFrom`/`validUntil` on `reminderPolicySchema`** — plan extension noted these were added to the model in commit `2fa84ec` but the wire schema and repository read path did not yet surface them. Without these the editor cannot round-trip the validity window. Added with `z.coerce.date()` defaults so older fixtures continue to parse.

**2. `policyId` on `adminReminderRuleSchema`** — needed to group derived rules under their owning policy in the read-only expander. Made nullable with `default(null)` so legacy rules and pre-44-01 fixtures still validate. `AdminPrismaRepository.listReminderRules` now passes `rule.policyId` through.

**3. Inline TS fixtures in 3 api tests** — `AdminReminderRule` literal fixtures needed `policyId: null` added explicitly (TS structural typing, the schema default only covers JSON wire input). Mechanical change, no behavior shift.

### Plan-spec extras

The plan steps mentioned only `kind / offset / timezone / audience / active` for the form. The validity window (`validFrom`/`validUntil` + "forever") was added per the executor brief because the Phase-44 scope-extension landed those columns. Form layout reflects the brief, not the original step-3 ASCII.

## Docker post-conditions

Web container has source bind-mounted, so HMR picks up the rewrite. Shared types changed (`reminderPolicySchema`, `adminReminderRuleSchema`), so on next dev session run `docker compose restart web api` to clear stale `--watch` caches if HMR misbehaves (per project memory `feedback_docker_dev_stale_code.md`).

## Self-Check: PASSED

- File `apps/web/src/components/admin/derived-rules-panel.tsx` exists.
- File `apps/web/src/components/admin/reminders-tab.tsx` modified.
- Commit `ebb36c4` exists in `git log`.
- `pnpm --filter @customreport/web test` → 292/292 pass.
- `pnpm --filter @customreport/web lint` → clean.
- `pnpm --filter @customreport/api test` (admin.service / reminders.\*) → 695/695 pass.
