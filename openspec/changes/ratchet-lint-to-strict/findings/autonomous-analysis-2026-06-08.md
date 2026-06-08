# Autonomous analysis run — 2026-06-08

Read-only analysis/review army (workflow wgg61rk2c, 55 agents, adversarially
verified). Covers ratchet R6a/R6b/R3a-4 + defer-uat Wave-3 domain review.
Findings below survived an independent Opus refute-by-default verify stage;
refuted findings are recorded at the end so they are not re-investigated.

Status: the Wave-3 BLOCKER (auto-archiver) is FIXED (commit 4855df4a).
R6a/R6b PASS (clean). R3a-4 census is the work-list for the max-lines cluster.

---

## BLOCKERS

**One confirmed runtime-correctness blocker.**

### BLOCKER — Auto-archiver silently archives reopened periods

**File:** `apps/api/src/modules/period/auto-archiver.scheduler.ts` **Lines 65–72**

The candidate query filters on legacy `status:'published'` + `archived:false` + `publishedAt < cutoff`. The `reopen` transition (`period-transition.ts`) deliberately leaves `status='published'` and `archived=false` untouched while setting `periodState='open'`. Any period that was published before the `autoArchiveWeeksAfterPublish` cutoff and was later reopened satisfies all three predicates and gets archived by the daily cron — silently destroying an in-progress editing session.

**Fix:** Add one predicate to the WHERE clause:

```ts
where: {
  status: "published",
  archived: false,
  publishedAt: { lt: cutoff, not: null },
  periodState: { not: "open" },   // <-- add this line
},
```

