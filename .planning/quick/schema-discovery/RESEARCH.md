# WAVE -1: Schema Discovery for UAT Plan v7

**Date:** 2026-05-12
**Source:** `/Users/ap/work/customreport/prisma/schema.prisma` (776 lines)
**Purpose:** Realname mapping — plan vs actual schema for WAVE 0-7

---

## Section 1: Models Registry

| Model name         | Line | Has `archived` field? | Has `archivedAt` field? | Notes                                                          |
| ------------------ | ---- | --------------------- | ----------------------- | -------------------------------------------------------------- |
| User               | 9    | No                    | No                      |                                                                |
| ReportingGroup     | 40   | Yes (Boolean)         | No                      | UFB-039: archived for soft-delete                              |
| ViewerGroupAccess  | 69   | No                    | No                      | UFB-039: viewer↔group M:M                                      |
| UserActionLog      | 82   | No                    | No                      | audit log, no lifecycle fields                                 |
| Project            | 101  | Yes (Boolean)         | No                      | UFB-054: archived flag, m:n to ReportingGroup via GroupProduct |
| GroupProduct       | 141  | No                    | No                      | UFB-054: explicit Group↔Product M:M junction                   |
| Report             | 154  | Yes (Boolean)         | No                      | UFB-049: archived flag for auto-archiver                       |
| ReportSection      | 210  | No                    | No                      | has `revokedAt` (not archived)                                 |
| ProjectStatus      | 247  | No                    | No                      | junction: reportSectionId + projectId                          |
| StageStatus        | 260  | No                    | No                      | junction: reportSectionId + projectId + stageId                |
| Item               | 277  | No                    | No                      | current/next items in report section                           |
| Risk               | 300  | No                    | No                      | risks in report section                                        |
| Decision           | 320  | No                    | No                      | R4-C: productId NOT NULL (line 323)                            |
| Priority           | 342  | No                    | No                      | R4-C: productId NOT NULL (line 345)                            |
| PdfExportJob       | 359  | No                    | No                      | async PDF generation queue                                     |
| ReminderRule       | 374  | No                    | No                      | UFB-036: scheduled reminders                                   |
| ReminderPolicy     | 400  | No                    | No                      | UFB-036: template for ReminderRule                             |
| ReminderExecution  | 418  | No                    | No                      | execution log for reminders                                    |
| CarryOverExecution | 434  | No                    | No                      | carry-over batch for items/decisions                           |
| CarryOverRecord    | 447  | No                    | No                      | carry-over item-by-item record                                 |
| VersionSnapshot    | 460  | No                    | No                      | version history for sections                                   |
| Stage              | 472  | No                    | No                      | metadata (name, sortOrder)                                     |
| StageAssignment    | 481  | No                    | No                      | M:N: user + stage + project                                    |
| ReopenRequest      | 495  | No                    | No                      | UFB-031: reopen approval workflow                              |
| AppSettings        | 532  | No                    | No                      | singleton (id='singleton'), no lifecycle                       |
| Organization       | 578  | No                    | No                      | singleton (id='singleton'), no lifecycle                       |
| AiIngestionJob     | 605  | No                    | No                      | UFB-055 / Phase 54: seeds-only stub queue                      |
| AiInsight          | 619  | No                    | No                      | Phase 54: AI processing results cache                          |
| TelegramBinding    | 765  | No                    | No                      | UFB-056 / Phase 55-1: opt-in User↔Telegram link                |

**Lifecycle summary:**

- `archived` field exists on: ReportingGroup, Project, Report (3 models)
- No `archivedAt` timestamp field anywhere
- Report has extra lifecycle flags: `autoPublished`, `autoArchived`, `periodStatus`, `periodState`

---

## Section 2: Enums Registry

| Enum name               | Line | Values                                 | Notes                                          |
| ----------------------- | ---- | -------------------------------------- | ---------------------------------------------- |
| Role                    | 637  | lead, head, viewer, admin, director    | user role RBAC                                 |
| UserActionStatus        | 645  | success, fail                          | audit log status                               |
| ReportStatus            | 650  | draft, published                       | simple 2-state lifecycle                       |
| ReportSectionStatus     | 655  | draft, submitted                       | section submission state                       |
| TrafficLightStatus      | 660  | green, yellow, red                     | project/stage health indicator                 |
| ItemType                | 666  | current, next                          | item category (current week / next week)       |
| ItemWorkflowStatus      | 671  | done, in_progress, blocked             | item completion state                          |
| PdfExportStatus         | 677  | pending, processing, completed, failed | 4-state job queue                              |
| ReminderExecutionStatus | 684  | pending, sent, failed                  | execution outcome                              |
| CarryOverStatus         | 690  | pending, completed, failed             | batch job outcome                              |
| PeriodStatus            | 696  | open, published, reopened              | Report.periodStatus (3-state, no archived)     |
| PeriodState             | 707  | scheduled, open, published, archived   | Report.periodState (4-state, explicit archive) |
| ReopenRequestStatus     | 714  | pending, approved, rejected            | UFB-031 workflow                               |
| ReminderRuleKind        | 720  | deadline, follow_up, escalation        | reminder type                                  |
| ReminderAudience        | 726  | LEAD_WITH_DRAFT, HEAD_OF_LATE          | reminder recipients                            |
| WorkingDays             | 736  | MON_FRI, MON_SAT, MON_SUN              | UFB-048: metadata hint for admin               |
| ReminderRuleStatus      | 742  | active, paused                         | reminder pause/resume state                    |
| AiInsightKind           | 747  | summary, sentiment, on_track           | Phase 54: insight classification               |

