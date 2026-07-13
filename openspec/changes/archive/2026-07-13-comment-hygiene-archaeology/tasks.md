## 1. Strip archaeology tags

- [ ] 1.1 `apps/api/src/modules/telemetry/telemetry.service.test.ts:42`: rename
      the `describe("TelemetryService — Phase 52-C (UFB-054)", ...)` block to
      drop the `Phase 52-C (UFB-054)` suffix
- [ ] 1.2 `apps/web/src/features/analytics/ui/charts.test.tsx:125`: rename the
      `it(...)` title to drop the trailing `(CONTEXT D-3)`
- [ ] 1.3 `apps/web/src/styles/app.css:159`: drop the `SDLC-1 (Phase 33-04)`
      prefix from the pulsing-red-dot comment, keeping the rationale
- [ ] 1.4 `apps/web/src/styles/app.css:200`: drop the `D-27/D-36` tag from the
      `box.y must be < 200px` comment, keeping the constraint
- [ ] 1.5 `apps/web/src/styles/pulse.css:5`: drop `Phase 58` from the rebrand
      comment, keeping the "«Your PULSE?» rebrand" rationale and the
      load-bearing 2026-06-23 removal date
- [ ] 1.6 `apps/web/src/styles/pulse.css:73`: drop `UFB-062:` from the tagline
      comment, keeping "cycling with fade"

## 2. Correct stale/misleading comments (schema, admin, reminders)

- [ ] 2.1 `prisma/schema.prisma:680`: rewrite the `AppSettings`/`Organization`
      comment block — state that `prisma/seed.ts` provisions the singleton
      rows, not the init migration (the squashed migration has zero DML);
      keep the field-semantics documentation (`workingDays`,
      `gracePeriodHours`, `allowLateSubmissions`, `autoPublishAfterDeadline`)
      unchanged
- [ ] 2.2 `apps/api/src/modules/admin/admin-period-lifecycle.ts:44`: correct
      `createPeriodManual`'s docstring — remove the "No PolicyApplicator call
      here" claim and state that it applies the policy through the repo's
      wrapper, matching current behavior
- [ ] 2.3 `apps/api/src/modules/reminders/policy-applicator.service.ts:14-15`:
      drop the stale "`prisma/backfill-policy-rules.ts` iterates over open
      periods and calls `applyToPeriod`" lifecycle bullet; replace it with a
      note that the backfill script duplicates this method's math rather
      than calling it
- [ ] 2.4 `apps/api/src/modules/reminders/policy-applicator.service.ts:34-40`:
      replace the `computeFireAt` docstring's "DST-correct fireAt math" framing
      with an accurate one — the method computes an exact-duration offset
      from the deadline after shifting into the policy's timezone
      (`setZone(tz).plus({minutes}).toUTC()`), not DST-aware wall-clock math
- [ ] 2.5 `prisma/backfill-policy-rules.ts:43-49`: remove the unused `_tz`
      parameter from `computeFireAt` and its call site; correct the inline
      comment to state plainly that this duplicates
      `PolicyApplicatorService.computeFireAt`'s math on raw UTC offsets,
      instead of implying timezone awareness
- [ ] 2.6 `apps/api/src/modules/reminders/reminders-escalation-grouping.ts:80`:
      replace the fabricated `sectionTitle: \`Report ${report.id} section\``    with the section's actual title, falling back to a generic label
(e.g.`"Untitled section"`) only when the section has none

## 3. Fix the 403 copy and other small drifts

- [ ] 3.1 `apps/web/src/shared/ui/forbidden-page.tsx`: rewrite the body
      copy to drop "Switch role from the dev role switcher in the top
      navigation to continue" — keep only the role-name sentence and the
      "head back to the dashboard" affordance, so the copy is accurate in
      every environment (dev, UAT, prod)
- [ ] 3.2 `apps/web/src/app/print/[reportId]/print-report-template.tsx:521`:
      format the footer timestamp for display instead of rendering the raw
      `new Date().toISOString()` string (no change to print-color styling)
- [ ] 3.3 `apps/web/src/app/(app)/lead/report/[reportId]/preview/page.tsx:51`:
      wrap `reportId` in `encodeURIComponent` when building the "Back to
      form" `href`, matching the sibling route's existing pattern
- [ ] 3.4 `apps/web/src/features/organization/ui/settings-identity-sub-tab.tsx:86`:
      import `MAX_SHORT_NAME_LENGTH` from `@customreport/shared` and use it
      for both the input's `maxLength` and the "(max 16 chars)" helper text,
      removing the duplicated literal `16`

## 4. Spec deltas

- [ ] 4.1 `lint-max-strictness-standard`: ADD a requirement that comments and
      docstrings must state facts matching current code, not stale claims
- [ ] 4.2 `ui-role-route-access`: ADD a requirement that `ForbiddenPage` copy
      stays environment-agnostic (no dev-only affordance referenced)

## 5. Verification

- [ ] 5.1 `grep -rnE 'Phase [0-9]|UFB-[0-9]|SDLC-[0-9]|CONTEXT [A-Z]-[0-9]|D-[0-9]+/D-[0-9]+' apps apps/web/src/styles prisma` returns no hits in the six swept files
- [ ] 5.2 `pnpm --filter @customreport/api db:generate`
- [ ] 5.3 `pnpm typecheck && pnpm lint && pnpm test`
- [ ] 5.4 Live-check: request a lead-only route as `head` or `admin` via
      dev-login and confirm the 403 wall no longer mentions the dev role
      switcher
- [ ] 5.5 `openspec validate comment-hygiene-archaeology --strict`
