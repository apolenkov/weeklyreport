# Domain Pitfalls: CustomReport

**Domain:** Team status reporting web application
**Researched:** 2026-04-05

---

## Critical Pitfalls

These mistakes cause rewrites or complete feature failures. Prevention is mandatory.

### Pitfall 1: Synchronous PDF Generation (Blocking HTTP, Timeouts)

**What goes wrong:**
- User clicks "Export PDF"
- Backend renders HTML → PDF synchronously (5–15 seconds)
- HTTP response times out (typical timeout: 30s, but after 10s user gives up)
- Multiple concurrent requests → thread pool exhausted
- Frontend hung indefinitely, user closes browser

**Why it happens:**
- Playwright PDF rendering is slow (hardware-bound, not I/O)
- Developer assumes "just add it to the endpoint" (works in test, fails under load)
- No async job queue set up yet

**Consequences:**
- PDF export completely broken in production
- Head cannot send reports to director
- User frustration, app looks broken
- Requires emergency rewrite of PDF generation

**Prevention:**
- ✓ Design PDF generation as BullMQ job (asynchronous from day 1)
- ✓ User clicks → backend adds job → returns job ID immediately
- ✓ Frontend polls `/api/jobs/{jobId}` for status (show spinner)
- ✓ Worker generates PDF in background, stores on disk/S3
- ✓ Frontend detects completion, shows download link

**Detection:**
- Load test: 10 concurrent "Export PDF" requests → if any timeout, you have this pitfall

---

### Pitfall 2: No Validation on Backend (Data Corruption, Security)

**What goes wrong:**
- Frontend validates with Zod before sending
- Developer trusts frontend, backend skips validation
- Malicious user (or bug) sends invalid data directly to API
- Backend crashes or silently corrupts database
- Report shows red flag where it should show green, head publishes wrong data

**Why it happens:**
- "Frontend validation is good enough" (it's not — it's just UX)
- Copy-pasted code from example without validation
- Time pressure: "we'll validate later"

