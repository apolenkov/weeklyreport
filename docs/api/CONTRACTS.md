# API Contracts Reference

Complete specification of every API endpoint in CustomReport.
All tRPC endpoints are mounted at `/trpc`. Auth routes are plain Express REST.

---

## REST Auth Routes

### `GET /auth/saml/login`
- **Auth**: None (initiates SAML flow)
- **Behavior**: Redirects to Keycloak IdP
- **Response**: HTTP 302 redirect

### `POST /auth/saml/callback`
- **Auth**: SAML assertion from IdP
- **Content-Type**: `application/x-www-form-urlencoded`
- **Behavior**:
  1. Validates SAML assertion signature (SHA256)
  2. Extracts profile: `{ samlId, email, displayName, role }`
  3. Upserts user in DB (match by email first, then samlId)
  4. For leads: auto-creates weekly Report + ReportSection + Priorities + ProjectStatuses if none exist
  5. Builds `UserSession` with `activeReportId` and `activeReportSectionId`
  6. Issues JWT cookie (`customreport_session`, HttpOnly, SameSite=Lax, 1h TTL)
  7. Redirects to `FRONTEND_URL`
- **Errors**:
  - Invalid assertion -> redirect to `/auth/error?reason=invalid_assertion`
  - Missing profile -> redirect to `/auth/error?reason=invalid_assertion`
- **Cookie**: `customreport_session=<JWT>; Path=/; HttpOnly; SameSite=Lax; Max-Age=3600`

### `POST /auth/logout`
- **Auth**: None (clears cookie regardless)
- **Behavior**: Sets cookie `Max-Age=0`, redirects to `/`
- **Response**: HTTP 302 redirect

### `GET /auth/dev-login` (dev mode only)
- **Auth**: None
- **Query params**:
  - `role` (optional, default: `head`): `lead` | `head` | `viewer`
  - `email` (optional): custom email, overrides default for role
  - `redirect` (optional): custom redirect path after login
- **Behavior**: Same as SAML callback but with hardcoded test profiles
- **Default accounts**:
  - `head` -> `head@customreport.local` / "Department Head"
  - `lead` -> `lead1@customreport.local` / "Lead 1"
  - `viewer` -> `viewer@customreport.local` / "Report Viewer"
- **Errors**:
  - Invalid role -> 400 `{ error: "Invalid role: X. Must be one of: lead, head, viewer" }`
- **Redirects**:
  - head -> `/admin`
  - lead -> `/lead/report`
  - viewer -> `/reports/history`

---

## tRPC Endpoints

### Context

Every tRPC call extracts JWT from `customreport_session` cookie.
Context type:
```typescript
type TrpcContext = {
  session: UserSession | null;
};
```

### Error mapping

| Domain Error | tRPC Code | HTTP Status |
|-------------|-----------|-------------|
| `ReportSectionDomainError` | `BAD_REQUEST` | 400 |
| `ReviewAccessError` | `FORBIDDEN` | 403 |
| `AdminAccessError` | `FORBIDDEN` | 403 |
| `PublicationAccessError` | `CONFLICT` | 409 |
| `PdfExportDomainError` | `NOT_FOUND` | 404 |
| `ArchiveDomainError` | `NOT_FOUND` | 404 |
| `ReminderDomainError` | `BAD_REQUEST` | 400 |
| `CarryOverDomainError` | `BAD_REQUEST` | 400 |
| Unknown error | `INTERNAL_SERVER_ERROR` | 500 |
| No session | `UNAUTHORIZED` | 401 |
| Not head role | `FORBIDDEN` | 403 |

---

## reports.getActive

- **Type**: query
- **Guard**: `protectedProcedure` (any authenticated user)
- **Input**: none
- **Output**: `ReportSectionReadModel | null`

