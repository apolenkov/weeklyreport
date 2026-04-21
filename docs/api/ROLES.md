# Role Capability Matrix

CustomReport defines three roles: **Lead**, **Head**, and **Viewer**.
Each role has a distinct set of capabilities enforced at the tRPC middleware layer.

## Authentication

| Action | Lead | Head | Viewer |
|--------|------|------|--------|
| SAML login (`GET /auth/saml/login`) | Yes | Yes | Yes |
| SAML callback (`POST /auth/saml/callback`) | Yes | Yes | Yes |
| Logout (`POST /auth/logout`) | Yes | Yes | Yes |
| Dev login (`GET /auth/dev-login`) | Yes | Yes | Yes |
| Auto-create weekly report on login | Yes | No | No |
| Session contains `activeReportSectionId` | Yes | No | No |
| Session contains `activeReportId` | Yes (from section) | Yes (latest draft) | Yes (latest draft) |

## Reports Namespace (`reports.*`)

| Endpoint | Type | Lead | Head | Viewer | Notes |
|----------|------|------|------|--------|-------|
| `reports.getActive` | query | Own section | null (no sectionId) | null (no sectionId) | Returns `ReportSectionReadModel` or `null` |
| `reports.myHistory` | query | Own sections | Own sections (empty if none) | Own sections (empty if none) | All past `ReportSection` records for user |
| `reports.saveDraft` | mutation | Own draft section | Technically callable but no sectionId | Technically callable but no sectionId | Validates section exists + is draft + report not published |
| `reports.submit` | mutation | Own draft section | Same restriction | Same restriction | Validates traffic lights, current items, 3 priorities |

### Lead-specific behavior
- On login, if no active section exists for the current week, the system auto-creates:
  - `Report` (Mon 00:00 - Sun 23:59:59) if none exists
  - `ReportSection` for this lead
  - 3 default `Priority` records (rank 1-3)
  - `ProjectStatus` records for each non-archived project led by this user

### Key validation rules for submit
1. Every project assigned to lead must have a traffic light status (green/yellow/red)
2. Every project must have at least one `current` week item
3. Exactly 3 priorities with unique ranks, all with non-empty text
4. `confirmed: true` must be set

## Review Namespace (`review.*`)

| Endpoint | Type | Lead | Head | Viewer | Notes |
|----------|------|------|------|--------|-------|
| `review.dashboard` | query | Allowed (protectedProcedure) | Allowed | Allowed | Returns `SubmissionDashboardRow[]` sorted by status then name (Russian locale) |
| `review.assembledReport` | query | **DENIED** (403 FORBIDDEN) | Allowed | **DENIED** (403 FORBIDDEN) | Returns full `AssembledReport` with portfolio overview |
| `review.publish` | mutation | **DENIED** (403 FORBIDDEN) | Allowed | **DENIED** (403 FORBIDDEN) | Sets report status=published, publishedAt, publishedById |

### Head workflow
1. View dashboard to see which leads have submitted
2. View assembled report to review all sections
3. Publish report (irreversible - report becomes immutable)

## PDF Export Namespace (`pdfExport.*`)

| Endpoint | Type | Lead | Head | Viewer | Notes |
|----------|------|------|------|--------|-------|
| `pdfExport.request` | mutation | **DENIED** (403) | Allowed | **DENIED** (403) | Requires report to be published; creates BullMQ job |
| `pdfExport.status` | query | Allowed | Allowed | Allowed | Polls job status by jobId |

### PDF generation flow
1. Head requests export for a published report
2. System creates `PdfExportJob` (status: queued)
3. BullMQ worker picks up job, generates PDF via Playwright
4. Job status transitions: queued -> processing -> completed/failed
5. Any authenticated user can poll status

## Admin Namespace (`admin.*`)

