# Graph Report - customreport  (2026-04-27)

## Corpus Check
- 308 files · ~456,806 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 974 nodes · 978 edges · 34 communities detected
- Extraction: 89% EXTRACTED · 11% INFERRED · 0% AMBIGUOUS · INFERRED: 106 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 9|Community 9]]
- [[_COMMUNITY_Community 10|Community 10]]
- [[_COMMUNITY_Community 11|Community 11]]
- [[_COMMUNITY_Community 12|Community 12]]
- [[_COMMUNITY_Community 13|Community 13]]
- [[_COMMUNITY_Community 14|Community 14]]
- [[_COMMUNITY_Community 15|Community 15]]
- [[_COMMUNITY_Community 18|Community 18]]
- [[_COMMUNITY_Community 21|Community 21]]
- [[_COMMUNITY_Community 25|Community 25]]
- [[_COMMUNITY_Community 30|Community 30]]
- [[_COMMUNITY_Community 34|Community 34]]
- [[_COMMUNITY_Community 40|Community 40]]
- [[_COMMUNITY_Community 51|Community 51]]
- [[_COMMUNITY_Community 52|Community 52]]
- [[_COMMUNITY_Community 54|Community 54]]
- [[_COMMUNITY_Community 57|Community 57]]
- [[_COMMUNITY_Community 69|Community 69]]
- [[_COMMUNITY_Community 127|Community 127]]
- [[_COMMUNITY_Community 129|Community 129]]
- [[_COMMUNITY_Community 132|Community 132]]
- [[_COMMUNITY_Community 136|Community 136]]
- [[_COMMUNITY_Community 141|Community 141]]
- [[_COMMUNITY_Community 147|Community 147]]
- [[_COMMUNITY_Community 149|Community 149]]

## God Nodes (most connected - your core abstractions)
1. `AdminService` - 15 edges
2. `bootstrap()` - 12 edges
3. `mapWeeklyReport()` - 10 edges
4. `LeadFormPrismaRepository` - 10 edges
5. `main()` - 9 edges
6. `uuid()` - 9 edges
7. `mapLeadFormData()` - 9 edges
8. `AppLoggerImpl` - 9 edges
9. `AdminPrismaRepository` - 9 edges
10. `LeadFormService` - 8 edges

## Surprising Connections (you probably didn't know these)
- `createAppRouter()` --calls--> `Input()`  [INFERRED]
  apps/api/src/infrastructure/trpc/trpc.router.ts → packages/ui/src/components/ui/input.tsx
- `createAppRouter()` --calls--> `uuid()`  [INFERRED]
  apps/api/src/infrastructure/trpc/trpc.router.ts → packages/shared/src/schemas/__tests__/report.test.ts
- `ExportPdfButton()` --calls--> `useTRPC()`  [INFERRED]
  apps/web/src/components/weekly-report/export-pdf-button.tsx → apps/web/src/lib/trpc-context.ts
- `StageAssignmentEditor()` --calls--> `useTRPC()`  [INFERRED]
  apps/web/src/components/admin/stage-assignment-editor.tsx → apps/web/src/lib/trpc-context.ts
- `AdminPanel()` --calls--> `useTRPC()`  [INFERRED]
  apps/web/src/components/admin/admin-panel.tsx → apps/web/src/lib/trpc-context.ts

## Communities

### Community 0 - "Community 0"
Cohesion: 0.05
Nodes (17): CarryOverPrismaRepository, mapPrismaToExecution(), CarryOverService, validateEnv(), QueryErrorBoundary, createNullLogger(), NullLogger, computePortfolioOverview() (+9 more)

### Community 1 - "Community 1"
Cohesion: 0.05
Nodes (16): AdminAccessError, ArchiveDomainError, ArchiveService, CarryOverDomainError, PdfExportDomainError, PublicationPrismaRepository, buildPortfolioOverview(), PublicationAccessError (+8 more)

