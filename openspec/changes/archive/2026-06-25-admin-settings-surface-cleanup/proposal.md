## Why

The Admin → Settings page carries three honesty defects surfaced by live page
feedback: the Holidays sub-tab is styled as an outlined pill unlike its
underline-style siblings; the Integrations sub-tab advertises integrations that
are not on the roadmap (Slack, CI) while the one real placeholder (AI Summary)
is too narrowly named; and the Periods sub-tab mixes four consumer-less "knobs"
with eleven working ones, and its help text claims working settings are
"deferred to Phase 51-C" when their consumers already ship. The page tells the
admin things that are not true.

## What Changes

- **Holidays sub-tab restyle.** The Holidays trigger renders in the same
  underline `line` style as the other sub-tabs (no outlined pill, no fixed-width
  Calendar pill). Its nested Coming-Soon label stays inert while the trigger
  itself remains selectable like its siblings (unchanged); the Coming-Soon
  tooltip, `data-testid`, and assistive-tech accessible name are preserved.
- **Integrations sub-tab pruned to roadmapped surfaces.** **BREAKING** (UI
  contract) Remove the Slack card and the CI Integration card entirely; remove
  the undocumented `ci` field from the `admin.integrationsStatus` router payload
  and the `CI_WEBHOOK_SECRET` read. Keep Telegram (the one real integration).
  Rename the "AI Summary" card to a general **AI** integration whose scope is a
  provider/model selection applied to all AI features (summary, risk
  extraction, RAG); it stays a Coming-Soon placeholder.
- **Periods sub-tab made honest.** Remove the four period-policy fields that have
  no consumer anywhere (`firstDayOfWeek`, `deadlineDayOfWeek`, `maxOpenPeriods`,
  `requireAllSectionsToPublish`) from the form, the wire schema, the read DTO,
  and the `AppSettings` model. Rewrite the stale "deferred / values only
  round-trip / ships in Phase 51-C" help text on the eleven fields that DO have
  live consumers so it states their actual current behavior — including two
  factually-backwards strings: the reversed late-submission/grace copy and the
  false "auto-publish requires auto-create" dependency (the scheduler reads
  `autoPublishAfterDeadline` independently). Rename the save button + toast from
  "Period settings" to **"Period policy"** per CONTEXT.md.

## Capabilities

### New Capabilities

<!-- none — this is a cleanup of an existing surface -->

### Modified Capabilities

- `admin-settings-ui`: adds visual-parity requirement for the Settings sub-tab
  triggers, a roadmapped-only requirement for the Integrations cards, and a
  honest-period-policy requirement for the Periods form; the existing
  nested-interactive-element requirement is unchanged.

## Impact

- **Web**: `settings-tab.tsx` (Holidays trigger), `settings-integrations-sub-tab.tsx`
  (remove Slack + CI cards, rename AI card, drop the `ci` read + its
  eslint-disable), `settings-periods-fields-cycle.tsx` (remove 4 fields),
  `settings-periods-sub-tab.tsx` (drop 4 fields from the mutate payload),
  `mock-data.ts`, `lib/mappers/admin.ts`, `lib/mappers/admin-types.ts`.
- **API**: `trpc.router.ts` `integrationsStatus` (drop `ci` + `CI_WEBHOOK_SECRET`),
  `modules/admin/admin-settings.queries.ts` (drop the 4 fields from the read +
  PATCH writer + its TS type).
- **Shared**: `schemas/period.schema.ts` (drop the 4 fields from the settings
  update schema + type). `schemas/integrations.ts` is already `telegram`-only, so
  no contract change is needed there.
- **Prisma**: `schema.prisma` `AppSettings` (drop 4 columns + tidy the comment),
  the single init migration `20260530162224_init/migration.sql` kept in sync, and
  **both seed programs** `prisma/seed.ts` + `prisma/seed-simple.ts` (they write
  all four columns); `prisma migrate reset` + seed on the disposable dev DB per
  the MVP rule.
- **e2e catalog**: `e2e/catalog/admin.yaml` — the two scenarios asserting the four
  removed controls and the CI / Slack / "AI Summary" cards (pre-push
  catalog-drift gate).
- **Tests**: settings + scheduler integration/unit tests that seed the 4 removed
  fields in their `AppSettings` fixtures; `settings-tab.test.tsx`.
- **Spec**: `openspec/specs/admin-settings-ui/spec.md` delta.