| Endpoint | Type | Lead | Head | Viewer | Notes |
|----------|------|------|------|--------|-------|
| `admin.snapshot` | query | **DENIED** (403) | Allowed | **DENIED** (403) | Returns all users, projects, periods, reminder rules |
| `admin.saveUser` | mutation | **DENIED** (403) | Allowed | **DENIED** (403) | Upsert user (create or update) |
| `admin.saveProject` | mutation | **DENIED** (403) | Allowed | **DENIED** (403) | Upsert project |
| `admin.savePeriod` | mutation | **DENIED** (403) | Allowed | **DENIED** (403) | Upsert report period |
| `admin.saveReminderRule` | mutation | **DENIED** (403) | Allowed | **DENIED** (403) | Upsert reminder rule |
| `admin.deleteUser` | mutation | **DENIED** (403) | Allowed | **DENIED** (403) | Hard-delete user from system |
| `admin.deleteProject` | mutation | **DENIED** (403) | Allowed | **DENIED** (403) | Soft-delete: sets `archived: true` |
| `admin.deleteReminderRule` | mutation | **DENIED** (403) | Allowed | **DENIED** (403) | Hard-delete reminder rule |

### Admin capabilities
- **Users**: CRUD (create lead/head/viewer accounts, assign roles)
- **Projects**: CRUD (create projects, assign leads, archive)
- **Periods**: CRUD (create report periods with start/end/deadline)
- **Reminder Rules**: CRUD (deadline reminders, follow-up reminders)

## Archive Namespace (`archive.*`)

| Endpoint | Type | Lead | Head | Viewer | Notes |
|----------|------|------|------|--------|-------|
| `archive.list` | query | Allowed | Allowed | Allowed | Returns published reports sorted by publishedAt desc |
| `archive.detail` | query | Allowed | Allowed | Allowed | Returns full report detail with all sections |

### Archive behavior
- Only published reports appear in archive
- All roles can view historical reports
- Reports in archive are immutable

## Reminders Namespace (`reminders.*`)

| Endpoint | Type | Lead | Head | Viewer | Notes |
|----------|------|------|------|--------|-------|
| `reminders.execute` | mutation | **DENIED** (403) | Allowed | **DENIED** (403) | Triggers email reminder for a specific rule + recipient |
| `reminders.listExecutions` | query | **DENIED** (403) | Allowed | **DENIED** (403) | Lists past reminder executions for a rule |

### Reminder flow
1. Head creates reminder rules via admin panel
2. Head manually triggers execution for specific recipients
3. System deduplicates by `ruleId:fireAt:email` key
4. BullMQ worker sends email with 3 retries (exponential backoff)

## CarryOver Namespace (`carryOver.*`)

| Endpoint | Type | Lead | Head | Viewer | Notes |
|----------|------|------|------|--------|-------|
| `carryOver.execute` | mutation | **DENIED** (403) | Allowed | **DENIED** (403) | Copies items/decisions from source to target report |

### CarryOver behavior
1. Source and target must be different reports
2. Copies `next` items as `current` items (with `carriedOver: true`)
3. Copies unresolved decisions
4. Matches sections by `authorId` (same lead in both periods)
5. Deduplicates by `sourceReportId:targetReportId` key

## Role Summary

### Lead (Team Lead)
- **Primary action**: Fill and submit their report section
- **Can view**: Own section, own history, dashboard (all leads' status), archive
- **Cannot**: Access admin, publish reports, export PDF, manage reminders, carry over

### Head (Department Head / Director)
- **Primary action**: Review submissions, publish final report, manage system
- **Can view**: Everything (dashboard, assembled report, archive, admin panel)
- **Can do**: Publish, export PDF, send reminders, carry over items, CRUD users/projects/periods
- **Cannot**: Has no report section to fill (no `activeReportSectionId`)

### Viewer (Stakeholder / Observer)
- **Primary action**: View published reports
- **Can view**: Dashboard (submission status), archive (published reports)
- **Cannot**: Edit anything, access admin, publish, export PDF, manage reminders
- **Has no**: Active section, admin access

## Auth Guard Implementation

```
publicProcedure  -> no auth check (unused in production routes)
protectedProcedure -> requires valid JWT session (any role)
headProcedure    -> requires valid JWT session + role === 'head'
```

There is no `leadProcedure` — lead-specific behavior is enforced by data access
(lead can only access their own `activeReportSectionId` from the session).

## Session Structure

```typescript
{
  userId: string;       // UUID
  email: string;        // from SAML or dev-login
  name: string;         // display name
  role: 'lead' | 'head' | 'viewer';
  activeReportId: string | null;        // current draft report
  activeReportSectionId: string | null; // lead's section (null for head/viewer)
}
```

Session is baked into JWT at login time. If the active report changes (new week),
the user must re-login to get updated session.