**Key enums for WAVE 0-7:**

- `PeriodStatus` (open / published / reopened) — used in A22, A24
- `PeriodState` (scheduled / open / published / archived) — UFB-053, explicit state machine
- `ReportStatus` (draft / published) — used in A15 verify
- No enum value `scheduled` except in `PeriodState` (Report.periodState only)
- No enum value `archived` — archived state uses Boolean field + PeriodState.archived

---

## Section 3: Junction Tables

| Junction Model    | Line | Fields                              | Uniqueness                                      | Notes                            |
| ----------------- | ---- | ----------------------------------- | ----------------------------------------------- | -------------------------------- |
| ViewerGroupAccess | 69   | viewerUserId, groupId               | @@unique([viewerUserId, groupId])               | UFB-039: viewer grants per group |
| ProjectStatus     | 247  | reportSectionId, projectId          | @@unique([reportSectionId, projectId])          | project health per section       |
| StageStatus       | 260  | reportSectionId, projectId, stageId | @@unique([reportSectionId, projectId, stageId]) | stage health per section         |
| GroupProduct      | 141  | groupId, productId                  | @@unique([groupId, productId])                  | UFB-054: Group↔Project M:M       |
| StageAssignment   | 481  | stageId, projectId                  | @@unique([stageId, projectId])                  | user assignment to stage+project |
| ReminderRule      | 374  | reportId, policyId                  | @@unique([reportId, policyId])                  | one policy per report+rule       |

**A24 verify note:** `PeriodStatus` is NOT unique across anything — same report can have same status. No unique constraint on `(Report.id, Report.periodStatus)`. The A24 concern about "each report at most one open" is an **application-level invariant**, not enforced by schema.

---

## Section 4: Verify SQL Templates (Plan v6/v7)

For each plan verify command, substitute actual names from schema:

| Plan says                       | Real schema                                                                     | Working SQL                                                                                                                         |
| ------------------------------- | ------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `ActionLog` model               | `UserActionLog` (line 82)                                                       | `SELECT count(*) FROM "UserActionLog";`                                                                                             |
| `Report.archivedAt` DateTime    | `Report.archived` Boolean (line 172)                                            | `SELECT count(*) FROM "Report" WHERE archived = true;`                                                                              |
| All models with `archived`      | `ReportingGroup`, `Project`, `Report`                                           | `SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename;`                                                     |
| `Decision.productId` NOT NULL?  | Yes (line 323, FK to Project)                                                   | `SELECT count(*) FROM "Decision" WHERE "productId" IS NULL;` (expect: 0)                                                            |
| `Priority.productId` NOT NULL?  | Yes (line 345, FK to Project)                                                   | `SELECT count(*) FROM "Priority" WHERE "productId" IS NULL;` (expect: 0)                                                            |
| `Report.periodStatus` enum      | `PeriodStatus` enum (line 696) with values: open, published, reopened           | `SELECT DISTINCT "periodStatus" FROM "Report";`                                                                                     |
| `Report.periodState` enum       | `PeriodState` enum (line 707) with values: scheduled, open, published, archived | `SELECT DISTINCT "periodState" FROM "Report";`                                                                                      |
| `Report.status` enum            | `ReportStatus` enum (line 650) with values: draft, published                    | `SELECT DISTINCT "status" FROM "Report";`                                                                                           |
| `GroupProduct` junction exists? | Yes (line 141), @unique([groupId, productId])                                   | `SELECT "groupId", "productId", count(*) FROM "GroupProduct" GROUP BY "groupId", "productId" HAVING count(*) > 1;` (expect: 0 rows) |
| FK cascades on Decision delete? | Yes (line 334, onDelete: Cascade)                                               | `SELECT constraint_name FROM information_schema.table_constraints WHERE table_name='Decision' AND constraint_type='FOREIGN KEY';`   |
| FK cascades on Priority delete? | Yes (line 352, onDelete: Cascade)                                               | `SELECT constraint_name FROM information_schema.table_constraints WHERE table_name='Priority' AND constraint_type='FOREIGN KEY';`   |

---

## Section 5: Decision/Priority Schema (R4 Cluster)

### Decision Model (lines 320–340)

