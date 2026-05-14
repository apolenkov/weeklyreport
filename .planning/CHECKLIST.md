# CustomReport — Release Smoke Checklist

Per-milestone copies live under `.planning/milestones/v{N}-CHECKLIST.md`.
Auto-generation: `pnpm gsd:checklist:sync` rewrites HANDOFF.md `## Pending Manual Smoke` from unticked items below.

Each item ID (e.g. `AUTH-LOGIN-001`) has a 1:1 row in `.planning/REGRESSION-TEST-SCENARIOS.md` under section "v6.0 Release Smoke (Phase 28 / REL-03)". `[CI]` items run as part of the test suite; `[manual]` items must be ticked by the release lead.

## Functional Smoke

- [ ] FUNC-LEAD-001 [manual] — Lead can save a draft section
- [ ] FUNC-LEAD-002 [manual] — Lead can submit a section after autosave settles
- [ ] FUNC-HEAD-001 [manual] — Head sees the assembled report and publishes it
- [ ] FUNC-INTG-001 [CI] — Integration suite green: `pnpm test:e2e:integration`

## Auth

- [ ] AUTH-LOGIN-001 [manual] — Login as lead via Keycloak (Phase 29 active gate)
- [ ] AUTH-LOGIN-002 [manual] — Login as head; head-only routes accessible
- [ ] AUTH-VIEWER-001 [manual] — Viewer cannot access /admin or /head/\* (proxy.ts + SSR layout)
- [ ] AUTH-FILTERS-001 [CI] — Service-layer role filter unit tests: `pnpm --filter @customreport/api test apps/api/src/modules/archive apps/api/src/modules/weekly-report`
- [ ] AUTH-DEFAULT-DENY-001 [CI] — Default-deny coverage gate: `pnpm --filter @customreport/api test apps/api/src/infrastructure/trpc/__tests__/role-coverage.test.ts`

## PDF

- [ ] PDF-EXPORT-001 [manual] — Head exports a published report; PDF downloads non-empty
- [ ] PDF-COOKIE-001 [CI] — PDF cookie seam test: `pnpm --filter @customreport/api test apps/api/src/modules/pdf-export/pdf-export.service.test.ts`
- [ ] PDF-CONTENT-001 [manual] — Generated PDF contains the report period text and lead names

## Email

- [ ] EMAIL-DEADLINE-001 [manual] — T-24h deadline reminder lands in test inbox; HTML and plaintext both present
- [ ] EMAIL-IDEMPOTENT-001 [CI] — Reminder idempotency test: `pnpm --filter @customreport/api test apps/api/src/modules/reminders/reminders.scheduler.test.ts`
- [ ] EMAIL-DELIVERY-001 [manual] — Corporate SMTP accepts and delivers (no spam-folder routing)

## Mobile (deferred to Phase 30)

- [ ] MOB-VIEWPORT-001 [manual] — All 7 pages have no horizontal scroll at 375px (Phase 30)
- [ ] MOB-TAP-001 [manual] — Tap targets >=44px on iOS (Phase 30)

## AI Insights (deferred to Phase 31)

- [ ] AI-EVAL-001 [CI] — AI eval suite green: `pnpm test:ai-eval` (Phase 31)
- [ ] AI-COST-001 [manual] — Anthropic dashboard daily spend <= budget cap (Phase 31)

## Analytics (deferred to Phase 30)

- [ ] ANAL-CHARTS-001 [manual] — /reports/trends renders without console errors (Phase 30)
- [ ] ANAL-PERF-001 [CI] — Analytics query p95 <200ms (Phase 30)

---

## Signoff

- Milestone: \_\_\_\_
- Date: \_\_\_\_
- Released by: \_\_\_\_
- Sign-off: \_\_\_\_
