# Tasks

Backlog: `files-seed.json` (112 files, 215 minors, minors-only). Every
`line` is as-of the review SHA — re-resolve against live code. Check a file
off only when its scoped unit suite is green AND every one of its minors is
either fixed or recorded as a stale re-grade in the wave notes.

## 0. Wave plan (calibrate on S, then scale)

- [x] 0.0 **Prerequisite — wave-1 MUST land first (hard gate, not a
      preference).** The seven `fix-*` / `harden-*` changes (period reopen
      leak, Fill From TOCTOU, archive floor, portfolio snapshot, admin
      restore, web product-code defects, test-suite hardening) MUST be
      committed on `main` before ANY slice below starts. This is a
      **correctness prerequisite**: those changes rewrite lines this campaign
      also touches, so starting first would fix a line the major fix then
      overwrites (or re-flag a finding the major already resolved). Do not
      begin §1 until `git log` shows all seven landed.
- [x] 0.1 **W1 — calibration (S-tier):** run the two smallest S slices
      (`web-viewer-telemetry`, `web-slides`) solo through the `waveb`
      harness. Confirm verifiers reject counter-gaming (comment prefix
      swapped for another ref, split-to-shorten) before mass waves.
- [ ] 0.2 **W2–W5 — remaining S slices:** batch seam-disjoint S slices in
      parallel (`waveb-batch`): prisma, packages-misc, web-admin, api-comms,
      api-lib, api-report-pub-search, api-sections-review, api-modules-other,
      web-dashboard, api-analytics-activity-obs, web-review.
- [ ] 0.3 **W6–W9 — M slices:** web-report-sections, e2e,
      api-period-carryover-archive, web-lib, web-app, api-auth-admin.
- [ ] 0.4 **W10–W13 — L slices:** web-landing-org-period, web-report-pages,
      api-infrastructure, web-shared.

## 1. web-landing-org-period (L — 11 files, 24 minors)

- [ ] 1.1 `apps/web/src/features/organization/ui/settings-identity-sub-tab.tsx` — 2 minors
- [ ] 1.2 `apps/web/src/features/organization/ui/settings-integrations-sub-tab.tsx` — 2 minors
- [ ] 1.3 `apps/web/src/features/period/ui/current-week-section-add-signal.test.tsx` — 2 minors
- [ ] 1.4 `apps/web/src/features/period/ui/decision-edit-dialog.tsx` — 2 minors
- [ ] 1.5 `apps/web/src/features/period/ui/decisions-section.snapshot.test.tsx` — 3 minors
- [ ] 1.6 `apps/web/src/features/period/ui/decisions-section.tsx` — 2 minors
- [ ] 1.7 `apps/web/src/features/period/ui/head-publish-lock-action.tsx` — 1 minor
- [ ] 1.8 `apps/web/src/features/period/ui/period-navigator.test.tsx` — 3 minors
- [ ] 1.9 `apps/web/src/features/period/ui/periods-tab-icons.tsx` — 2 minors
- [ ] 1.10 `apps/web/src/features/period/ui/sdlc-pipeline.test.tsx` — 2 minors
- [ ] 1.11 `apps/web/src/features/period/ui/use-decision-edit-dialog.ts` — 3 minors

## 2. web-report-pages (L — 9 files, 21 minors)

- [ ] 2.1 `apps/web/src/features/report-pages/ui/activity-status-strip.test.tsx` — 3 minors
- [ ] 2.2 `apps/web/src/features/report-pages/ui/head-report-shell.tsx` — 1 minor
- [ ] 2.3 `apps/web/src/features/report-pages/ui/lead-form-dialogs.tsx` — 4 minors
- [ ] 2.4 `apps/web/src/features/report-pages/ui/lead-form-sync-bridge.tsx` — 3 minors
- [ ] 2.5 `apps/web/src/features/report-pages/ui/next-week-section.tsx` — 2 minors
- [ ] 2.6 `apps/web/src/features/report-pages/ui/unified-activity-section.tsx` — 2 minors
- [ ] 2.7 `apps/web/src/features/report-pages/ui/use-lead-form-add-signals.test.tsx` — 1 minor
- [ ] 2.8 `apps/web/src/features/report-pages/ui/use-lead-form-redirects.ts` — 2 minors
- [ ] 2.9 `apps/web/src/features/report-pages/ui/weekly-report-skeleton.test.tsx` — 3 minors

## 3. api-infrastructure (L — 9 files, 19 minors)

