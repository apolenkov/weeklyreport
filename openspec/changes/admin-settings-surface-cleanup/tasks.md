# Tasks — admin-settings-surface-cleanup

## 1. Holidays sub-tab restyle (→ "Settings Sub-Tab Triggers Share One Visual Style")

- [x] 1.1 In `apps/web/src/components/admin/settings-tab.tsx`, change
      `HolidaysComingSoonControl` so the inert `<span>` uses the same label
      treatment as a normal `TabsTrigger` child (drop the outlined-pill / border /
      `bg-surface-empty` / fixed-width `xl:w-[92px]` classes and the `Calendar`
      icon + its import).
- [x] 1.2 Keep the `ComingSoonTooltip` wrapper, the `sr-only` `ComingSoonBadge`,
      the `aria-disabled`, and `data-testid="holidays-coming-soon"`.
- [x] 1.3 Confirm the Holidays trigger visually matches siblings and `settings-tab.test.tsx`
      still passes (a11y name + testid assertions).

## 2. Integrations: remove Slack + CI (→ "Integrations Sub-Tab Surfaces Only Roadmapped Integrations")

- [x] 2.1 In `settings-integrations-sub-tab.tsx`, delete the Slack card block
      (`data-testid="integration-row-slack"`).
- [x] 2.2 Delete the CI Integration card block (`data-testid="integration-row-ci"`),
      the `ci` destructure, the `isCiConfigured` line, and its
      `no-unnecessary-condition` eslint-disable comment.
- [x] 2.3 In `apps/api/src/infrastructure/trpc/trpc.router.ts` `integrationsStatus`,
      remove the `ci` return branch and the `CI_WEBHOOK_SECRET` read; update the
      doc-comment.
- [x] 2.4 Grep for stray `CI_WEBHOOK_SECRET` / `integration-row-ci` /
      `integration-badge-ci` references (`.env.example`, tests) and remove them.

## 3. Integrations: reframe AI card (→ same requirement)

- [x] 3.1 In `settings-integrations-sub-tab.tsx`, rename the AI card heading
      "AI Summary" → "AI"; widen the copy to a provider/model selection applied to
      all AI features (summary, risk extraction, RAG). Keep the Coming-Soon badge
      and the placeholder Provider / RAG rows. English strings only.
- [x] 3.2 Keep `data-testid="integration-row-ai"` / `integration-badge-ai`
      (rename only if a test asserts the old heading text — update the test then).

## 4. Periods: remove the 4 dead fields (→ "Period Policy Form Exposes Only Live Fields…")

- [x] 4.1 `settings-periods-fields-cycle.tsx`: delete the `firstDayOfWeek`
      fieldset, the `deadlineDayOfWeek` select, the `maxOpenPeriods` input, and the
      `requireAllSectionsToPublish` checkbox. Keep `deadlineTime`,
      `allowReopenAfterPublish`, `reopenWindowHours`.
- [x] 4.2 `settings-periods-sub-tab.tsx`: drop those four keys from the
      `updateSettingsMut.mutate({...})` payload.
- [x] 4.3 `packages/shared/src/schemas/period.schema.ts`: drop the four fields
      from the settings-update schema + its inferred type.
- [x] 4.4 `apps/api/src/modules/admin/admin-settings.queries.ts`: drop the four
      fields from the row→DTO read, the PATCH writer (`dbData.*` guards), and the TS
      type.
- [x] 4.5 Web mappers + mock: `lib/mappers/admin.ts`, `lib/mappers/admin-types.ts`,
      `components/admin/mock-data.ts` — drop the four fields from the `MockSettings`
      type and defaults.
- [x] 4.6 `prisma/schema.prisma`: drop the four `AppSettings` columns and tidy the
      surrounding comment so it no longer lists them.
- [x] 4.7 `prisma/seed.ts` (both `AppSettings` write branches, ~lines 1343-1366)
      and `prisma/seed-simple.ts` (~line 364): drop the four columns from the
      upsert/create data.
- [x] 4.8 Hand-sync `prisma/migrations/20260530162224_init/migration.sql` to match,
      then `prisma migrate reset` + seed on the disposable dev DB (pass
      `PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION`); confirm the seed succeeds.