```prisma
model Decision {
  id              String                   @id @default(uuid())
  reportSectionId String
  productId       String                   ← R4-C: NOT NULL (FK to Project)
  text            String
  owner           String
  deadline        DateTime?
  impact          String
  resolvedAt      DateTime?
  createdAt       DateTime                 @default(now())
  updatedAt       DateTime                 @updatedAt
  searchTsv       Unsupported("tsvector")? @default(dbgenerated(...))
  stageName       String?
  reportSection   ReportSection            @relation(..., onDelete: Cascade)
  project         Project                  @relation(fields: [productId], references: [id], onDelete: Cascade)

  @@index([reportSectionId])
  @@index([productId])
  @@index([stageName])
  @@index([searchTsv], type: Gin)
}
```

**R4-C verification:**

- `productId` **is NOT NULL** ✓
- FK constraint: `@relation(fields: [productId], references: [id], onDelete: Cascade)` ✓
- Type: String (UUID reference)
- Cascade delete on Project removal ✓

### Priority Model (lines 342–357)

```prisma
model Priority {
  id              String        @id @default(uuid())
  reportSectionId String
  productId       String        ← R4-C: NOT NULL (FK to Project)
  rank            Int
  text            String
  createdAt       DateTime      @default(now())
  updatedAt       DateTime      @updatedAt
  stageName       String?
  reportSection   ReportSection @relation(..., onDelete: Cascade)
  project         Project       @relation(fields: [productId], references: [id], onDelete: Cascade)

  @@unique([reportSectionId, rank])
  @@index([productId])
  @@index([stageName])
}
```

**R4-C verification:**

- `productId` **is NOT NULL** ✓
- FK constraint: `@relation(fields: [productId], references: [id], onDelete: Cascade)` ✓
- Type: String (UUID reference)
- Cascade delete on Project removal ✓
- Unique constraint: `@@unique([reportSectionId, rank])` — ensures one rank per section per report ✓

---

## Section 6: Open Questions for Plan

**Issue 1: PeriodStatus vs PeriodState dual state machine**

Plan needs to verify that both enums are used correctly:

- `periodStatus` (open / published / reopened) — handles reopen flavor, **no archived state**
- `periodState` (scheduled / open / published / archived) — handles archive lifecycle, **no reopened**

On reopen: `periodState` is **reverted to `open`** while `periodStatus` flips to `reopened` (line 194-195). This is intentional but complex.

**Action:** A22 (archived-tabs verify) and A24 (period-unique verify) must use **`periodState`** not `periodStatus` for archive checks.

---

**Issue 2: Report lifecycle fields overlap**

Report has **4 distinct lifecycle dimensions** (line 154-207):

1. `status: ReportStatus` (draft / published) — publication state
2. `periodStatus: PeriodStatus` (open / published / reopened) — reopen flavor
3. `periodState: PeriodState` (scheduled / open / published / archived) — archive lifecycle
4. `archived: Boolean` — legacy flag from UFB-049

All three status enums + the boolean flag represent **overlapping state**. Schema comment (lines 182-195) confirms this is intentional for one-release compatibility. Plan v7 should verify:

- Legacy reads still work (query on `archived` Boolean + old `periodStatus`)
- New writes use `periodState` exclusively
- No contradictory states (e.g., `status=draft AND periodState=archived`)

---

**Issue 3: No `archivedAt` timestamp**

Plan says "verify `Report.archivedAt`" but schema has `Report.archived: Boolean` only. There is no timestamp. If you need to know **when** something was archived, that info doesn't exist in the schema.

Related: Report has `publishedAt`, `reopenedAt`, `autoPublished`, `autoArchived` (Boolean flags), but no `archivedAt` or `autoArchivedAt`.

---

**Issue 4: AiIngestionJob status is String, not enum**

Line 608: `status String @default("pending")` — plan may assume enum, but it's a free-form string. Comment (line 595-603) lists expected values: pending / processed / failed / skipped, but no Prisma enum enforces it.

This is intentional for Phase 54 (seeds-only stub), but if plan tries to query `WHERE status = 'processed'`, verify the exact string spelling.

---

**Issue 5: No soft-delete timestamp on most models**

Only Report and ReportingGroup and Project have `archived: Boolean`. Most other models (Item, Risk, Decision, Priority, etc.) have **no soft-delete mechanism** — they are deleted hard.

If plan expects soft-delete for reporting/audit, only the 3 models above support it.

---

**Confirmed OK:**

- `GroupProduct` junction table exists ✓
- `Decision` and `Priority` both have `productId NOT NULL` with FK + CASCADE ✓
- `PeriodState` enum exists with scheduled / open / published / archived ✓
- `Project.lead` is user FK (line 110) — via `Project.leadId` ✓
- `ReportingGroup.head` is optional user FK (line 54) — via `ReportingGroup.headUserId` ✓
- `TelegramBinding` exists for Phase 55 ✓
- `AiIngestionJob` exists for Phase 54 ✓

---

**Date:** 2026-05-12
**Open questions:** 5 (PeriodStatus vs PeriodState, lifecycle overlap, archivedAt missing, status String not enum, soft-delete coverage)