```typescript
// Output schema
{
  reportSectionId: string;    // UUID
  reportId: string;           // UUID
  authorId: string;           // UUID
  authorName: string;         // min 1 char
  status: 'draft' | 'submitted';
  submittedAt: Date | null;
  projects: Array<{
    projectId: string;        // UUID
    projectName: string;      // min 1 char
    trafficLight: 'green' | 'yellow' | 'red' | null;
  }>;
  items: Array<{
    id?: string;              // UUID, optional
    projectId: string;        // UUID
    type: 'current' | 'next';
    text: string;             // 1-500 chars, safeText
    tag: string;              // 1-50 chars, safeText
    workflowStatus: 'done' | 'in_progress' | 'blocked';
    carriedOver: boolean;
    completed: boolean | null;
  }>;
  risks: Array<{
    id?: string;              // UUID, optional
    projectId: string;        // UUID
    risk: string;             // 1-500 chars, safeText
    impact: string;           // 1-500 chars, safeText
    mitigation: string;       // 1-500 chars, safeText
  }>;
  decisions: Array<{
    id?: string;              // UUID, optional
    text: string;             // 1-500 chars, safeText
    owner: string;            // 1-200 chars, safeText
    deadline: Date | null;
    impact: string;           // 1-500 chars, safeText
    resolvedAt: Date | null;
  }>;
  priorities: Array<{
    id?: string;              // UUID, optional
    rank: number;             // int, 1-3
    text: string;             // 1-200 chars, safeText
  }>;
}
```

**Behavior**:
- Returns `null` if `ctx.session.activeReportSectionId` is null
- Throws `Error` (-> 500) if section exists in session but not in DB

---

## reports.myHistory

- **Type**: query
- **Guard**: `protectedProcedure`
- **Input**: none
- **Output**: `Array<HistoryEntry>`

```typescript
// Output (not validated by Zod schema — raw Prisma select)
Array<{
  sectionId: string;
  reportId: string;
  periodStart: Date;
  periodEnd: Date;
  reportStatus: 'draft' | 'published';
  sectionStatus: 'draft' | 'submitted';
  submittedAt: Date | null;
  publishedAt: Date | null;
}>
```

**Behavior**: Returns all ReportSections authored by current user, ordered by `createdAt` desc.

---

## reports.saveDraft

- **Type**: mutation
- **Guard**: `protectedProcedure`
- **Input**: `DraftSavePayload`

```typescript
// Input schema (draftSaveSchema)
{
  reportSectionId: string;    // UUID, required
  status?: 'draft' | 'submitted';  // defaults to 'draft'
  projectStatuses: Array<{
    projectId: string;        // UUID
    status?: 'green' | 'yellow' | 'red';  // optional for draft
  }>;
  items: Array<ItemInput>;    // max 100
  risks: Array<RiskInput>;    // max 100
  decisions: Array<DecisionInput>;  // max 100
  priorities: Array<PriorityInput>; // max 50
}
```

- **Output**: `ReportSectionReadModel` (updated section)
- **Errors**:
  - Section not found -> 500 `INTERNAL_SERVER_ERROR`
  - Report is published -> 400 `BAD_REQUEST` ("Cannot edit sections of a published report.")
  - Section already submitted -> 400 `BAD_REQUEST` ("Submitted sections are read-only.")
  - Zod validation failure -> 400 `BAD_REQUEST`

**Behavior**:
1. Parses input through `draftSaveSchema`
2. Loads section from DB
3. Checks report status (must not be published)
4. Checks section status (must not be submitted)
5. Merges input into section read model
6. Persists via repository

---

## reports.submit

- **Type**: mutation
- **Guard**: `protectedProcedure`
- **Input**: `SubmitSectionPayload`

```typescript
// Input schema (submitSectionSchema = draftSaveSchema + extensions)
{
  reportSectionId: string;    // UUID
  confirmed: true;            // literal true required
  projectStatuses: Array<{
    projectId: string;        // UUID
    status: 'green' | 'yellow' | 'red';  // REQUIRED (not optional)
  }>;  // min 1 entry
  items: Array<ItemInput>;    // max 100
  risks: Array<RiskInput>;    // max 100
  decisions: Array<DecisionInput>;  // max 100
  priorities: Array<{
    rank: number;             // int, 1-3
    text: string;             // 1-200 chars, safeText
  }>;  // EXACTLY 3, unique ranks
}
```