**Consequences:**
- Data corruption (reports with invalid statuses, missing required fields)
- Security vulnerability (no input sanitization)
- Audit trail broken (can't trust historical data)
- Requires data cleanup or database migration

**Prevention:**
- ✓ Zod schema validation on EVERY endpoint (mandatory, non-negotiable)
- ✓ Use same schema frontend + backend (single source of truth)
- ✓ Backend always re-validates, frontend validation is UX only

```typescript
// MANDATORY pattern
@Post("items")
async createItem(@Body() body: unknown) {
  const validated = CreateItemSchema.parse(body); // ALWAYS
  return this.prisma.item.create({ data: validated });
}
```

**Detection:**
- Code review: grep for `@Body()` without `.parse()`
- Automated check: every controller endpoint must validate input

---

### Pitfall 3: Shared Memory Cache Breaks Under Multiple Instances

**What goes wrong:**
- Developer caches report summary in memory: `reportCache[reportId] = {...}`
- Production runs 2–3 NestJS instances (load-balanced)
- Head modifies report in instance A
- Instance B still serves stale cache from memory
- Reports appear to "go backwards" or show inconsistent data across refreshes
- Head thinks app is broken, submits bug report

**Why it happens:**
- "Redis setup is complex" (it's not — it's one environment variable)
- Local development works fine with 1 instance, breaks in production with N instances
- Developer doesn't test with horizontal scaling

**Consequences:**
- Data inconsistency (critical for reports)
- Unpredictable behavior (works sometimes, not others)
- Requires rewrite of cache layer to Redis

**Prevention:**
- ✓ Never cache in memory (process-local state is forbidden)
- ✓ Use Redis for all caching from day 1
- ✓ Backend stateless: all state in PostgreSQL + Redis

```typescript
// DO THIS (Redis shared cache)
const cached = await this.redis.get(`report:${id}`);
if (cached) return JSON.parse(cached);
const report = await this.prisma.report.findUnique({ where: { id } });
await this.redis.set(`report:${id}`, JSON.stringify(report), "EX", 3600);
```

**Detection:**
- Code review: grep for `let cache =`, `const cache =` (should not exist)
- Test: run 2 instances, modify data, request from both → must see consistent data

---

### Pitfall 4: PDF Export Includes Sensitive Data (Compliance Risk)

**What goes wrong:**
- Head exports report including "Risk Assessment" section with sensitive data
- PDF is emailed to director + shared with other departments
- PDF contains project names, risk ratings, mitigation plans that are internal-only
- Accidentally shared externally → compliance violation, audit finding

**Why it happens:**
- No distinction between "internal" and "shareable" report versions
- Developer didn't check what data should be in PDF
- Export includes everything from database by default

**Consequences:**
- GDPR/compliance violation
- Legal review required
- Cannot share reports externally
- Feature is blocked until redesigned

**Prevention:**
- ✓ Define "export format" with product owner first (before coding)
- ✓ Explicitly list which fields go in PDF (whitelist, not blacklist)
- ✓ PDF template only renders approved fields
- ✓ Test: export PDF, manually verify sensitive data is NOT included

```typescript
// Instead of exporting entire report:
const reportForPDF = {
  name: report.name,
  deadline: report.deadline,
  sections: report.sections.map(s => ({
    author: s.authorName,
    projects: s.projects.map(p => p.name), // only names, not risks
    items: s.items.filter(i => i.type === 'current'),
    // NOT included: risks, decisions (internal only)
  })),
};
```

**Detection:**
- Product review: check PDF content against data model
- Manual test: export PDF, verify it contains only approved fields

---

### Pitfall 5: Carry-over Logic Creates Infinite Duplicates

**What goes wrong:**
- Carry-over job runs: items from week 1 → week 2
- Job runs again (duplicate trigger, or rerun): items from week 1 → week 3
- Job runs again: week 1 → week 4
- Items now appear 4x in the new report
- Leads see duplicates, data looks corrupted, app feels broken

**Why it happens:**
- Idempotency not enforced (job is not idempotent)
- Cron job triggers multiple times (misconfiguration)
- Manual job rerun without deduplication

**Consequences:**
- Data corruption (duplicate items)
- Carry-over feature broken
- Requires database cleanup (remove duplicate items)
- Leads lose trust in "auto-carry-over"

**Prevention:**
- ✓ Carry-over is idempotent: check "already carried over" before adding
- ✓ Mark items with `carriedOver: true` when moved
- ✓ Query only items where `carriedOver: false` in next report

```typescript
// IDEMPOTENT pattern
async carryOverItems(previousReportId: string, newReportId: string) {
  const itemsToCarry = await this.prisma.item.findMany({
    where: {
      reportSectionId: { in: previousReportIds },
      carriedOver: false, // KEY: only items not yet carried over
      type: 'next',
    },
  });

  for (const item of itemsToCarry) {
    await this.prisma.item.create({
      data: { ...item, carriedOver: true },
    });
    // Mark original as carried over
    await this.prisma.item.update({
      where: { id: item.id },
      data: { carriedOver: true },
    });
  }
}
```

**Detection:**
- Test: run carry-over job twice with same input → second run adds zero items
- Audit: verify all items have `carriedOver: true/false` consistent with report history

---

## Moderate Pitfalls

### Pitfall 6: Email Reminders Never Sent (BullMQ Configuration)

**What goes wrong:**
- Admin sets "Email reminders 24 hours before deadline"
- Cron job runs, but no emails arrive
- Leads submit late because they didn't see reminder
- Head blames app, deadline missed

**Why it happens:**
- BullMQ worker not started (only job added to queue, nobody processes it)
- Redis connection down (silently fails, no error message)
- SMTP credentials wrong but error swallowed
- Cron job runs but adds jobs to wrong queue

**Prevention:**
- ✓ Start BullMQ worker alongside NestJS (in Docker Compose)
- ✓ Health check: `/health/queues` endpoint returns job count per queue
- ✓ Test: trigger cron manually, verify job in queue, verify email received
- ✓ Monitoring: alert if queue grows without completing (backlog piling up)

**Detection:**
- Health endpoint shows queue backlog (jobs → 0 after worker processes them)
- Manual test: trigger email job, check inbox within 5 seconds

---

### Pitfall 7: Timezone Confusion (Report Deadlines, Carry-over Times)

**What goes wrong:**
- Dev stores deadline as UTC: 2026-04-10 23:59:00 UTC
- Frontend displays it: "2026-04-11 00:59:00 MSK" (user's timezone, +1 hour)
- Carry-over scheduled for 23:00 UTC → 00:00 MSK (midnight)
- Carry-over runs after Friday 00:00 MSK, but deadline hasn't passed yet in UTC
- Leads see new week's items already, before the actual deadline

**Why it happens:**
- Developer forgot to convert UTC ↔ user timezone
- Deadline stored as local time, but cron runs in UTC
- No consistent timezone strategy across frontend + backend

**Prevention:**
- ✓ Store ALL datetimes as UTC in database (no exceptions)
- ✓ Frontend converts UTC → user timezone at display time only
- ✓ Cron jobs reference UTC only (no ambiguity)
- ✓ Test: verify deadline display in multiple timezones

```typescript
// Database: always UTC
const deadline = new Date("2026-04-10T23:59:00Z"); // UTC

// Frontend: convert to user timezone at display
const userTz = Intl.DateTimeFormat().resolvedOptions().timeZone; // 'Europe/Moscow'
const formatter = new Intl.DateTimeFormat('en-US', { timeZone: userTz });
// → displays as "2026-04-11 02:59" in MSK
```

**Detection:**
- Code review: grep for `new Date()` without "Z" suffix (missing timezone)
- Test: change system timezone, verify deadlines still display correctly

---

### Pitfall 8: Report Publication Doesn't Clear Draft

**What goes wrong:**
- Head clicks "Publish"
- Report marked published: `status: "published"`
- But draft ReportSections still exist with `status: "draft"`
- If someone goes back to edit, they're editing the draft version
- Head publishes version A, but draft version B still has old data
- No clear "source of truth" for what's published

**Why it happens:**
- Publish endpoint only sets `Report.status`, doesn't finalize sections
- No clear state machine (draft → submitted → published → ???)
- Data model allows ambiguous state (report published, sections not)

**Prevention:**
- ✓ Define clear state machine: only ReportSection.status matters, Report.status is derived
- ✓ Publish endpoint: finalize ALL sections simultaneously
- ✓ Create immutable "PublishedReport" snapshot once published (optional, but safer)

```typescript
// State machine
@Post("reports/:id/publish")
async publishReport(@Param("id") reportId: string) {
  // Atomically update all sections
  await this.prisma.reportSection.updateMany({
    where: { reportId },
    data: { status: 'published', publishedAt: new Date() },
  });
  // Update report status
  await this.prisma.report.update({
    where: { id: reportId },
    data: { status: 'published' },
  });
}
```

**Detection:**
- Query: find all published reports where any section has status='draft' (should be zero)

---

## Minor Pitfalls

### Pitfall 9: No Audit Trail (Can't Explain Who Changed What)

**What goes wrong:**
- Admin queries database, finds item changed from red to green
- Can't trace who made the change or when
- Head asks "who updated the status?", admin has no answer
- No accountability, no way to revert unauthorized changes

**Prevention:**
- ✓ Add `updatedBy` (user ID) and `updatedAt` to every model
- ✓ Optional: create `AuditLog` table for detailed change history
- ✓ Always set `updatedBy` when modifying records

---

### Pitfall 10: Partial Item Types (Neither "current" nor "next")

**What goes wrong:**
- Item type field: enum `['current', 'next']`
- Bug: item saved with type `'completed'` instead of `'done'` status
- Item doesn't appear in "Current Week" section (filters by type='current')
- Item is lost, user thinks they lost data

**Prevention:**
- ✓ Validate item type strictly at database level (CHECK constraint)
- ✓ Zod schema enforces enum at application level
- ✓ Test: try to create item with invalid type → must fail

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|----------------|-----------|
| **Phase 1: Core Form** | Form doesn't persist on page reload | Use uncontrolled form + React Hook Form, test localStorage auto-save |
| **Phase 2: PDF Export** | Synchronous generation blocks user | Design async from day 1 (BullMQ job), don't optimize later |
| **Phase 3: Email Reminders** | Worker not running, emails never sent | Start worker in Docker Compose, add health check |
| **Phase 4: Carry-over** | Infinite duplicates from re-runs | Idempotency check: `carriedOver: true` before adding |
| **Admin Panel** | User role escalation (lead creates admin) | Guard every endpoint with role check (`@UseGuards(RolesGuard)`) |
| **Deployment** | PgBouncer not configured, connection exhaustion | Start PgBouncer in Docker Compose, configure pool size |

---

## Sources

- Real CustomReport requirements (PROJECT.md)
- BullMQ documentation (job handling)
- Prisma documentation (state management)
- Common pitfalls from similar reporting systems

---

*Last updated: 2026-04-05 (research phase)*