## 5. Periods: make the help text honest (→ "…Each working field's copy matches its real behavior")

- [x] 5.1 **Late-submission copy is reversed — correct it.** In
      `settings-periods-fields-base.tsx`, the `gracePeriodHours` and
      `allowLateSubmissions` strings contradict `report-sections.service.ts`: the
      grace window is ALWAYS honored, and `allowLateSubmissions` governs only whether
      submission is accepted AFTER the grace window. Rewrite both to match.
- [x] 5.2 **Remove the false auto-publish dependency.** In
      `settings-periods-fields-base.tsx`, drop the `disabled={!draft.autoCreatePeriods}`
      guard, the `opacity-60` wrapper, and the "Requires «Auto-create periods»" note on
      the `autoPublishAfterDeadline` checkbox; the scheduler reads it independently.
      Rewrite its help text to state the hourly auto-publisher publishes any
      still-draft period once `deadline + grace` has passed.
- [x] 5.3 **`deadlineTime` honest copy.** State it is the manual-creation default
      applied at whole-hour precision (minutes ignored), and that scheduled
      auto-creation currently uses a fixed 18:00.
- [x] 5.4 Rewrite the remaining deferral-claiming strings/banners (workingDays
      "Metadata only in v1…", reopen "Window enforcement ships in Phase 51-C", the
      section banner "values only round-trip / Phase 51-C") to state real behavior.
      English only.

## 5b. Period-policy save copy rename (→ "Period-policy save affordance uses canonical language")

- [x] 5b.1 `settings-periods-sub-tab.tsx`: rename the button label, the
      `aria-label`, the success text, and the `useUpdateSettingsMut("Period settings")`
      label from "Period settings" → "Period policy".

## 6. Durable scenario catalog (→ all three requirements)

- [x] 6.1 `e2e/catalog/admin.yaml`: (a) update the Settings → Periods scenario so it
      no longer asserts the four removed controls, reflects the "Save Period Policy" /
      "Period policy saved" copy (was "Save Period Settings" / "Period settings
      saved", ~line 152), and drops the false auto-publish "requires Auto-create"
      note; (b) update the Integrations scenario (~line 174) so it asserts Telegram +
      AI (renamed) only — no CI, no Slack, no "AI Summary". Re-run
      `e2e/sweep/catalog-check.mjs` before pushing.

## 7. Tests + gates

- [x] 7.1 Update every test that asserts the four removed fields or `ci`:
      API fixtures `admin-settings.integration.test.ts`, `admin.service.test.ts`,
      `stage-assignment.integration.test.ts`, and the scheduler tests
      (`period-creator.scheduler.test.ts`, `auto-publisher.scheduler.test.ts`,
      `auto-archiver.scheduler.test.ts`); shared `schemas/report.test.ts` (~1393) and
      `schemas/integrations.test.ts` (if it asserts `ci`); web mapper test
      `lib/mappers/admin.test.ts` (~279) that asserts the deleted fields.
- [x] 7.2 Update/extend `settings-tab.test.tsx` (note existing period-field +
      auto-publish assertions ~line 358) for: the Holidays parity, the absence of
      Slack/CI cards, the AI rename, the removed 4 period fields, the dropped
      auto-publish disabled-dependency, and the "Period policy" save copy.
- [x] 7.3 Run gates: `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`.
- [x] 7.4 Grep sanity: `firstDayOfWeek|deadlineDayOfWeek|maxOpenPeriods|requireAllSectionsToPublish`
      returns no production hits outside an intentional historical reference;
      `ci|CI_WEBHOOK_SECRET` returns no integrations hits.
- [x] 7.5 `openspec validate "admin-settings-surface-cleanup" --strict` is clean.

## Implementation status (verified 2026-06-26)

Implemented; ALL gates green:

- typecheck, lint, build.
- pnpm test (web 1304 + api + shared, non-integration).
- API integration suite: 25 files / 142 tests passed (1 skipped: telegram real-bot).
- prisma migrate reset + full seed succeeded with the 4 columns dropped.
- e2e/sweep/catalog-check.mjs: no drift.
- production grep clean; openspec validate --strict clean.

Docker postgres + redis were started for the DB gates.