- **Output**: `ReportSectionReadModel` (with status='submitted', submittedAt set)
- **Errors**:
  - Zod validation (wrong priority count, missing traffic light) -> 400
  - `SECTION_ALREADY_SUBMITTED` -> 400 "Section has already been submitted."
  - `MISSING_TRAFFIC_LIGHT` -> 400 "Project X must have a traffic light status."
  - `MISSING_CURRENT_ITEM` -> 400 "Project X needs at least one Current Week item."
  - `MISSING_PRIORITIES` -> 400 "Top 3 priorities must be filled before submit."

**Validation chain** (after Zod parse):
1. Check section not already submitted
2. For each project in section: verify matching traffic light in input
3. For each project: verify at least one `current` type item
4. Verify exactly 3 priorities, all non-empty text

---

## review.dashboard

- **Type**: query
- **Guard**: `protectedProcedure` (any auth user)
- **Input**: none
- **Output**: `SubmissionDashboardRow[]`

```typescript
Array<{
  leadId: string;             // UUID
  leadName: string;           // min 1 char
  role: 'lead' | 'head' | 'viewer';
  projectNames: string[];     // names of projects assigned to lead
  status: 'draft' | 'submitted';
  submittedAt: Date | null;
}>
```

**Behavior**: 
- Requires `activeReportId` in session (throws generic Error -> 500 if null)
- Returns all sections for active report
- Sorted: drafts first, then submitted; within same status, by leadName (Russian locale collation)

---

## review.assembledReport

- **Type**: query
- **Guard**: `headProcedure` (head only)
- **Input**: none
- **Output**: `AssembledReport`

```typescript
{
  reportId: string;           // UUID
  periodStart: Date;          // >= year 2000
  periodEnd: Date;            // >= year 2000
  deadline: Date;             // >= year 2000
  status: 'draft' | 'published';
  publishedAt: Date | null;
  publishedById: string | null;  // UUID
  publishedByName: string | null;
  portfolioOverview: {
    status: 'green' | 'yellow' | 'red';  // worst-case across all projects
    totals: {
      green: number;          // int >= 0
      yellow: number;         // int >= 0
      red: number;            // int >= 0
    };
  };
  sections: ReportSectionReadModel[];  // sorted by authorName (Russian locale)
}
```

**Behavior**:
- Requires `activeReportId` in session
- Builds portfolio overview: status = red if any red, yellow if any yellow, else green
- Sections sorted alphabetically by author name

---

## review.publish

- **Type**: mutation
- **Guard**: `headProcedure` (head only)
- **Input**: none
- **Output**: `AssembledReport` (with status='published')
- **Errors**:
  - No activeReportId -> 500
  - Report already published -> 409 `CONFLICT` "Report has already been published."
  - Lead/viewer calling -> 403 `FORBIDDEN`

**Behavior**:
1. Loads assembled report
2. Checks status is 'draft'
3. Sets status='published', publishedAt=now(), publishedById=session.userId, publishedByName=session.name
4. Saves and returns

---

## pdfExport.request

- **Type**: mutation
- **Guard**: `headProcedure`
- **Input**: `{ reportId: string }` (UUID)
- **Output**: `PdfExportJob`

```typescript
{
  jobId: string;              // UUID
  reportId: string;           // UUID
  status: 'queued' | 'processing' | 'completed' | 'failed';
  requestedAt: Date;
  completedAt: Date | null;
  checksum: string | null;
  templateVersion: string;    // currently 'phase-2-pdf-v1'
  artifactUrl: string | null;
}
```

- **Errors**:
  - Report not found or not published -> 404 `NOT_FOUND`
  - Lead/viewer calling -> 403
- **Side effect**: Enqueues BullMQ job with 3 retries, exponential backoff (5s base)

---

## pdfExport.status

- **Type**: query
- **Guard**: `protectedProcedure`
- **Input**: `{ jobId: string }` (UUID)
- **Output**: `PdfExportJob`
- **Errors**:
  - Job not found -> 404 `NOT_FOUND`

---

## admin.snapshot

