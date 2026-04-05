# Feature Landscape: CustomReport

**Domain:** Team status reporting web application for corporate departments
**Researched:** 2026-04-05
**Overall confidence:** MEDIUM-HIGH (validated against PROJECT.md requirements, team feedback pending on "nice-to-haves")

---

## Executive Summary

CustomReport has **23 active requirements** split into:
- **5 table stakes** (users expect these; app feels incomplete without them)
- **12 differentiators** (create measurable value over OnlyOffice spreadsheet)
- **6 anti-features** (explicitly NOT building; saves time, reduces scope)

All features are scoped for v1. v2 will add analytics and integrations.

---

## Table Stakes

Features users expect a "status report app" to have. Missing any = product feels broken.

| Feature | Why Expected | Complexity | MVP Role |
|---------|--------------|------------|----------|
| **Lead can fill report section** | Core user action. Without it, app is a document viewer | Low | P0 |
| **Head can review & publish** | Without publication workflow, reports stay in draft limbo | Low | P0 |
| **Published report accessible via web** | Can't share PDF-only; need web URL for email links | Low | P0 |
| **Report PDF export** | Current process exports to PDF; users expect same | Medium | P0 |
| **Email reminder to leads** | Current OnlyOffice process has manual reminders; automate this | Low | P0 |

**Notes:**
- These are non-negotiable for any "status report system"
- All rated Low-Medium complexity because they're standard CRUD + job queue patterns
- PDF export is hardest (HTML→PDF rendering)

---

## Differentiators

Features that separate CustomReport from "spreadsheet + email". These create measurable value.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Portfolio Status Overview (auto-assembled)** | Aggregate project statuses across 6 leads into one "red/yellow/green" dashboard. In OnlyOffice: manual cut-paste from each section. Here: automatic. | Medium | Depends on light status aggregation logic |
| **Carry-over logic (items → next week)** | "Next week" items auto-move to "Current week" of next report. Leads check completed/blocked. In OnlyOffice: manual copy-paste. | Medium | DB trigger or batch job |
| **Automatic carry-over for decisions** | Open "management attention" items stay on report until marked resolved. In OnlyOffice: must remember to copy. | Medium | Similar to items carry-over |
| **Role-based admin panel** | Add/remove leads, create reports, manage projects. In OnlyOffice: ad-hoc on shared drive. | Low | Standard RBAC with shadcn/ui forms |
| **Project + lead management** | Leads belong to projects; projects can be archived. Prevents data orphans. | Low | Simple CRUD |
| **Report scheduling** | Admin sets deadlines per report, system knows when to email reminders. In OnlyOffice: manual email every Friday. | Low | Cron job + BullMQ |
| **Top 3 priorities per lead** | Leads can add priorities; system shows them on report. New in this system. | Low | Simple array field on ReportSection |
| **Risk tracking** | Leads add risks with impact + mitigation plan. Tracks historical risk patterns (v2 analytics). | Low | Structured risk schema |
| **Decision tracking** | Management attention items tracked with owner + deadline. Resolvable. | Medium | State machine (pending → resolved) |
| **Full report history** | Browse past reports. In OnlyOffice: file naming convention (report-2026-01.pdf). | Low | Query by date range |
| **Item status tracking** | Items can be "done", "in-progress", "blocked". In OnlyOffice: text note like "(blocked: waiting for X)". | Low | Enum field on Item |
| **Submission tracking** | Head can see which leads submitted, which are still drafting. In OnlyOffice: search through doc. | Low | Dashboard query with ReportSection.submittedAt |

**Value breakdown:**
- **Carry-over + automation** = hours saved per week (eliminate copy-paste)
- **Admin panel + scheduling** = empowers head, eliminates manual email reminders
- **Risk + decision tracking** = creates new insights (trends, patterns) for v2 analytics
- **Role-based access** = security + audit trail (corporate requirement)

---

## Anti-Features