- [ ] 3.1 `apps/api/src/infrastructure/bullmq/raw-bullmq-processor.ts` — 1 minor
- [ ] 3.2 `apps/api/src/infrastructure/email/email-dispatch.integration.test.ts` — 2 minors
- [ ] 3.3 `apps/api/src/infrastructure/health/prisma.health.ts` — 1 minor
- [ ] 3.4 `apps/api/src/infrastructure/trpc/__tests__/role-claim.contract.test.ts` — 2 minors
- [ ] 3.5 `apps/api/src/infrastructure/trpc/__tests__/role-coverage.test.ts` — 4 minors
- [ ] 3.6 `apps/api/src/infrastructure/trpc/reopen-requests.router.test.ts` — 2 minors
- [ ] 3.7 `apps/api/src/infrastructure/trpc/routers/organization.router.ts` — 2 minors
- [ ] 3.8 `apps/api/src/infrastructure/trpc/trpc.context.ts` — 2 minors
- [ ] 3.9 `apps/api/src/infrastructure/trpc/trpc.session-hydration.ts` — 3 minors

## 4. web-shared (L — 9 files, 19 minors)

- [ ] 4.1 `apps/web/src/shared/ui/confirm-delete-dialog.tsx` — 2 minors
- [ ] 4.2 `apps/web/src/shared/ui/confirmation-dialog.tsx` — 2 minors
- [ ] 4.3 `apps/web/src/shared/ui/forbidden-page.test.tsx` — 3 minors
- [ ] 4.4 `apps/web/src/shared/ui/icons.test.tsx` — 2 minors
- [ ] 4.5 `apps/web/src/shared/ui/report-shell/agent-review-coming-soon.test.tsx` — 2 minors
- [ ] 4.6 `apps/web/src/shared/ui/report-shell/archive-toggle.test.tsx` — 1 minor
- [ ] 4.7 `apps/web/src/shared/ui/report-shell/report-shell.test.tsx` — 3 minors
- [ ] 4.8 `apps/web/src/shared/ui/report-shell/scope-toggle.test.tsx` — 3 minors
- [ ] 4.9 `apps/web/src/shared/ui/sdlc-tooltip.tsx` — 1 minor

## 5. web-report-sections (M — 8 files, 14 minors)

- [ ] 5.1 `apps/web/src/features/report-sections/model/item-status.test.ts` — 1 minor
- [ ] 5.2 `apps/web/src/features/report-sections/model/lead-section-draft-payload.test.ts` — 1 minor
- [ ] 5.3 `apps/web/src/features/report-sections/model/lead-submit-readiness.ts` — 2 minors
- [ ] 5.4 `apps/web/src/features/report-sections/model/next-week-columns.ts` — 1 minor
- [ ] 5.5 `apps/web/src/features/report-sections/model/stage-chip-config.ts` — 4 minors
- [ ] 5.6 `apps/web/src/features/report-sections/ui/item-card.test.tsx` — 2 minors
- [ ] 5.7 `apps/web/src/features/report-sections/ui/item-edit-dialog.test.tsx` — 2 minors
- [ ] 5.8 `apps/web/src/features/report-sections/ui/item-edit-dialog.tsx` — 1 minor

## 6. e2e (M — 6 files, 13 minors)

- [ ] 6.1 `e2e/integration/global-setup.ts` — 2 minors
- [ ] 6.2 `e2e/integration/head-journey.integration.spec.ts` — 3 minors
- [ ] 6.3 `e2e/integration/helpers/seed-ids.ts` — 1 minor
- [ ] 6.4 `e2e/integration/lead-journey.integration.spec.ts` — 3 minors
- [ ] 6.5 `e2e/integration/mobile-no-horizontal-scroll.integration.spec.ts` — 3 minors
- [ ] 6.6 `e2e/integration/status-risk-sync.integration.spec.ts` — 1 minor

Note: `head-journey` and `status-risk-sync` are also touched by
`harden-test-suite-quality`; re-verify against their post-harden state.

## 7. api-period-carryover-archive (M — 6 files, 12 minors)

- [ ] 7.1 `apps/api/src/modules/archive/archive.contract.test.ts` — 2 minors
- [ ] 7.2 `apps/api/src/modules/archive/archive.prisma-repository.ts` — 1 minor
- [ ] 7.3 `apps/api/src/modules/archive/archive.service.test.ts` — 2 minors
- [ ] 7.4 `apps/api/src/modules/period/__tests__/lifecycle-write-gate.test.ts` — 1 minor
- [ ] 7.5 `apps/api/src/modules/period/infrastructure/auto-publisher.scheduler.test.ts` — 2 minors
- [ ] 7.6 `apps/api/src/modules/period/infrastructure/period-creator.scheduler.test.ts` — 4 minors

