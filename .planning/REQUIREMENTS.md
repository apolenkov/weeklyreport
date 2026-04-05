# Requirements: CustomReport

**Defined:** 2026-04-06
**Core Value:** Лиды заполняют свои секции независимо через удобную форму, система автоматически собирает единый отчёт — без конфликтов редактирования, с историей и аналитикой.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Authentication & Authorization

- [ ] **AUTH-01**: User can log in via SSO SAML through Keycloak
- [ ] **AUTH-02**: System supports three roles: lead, head, viewer
- [ ] **AUTH-03**: User session persists via JWT after SAML assertion
- [ ] **AUTH-04**: Unauthorized users are redirected to Keycloak login page

### Report Entry

- [ ] **ENTRY-01**: Lead can create structured items (project, text, tag, status) for current and next period
- [ ] **ENTRY-02**: Lead can set traffic light status (green/yellow/red) per project
- [ ] **ENTRY-03**: Lead can add risks (project, risk, impact, mitigation)
- [ ] **ENTRY-04**: Lead can add management decisions (text, owner, deadline, impact)
- [ ] **ENTRY-05**: Lead can set Top 3 priorities
- [ ] **ENTRY-06**: Lead can save section as draft and continue editing later
- [ ] **ENTRY-07**: Lead can submit section (status changes to "submitted")
- [ ] **ENTRY-08**: Items from "next period" auto-carry to "current period" in the next report
- [ ] **ENTRY-09**: Lead can mark carried-over items as completed or not completed
- [ ] **ENTRY-10**: Unresolved decisions auto-carry to next report until marked resolved

### Report Assembly & Publication

- [ ] **PUB-01**: Portfolio Status Overview auto-assembles from all leads' traffic lights
- [ ] **PUB-02**: Head can see submission status dashboard (who submitted, who hasn't)
- [ ] **PUB-03**: Head can review the assembled report before publishing
- [ ] **PUB-04**: Head can edit any section in the assembled report
- [ ] **PUB-05**: Head can publish the report (becomes read-only, visible to viewers)
- [ ] **PUB-06**: Published report is viewable as a web page
- [ ] **PUB-07**: Published report can be exported to PDF matching current visual format

### Admin Panel

- [ ] **ADMIN-01**: Head can manage users (add, remove, change role)
- [ ] **ADMIN-02**: Head can manage projects (create, archive, assign to lead)
- [ ] **ADMIN-03**: Head can create report periods with start date, end date, and deadline
- [ ] **ADMIN-04**: Head can configure email reminder schedule

### Notifications

- [ ] **NOTIF-01**: System sends email reminders to leads who haven't submitted by deadline
- [ ] **NOTIF-02**: Email reminders follow configurable schedule (e.g., Friday 9AM, Friday 2PM)

### History

- [ ] **HIST-01**: All published reports are archived and browsable
- [ ] **HIST-02**: User can view any past report in full detail

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Analytics

- **ANAL-01**: Trend charts showing project health trajectory over weeks
- **ANAL-02**: Risk aggregation dashboard (most common risks across projects)
- **ANAL-03**: Decision resolution timeline (how long decisions stay open)

### Integrations

- **INTG-01**: Slack/Teams notification when report is published
- **INTG-02**: Jira integration to auto-populate items from sprint data

### Enhanced UX

- **UX-01**: Lead can reorder items via drag-and-drop
- **UX-02**: Lead can use rich text formatting (bold, links, lists) in item text
- **UX-03**: Head can add comments/annotations to individual items during review

## Out of Scope

| Feature | Reason |
|---------|--------|
| Real-time collaborative editing | Each lead works in their own section — no conflicts by design |
| Mobile app | Web-first, responsive design sufficient |
| Per-item privacy controls | All items visible to all roles — corporate transparency |
| AI-powered risk summaries | Complexity without proven value in v1 |
| Telegram/Slack bot for submission | Email-only for v1, Slack in v2 |
| Custom report templates | Fixed format matching current PDF, customization in v2 |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| AUTH-01 | Phase 1 | Pending |
| AUTH-02 | Phase 1 | Pending |
| AUTH-03 | Phase 1 | Pending |
| AUTH-04 | Phase 1 | Pending |
| ENTRY-01 | Phase 1 | Pending |
| ENTRY-02 | Phase 1 | Pending |
| ENTRY-03 | Phase 1 | Pending |
| ENTRY-04 | Phase 1 | Pending |
| ENTRY-05 | Phase 1 | Pending |
| ENTRY-06 | Phase 1 | Pending |
| ENTRY-07 | Phase 1 | Pending |
| ENTRY-08 | Phase 3 | Pending |
| ENTRY-09 | Phase 3 | Pending |
| ENTRY-10 | Phase 3 | Pending |
| PUB-01 | Phase 2 | Pending |
| PUB-02 | Phase 1 | Pending |
| PUB-03 | Phase 2 | Pending |
| PUB-04 | Phase 2 | Pending |
| PUB-05 | Phase 2 | Pending |
| PUB-06 | Phase 2 | Pending |
| PUB-07 | Phase 2 | Pending |
| ADMIN-01 | Phase 3 | Pending |
| ADMIN-02 | Phase 3 | Pending |
| ADMIN-03 | Phase 3 | Pending |
| ADMIN-04 | Phase 3 | Pending |
| NOTIF-01 | Phase 3 | Pending |
| NOTIF-02 | Phase 3 | Pending |
| HIST-01 | Phase 3 | Pending |
| HIST-02 | Phase 3 | Pending |

**Coverage:**
- v1 requirements: 29 total
- Mapped to phases: 29
- Unmapped: 0 ✓

---

*Requirements defined: 2026-04-06*
*Last updated: 2026-04-06 after roadmap creation*