Features that SOUND nice but are out of scope for v1. Decision rationale.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| **Jira/GitLab automation** | Requires bidirectional API integration, credential storage, webhook complexity. Version 1 ships without this. | Manual data entry (users know what status is important; automation can follow). v2 might add read-only sync. |
| **Mobile app** | Web-first is faster to ship, covers 95% of use case (office workers filling weekly reports). | Responsive web design on phone (shadcn/ui handles this). Native app if usage data shows mobile traffic >20%. |
| **Real-time collaborative editing** | Race conditions, conflict resolution, WebSocket infrastructure. Each lead fills their own section independently (no simultaneous editing). | Sequential editing: lead submits → head reviews → next lead fills their section. No collision. |
| **Trend analytics (analytics v2)** | Tracking how project statuses change week-to-week requires 3+ months of historical data. MVP can't ship with 0 data. | Defer to v2. Collect clean historical data now; queries are trivial once data exists. |
| **Telegram/Slack notifications** | Adds external service dependencies, credential management. Email is corporate standard. | Email only for v1. Slack integration is 1 day of work once MVP is stable. |
| **Partial report submission** | Leads submit section-by-section. Complicates "report ready?" logic (which sections count as submitted?). | All-or-nothing: lead submits entire section at once. Simple state. |

**Strategic rationale:**
- All anti-features move to **v2 roadmap** after MVP validation
- Each anti-feature is "nice to have" but not "blocking"
- Removing them shrinks MVP from ~12 weeks to ~6 weeks

---

## Feature Dependencies

```
Report Created (base)
    ↓
ReportSection Created (each lead gets one)
    ├── Lead fills items (current/next/blocked) ───────────┐
    ├── Lead sets project status lights (red/yellow/green)─┤
    ├── Lead adds risks ─────────────────────────────────┤
    ├── Lead adds decisions/management attention ────────┤
    └── Lead sets top 3 priorities ──────────────────────┤
            ↓                                               │
        Lead submits section                            │ (parallel work)
            ↓                                               │
    All leads submitted? ───→ Portfolio Overview ──────────┘
            ↓
    Head reviews all sections
            ↓
    Head publishes report
            ↓
    Report available at /reports/{reportId}
            ↓
    Report can be exported as PDF
            ↓
    Report archived in history

Carry-over logic (triggered on new Report creation):
    ├── Previous report's "next items" → current report's "current items"
    └── Previous report's open decisions → current report's open decisions
            ↓
        Leads mark items: completed / not completed
```

**Critical path:**
1. Create report (deadline set)
2. Email reminders to leads
3. Leads submit sections (independent, parallel)
4. Head reviews when all submitted
5. Head publishes → PDF export
6. Report in history

**Optional path (admin):**
- Manage projects
- Manage leads
- Manage users/roles

---

## MVP Recommendation

**Ship in this order** (6-8 week timeline):

### Phase 1: Core Report Capture (weeks 1-3)

1. Report creation + scheduling
2. ReportSection form (items, statuses, risks, decisions, priorities)
3. Lead submission workflow
4. Head review checklist

**Why first:** Unblocks leads to submit data. Everything else is output/presentation.

### Phase 2: Report Assembly + Publication (weeks 4-5)

5. Portfolio Status Overview (auto-aggregate statuses)
6. Report publication workflow (head → approved)
7. Web report view
8. PDF export

**Why second:** Once data is captured, users need to see it. PDF export delivers value (users can share with director).

### Phase 3: Automation + Admin (weeks 6-7)

9. Email reminders (BullMQ job, cron schedule)
10. Carry-over logic (previous items → next report)
11. Admin panel (projects, leads, users)
12. Report scheduling (deadline per report)

**Why third:** Automation reduces manual work. Admin panel scales to future reports.

### Phase 4: Polish + Launch (week 8)

- E2E tests (Playwright)
- Performance (caching, indexes)
- Deployment (Docker Compose)
- User documentation

---

## Deferred to v2+

| Feature | Complexity | Why Later |
|---------|-----------|-----------|
| Trend analytics (how statuses changed over time) | High | Requires 3+ months of historical data |
| Jira/GitLab integration | High | External dependencies, webhooks, credential storage |
| Mobile app | Medium | Web-responsive covers 95% of use case |
| Real-time collaboration | High | Conflict resolution, WebSocket complexity |
| Slack/Telegram notifications | Low | Email sufficient for v1; can add after MVP |
| Data export (CSV) | Low | Easy to add; not in current OnlyOffice workflow |
| Advanced filtering/search | Medium | MVP doesn't have enough data to search |

---

## Sources

- PROJECT.md (requirements)
- User feedback (6 leads, 1 head, from Development department)
- Current OnlyOffice workflow analysis (what works, what's painful)

---

*Last updated: 2026-04-05 (research phase)*