Note: `archive.service.test.ts` and `lifecycle-write-gate.test.ts` overlap
`harden-test-suite-quality`; re-verify post-harden.

## 8. web-lib (M — 8 files, 11 minors)

- [ ] 8.1 `apps/web/src/hooks/use-status-risk.ts` — 1 minor
- [ ] 8.2 `apps/web/src/lib/query-client.ts` — 2 minors
- [ ] 8.3 `apps/web/src/lib/role-home.ts` — 1 minor
- [ ] 8.4 `apps/web/src/lib/role-visibility.ts` — 2 minors
- [ ] 8.5 `apps/web/src/lib/server/get-print-route-context.test.ts` — 1 minor
- [ ] 8.6 `apps/web/src/lib/server/get-print-route-context.ts` — 1 minor
- [ ] 8.7 `apps/web/src/lib/trpc-provider.test.tsx` — 2 minors
- [ ] 8.8 `apps/web/src/lib/use-dialog-focus.test.tsx` — 1 minor

Note: `use-status-risk.ts` is also touched by `fix-web-product-code-defects`
(dead-field deletion); re-verify the remaining minor still applies.

## 9. web-app (M — 5 files, 10 minors)

- [ ] 9.1 `apps/web/src/app/(app)/layout.tsx` — 1 minor
- [ ] 9.2 `apps/web/src/app/(app)/reports/trends/loading-contract.test.ts` — 3 minors
- [ ] 9.3 `apps/web/src/app/login-page.client.test.tsx` — 3 minors
- [ ] 9.4 `apps/web/src/app/page.test.tsx` — 2 minors
- [ ] 9.5 `apps/web/src/app/print/[reportId]/print-portfolio-table.test.tsx` — 1 minor

Note: `layout.tsx` is also touched by `fix-web-product-code-defects` (dead
Suspense boundary removal); re-verify the remaining minor still applies.

## 10. api-auth-admin (M — 5 files, 9 minors)

- [ ] 10.1 `apps/api/src/modules/admin/action-log.prisma-repository.ts` — 1 minor
- [ ] 10.2 `apps/api/src/modules/admin/admin-period.queries.ts` — 4 minors
- [ ] 10.3 `apps/api/src/modules/admin/admin-reminder-policy.queries.ts` — 1 minor
- [ ] 10.4 `apps/api/src/modules/admin/session-revocation.service.test.ts` — 1 minor
- [ ] 10.5 `apps/api/src/modules/auth/auth.e2e.spec.ts` — 2 minors

## 11. prisma (S — 3 files, 8 minors)

- [x] 11.1 `prisma/seed-demo.ts` — 3 minors
- [x] 11.2 `prisma/seed-simple.ts` — 3 minors
- [x] 11.3 `prisma/seed.ts` — 2 minors

## 12. packages-misc (S — 5 files, 7 minors)

- [x] 12.1 `packages/shared/src/admin/reminder-policy.schema.test.ts` — 2 minors
- [x] 12.2 `packages/shared/src/schemas/auth.contract.test.ts` — 1 minor
- [x] 12.3 `packages/shared/src/schemas/auth.test.ts` — 2 minors
- [x] 12.4 `packages/shared/src/schemas/section.schema.ts` — 1 minor
- [x] 12.5 `packages/shared/src/schemas/web-vitals.test.ts` — 1 minor

## 13. web-admin (S — 4 files, 7 minors)

- [x] 13.1 `apps/web/src/features/admin/ui/group-products-editor.tsx` — 2 minors —
      **stale re-grade:** the shared ownership invalidator no longer touches
      `listGroupProducts`, so attach-wide and detach-scoped invalidations are
      neither duplicated nor dead.
- [x] 13.2 `apps/web/src/features/admin/ui/jobs-tab-label.tsx` — 1 minor
- [x] 13.3 `apps/web/src/features/admin/ui/settings-tab.test.tsx` — 3 minors
- [x] 13.4 `apps/web/src/features/admin/ui/users-tab.test.tsx` — 1 minor

## 14. api-comms (S — 3 files, 7 minors)

- [x] 14.1 `apps/api/src/modules/reminders/policy-applicator.perf.test.ts` — 2 minors
- [x] 14.2 `apps/api/src/modules/reminders/policy-applicator.service.ts` — 2 minors
- [x] 14.3 `apps/api/src/modules/reminders/reminders.service.test.ts` — 3 minors

