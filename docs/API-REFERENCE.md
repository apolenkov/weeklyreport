# CustomReport API Reference

Complete reference for all API endpoints in the CustomReport application.

**Base URL:** `http://localhost:3001` (development)

**Protocol:** tRPC over HTTP (batch link) + REST auth routes

**Serialization:** superjson (transparently serializes Date, Map, Set, BigInt, etc.)

---

## Table of Contents

1. [Authentication](#authentication)
2. [tRPC Endpoint Reference](#trpc-endpoint-reference)
   - [reports](#reports) (4 endpoints)
   - [review](#review) (3 endpoints)
   - [pdfExport](#pdfexport) (2 endpoints)
   - [admin](#admin) (13 endpoints)
   - [archive](#archive) (2 endpoints)
   - [reminders](#reminders) (2 endpoints)
   - [carryOver](#carryover) (1 endpoint)
   - [period](#period) (2 endpoints)
   - [weeklyReport](#weeklyreport) (1 endpoint)
   - [leadForm](#leadform) (6 endpoints)
3. [REST Auth Routes](#rest-auth-routes) (4 endpoints)
4. [Health and Metrics](#health-and-metrics) (3 endpoints)
5. [Error Handling](#error-handling)
6. [Shared Schemas](#shared-schemas)

**Total endpoints: 43** (36 tRPC + 4 REST auth + 3 health/metrics)

---

## Authentication

### Session Model

All tRPC endpoints require a valid session. Sessions are established via SAML
SSO or the dev-login bypass, and carried as an HTTP-only cookie containing a
signed JWT.

| Property | Description |
|----------|-------------|
| Cookie name | `customreport_session` (configurable via `AUTH_JWT_COOKIE_NAME`) |
| Algorithm | HS256 |
| Expiry | 1 hour |
| Transport | HTTP-only, Secure (in production), SameSite=Lax, Path=/ |
| Secret | `AUTH_JWT_SECRET` environment variable (required) |

### JWT Payload (UserSession)

```typescript
{
  userId: string;          // UUID
  email: string;           // user email
  name: string;            // display name
  role: "lead" | "head" | "viewer";
  activeReportId: string | null;          // current draft report UUID
  activeReportSectionId: string | null;   // lead's section UUID (null for head/viewer)
}
```

### Auth Levels

| Level | Middleware | Who can access | On failure |
|-------|-----------|----------------|------------|
| `protectedProcedure` | `isAuthed` | Any authenticated user (lead, head, viewer) | `UNAUTHORIZED` |
| `headProcedure` | `isHead` | Head role only | `UNAUTHORIZED` (no session) or `FORBIDDEN` (wrong role) |

### Dev Mode Bypass

When `AUTH_DEV_MODE=true`, requests without a valid cookie receive a fallback
head session automatically. This enables tRPC playground and frontend
development without Keycloak.

---

## tRPC Endpoint Reference

All tRPC endpoints are accessed via the batch HTTP link at `/trpc`.

**Client URL pattern:** `POST /trpc/<namespace>.<procedure>`

---

### reports

Lead-facing endpoints for managing report sections.

#### reports.getActive

| Property | Value |
|----------|-------|
| **Auth** | `protectedProcedure` (any authenticated role) |
| **Type** | query |
| **Input** | none |
| **Output** | `ReportSectionReadModel \| null` |

Returns the active (draft) report section for the authenticated user. Uses
`ctx.session.activeReportSectionId` to look up the section. Returns `null` if
the user has no active section assigned.

**Output shape (`ReportSectionReadModel`):**

```typescript
{
  reportSectionId: string;   // UUID
  reportId: string;          // UUID
  authorId: string;          // UUID
  authorName: string;
  status: "draft" | "submitted";
  submittedAt: Date | null;
  projects: Array<{
    projectId: string;
    projectName: string;
    trafficLight: "green" | "yellow" | "red" | null;
  }>;
  items: Array<ItemInput>;
  risks: Array<RiskInput>;
  decisions: Array<DecisionInput>;
  priorities: Array<PriorityInput>;
}
```

---

#### reports.myHistory

| Property | Value |
|----------|-------|
| **Auth** | `protectedProcedure` (any authenticated role) |
| **Type** | query |
| **Input** | none |
| **Output** | `MyHistoryEntry[]` |

Returns all report sections authored by the current user, ordered by creation
date descending. Includes the parent report's period and publication status.

**Output shape (`MyHistoryEntry`):**

```typescript
{
  sectionId: string;         // UUID
  reportId: string;          // UUID
  periodStart: Date;
  periodEnd: Date;
  reportStatus: "draft" | "published";
  sectionStatus: "draft" | "submitted";
  submittedAt: Date | null;
  publishedAt: Date | null;
}
```

---

#### reports.saveDraft

| Property | Value |
|----------|-------|
| **Auth** | `protectedProcedure` (any authenticated role) |
| **Type** | mutation |
| **Input** | `DraftSavePayload` |
| **Output** | Updated `ReportSectionReadModel` |

Saves the current state of a report section as a draft. Does not validate
completeness -- partial data is accepted.

**Input shape (`draftSaveSchema`):**

```typescript
{
  reportSectionId: string;                 // UUID - required
  status: "draft" | "submitted";           // defaults to "draft"
  projectStatuses: Array<{
    projectId: string;                     // UUID
    status?: "green" | "yellow" | "red";   // optional for drafts
  }>;
  items: Array<{                           // max 100
    id?: string;                           // UUID - omit for new items
    projectId: string;                     // UUID
    type: "current" | "next";
    text: string;                          // 1-500 chars, safe text
    tag: string;                           // 1-50 chars
    workflowStatus: "done" | "in_progress" | "blocked";
    carriedOver: boolean;                  // default false
    completed?: boolean | null;
  }>;
  risks: Array<{                           // max 100
    id?: string;
    projectId: string;
    risk: string;                          // 1-500 chars
    impact: string;                        // 1-500 chars
    mitigation: string;                    // 1-500 chars
  }>;
  decisions: Array<{                       // max 100
    id?: string;
    text: string;                          // 1-500 chars
    owner: string;                         // 1-200 chars
    deadline?: Date | null;
    impact: string;                        // 1-500 chars
    resolvedAt?: Date | null;
  }>;
  priorities: Array<{                      // max 50
    id?: string;
    rank: number;                          // positive integer, min 1
    text: string;                          // 1-200 chars
  }>;
}
```

---

#### reports.submit

| Property | Value |
|----------|-------|
| **Auth** | `protectedProcedure` (any authenticated role) |
| **Type** | mutation |
| **Input** | `SubmitSectionPayload` |
| **Output** | Updated `ReportSectionReadModel` |

Submits a report section for review. Extends `draftSaveSchema` with stricter
validation:

- `confirmed: true` is required (literal)
- Every project must have a traffic light status (not optional)
- At least one project status is required
- At least one priority with non-empty text is required
- Priority ranks must be unique

Server-side validation (via `validateSubmitInput`) additionally checks:
- Section is not already submitted (`SECTION_ALREADY_SUBMITTED`)
- All projects have traffic lights (`MISSING_TRAFFIC_LIGHT`)
- Each project has at least one "current" item (`MISSING_CURRENT_ITEM`)
- At least one filled priority (`MISSING_PRIORITIES`)

---

### review

Head-facing endpoints for reviewing and publishing assembled reports.

#### review.dashboard

| Property | Value |
|----------|-------|
| **Auth** | `protectedProcedure` (any authenticated role) |
| **Type** | query |
| **Input** | none |
| **Output** | `SubmissionDashboardRow[]` |

Returns the submission dashboard for the active report. Shows each lead's
submission status. Returns an empty array if no active report exists in session.

**Output shape (`SubmissionDashboardRow`):**

```typescript
{
  leadId: string;            // UUID
  leadName: string;
  role: "lead" | "head" | "viewer";
  projectNames: string[];
  status: "draft" | "submitted";
  submittedAt: Date | null;
}
```

---

#### review.assembledReport

| Property | Value |
|----------|-------|
| **Auth** | `headProcedure` (head role only) |
| **Type** | query |
| **Input** | none |
| **Output** | `AssembledReport` |

Returns the fully assembled report for the active period, including all
submitted sections, portfolio overview, and publication metadata. Throws
`BAD_REQUEST` if no active report exists in session.

**Output shape (`AssembledReport`):**

```typescript
{
  reportId: string;
  periodStart: Date;
  periodEnd: Date;
  deadline: Date;
  status: "draft" | "published";
  publishedAt: Date | null;
  publishedById: string | null;
  publishedByName: string | null;
  portfolioOverview: {
    status: "green" | "yellow" | "red";
    totals: { green: number; yellow: number; red: number; };
  };
  sections: ReportSectionReadModel[];
}
```

---

#### review.publish

| Property | Value |
|----------|-------|
| **Auth** | `headProcedure` (head role only) |
| **Type** | mutation |
| **Input** | none |
| **Output** | Published report confirmation |

Publishes the active report. Sets the report status to "published" and records
the publisher identity and timestamp. Throws `BAD_REQUEST` if no active report
exists in session.

---

### pdfExport

Endpoints for requesting and tracking PDF export jobs.

#### pdfExport.request

| Property | Value |
|----------|-------|
| **Auth** | `headProcedure` (head role only) |
| **Type** | mutation |
| **Input** | `{ reportId: string }` (UUID) |
| **Output** | `PdfExportJob` |

Queues a PDF export job for the specified report. The job is processed
asynchronously via BullMQ.

**Output shape (`PdfExportJob`):**

```typescript
{
  jobId: string;             // UUID
  reportId: string;          // UUID
  status: "queued" | "processing" | "completed" | "failed";
  requestedAt: Date;
  completedAt: Date | null;
  checksum: string | null;
  templateVersion: string;
  artifactUrl: string | null;
}
```

---

#### pdfExport.status

| Property | Value |
|----------|-------|
| **Auth** | `protectedProcedure` (any authenticated role) |
| **Type** | query |
| **Input** | `{ jobId: string }` (UUID) |
| **Output** | `PdfExportJob` |

Returns the current status of a PDF export job. Poll this endpoint to track
job progress.

---

### admin

Head-only endpoints for managing users, projects, periods, reminder rules, and
stage assignments.

#### admin.snapshot

| Property | Value |
|----------|-------|
| **Auth** | `headProcedure` (head role only) |
| **Type** | query |
| **Input** | none |
| **Output** | `AdminSnapshot` |

Returns the complete admin snapshot: all users, projects, periods, reminder
rules, and reminder executions.

**Output shape (`AdminSnapshot`):**

```typescript
{
  users: AdminUser[];
  projects: AdminProject[];
  periods: ReportPeriod[];
  reminderRules: AdminReminderRule[];
  reminderExecutions: AdminReminderExecution[];
}
```

---

#### admin.getSettings

| Property | Value |
|----------|-------|
| **Auth** | `headProcedure` (head role only) |
| **Type** | query |
| **Input** | none |
| **Output** | `AppSettings` |

Returns application-wide settings.

**Output shape (`AppSettings`):**

```typescript
{
  departmentName: string;      // 1-200 chars
  autoCreatePeriods: boolean;
  defaultDeadlineDays: number; // 1-30
}
```

---

#### admin.updateSettings

| Property | Value |
|----------|-------|
| **Auth** | `headProcedure` (head role only) |
| **Type** | mutation |
| **Input** | `Partial<AppSettings>` |
| **Output** | Updated `AppSettings` |

Partially updates application settings. All fields are optional (partial
update).

---

#### admin.saveUser

| Property | Value |
|----------|-------|
| **Auth** | `headProcedure` (head role only) |
| **Type** | mutation |
| **Input** | `AdminUser` |
| **Output** | Upserted user |

Creates or updates a user (upsert by `id`).

**Input shape (`AdminUser`):**

```typescript
{
  id: string;        // UUID
  email: string;     // valid email
  name: string;      // min 1 char
  role: "lead" | "head" | "viewer";
}
```

---

#### admin.saveProject

| Property | Value |
|----------|-------|
| **Auth** | `headProcedure` (head role only) |
| **Type** | mutation |
| **Input** | `AdminProject` |
| **Output** | Upserted project |

Creates or updates a project (upsert by `id`).

**Input shape (`AdminProject`):**

```typescript
{
  id: string;        // UUID
  name: string;      // min 1 char
  archived: boolean;
  leadId: string;    // UUID - assigned lead
  leadName: string;  // min 1 char
}
```

---

#### admin.savePeriod

| Property | Value |
|----------|-------|
| **Auth** | `headProcedure` (head role only) |
| **Type** | mutation |
| **Input** | `ReportPeriod` |
| **Output** | Upserted period |

Creates or updates a reporting period (upsert by `id`).

**Input shape (`ReportPeriod`):**

```typescript
{
  id: string;          // UUID
  periodStart: Date;   // must be after year 2000
  periodEnd: Date;     // must be after year 2000
  deadline: Date;      // must be after year 2000
  status: "draft" | "published";
}
```

---

#### admin.saveReminderRule

| Property | Value |
|----------|-------|
| **Auth** | `headProcedure` (head role only) |
| **Type** | mutation |
| **Input** | `AdminReminderRule` |
| **Output** | Upserted reminder rule |

Creates or updates a reminder rule (upsert by `id`).

**Input shape (`AdminReminderRule`):**

```typescript
{
  id: string;                      // UUID
  reportId: string | null;         // UUID or null
  kind: "deadline" | "follow_up";
  fireAt: Date;
  timezone: string;                // min 1 char (e.g. "Europe/Moscow")
  status: "active" | "paused";
  version: number;                 // positive integer, min 1
}
```

---

#### admin.deleteUser

| Property | Value |
|----------|-------|
| **Auth** | `headProcedure` (head role only) |
| **Type** | mutation |
| **Input** | `{ userId: string }` (UUID) |
| **Output** | Deletion confirmation |

Removes a user from the system.

---

#### admin.deleteProject

| Property | Value |
|----------|-------|
| **Auth** | `headProcedure` (head role only) |
| **Type** | mutation |
| **Input** | `{ projectId: string }` (UUID) |
| **Output** | Deletion confirmation |

Removes a project from the system.

---

#### admin.deleteReminderRule

| Property | Value |
|----------|-------|
| **Auth** | `headProcedure` (head role only) |
| **Type** | mutation |
| **Input** | `{ ruleId: string }` (UUID) |
| **Output** | Deletion confirmation |

Removes a reminder rule.

---

#### admin.saveStageAssignment

| Property | Value |
|----------|-------|
| **Auth** | `headProcedure` (head role only) |
| **Type** | mutation |
| **Input** | `{ userId: string, stageId: string, projectId: string }` (all UUIDs) |
| **Output** | Saved assignment |

Assigns a user to a product stage for a specific project.

---

#### admin.deleteStageAssignment

| Property | Value |
|----------|-------|
| **Auth** | `headProcedure` (head role only) |
| **Type** | mutation |
| **Input** | `{ id: string }` (UUID) |
| **Output** | Deletion confirmation |

Removes a stage assignment.

---

#### admin.listStageAssignments

| Property | Value |
|----------|-------|
| **Auth** | `headProcedure` (head role only) |
| **Type** | query |
| **Input** | `{ projectId: string }` (UUID) |
| **Output** | `StageAssignment[]` |

Lists all stage assignments for a given project.

**Output shape (`StageAssignment`):**

```typescript
{
  id: string;          // UUID
  userId: string;      // UUID
  stageId: string;     // UUID
  projectId: string;   // UUID
  stageName: string;
  userName?: string;
}
```

---

### archive

Endpoints for browsing published report history.

#### archive.list

| Property | Value |
|----------|-------|
| **Auth** | `protectedProcedure` (any authenticated role) |
| **Type** | query |
| **Input** | `PaginationInput?` (optional) |
| **Output** | `PaginatedResult<ArchiveReportSummary>` |

Lists published reports with cursor-based pagination.

**Input shape (`PaginationInput` -- optional):**

```typescript
{
  cursor?: string;  // UUID - cursor for next page
  limit?: number;   // 1-100, default 20
}
```

**Output shape (`ArchiveReportSummary`):**

```typescript
{
  reportId: string;
  periodStart: Date;
  periodEnd: Date;
  publishedAt: Date;
  publishedByName: string;
  portfolioStatus: "green" | "yellow" | "red";
}
```

---

#### archive.detail

| Property | Value |
|----------|-------|
| **Auth** | `protectedProcedure` (any authenticated role) |
| **Type** | query |
| **Input** | `{ reportId: string }` (UUID) |
| **Output** | `ArchiveReportDetail` |

Returns full details of an archived (published) report, including the assembled
report and its summary metadata.

**Output shape (`ArchiveReportDetail`):**

```typescript
{
  summary: ArchiveReportSummary;
  report: AssembledReport;
}
```

---

### reminders

Head-only endpoints for managing email reminders.

#### reminders.execute

| Property | Value |
|----------|-------|
| **Auth** | `headProcedure` (head role only) |
| **Type** | mutation |
| **Input** | `{ ruleId: string, recipientEmail: string }` |
| **Output** | Execution result |

Manually triggers a reminder execution for a specific rule and recipient.

**Input validation:**
- `ruleId`: UUID
- `recipientEmail`: valid email address

---

#### reminders.listExecutions

| Property | Value |
|----------|-------|
| **Auth** | `headProcedure` (head role only) |
| **Type** | query |
| **Input** | `{ ruleId: string, cursor?: string, limit?: number }` |
| **Output** | `PaginatedResult<AdminReminderExecution>` |

Lists execution history for a reminder rule with optional pagination.

**Output shape (`AdminReminderExecution`):**

```typescript
{
  id: string;
  ruleId: string;
  reportId: string | null;
  dedupeKey: string;
  status: "queued" | "sent" | "failed";
  scheduledFor: Date;
  sentAt: Date | null;
  recipientEmail: string;
  errorMessage: string | null;
}
```

---

### carryOver

Head-only endpoint for carrying over unfinished items between periods.

#### carryOver.execute

| Property | Value |
|----------|-------|
| **Auth** | `headProcedure` (head role only) |
| **Type** | mutation |
| **Input** | `{ sourceReportId: string, targetReportId: string }` (both UUIDs) |
| **Output** | `CarryOverExecution` |

Carries over incomplete items and unresolved decisions from a source report to
a target report.

**Output shape (`CarryOverExecution`):**

```typescript
{
  id: string;
  sourceReportId: string;
  targetReportId: string;
  dedupeKey: string;
  status: "pending" | "completed" | "failed";
  startedAt: Date;
  completedAt: Date;
  carriedItemCount: number;
  carriedDecisionCount: number;
}
```

---

### period

Head-only endpoints for managing period lifecycle (publish and reopen).

#### period.publish

| Property | Value |
|----------|-------|
| **Auth** | `headProcedure` (head role only) |
| **Type** | mutation |
| **Input** | `{ reportId: string }` (UUID) |
| **Output** | Published period confirmation |

Publishes a period, locking all sections and setting the period status to
"published". Records the publisher identity from the session.

---

#### period.reopen

| Property | Value |
|----------|-------|
| **Auth** | `headProcedure` (head role only) |
| **Type** | mutation |
| **Input** | `{ reportId: string }` (UUID) |
| **Output** | Reopened period confirmation |

Reopens a published period, allowing leads to edit their sections again. Sets
the period status to "reopened".

---

### weeklyReport

Endpoint for retrieving the full assembled weekly report view.

#### weeklyReport.get

| Property | Value |
|----------|-------|
| **Auth** | `protectedProcedure` (any authenticated role) |
| **Type** | query |
| **Input** | `{ reportId?: string }?` (optional object with optional UUID) |
| **Output** | `WeeklyReportReadModel` |

Returns the full weekly report view including portfolio overview, all lead
sections, and escalations. If `reportId` is omitted, returns the current active
report.

**Output shape (`WeeklyReportReadModel`):**

```typescript
{
  reportId: string;
  periodStart: Date;
  periodEnd: Date;
  periodStatus: "open" | "published" | "reopened";
  weekLabel: string | null;
  submissionCount: number;
  totalLeads: number;
  portfolioOverview: Array<{
    productId: string;
    productName: string;
    worstStatus: "green" | "yellow" | "red" | null;
    stageCount: number;
    leadNames: string[];
  }>;
  leadSections: ReportSectionReadModel[];
  escalations: Array<{
    type: "blocked" | "at_risk" | "unresolved_risk";
    productName: string;
    stageName: string | null;
    leadName: string;
    description: string;
  }>;
}
```

---

### leadForm

Lead-facing endpoints for form data, version history, and reopen requests.

#### leadForm.byPeriod

| Property | Value |
|----------|-------|
| **Auth** | `protectedProcedure` (any authenticated role) |
| **Type** | query |
| **Input** | `{ reportId: string }` (UUID) |
| **Output** | Lead's section for the specified report period |

Returns the lead's report section for a specific period. Uses
`ctx.session.userId` to scope the lookup to the authenticated user.

---

#### leadForm.fillFrom

| Property | Value |
|----------|-------|
| **Auth** | `protectedProcedure` (any authenticated role) |
| **Type** | mutation |
| **Input** | `{ targetSectionId: string, sourceSectionId: string }` (both UUIDs) |
| **Output** | Populated section |

Copies data from a previous section into the target section. Useful for
pre-filling a new period's form from a previous week. Scoped to the
authenticated user via `ctx.session.userId`.

---

#### leadForm.versions

| Property | Value |
|----------|-------|
| **Auth** | `protectedProcedure` (any authenticated role) |
| **Type** | query |
| **Input** | `{ reportSectionId: string }` (UUID) |
| **Output** | `VersionSnapshot[]` |

Lists all saved version snapshots for a report section.

**Output shape (`VersionSnapshot`):**

```typescript
{
  id: string;
  reportSectionId: string;
  version: number;       // positive integer
  createdAt: Date;
}
```

---

#### leadForm.restoreVersion

| Property | Value |
|----------|-------|
| **Auth** | `protectedProcedure` (any authenticated role) |
| **Type** | mutation |
| **Input** | `{ reportSectionId: string, version: number }` |
| **Output** | Restored section |

Restores a report section to a previous version snapshot. Scoped to the
authenticated user.

**Input validation:**
- `reportSectionId`: UUID
- `version`: positive integer

---

#### leadForm.revoke

| Property | Value |
|----------|-------|
| **Auth** | `headProcedure` (head role only) |
| **Type** | mutation |
| **Input** | `{ reportSectionId: string }` (UUID) |
| **Output** | Revoked section |

Revokes a submitted section, returning it to draft status. Only available to
the head role. Uses `ctx.session.userId` to record who performed the revocation.

---

#### leadForm.requestReopen

| Property | Value |
|----------|-------|
| **Auth** | `protectedProcedure` (any authenticated role) |
| **Type** | mutation |
| **Input** | `{ reportSectionId: string, reason?: string }` |
| **Output** | Reopen request result |

Allows a lead to request that their submitted section be reopened for editing.
The optional `reason` field (max 500 chars) is recorded for the head's review.

---

## REST Auth Routes

These are standard Express routes outside the tRPC router, mounted at
`/auth/*`.

### GET /auth/saml/login

| Property | Value |
|----------|-------|
| **Auth** | Public (unauthenticated) |
| **Method** | GET |

Initiates the SAML SSO flow. Redirects the browser to the Keycloak IdP for
authentication. Passport.js handles the SAML AuthnRequest generation.

---

### POST /auth/saml/callback

| Property | Value |
|----------|-------|
| **Auth** | Public (IdP callback) |
| **Method** | POST |
| **Content-Type** | application/x-www-form-urlencoded |

Receives the SAML assertion from Keycloak after successful authentication.
On success: creates/updates the user in the database, builds a session, issues
a JWT cookie (`customreport_session`), and redirects to the frontend URL.
On failure: redirects to `/auth/error?reason=invalid_assertion`.

**SAML profile extracted:**

```typescript
{
  samlId: string;       // from IdP nameID
  email: string;
  displayName: string;
  role: string;         // "lead" | "head" | "viewer"
}
```

**Auto-provisioning:** If the user does not exist in the database, they are
created automatically. If a lead user has no active report section, a weekly
report and section are auto-created.

---

### POST /auth/logout

| Property | Value |
|----------|-------|
| **Auth** | Public |
| **Method** | POST |

Clears the session cookie by setting `Max-Age=0` and redirects to `/`.

---

### GET /auth/dev-login

| Property | Value |
|----------|-------|
| **Auth** | Public (dev mode only) |
| **Method** | GET |
| **Availability** | Only when `AUTH_DEV_MODE=true` |

Quick-login endpoint for development. Creates a session cookie for the
specified role without SAML.

**Query parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `role` | `"lead" \| "head" \| "viewer"` | `"head"` | Role to authenticate as |
| `email` | `string` | Role-specific default | Custom email (looks up/creates user) |
| `redirect` | `string` | Role-specific page | Post-login redirect path |

**Default emails by role:**

| Role | Email | Redirect |
|------|-------|----------|
| head | `head@customreport.local` | `/admin` |
| lead | `lead1@customreport.local` | `/lead/report` |
| viewer | `viewer@customreport.local` | `/reports/history` |

---

## Health and Metrics

Infrastructure endpoints for monitoring and orchestration. These are NestJS
controller routes, not tRPC procedures.

### GET /health/live

| Property | Value |
|----------|-------|
| **Auth** | Public (unauthenticated) |
| **Method** | GET |
| **Purpose** | Kubernetes liveness probe |

Checks memory heap usage (threshold: 200 MB). Returns HTTP 200 with health
status JSON on success, HTTP 503 on failure.

**Response shape:**

```json
{
  "status": "ok",
  "info": { "memory_heap": { "status": "up" } },
  "error": {},
  "details": { "memory_heap": { "status": "up" } }
}
```

---

### GET /health/ready

| Property | Value |
|----------|-------|
| **Auth** | Public (unauthenticated) |
| **Method** | GET |
| **Purpose** | Kubernetes readiness probe |

Checks all dependencies:
- **database** (Prisma/PostgreSQL connectivity)
- **redis** (Redis connectivity)
- **bullmq** (BullMQ queue health)
- **memory_heap** (< 200 MB threshold)

Returns HTTP 200 when all checks pass, HTTP 503 if any fail.

---

### GET /metrics

| Property | Value |
|----------|-------|
| **Auth** | Public (unauthenticated) |
| **Method** | GET |
| **Content-Type** | `text/plain; version=0.0.4; charset=utf-8` (Prometheus) |

Exposes Prometheus-compatible metrics using `prom-client`. Includes default
Node.js metrics (event loop lag, heap usage, GC stats, active handles, etc.).

---

## Error Handling

### tRPC Error Codes

All tRPC endpoints use a centralized error mapper (`trpc.error-mapper.ts`)
that translates domain-specific errors into standard tRPC error codes.

| Domain Error | tRPC Code | HTTP Status | When |
|-------------|-----------|-------------|------|
| `TRPCError` (passthrough) | Original code | Varies | Error already mapped |
| `ReportSectionDomainError` | `BAD_REQUEST` | 400 | Invalid draft/submit operations |
| `ReviewAccessError` | `FORBIDDEN` | 403 | Unauthorized review access |
| `AdminAccessError` | `FORBIDDEN` | 403 | Unauthorized admin operations |
| `PublicationAccessError` | `CONFLICT` | 409 | Publication conflicts (e.g., already published) |
| `PdfExportDomainError` | `NOT_FOUND` | 404 | PDF job or report not found |
| `ArchiveDomainError` | `NOT_FOUND` | 404 | Archived report not found |
| `ReminderDomainError` | `BAD_REQUEST` | 400 | Invalid reminder operation |
| `CarryOverDomainError` | `BAD_REQUEST` | 400 | Invalid carry-over operation |
| Unhandled errors | `INTERNAL_SERVER_ERROR` | 500 | Unexpected server errors |

### Auth Errors

| Scenario | tRPC Code | HTTP Status | Message |
|----------|-----------|-------------|---------|
| No session cookie | `UNAUTHORIZED` | 401 | "Not authenticated" |
| Invalid/expired JWT | `UNAUTHORIZED` | 401 | "Not authenticated" |
| Wrong role (not head) | `FORBIDDEN` | 403 | "Head role required" |

### Validation Errors

Input validation is performed by Zod schemas. Invalid inputs return:

```json
{
  "error": {
    "code": "BAD_REQUEST",
    "message": "Validation error",
    "data": {
      "zodError": {
        "issues": [
          {
            "code": "invalid_type",
            "expected": "string",
            "received": "undefined",
            "path": ["reportSectionId"],
            "message": "Required"
          }
        ]
      }
    }
  }
}
```

### Safe Text Validation

All user-facing text fields use the `safeText` helper which enforces:
- No null bytes (`\u0000`) -- PostgreSQL incompatible
- Must contain visible characters (rejects whitespace-only/zero-width strings)
- Configurable min/max length

---

## Shared Schemas

All input/output schemas are defined in `packages/shared/src/schemas/` and
shared between frontend and backend via the `@customreport/shared` package.

### Enum Types

| Schema | Values | Used in |
|--------|--------|---------|
| `trafficLightStatusSchema` | `"green"`, `"yellow"`, `"red"` | Project status indicators |
| `itemTypeSchema` | `"current"`, `"next"` | Work items (this week / next week) |
| `itemWorkflowStatusSchema` | `"done"`, `"in_progress"`, `"blocked"` | Item progress tracking |
| `reportSectionStatusSchema` | `"draft"`, `"submitted"` | Section lifecycle |
| `reportStatusSchema` | `"draft"`, `"published"` | Report lifecycle |
| `periodStatusSchema` | `"open"`, `"published"`, `"reopened"` | Period lifecycle |
| `roleSchema` | `"lead"`, `"head"`, `"viewer"` | User roles |
| `pdfExportStatusSchema` | `"queued"`, `"processing"`, `"completed"`, `"failed"` | PDF job status |
| `carryOverStatusSchema` | `"pending"`, `"completed"`, `"failed"` | Carry-over job status |
| `adminReminderRuleKindSchema` | `"deadline"`, `"follow_up"` | Reminder types |
| `adminReminderRuleStatusSchema` | `"active"`, `"paused"` | Reminder rule state |
| `adminReminderExecutionStatusSchema` | `"queued"`, `"sent"`, `"failed"` | Reminder execution state |

### Key Schema Files

| File | Contents |
|------|----------|
| `packages/shared/src/schemas/auth.ts` | `roleSchema`, `userSessionSchema` |
| `packages/shared/src/schemas/report.ts` | All report, admin, archive, PDF, reminder, carry-over, period, stage, and settings schemas |