- **Type**: query
- **Guard**: `headProcedure`
- **Input**: none
- **Output**: `AdminSnapshot`

```typescript
{
  users: Array<{
    id: string;               // UUID
    email: string;            // valid email
    name: string;             // min 1 char
    role: 'lead' | 'head' | 'viewer';
  }>;
  projects: Array<{
    id: string;               // UUID
    name: string;             // min 1 char
    archived: boolean;
    leadId: string;           // UUID
    leadName: string;         // min 1 char
  }>;
  periods: Array<{
    id: string;               // UUID
    periodStart: Date;        // >= year 2000
    periodEnd: Date;          // >= year 2000
    deadline: Date;           // >= year 2000
    status: 'draft' | 'published';
  }>;
  reminderRules: Array<{
    id: string;               // UUID
    reportId: string;         // UUID
    kind: 'deadline' | 'follow_up';
    fireAt: Date;
    timezone: string;         // min 1 char
    status: 'active' | 'paused';
    version: number;          // int >= 1
  }>;
  reminderExecutions: Array<ReminderExecution>;  // defaults to []
}
```

---

## admin.saveUser

- **Type**: mutation
- **Guard**: `headProcedure`
- **Input**: `AdminUser`

```typescript
{
  id: string;                 // UUID
  email: string;              // valid email
  name: string;               // min 1 char
  role: 'lead' | 'head' | 'viewer';
}
```

- **Output**: `AdminSnapshot` (full snapshot after upsert)
- **Behavior**: Creates user if id doesn't exist, updates if it does. Users sorted by name (Russian locale).

---

## admin.saveProject

- **Type**: mutation
- **Guard**: `headProcedure`
- **Input**: `AdminProject`

```typescript
{
  id: string;                 // UUID
  name: string;               // min 1 char
  archived: boolean;
  leadId: string;             // UUID
  leadName: string;           // min 1 char
}
```

- **Output**: `AdminSnapshot`
- **Behavior**: Upsert project, sorted by name.

---

## admin.savePeriod

- **Type**: mutation
- **Guard**: `headProcedure`
- **Input**: `ReportPeriod`

```typescript
{
  id: string;                 // UUID
  periodStart: Date;          // >= year 2000
  periodEnd: Date;            // >= year 2000
  deadline: Date;             // >= year 2000
  status: 'draft' | 'published';
}
```

- **Output**: `AdminSnapshot`

---

## admin.saveReminderRule

- **Type**: mutation
- **Guard**: `headProcedure`
- **Input**: `AdminReminderRule`

```typescript
{
  id: string;                 // UUID
  reportId: string;           // UUID
  kind: 'deadline' | 'follow_up';
  fireAt: Date;
  timezone: string;           // min 1 char, e.g. 'Europe/Moscow'
  status: 'active' | 'paused';
  version: number;            // int >= 1
}
```

- **Output**: `AdminSnapshot`

**Known issue**: Prisma schema stores `cronExpression` + `name` + `enabled`, but Zod schema expects `kind` + `fireAt` + `timezone` + `status` + `version`. Schema mismatch between shared types and database model.

---

## admin.deleteUser

- **Type**: mutation
- **Guard**: `headProcedure`
- **Input**: `{ userId: string }` (UUID)
- **Output**: `AdminSnapshot`
- **Behavior**: Hard-deletes user from snapshot (filters out by id)

---

## admin.deleteProject

- **Type**: mutation
- **Guard**: `headProcedure`
- **Input**: `{ projectId: string }` (UUID)
- **Output**: `AdminSnapshot`
- **Behavior**: Soft-delete: sets `archived: true` (does NOT remove from list)

---

## admin.deleteReminderRule

- **Type**: mutation
- **Guard**: `headProcedure`
- **Input**: `{ ruleId: string }` (UUID)
- **Output**: `AdminSnapshot`
- **Behavior**: Hard-deletes rule from snapshot

---

## archive.list

- **Type**: query
- **Guard**: `protectedProcedure`
- **Input**: none
- **Output**: `ArchiveReportSummary[]`

