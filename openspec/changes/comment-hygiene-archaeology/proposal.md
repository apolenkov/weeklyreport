## Why

Wave 3 / P3 from the 2026-07-12 repo-excellence review (docs/reviews/repo-excellence-review-2026-07-12.md).

Several comments, docstrings, and one user-facing string across the repo
either carry banned change-log/ticket/phase tags or no longer match the code
they sit next to:

- Six comments/test-titles embed archaeology-style identifiers
  (`Phase 52-C (UFB-054)`, `CONTEXT D-3`, `SDLC-1 (Phase 33-04)`, `D-27/D-36`,
  `Phase 58`, `UFB-062`) that CLAUDE.md's comment-hygiene rule bans — git
  history already holds that provenance.
- `schema.prisma`'s `AppSettings`/`Organization` comments claim the init
  migration seeds/updates the singleton rows; the squashed migration carries
  zero DML, `seed.ts` provisions them instead.
- `admin-period-lifecycle.ts`'s docstring says manual period creation skips
  the `PolicyApplicator`; the repo wrapper it calls applies it.
- `policy-applicator.service.ts`'s class docstring lists
  `prisma/backfill-policy-rules.ts` as calling `applyToPeriod`; the backfill
  script has always carried its own duplicated `computeFireAt`, never called
  the service. A prior finding (BL-19) suspected this duplication silently
  corrupts DST-observing policies on rerun; adversarial verification refuted
  that — `PolicyApplicatorService.computeFireAt` does exact-duration minute
  math (`setZone(tz).plus({minutes}).toUTC()`), not DST-aware wall-clock
  math, so the two implementations already agree on every input, and the
  backfill's upsert is a no-op rerun. What remains is the stale "calls
  applyToPeriod" claim, the service's misleading "DST-correct wall-clock"
  self-description, and the backfill's dead `_tz` parameter.
- `ForbiddenPage`'s 403 copy tells every denied visitor to "switch role from
  the dev role switcher in the top navigation" — a dev-only affordance
  (`NEXT_PUBLIC_DEV_ROLE_SWITCHER`) that does not exist in a real deployment,
  actively misdirecting a denied production user.
- Four smaller drifts: the print footer renders a raw `toISOString()`
  timestamp instead of a formatted one; the lead preview's "Back to form"
  link builds its `href` without `encodeURIComponent` while its sibling
  route does; the org short-name input's `maxLength={16}` and its helper
  text duplicate the `16` already named by `MAX_SHORT_NAME_LENGTH` in
  `packages/shared/src/schemas/organization.ts`; and the reminders
  escalation grouping fabricates `sectionTitle: "Report <uuid> section"`
  instead of using the section's actual title.

## What Changes

- Strip the phase/ticket prefixes from the six archaeology-tagged
  comments/test titles, keeping only the load-bearing rationale (including
  the load-bearing 2026-06-23 removal date already present in
  `pulse.css`):
  `apps/api/src/modules/telemetry/telemetry.service.test.ts`,
  `apps/web/src/features/analytics/ui/charts.test.tsx`,
  `apps/web/src/styles/app.css`, `apps/web/src/styles/pulse.css`.
- Correct the `schema.prisma` `AppSettings`/`Organization` comments to state
  that `seed.ts` provisions the singleton rows, not the migration.
- Correct `admin-period-lifecycle.ts`'s docstring to state that
  `createPeriodManual` applies the `PolicyApplicator` via its repo wrapper
  (matching current behavior), removing the false "no PolicyApplicator
  call here" claim.
- Correct `policy-applicator.service.ts`: drop the stale "backfill calls
  applyToPeriod" lifecycle bullet, replace the "DST-correct" self-description
  with an accurate one (exact-duration minute math, zone-shifted), and note
  the sibling `backfill-policy-rules.ts` duplicates the same math rather than
  calling this method — pointing a future maintainer at the actual
  duplication if they ever need to touch either side.
- Remove the dead `_tz` parameter from `backfill-policy-rules.ts`'s
  `computeFireAt` (it is never read; the function does raw UTC-offset math)
  and correct its comment to state plainly that it duplicates
  `PolicyApplicatorService.computeFireAt`'s math rather than calling it.
- Rewrite `ForbiddenPage`'s body copy to be environment-agnostic: drop the
  "dev role switcher in the top navigation" sentence, keeping only the
  "head back to the dashboard" affordance that works in every environment.
- Format the print footer timestamp for display instead of rendering raw
  ISO 8601; add `encodeURIComponent(reportId)` to the preview's "Back to
  form" `href`; replace the `16` and helper-text literal in
  `settings-identity-sub-tab.tsx` with `MAX_SHORT_NAME_LENGTH` imported from
  `@customreport/shared`; replace the fabricated `sectionTitle` in
  `reminders-escalation-grouping.ts` with the section's real title (falling
  back to a generic label only when the section has none).

All of the above are comment, docstring, copy, and dead-parameter changes;
none alter a public export's runtime signature, a database schema, or a
tRPC contract. Print-color styling in `print-report-template.tsx` and any
reference to a dropped feature are explicitly out of scope for this change.

## Impact

- `apps/api/src/modules/telemetry/telemetry.service.test.ts`
- `apps/web/src/features/analytics/ui/charts.test.tsx`
- `apps/web/src/styles/app.css`
- `apps/web/src/styles/pulse.css`
- `prisma/schema.prisma`
- `apps/api/src/modules/admin/admin-period-lifecycle.ts`
- `apps/api/src/modules/reminders/policy-applicator.service.ts`
- `prisma/backfill-policy-rules.ts`
- `apps/web/src/shared/ui/forbidden-page.tsx`
- `apps/web/src/app/print/[reportId]/print-report-template.tsx`
- `apps/web/src/app/(app)/lead/report/[reportId]/preview/page.tsx`
- `apps/web/src/features/organization/ui/settings-identity-sub-tab.tsx`
- `apps/api/src/modules/reminders/reminders-escalation-grouping.ts`

Non-goals: `trpc.context.ts`'s synthetic PDF-export `userId` comment is left
as-is (the value is harmless — the column is `TEXT`, not a UUID type — and
the finding rates it "harmless"); print-color styling in
`print-report-template.tsx` stays untouched; no dropped-feature reference is
resurrected; the BL-19 P1 DST-corruption claim is not acted on because
adversarial verification refuted it.