Note: `reminders.service.test.ts` overlaps `harden-test-suite-quality`;
re-verify post-harden.

## 15. api-lib (S — 4 files, 6 minors)

- [x] 15.1 `apps/api/src/lib/audit-logger.test.ts` — 2 minors
- [x] 15.2 `apps/api/src/lib/business-date.test.ts` — 2 minors
- [x] 15.3 `apps/api/src/lib/group-scope.ts` — 1 minor
- [x] 15.4 `apps/api/src/lib/logger.ts` — 1 minor

Note: `audit-logger.test.ts` overlaps `harden-test-suite-quality`;
re-verify post-harden.

## 16. api-report-pub-search (S — 3 files, 6 minors)

- [x] 16.1 `apps/api/src/modules/publication/publication.module.ts` — 1 minor
- [x] 16.2 `apps/api/src/modules/published-report-snapshot.ts` — 1 minor
- [x] 16.3 `apps/api/src/modules/report-sections/application/report-sections.contract.test.ts` — 4 minors

## 17. api-sections-review (S — 2 files, 4 minors)

- [ ] 17.1 `apps/api/src/modules/review/application/review-actions.service.ts` — 2 minors
- [x] 17.2 `apps/api/src/modules/review/application/review.contract.test.ts` — 2 minors

## 18. api-modules-other (S — 2 files, 4 minors)

- [x] 18.1 `apps/api/src/modules/telegram/activation.integration.test.ts` — 2 minors
- [x] 18.2 `apps/api/src/modules/weekly-report/weekly-report.integration.test.ts` — 2 minors

## 19. web-dashboard (S — 2 files, 4 minors)

- [x] 19.1 `apps/web/src/features/dashboard/ui/kpi-cards.test.tsx` — 3 minors
- [x] 19.2 `apps/web/src/features/dashboard/ui/reopen-request-row.tsx` — 1 minor

## 20. api-analytics-activity-obs (S — 3 files, 3 minors)

- [x] 20.1 `apps/api/src/modules/analytics/analytics.cache.test.ts` — 1 minor
- [x] 20.2 `apps/api/src/modules/analytics/analytics.tz.test.ts` — 1 minor
- [x] 20.3 `apps/api/src/modules/observability/web-vitals.controller.test.ts` — 1 minor

## 21. web-review (S — 2 files, 3 minors)

- [x] 21.1 `apps/web/src/features/review/ui/review-acknowledge-bar.test.tsx` — 1 minor
- [x] 21.2 `apps/web/src/features/review/ui/section-verdict-control.test.tsx` — 2 minors —
      re-verified post-`harden-test-suite-quality`: both findings still held
      (no click coverage; pure className pin remained); fixed in-place.

Note: `section-verdict-control.test.tsx` overlaps
`harden-test-suite-quality`; re-verify post-harden.

## 22. api-modules — web-slides (S — 2 files, 2 minors)

- [x] 22.1 `apps/web/src/features/slides/model/slide-grid-cells.test.ts` — 1 minor —
      **stale re-grade:** `harden-test-suite-quality` already removed the dead
      variable and its type-only import.
- [x] 22.2 `apps/web/src/features/slides/ui/report-slides.tsx` — 1 minor

Note: `slide-grid-cells.test.ts` overlaps `harden-test-suite-quality`;
re-verify post-harden.

## 23. web-viewer-telemetry (S — 1 file, 2 minors)

- [x] 23.1 `apps/web/src/features/viewer/ui/viewer-report-shell.test.tsx` — 2 minors

## 24. Gates (per slice, then once at the end)

- [ ] 24.1 Per slice: scoped unit suites for every touched file
- [ ] 24.2 `pnpm --filter @customreport/api db:generate`
- [ ] 24.3 `pnpm typecheck`
- [ ] 24.4 `pnpm lint`
- [ ] 24.5 `pnpm test`
- [ ] 24.6 `pnpm test:e2e:integration` (after the e2e slice)
- [ ] 24.7 `openspec validate needs-attention-to-good --strict`

## 25. Final control re-grade

- [ ] 25.1 Re-review all **125** needs-attention files against live code
      (Opus batch + adversarial verify, same harness as the 2026-07-22 mass
      review) — confirm each is now **good**/**exemplary** or carries a
      recorded, justified re-grade.
- [ ] 25.2 Confirm the 13 majors-only files reach good via their sibling
      `fix-*` change (this campaign owns none of their findings).
- [ ] 25.3 Record the delta (files cleared, findings fixed vs. stale
      re-grades) in `~/work/customreport-archive/` and update its `INDEX.md`.