```typescript
Array<{
  reportId: string;           // UUID
  periodStart: Date;          // >= year 2000
  periodEnd: Date;            // >= year 2000
  publishedAt: Date;          // >= year 2000
  publishedByName: string;    // min 1 char
  portfolioStatus: 'green' | 'yellow' | 'red';
}>
```

**Behavior**: Returns all published reports, sorted by `publishedAt` descending.

---

## archive.detail

- **Type**: query
- **Guard**: `protectedProcedure`
- **Input**: `{ reportId: string }` (UUID)
- **Output**: `ArchiveReportDetail`

```typescript
{
  summary: ArchiveReportSummary;
  report: AssembledReport;    // full report with all sections
}
```

- **Errors**: Report not found -> 404 `NOT_FOUND`

---

## reminders.execute

- **Type**: mutation
- **Guard**: `headProcedure`
- **Input**: `{ ruleId: string, recipientEmail: string }` (UUID, valid email)
- **Output**: `AdminReminderExecution`

```typescript
{
  id: string;                 // UUID
  ruleId: string;             // UUID
  reportId: string;           // UUID
  dedupeKey: string;          // "{ruleId}:{fireAt ISO}:{email}"
  status: 'queued' | 'sent' | 'failed';
  scheduledFor: Date;
  sentAt: Date | null;
  recipientEmail: string;
  errorMessage: string | null;
}
```

- **Errors**:
  - Rule not found -> 400 `BAD_REQUEST`
  - Rule not active -> 400 `BAD_REQUEST`
- **Deduplication**: Same rule + fireAt + email returns existing execution
- **Side effect**: Enqueues BullMQ email job (3 retries, exponential backoff)

---

## reminders.listExecutions

- **Type**: query
- **Guard**: `headProcedure`
- **Input**: `{ ruleId: string }` (UUID)
- **Output**: `AdminReminderExecution[]`
- **Behavior**: Returns all executions for a given rule (no pagination)

---

## carryOver.execute

- **Type**: mutation
- **Guard**: `headProcedure`
- **Input**: `{ sourceReportId: string, targetReportId: string }` (UUIDs)
- **Output**: `CarryOverResult`

```typescript
{
  execution: {
    id: string;               // UUID
    sourceReportId: string;
    targetReportId: string;
    dedupeKey: string;        // "{source}:{target}"
    status: 'pending' | 'completed' | 'failed';
    startedAt: Date;
    completedAt: Date;
    carriedItemCount: number; // int >= 0
    carriedDecisionCount: number; // int >= 0
  };
  records: CarryOverRecord[];
  targetSection: ReportSectionReadModel;
}
```

- **Errors**:
  - Same source and target -> 400 "Carry-over requires different source and target reports."
  - No sections in source or target -> 400 "Carry-over requires both source and target sections."
- **Deduplication**: Same source+target pair returns existing execution without re-copying
- **Items carried**: `next` type items that are not already carried over -> become `current` with `carriedOver: true`
- **Decisions carried**: Unresolved decisions (resolvedAt == null) -> copied with `resolvedAt: null`

---

## Input Schema Details

### safeText validation

All user-facing text fields use `safeText()`:
1. **Min length**: 1 character (default) — empty strings rejected
2. **Max length**: varies (50 for tags, 200 for priorities/owners, 500 for text fields)
3. **No null bytes**: `\u0000` rejected (PostgreSQL incompatible)
4. **No invisible-only**: strings containing only `\s`, `\u200B`, `\u200C`, `\u200D`, `\uFEFF` rejected
5. Mixed visible + invisible characters are allowed

### Array limits

| Field | Draft max | Submit constraint |
|-------|-----------|-------------------|
| items | 100 | At least 1 `current` item per project |
| risks | 100 | No minimum |
| decisions | 100 | No minimum |
| priorities | 50 (draft) | Exactly 3 with unique ranks (submit) |
| projectStatuses | unbounded | Min 1 with required status (submit) |

### Date validation

`reportDate()` rejects dates before year 2000 (prevents epoch/nonsensical dates).
Applied to: `periodStart`, `periodEnd`, `deadline`, `publishedAt` (in archive).
