## Why

Wave 3 / P3 from the 2026-07-12 repo-excellence review (docs/reviews/repo-excellence-review-2026-07-12.md).

Four small groups of hand-declared types and constants are byte- or
near-byte-duplicated instead of importing one shared source, risking silent
drift on the next edit:

- The `{shortName, fullName}` organization-brand shape is independently
  hand-declared as `OrganizationBrand` in
  `apps/api/src/modules/email/templates/escalation.template.tsx` and
  `deadline.template.tsx`, and again as `ReminderOrganization` /
  `ReminderOrganizationJob` in `apps/api/src/modules/reminders/reminders.service.ts`
  and `apps/api/src/infrastructure/bullmq/email-reminder.processor.ts` — four
  structurally identical interfaces where `packages/shared` already owns the
  equivalent shape (`OrganizationPublic`, `organizationPublicSchema`).
- The 6-color chart palette and `ChartSeries`/`ChartData` types are
  byte-duplicated between
  `apps/web/src/features/analytics/ui/lead-velocity.chart.tsx` and
  `traffic-light-history.chart.tsx`.
- The three `getActive{Item,Risk,Decision}Record` discriminators are
  byte-duplicated between
  `apps/web/src/features/report-sections/ui/slide-inline-editor-dialogs.tsx`
  (their original home) and `use-slide-inline-editor.tsx`.
- The dev-login role picker in `apps/web/src/app/login-page.client.tsx`
  hardcodes `["lead", "head", "admin", "viewer"] as const` twice instead of
  reading the canonical session-role list from `@customreport/shared`.

## What Changes

- Add a shared `OrganizationBrand` type alias in `packages/shared`
  (`schemas/organization.ts`, aliasing the existing `OrganizationPublic`
  shape) and have `escalation.template.tsx`, `deadline.template.tsx`,
  `reminders.service.ts`, and `email-reminder.processor.ts` import it instead
  of hand-declaring their own `{shortName, fullName}` interface.
- Add `apps/web/src/features/analytics/ui/chart-palette.ts` exporting the
  6-color `COLORS` array plus the `ChartSeries` / `ChartData` types; both
  `lead-velocity.chart.tsx` and `traffic-light-history.chart.tsx` import from
  it instead of re-declaring them.
- Export `getActiveItemRecord`, `getActiveRiskRecord`, and
  `getActiveDecisionRecord` from `slide-inline-editor-dialogs.tsx` (their
  original home) and have `use-slide-inline-editor.tsx` import them instead
  of re-declaring the discriminators.
- Replace both hardcoded `["lead", "head", "admin", "viewer"] as const` role
  arrays in `login-page.client.tsx` with `sessionRoleSchema.options` from
  `@customreport/shared` (the session axis, matching the `role-type` spec's
  existing axis rule for session-sourced UI values).
- Explicitly out of scope: print-color tokenization (ratified as
  intentionally left as-is) and any versions/snapshots residue — neither is
  touched by this change.