### Community 2 - "Community 2"
Cohesion: 0.05
Nodes (22): createAuthController(), createJwtSigner(), requireJwtSecret(), AuthModule, buildUserSession(), ensureWeeklyReport(), getCurrentWeekBounds(), mountAuthRoutes() (+14 more)

### Community 3 - "Community 3"
Cohesion: 0.07
Nodes (21): emptyStageGrid(), isoWeekLabel(), mapAdminSettings(), mapAdminSnapshot(), mapPeriod(), mapProject(), mapReminder(), newId() (+13 more)

### Community 4 - "Community 4"
Cohesion: 0.08
Nodes (7): LeadFormPrismaRepository, LeadFormService, mapPrismaToReportSection(), ReportSectionsPrismaRepository, mergeSection(), ReportSectionsService, validateSubmitInput()

### Community 5 - "Community 5"
Cohesion: 0.07
Nodes (11): ArchiveModule, ArchivePrismaRepository, computePortfolioOverview(), toArchiveSummary(), toAssembledReport(), PeriodModule, PeriodPrismaRepository, PeriodAccessError (+3 more)

### Community 6 - "Community 6"
Cohesion: 0.08
Nodes (5): EmailReminderProcessor, close(), on(), EmailService, PdfExportProcessor

### Community 7 - "Community 7"
Cohesion: 0.12
Nodes (3): AdminPrismaRepository, AdminService, sortByName()

### Community 8 - "Community 8"
Cohesion: 0.1
Nodes (13): formatRelativeDeadline(), isoDateLabel(), isoWeekLabel(), mapArchiveSummary(), mapDashboardData(), DashboardPage(), shortDate(), ExportPdfButton() (+5 more)

### Community 9 - "Community 9"
Cohesion: 0.12
Nodes (5): BullMQHealthIndicator, HealthController, HealthModule, PrismaHealthIndicator, RedisHealthIndicator

### Community 10 - "Community 10"
Cohesion: 0.18
Nodes (13): Input(), makeSection(), uuid(), validAssembled(), validDecision(), validDraft(), validItem(), validPeriod() (+5 more)

### Community 11 - "Community 11"
Cohesion: 0.18
Nodes (13): deriveItemStatus(), workflowToItemStatus(), trafficToStageStatus(), findNeedsAttention(), formatWeekRange(), groupDecisionsAndPrioritiesByProject(), groupItemsByProject(), groupRisksByProject() (+5 more)

### Community 12 - "Community 12"
Cohesion: 0.21
Nodes (10): buildProjectIndex(), initialsFromName(), mapLeadDecisions(), mapLeadFormData(), mapLeadItems(), mapLeadPeriods(), mapLeadPriorities(), mapLeadProducts() (+2 more)

### Community 13 - "Community 13"
Cohesion: 0.16
Nodes (6): WeeklyReportModule, buildEscalations(), buildPortfolioOverview(), WeeklyReportPrismaRepository, WeeklyReportDomainError, WeeklyReportService

### Community 14 - "Community 14"
Cohesion: 0.33
Nodes (9): decisionId(), itemId(), main(), priorityId(), projectStatusId(), riskId(), sectionId(), stageAssignmentId() (+1 more)

### Community 15 - "Community 15"
Cohesion: 0.31
Nodes (7): navigateTo(), waitForPageReady(), ChevronLeft(), ChevronRight(), handleNext(), handlePrev(), handleSelect()

### Community 18 - "Community 18"
Cohesion: 0.43
Nodes (6): buildLoginRedirect(), isProtectedPath(), isPublicPath(), proxy(), requiresAuthentication(), shouldRedirectToLogin()

### Community 21 - "Community 21"
Cohesion: 0.33
Nodes (2): SidebarMenuButton(), useSidebar()

### Community 25 - "Community 25"
Cohesion: 0.4
Nodes (4): Provider(), Risks(), useBridgeContext(), useStatusRiskSync()

### Community 30 - "Community 30"
Cohesion: 0.7
Nodes (4): createAuthRedirectHandler(), createAuthRedirectLink(), makeTRPCClient(), makeTRPCProxy()