A reopened period has `periodState='open'`; this single condition excludes all reopened periods regardless of `publishedAt` age. (The archiver's own audit-log comment at line 82 already names `periodState` as the canonical column — the query should match.)

---

## R3a-4 max-lines census

34 files exceed 300 ESLint-estimated counted lines (skipBlankLines + skipComments). Counts are static estimates; ESLint runtime may differ slightly. 7 are documented-exempt; 27 are split candidates.

**How to read the table:** "counted" = approximate ESLint-style counted lines; "raw" = total file lines.

### DOCUMENTED-EXEMPT (7 files — no action needed)

| File                                                 | counted / raw | Reason                                                                                                                      |
| ---------------------------------------------------- | ------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `apps/web/src/components/dashboard/mock-data.ts`     | 819 / 861     | Pure fixture data; will be deleted when live mapper replaces mocks                                                          |
| `apps/web/src/components/lead/mock-data.ts`          | 776 / 823     | Pure fixture data; same lifecycle                                                                                           |
| `apps/web/src/components/admin/mock-data.ts`         | 447 / 505     | Pure fixture data; same lifecycle                                                                                           |
| `packages/ui/src/components/ui/sidebar.tsx`          | 667 / 732     | shadcn/ui generated primitive bundle; ~20 exports share one context; splitting breaks shadcn update workflow                |
| `packages/shared/src/schemas/report.schema.ts`       | 324 / 442     | Dense Zod schema catalogue (68 tightly-interdependent exports); no logic                                                    |
| `apps/api/src/main.ts`                               | ~312 / 420    | Borderline over-limit; high comment density but ~312 real code lines — qualifies for a one-line eslint override with reason |
| `apps/api/src/modules/admin/period-admin.service.ts` | 347 / 521     | 174 stripped comment lines; 347 counted lines close to limit — document as heavily-commented service or split (see below)   |

`main.ts` note: a prior analysis claimed 62 counted lines (wrong — the "60 block-comment lines" were invented; the file has exactly one block comment). Actual count is ~312. Add a targeted `/* eslint-disable max-lines */` with the reason "load-order documentation" or extract `normalizeHttpRoute` to trim below 300.

### SPLIT CANDIDATES (27 files) — ready to execute

```
apps/api/src/infrastructure/trpc/
├─ trpc.router.ts              1755 / 2219   Extract each named sub-router (auth, org, dev, reports, review, pdfExport, admin,
│                                            actionLog, jobs, archive, reminders, carryOver, period) into own *router.ts files;
│                                            thin trpc.router.ts merges via t.mergeRouters / composition.
└─ trpc.middleware.ts           370 /  527   (1) metrics+logging → trpc.observability-middleware.ts
                                             (2) audit → trpc.audit-middleware.ts
                                             (3) procedure/role exports → trpc.procedures.ts

apps/api/src/modules/admin/
├─ admin.prisma-repository.ts  896 / 1181   (1) settings+reminder-policies → admin-settings.prisma-repository.ts
│                                            (2) snapshots → admin-snapshot.prisma-repository.ts
│                                            (3) period CRUD → period.prisma-repository.ts
│                                            (4) group/product edges → group-product.prisma-repository.ts
└─ period-admin.service.ts     347 /  521   Extract period state-machine (open→publish→reopen→archive) to period-state-machine.ts;
                                             or document-exempt (see above)

apps/api/src/modules/report-sections/
├─ lead-form.prisma-repository.ts 702 / 807  (1) version snapshots → lead-form-versions.prisma-repository.ts
│                                             (2) cross-author queries → lead-form-cross-author.prisma-repository.ts
└─ report-sections.prisma-repository.ts 345 / 406  (1) reportSectionFullInclude + aggregateStageTraffic + mapper
                                                      → report-section-mapper.ts
                                                     (2) keep ReportSectionsPrismaRepository class in main file

apps/api/src/modules/auth/
└─ auth.routes.ts              363 /  487   (1) getCurrentWeekBounds + ensureWeeklyReport → auth-week-helpers.ts
                                             (2) buildUserSession + SamlProfile → auth-session-builder.ts
                                             (3) mountAuthRoutes stays in auth.routes.ts (~100 lines)

apps/api/src/lib/
└─ audit-logger.ts             304 /  452   AuditEvent discriminated union → audit-events.ts
                                             createAuditLogger + createNullAuditLogger + AuditLogger interface stay

apps/web/src/components/admin/
├─ settings-tab.tsx           1057 / 1203   Extract each *SubTab: identity-sub-tab.tsx, periods-sub-tab.tsx,
│                                            reminders-sub-tab.tsx, notifications-sub-tab.tsx, integrations-sub-tab.tsx
├─ periods-tab.tsx            1039 / 1268   (1) icons → periods-tab-icons.tsx
│                                            (2) PeriodTable+Row+badges+ActionIconRow+IconButton → period-table.tsx
│                                            (3) CreatePeriodDialog → create-period-dialog.tsx
├─ reminders-tab.tsx           824 /  931   (1) PolicyForm → reminder-policy-form.tsx
│                                            (2) PolicyRow → reminder-policy-row.tsx
│                                            (3) format helpers → reminders-tab-helpers.ts
├─ users-tab.tsx               548 /  585   (1) RoleBadge → role-badge.tsx  (2) user edit dialog → user-edit-dialog.tsx
├─ products-tab.tsx            445 /  487   (1) edit dialog → product-edit-dialog.tsx
│                                            (2) stage assignment → product-stage-assignment.tsx
└─ groups-tab.tsx              445 /  477   (1) edit dialog → group-edit-dialog.tsx
                                             (2) member assignment → group-member-panel.tsx

apps/web/src/components/lead/
├─ lead-form.tsx              1650 / 1922   (1) icons → lead-form-icons.tsx
│                                            (2) sectionToDraftPayload + aggregateTrafficLight → lead-form-helpers.ts
│                                            (3) section sub-components following existing pattern
│                                               (current-week-section.tsx, risks-section.tsx etc. already started)
├─ lead-form-sync-bridge.tsx   320 /  413   (1) Pipeline + Risks → lead-form-sync-bridge-effects.tsx
│                                            (2) promoteStageStatus + computeUnbackedStages → lead-form-sync-helpers.ts
├─ risk-edit-dialog.tsx        430 /  498   (1) form body → RiskEditDialogContent (inner-component pattern)
│                                            (2) risk helpers → risk-helpers.ts
├─ item-edit-dialog.tsx        329 /  404   ItemEditDialogContent → item-edit-dialog-content.tsx
│                                            form helpers → item-edit-helpers.ts
└─ decision-edit-dialog.tsx    303 /  341   form sub-section → decision-edit-dialog-content.tsx
                                             helpers → decision-edit-helpers.ts

apps/web/src/components/slides/
├─ section-slide-utils.ts      728 /  830   (1) types → section-slide-models.ts
│                                            (2) buildSectionSlideModel + buildActivitySlideModel + paginateSectionSlides
│                                               → section-slide-builder.ts
│                                            (3) buildUnifiedSlideModel + buildProductScopedSlides + sortSlidesForReview
│                                               → unified-slide-builder.ts
└─ status-slide-deck.tsx       492 /  524   (1) LeadSlideArticle → lead-slide-article.tsx
                                             (2) HeadSlideArticle → head-slide-article.tsx
                                             (3) rendering utilities → slide-deck-helpers.ts

apps/web/src/components/navigation/
└─ nav-bar.tsx                 446 /  516   (1) LanguageComingSoonControl + ThemeComingSoonControl → nav-coming-soon-controls.tsx
                                             (2) MobileNav → mobile-nav.tsx
                                             (3) getRoleLabel + isActiveLink + initialsFromName → nav-helpers.ts

apps/web/src/components/dashboard/
└─ dashboard-page.tsx          364 /  421   (1) DashboardLoadIssue → dashboard-load-issue.tsx
                                             (2) blocked/at-risk section → dashboard-blocked-section.tsx
                                             (3) portfolio section → dashboard-portfolio-section.tsx

apps/web/src/components/weekly-report/
├─ weekly-report-page.tsx      354 /  429   (1) product section → weekly-report-product-section.tsx
│                                            (2) header/status bar → weekly-report-header.tsx
└─ product-accordion.tsx       376 /  394   (1) item list → product-accordion-items.tsx
                                             (2) risks/decisions → product-accordion-risks-decisions.tsx

apps/web/src/app/print/[reportId]/
└─ page.tsx                    668 /  712   (1) PortfolioTable → print-portfolio-table.tsx
                                             (2) LeadSection → print-lead-section.tsx
                                             (3) statusColor + statusLabel + workflowBadge → print-helpers.ts

apps/web/src/lib/mappers/
├─ lead-form.ts                428 /  653   (1) types → lead-form-types.ts  (2) stage helpers → lead-stage-mapper.ts
│                                            (3) item/risk/decision/priority mappers → lead-items-mapper.ts
│                                            (4) period/version mappers → lead-period-mapper.ts
├─ admin.ts                    426 /  611   (1) types → admin-types.ts  (2) reminder helpers → admin-reminder-mapper.ts
│                                            (3) keep mapAdminSnapshot + mapAdminSettings + entity mappers in admin.ts
└─ weekly-report.ts            343 /  461   (1) types → weekly-report-types.ts
                                             (2) grouping helpers → weekly-report-groupers.ts
                                             (3) keep mapWeeklyReport + buildProductToAuthorMap + findNeedsAttention
```

---

## Wave-3 domain review

### Confirmed correctness bugs

#### 1. BLOCKER — Auto-archiver archives reopened periods (repeated from BLOCKERS)

See BLOCKERS section above. Fix: `periodState: { not: 'open' }` in WHERE clause at `auto-archiver.scheduler.ts:65–72`.

#### 2. MEDIUM — Carry-over silently drops decisions without `productId`

**File:** `apps/api/src/modules/carry-over/carry-over.prisma-repository.ts` **Lines 201–215**

Decisions where `productId` is null are filtered out without any log entry or return-value indication. The carry-over result object reports them as carried while they are absent from the DB.

**Fix options:**

- If decisions with null `productId` are valid: remove the filter and verify the `Decision` schema permits null `productId` (if `productId String` without `?`, widen the schema or throw).
- If they are invalid: throw or log a warning per dropped record so the caller can surface the data gap rather than silently losing data.

#### 3. LOW — Misleading comment in `findOverlappingPeriod`

**File:** `apps/api/src/modules/admin/admin.prisma-repository.ts` — `findOverlappingPeriod` function

The comment says "Half-open intersect" but the WHERE clause is a standard closed-interval overlap test (`periodStart: { lte: input.periodEnd }, periodEnd: { gte: input.periodStart }`). The logic is correct; the comment misleads readers reasoning about whether adjacent periods sharing an endpoint count as overlapping.

**Fix:** Change comment to: `// Closed-interval overlap: [A,B] ∩ [C,D] ≠ ∅ iff A≤D AND B≥C`

#### 4. LOW — Deadline divergence between login-time auto-create and scheduler

**File:** `apps/api/src/modules/auth/auth.routes.ts` **Lines 133–135**

`ensureWeeklyReport` computes deadlines as calendar days + hardcoded UTC 18:00. `computeDeadline` (used by `period-creator.scheduler.ts` and the manual-create path) uses business-day arithmetic with `settings.workingDays` and `settings.defaultTimezone`. Periods created via the login path will have different deadlines than identical periods created by the scheduler.

**Fix:** Import and call `computeDeadline` in `ensureWeeklyReport`, adding `settings.workingDays` and `settings.defaultTimezone` to the AppSettings select. Eliminates the hardcoded 18:00 comment and makes both creation paths produce identical deadlines.

### Confirmed safe (no action needed)

**Auto-publish snapshot parity** — `publication.prisma-repository.ts:56–66`: snapshot and lifecycle fields are written in the same Prisma `update` call when `report.status === 'published'`. No torn-write hazard.

---

## Per-task summary + refuted

### R6a — DI import-type review (commit 7952e3c5)

**PASS.** All ~47 symbol conversions across 31 files verified: every by-type-injected constructor param is a value import; every `import type` is an interface or `@Inject(TOKEN)` site. The trpc.router.ts asymmetry (5 converted, 9 left as type) is safe — the file is a plain factory whose services appear only as `interface RouterDeps` fields, resolved via `app.get()` in `main.ts`. Four files / 8 symbols were converted to value imports despite being type-only (over-broad but runtime-harmless; classes emit at runtime and verbatimModuleSyntax does not reject them).

### R6b — Repo-wide lazy `import type` audit

**PASS (clean).** All 230 files in `apps/api/src` (excluding test files) checked. Every NestJS by-type reflection-injected class is value-imported; no class injected by constructor-type is `import type`. `verbatimModuleSyntax:true` (tsconfig.base.json:17) makes value-position DI type-lies compile errors, narrowing the silent risk surface to constructor-param type annotations — all confirmed clean.

**Refuted finding (R6b):** "AppLogger injected via @Inject(APP_LOGGER)" — the token `APP_LOGGER` does not exist anywhere in `apps/api/src`. The real wiring is an optional constructor parameter defaulting to `createNullLogger()` (e.g. `admin.service.ts:58`). The conclusion (no inverse smell) is correct; the cited mechanism is invented. Not re-investigable as-is.

### R3a-4 — max-lines census

**34 files over limit.** 27 split candidates with concrete seams identified (see census above). 7 documented-exempt. One prior analysis finding refuted:

**Refuted finding (R3a-4):** "main.ts has 62 counted lines — exempt." The file has exactly one block comment (`/* eslint-disable */` on line 1); the claimed "60 block-comment lines" do not exist. Actual count: ~312 code lines (420 raw − 34 blank − 73 comment-only = 312 by awk). The file is over the 300-line limit and needs either a slim-down or a documented inline override.

### Wave-3 — domain review

**2 confirmed bugs (1 blocker, 1 medium), 2 low/info items, 1 confirmed-clean item.**

**Refuted finding — `ensure-weekly-report-status-draft` (high):** The three `status:'draft'` predicates in `auth.routes.ts` (lines 115, 242, 258) do go stale after the first publish — that mechanism is real. However, the stated severity-justifying impact is wrong: (a) the partial unique index `WHERE periodState='open'` described in `schema.prisma` comments is absent from the actual init migration SQL, so there is no P2002 to throw; (b) even if it existed, the published report is `periodState='published'` and the new row defaults to `'open'` — no conflict; (c) harm is a silent duplicate Report row on the lead login path (line 247 gates `ensureWeeklyReport` to `role==='lead'`), not "the whole login path is broken at login." The fix direction (replace `status:'draft'` with `periodState: { not: 'archived' }`) is correct, but severity is medium not high. Not re-investigable at the claimed severity.

**Refuted finding — `carry-over-idempotency-predicate-mismatch` (medium):** The `dedupeKey` is defined as `${sourceReportId}:${targetReportId}` (carry-over.service.ts:125), making it a bijective function of the pair. The premise of "two different dedupeKeys for the same pair" is impossible. The `dedupeKey` is also already `@unique` in `schema.prisma:430`. Both cited harms (predicates disagreeing, records mis-attributed) depend on the impossible scenario. Not re-investigable.

**Refuted finding — `unarchive-reopened-period-state-torn` (medium):** `unarchivePeriod` explicitly preserves `periodStatus` via `const nextPeriodStatus = row.periodStatus` and the typed return. `periodState='published'` + `periodStatus='reopened'` is a deliberately valid state documented in the codebase. `period-transition.ts:162–173` (reopen) intentionally leaves the legacy tuple untouched. The downstream reader (`weekly-report.prisma-repository.ts:139`) gates on `periodStatus==='published'` and correctly falls through to live editable data for a reopened period — correct behavior. The proposed fix (force `periodStatus='published'`) would destroy the reopen marker and violate the period-dual-state invariant. Not re-investigable.
