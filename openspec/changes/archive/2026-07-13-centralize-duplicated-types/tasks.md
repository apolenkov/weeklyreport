## 1. Organization-brand type centralization

- [ ] 1.1 `packages/shared/src/schemas/organization.ts`: add
      `export type OrganizationBrand = OrganizationPublic;` next to the
      existing `OrganizationPublic` export (same `{shortName, fullName}`
      shape already validated by `organizationPublicSchema`)
- [ ] 1.2 `apps/api/src/modules/email/templates/escalation.template.tsx`:
      remove the local `OrganizationBrand` interface; import the shared type
      from `@customreport/shared` and use it in `EscalationEmailProps`
- [ ] 1.3 `apps/api/src/modules/email/templates/deadline.template.tsx`: same
      removal/import for its local `OrganizationBrand` interface
- [ ] 1.4 `apps/api/src/modules/reminders/reminders.service.ts`: remove the
      local `ReminderOrganization` interface; import the shared
      `OrganizationBrand` type and use it wherever `ReminderOrganization` was
      referenced (`DeadlineReminderPayload` and siblings)
- [ ] 1.5 `apps/api/src/infrastructure/bullmq/email-reminder.processor.ts`:
      remove the local `ReminderOrganizationJob` interface; import the shared
      `OrganizationBrand` type in its place
- [ ] 1.6 Confirm no field-shape drift: all four sites carry exactly
      `{shortName: string, fullName: string}` before and after — this is a
      type-only change, no runtime behavior difference

## 2. Analytics chart palette centralization

- [ ] 2.1 Create `apps/web/src/features/analytics/ui/chart-palette.ts`
      exporting the 6-color `COLORS` array and the `ChartSeries` / `ChartData`
      types, moved verbatim from `lead-velocity.chart.tsx`
- [ ] 2.2 `lead-velocity.chart.tsx`: remove its local `COLORS` /
      `ChartSeries` / `ChartData` declarations; import from
      `./chart-palette`
- [ ] 2.3 `traffic-light-history.chart.tsx`: remove its local `COLORS` /
      `ChartSeries` / `ChartData` declarations; import from
      `./chart-palette`
- [ ] 2.4 `period-comparison.chart.tsx` is unaffected (it does not declare
      this palette) — confirm it stays untouched

## 3. Slide-record discriminator centralization

- [ ] 3.1 In `slide-inline-editor-dialogs.tsx`, export
      `getActiveItemRecord`, `getActiveRiskRecord`, and
      `getActiveDecisionRecord` (currently module-private functions)
- [ ] 3.2 `use-slide-inline-editor.tsx`: remove its byte-duplicate copies of
      the three functions; import them from `./slide-inline-editor-dialogs`
      instead
- [ ] 3.3 Confirm no circular-import issue between the two files (the dialogs
      file must not import back from the hook file for anything else); if a
      cycle would result, relocate the three functions to a new
      dependency-free module (e.g. `slide-active-record.ts`) that both files
      import instead

## 4. Dev-login role list centralization

- [ ] 4.1 `login-page.client.tsx`: import `sessionRoleSchema` from
      `@customreport/shared`
- [ ] 4.2 Replace both `(["lead", "head", "admin", "viewer"] as const)`
      occurrences (line ~168 and ~293) with `sessionRoleSchema.options`
- [ ] 4.3 Confirm the picker's render order is unchanged (`sessionRoleSchema`
      enumerates `lead, head, admin, viewer` in the same order as the
      literals it replaces)

## 5. Spec delta

- [ ] 5.1 `architecture-refactor-backlog`: ADD a requirement recording this
      SSOT-hygiene sweep (organization-brand type, chart palette, slide
      discriminators, dev-login role list) as a centralization target closed
      by this change

## 6. Gates and verification

- [ ] 6.1 `pnpm --filter @customreport/api db:generate`
- [ ] 6.2 `pnpm typecheck && pnpm lint && pnpm test`
- [ ] 6.3 Grep sweep confirms zero remaining duplicates: `grep -rn "interface OrganizationBrand\|interface ReminderOrganization" apps/api/src`
- [ ] 6.4 Live-check: trigger a deadline reminder email and an escalation
      digest in dev (Mailpit UI `http://localhost:8025`) and confirm the
      brand strings still render correctly
- [ ] 6.5 Live-check: open `/auth/dev-login` and confirm all four role
      buttons still render in the original order
- [ ] 6.6 `openspec validate centralize-duplicated-types --strict`
- [ ] 6.7 Adversarial review of the diff before archiving