### Community 34 - "Community 34"
Cohesion: 0.4
Nodes (2): MetricsController, MetricsModule

### Community 40 - "Community 40"
Cohesion: 0.67
Nodes (2): AppShell(), getPageTitle()

### Community 51 - "Community 51"
Cohesion: 0.67
Nodes (2): makeDetail(), makeSummary()

### Community 52 - "Community 52"
Cohesion: 0.67
Nodes (2): validDraft(), validSubmit()

### Community 54 - "Community 54"
Cohesion: 0.67
Nodes (2): makeSection(), makeTargetSection()

### Community 57 - "Community 57"
Cohesion: 1.0
Nodes (2): uuid(), validSession()

### Community 69 - "Community 69"
Cohesion: 0.67
Nodes (1): AppModule

### Community 127 - "Community 127"
Cohesion: 1.0
Nodes (1): BullMQModule

### Community 129 - "Community 129"
Cohesion: 1.0
Nodes (1): PublicationModule

### Community 132 - "Community 132"
Cohesion: 1.0
Nodes (1): ReportSectionsModule

### Community 136 - "Community 136"
Cohesion: 1.0
Nodes (1): AdminModule

### Community 141 - "Community 141"
Cohesion: 1.0
Nodes (1): CarryOverModule

### Community 147 - "Community 147"
Cohesion: 1.0
Nodes (1): PdfExportModule

### Community 149 - "Community 149"
Cohesion: 1.0
Nodes (1): RemindersModule

## Knowledge Gaps
- **14 isolated node(s):** `MetricsModule`, `HealthModule`, `PrismaModule`, `BullMQModule`, `WeeklyReportModule` (+9 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `Community 21`** (7 nodes): `sidebar.tsx`, `cn()`, `handleKeyDown()`, `SidebarMenu()`, `SidebarMenuButton()`, `SidebarMenuItem()`, `useSidebar()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 34`** (5 nodes): `metrics.controller.ts`, `metrics.module.ts`, `MetricsController`, `.getMetrics()`, `MetricsModule`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 40`** (4 nodes): `AppShell()`, `getPageTitle()`, `getRoleLabel()`, `app-shell.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 51`** (4 nodes): `archive.contract.test.ts`, `createInMemoryRepository()`, `makeDetail()`, `makeSummary()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 52`** (4 nodes): `report-sections.contract.test.ts`, `createRepository()`, `validDraft()`, `validSubmit()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 54`** (4 nodes): `carry-over.contract.test.ts`, `createInMemoryRepository()`, `makeSection()`, `makeTargetSection()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 57`** (3 nodes): `uuid()`, `validSession()`, `auth.test.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 69`** (3 nodes): `AppModule`, `.configure()`, `app.module.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 127`** (2 nodes): `bullmq.module.ts`, `BullMQModule`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 129`** (2 nodes): `publication.module.ts`, `PublicationModule`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 132`** (2 nodes): `report-sections.module.ts`, `ReportSectionsModule`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 136`** (2 nodes): `AdminModule`, `admin.module.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 141`** (2 nodes): `carry-over.module.ts`, `CarryOverModule`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 147`** (2 nodes): `pdf-export.module.ts`, `PdfExportModule`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 149`** (2 nodes): `reminders.module.ts`, `RemindersModule`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `bootstrap()` connect `Community 2` to `Community 0`, `Community 10`?**
  _High betweenness centrality (0.024) - this node is a cross-community bridge._
- **Why does `createAppRouter()` connect `Community 10` to `Community 1`, `Community 2`?**
  _High betweenness centrality (0.020) - this node is a cross-community bridge._
- **Are the 11 inferred relationships involving `bootstrap()` (e.g. with `validateEnv()` and `createAppLogger()`) actually correct?**
  _`bootstrap()` has 11 INFERRED edges - model-reasoned connections that need verification._
- **What connects `MetricsModule`, `HealthModule`, `PrismaModule` to the rest of the system?**
  _14 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.05 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.05 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.05 - nodes in this community are weakly interconnected._