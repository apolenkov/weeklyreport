## ADDED Requirements

### Requirement: Hand-duplicated types and constants are recorded centralization targets

The backlog MUST record that four small groups of hand-declared types and
constants — each independently re-declared instead of importing one shared
source — are centralized: the `{shortName, fullName}` organization-brand
shape (previously `OrganizationBrand` in two email templates and
`ReminderOrganization` / `ReminderOrganizationJob` in the reminders service
and its BullMQ processor, now the single shared `OrganizationBrand` type in
`packages/shared`), the analytics chart palette (`COLORS` plus
`ChartSeries` / `ChartData`, previously duplicated between the lead-velocity
and traffic-light-history charts, now `apps/web/src/features/analytics/ui/chart-palette.ts`),
the slide-record discriminators (`getActiveItemRecord`,
`getActiveRiskRecord`, `getActiveDecisionRecord`, previously duplicated
between `slide-inline-editor-dialogs.tsx` and `use-slide-inline-editor.tsx`,
now exported once from the dialogs file), and the dev-login role picker's
role list (previously two independent literal arrays in
`login-page.client.tsx`, now `sessionRoleSchema.options`). All four are
landed by `centralize-duplicated-types`. The TARGET IS CLOSED. Print-color
tokenization and any versions/snapshots residue are explicitly out of scope
for this target — the former is a ratified intentional exception, the latter
belongs to a dropped, unrevived feature area.

#### Scenario: a maintainer looks for the duplicated-type sweep

- **WHEN** a maintainer searches the backlog for hand-duplicated types or
  constants
- **THEN** the backlog names the four centralized sites (organization-brand
  type, chart palette, slide discriminators, dev-login role list), their
  shared source locations, and records the target as closed by
  `centralize-duplicated-types`

#### Scenario: a new duplicate of one of these shapes is introduced

- **WHEN** a maintainer adds a new email template, a new analytics chart, or
  a new slide-record consumer that needs the organization-brand shape, the
  chart palette, or the active-record discriminators
- **THEN** they import the shared source (`OrganizationBrand` from
  `@customreport/shared`, `COLORS`/`ChartSeries`/`ChartData` from
  `chart-palette.ts`, or the exported discriminators from
  `slide-inline-editor-dialogs.tsx`) instead of re-declaring it
