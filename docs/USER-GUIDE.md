# CustomReport User Guide

CustomReport automates weekly status reporting for a software department.
Each team lead fills a structured report form, the system compiles all
submissions into a unified weekly report, and the department head publishes
the final version.

This guide covers workflows for each role: **Lead**, **Head**, and **Admin**.

---

## Roles Overview

| Role      | Primary Action                     | Entry Point                |
| --------- | ---------------------------------- | -------------------------- |
| **Lead**  | Fill and submit weekly report      | `/report` (My Report)      |
| **Head**  | Review submissions, publish report | `/dashboard`               |
| **Admin** | Manage users, products, periods    | `/dashboard` then `/admin` |

---

## Lead Workflows

### Logging In

Navigate to the application URL. In development mode, the login page shows
role-selector buttons — click **"Enter as Lead"** to authenticate with a test
account.

In production, click **"Sign in with SSO"** to authenticate via Keycloak
(SAML 2.0).

![Login page](../mockups/screenshots/s8-login.png)

After login, Leads are redirected to **My Report** (`/report`).

### Filling the Weekly Report Form

The Lead Form is your primary workspace. It contains these sections:

1. **SDLC Pipeline** — Set the status of each stage you own (On Track, At Risk,
   or Blocked) for every product assigned to you.
2. **Current Week** — Add kanban items for tasks completed or in progress this
   week, tagged to a product and stage.
3. **Next Week** — Add planned items for the coming week.
4. **Risks & Blockers** — Describe risks scoped to a specific product and stage.
5. **Decisions** — Items requiring management decision, tagged to a product.
6. **Top 3 Priorities** — Ranked list of your top priorities for the week.

![Lead form](../mockups/screenshots/s1-lead-form.png)

#### SDLC Pipeline

The pipeline shows all products where you own at least one stage. For each
product, the 7 canonical stages are displayed:

```
Planning -> Analysis -> Design -> Dev -> Testing -> DevOps -> Support
```

- **Your stages** are editable — click to cycle between On Track, At Risk,
  or Blocked.
- **Locked stages** (owned by another lead) are dimmed and read-only.
- **Unassigned stages** show a dashed border.
- **Empty stages** (yours, not yet filled) pulse with a dashed border to
  remind you to set a status.

#### Kanban Items

Items are grouped by product. Each item has:

- **Text** — description of the task
- **Tag** — category label (e.g., feature, bugfix, refactor)
- **Workflow status** — Completed, In Progress, Blocked (current week) or
  Planned (next week)

#### Autosave

The form autosaves as you work. A version snapshot is created with each
autosave, building a version history you can navigate.

### Submitting the Report

When your form is complete, click **"Submit Report"**. A confirmation modal
shows a summary of your item counts, risks, and decisions. After confirmation:

- Your form becomes **read-only** for the current period.
- The Head can see your submission in the compiled Weekly Report.
- A "Submitted" badge appears on your section in the Dashboard.

**Validation requirements before submit:**

- Every product must have a traffic-light status set for all your assigned stages
- Every product must have at least one Current Week item
- All 3 priority slots must have non-empty text

### Viewing History

Navigate to **History** (`/history`) to see all your past submissions organized
by period.

![Lead history](../mockups/screenshots/s9-lead-history.png)

- Each past period shows your submitted data in read-only form.
- Click a period to expand and review your items, risks, and decisions.

### Fill From Previous

When starting a new period, you can pre-fill your form from any past submission:

1. Click **"Fill from Previous"** to copy data from the most recent submitted
   period (quick action).
2. Click the **dropdown arrow** to open a searchable dialog listing all past
   periods with item/risk/decision counts.
3. If your current form already has data, a warning dialog appears — confirm
   "Replace & Fill" or cancel.

**What gets filled:** Current Week items (as new items), Risks, Decisions.
Priorities are NOT filled — they must be set fresh each week. Next Week items
from the source period become Current Week suggestions.

### Version History

Each autosave creates a version snapshot. You can navigate versions:

1. Use the **version navigator** (arrow buttons) in the form header to step
   through versions.
2. Click the version label (e.g., "v3") to open the **Version History modal**
   with all snapshots listed by timestamp.
3. Click **"Restore"** on any version to roll back.

**Important:** Editing from a past version discards all newer versions (linear
history, like an undo stack). A warning confirms this before proceeding.

### Period Navigation

The Lead Form has a **period navigator** (left/right arrows + dropdown) to
switch between reporting periods:

- **Current open period** — editable, fill and submit as normal.
- **Past submitted period** — read-only, shows "Viewing past period" banner.
- **Published period** — read-only, shows "Report published by [Head] on [Date]"
  banner with a "Request Reopen" option.

---

## Head Workflows

### Dashboard

After login, Heads are directed to the **Dashboard** (`/dashboard`) — the
central hub for monitoring the reporting cycle.

![Dashboard](../mockups/screenshots/s2-dashboard.png)

The Dashboard contains:

1. **KPI Cards** — Three summary cards:
   - **Submissions**: progress (e.g., "4/6") with a progress bar
   - **Deadline**: countdown to the period deadline (e.g., "2d 5h")
   - **Escalations**: count of risks and decisions requiring action

2. **Alert Bar** — Yellow banner listing leads who have not yet submitted,
   with a **"Send Reminder"** button to nudge them.

3. **My Report Hero Card** — Quick link to the current period's Weekly Report.

4. **Blocked & At Risk** — Collapsible table showing products with stage issues
   across all leads.

5. **Lead Reports** — All 6 leads listed with their submission status. Click
   any lead to view their form. Submitted leads show a **"Revoke"** button.

6. **Report Archive** — Paginated list of past published weekly reports.

### Reviewing the Weekly Report

Navigate to **Weekly Report** (`/report/weekly`) to see the auto-compiled
report from all lead submissions.

![Weekly Report](../mockups/screenshots/s3-weekly-report.png)

The Weekly Report is built automatically as leads submit — there is no manual
"create report" step. It includes:

- **Portfolio Overview** — All products with worst-case status (if any stage is
  Blocked, the product shows Blocked).
- **Per-Lead Sections** — Expandable accordion for each lead showing their
  items, risks, decisions, and priorities.
- **Escalations** — Consolidated view of all Blocked/At Risk stages and risks
  from all leads.

During an **Open** period, the report shows a "Live" badge (e.g., "Live -
4/6 Submitted") and updates in real-time as leads submit.

### Publishing and Locking a Period

When all submissions are in (or you decide to proceed):

1. Click **"Publish & Lock"** on the Weekly Report page.
2. If any leads have not submitted, a warning appears: "N leads haven't
   submitted. Publish anyway?"
3. On confirmation:
   - All lead forms for this period become **read-only** (locked).
   - The Weekly Report badge changes to "Published".
   - The report is frozen and immutable.

### Reopening a Period

If corrections are needed after publishing:

1. Click **"Reopen"** on the published Weekly Report.
2. All lead forms return to editable state.
3. The report badge returns to "Live" status.
4. Leads can resume editing and resubmit.

### Revoking a Lead's Submission

From the Dashboard's **Lead Reports** section:

1. Find the submitted lead.
2. Click **"Revoke"** next to their name.
3. The lead's form returns to **Draft** (editable) state.
4. The Weekly Report updates automatically, removing the revoked lead's data.
5. The lead receives a notification.

### Exporting to PDF

On the Weekly Report page, click **"Export PDF"**:

1. A PDF generation job is queued (via BullMQ).
2. The system renders the report HTML through Playwright and produces a PDF.
3. When complete, a download link appears.

PDF export is available only for **published** reports.

### Browsing the Report Archive

The Dashboard's **Report Archive** section shows all past published reports
with pagination. Click any report to view its full content in read-only mode.

You can also use the **period navigator** on the Weekly Report page to browse
historical reports — left/right arrows for quick navigation, or use the
dropdown to jump to a specific period.

---

## Admin Workflows

Admin has full access to the Dashboard and Weekly Report (same as Head),
plus the **Admin Panel** (`/admin`) for system configuration.

![Admin Panel](../mockups/screenshots/s4-admin.png)

### Managing Users

In the **Users** tab of the Admin Panel:

- **Add a user**: Click "Add User", enter name, email, and select a role
  (Lead, Head, or Admin).
- **Edit a user**: Click on an existing user to change their name, email,
  or role.
- **Remove a user**: Click the delete icon and confirm.

Each user's assigned products are shown as tags.

### Managing Products and Stage Assignments

In the **Products** tab:

- **Add a product**: Click "Add Product", enter the product name.
- **Configure stages**: For each product, select which of the 7 SDLC stages
  are active (Planning, Analysis, Design, Dev, Testing, DevOps, Support).
- **Assign people**: Use the assignee dropdown on each active stage to assign
  a lead. One person per stage per product.
- **Archive a product**: Click the archive action to soft-delete (hides from
  active views but preserves historical data).

**Validation:** The system prevents assigning the same user to the same stage
on the same product twice.

### Managing Report Periods

In the **Periods** tab:

- **Create a period**: Set start date, end date, deadline, and week label.
  The week label auto-generates (e.g., "Week 17") but can be overridden.
- **Edit a period**: Adjust dates or deadline before the period is published.

Periods define the reporting cycle — leads fill forms for the current open
period, and the Head publishes when ready.

### Configuring Reminders

In the **Reminders** tab, toggle-based rules control automatic notifications:

- **Deadline day reminder** (10:00) — sent to leads who have not submitted.
- **24h before deadline** — sent to leads who have not started.
- **Weekly summary for manager** — sent Friday at 17:00.

Manual reminders can be sent from the Dashboard alert bar to specific
pending leads.

### Application Settings

In the **Settings** tab:

- **Department name** — displayed in reports and UI headers.
- **Auto-create periods** — toggle automatic period creation.
- **Default deadline days** — number of days from period start to deadline.

---

## UI States Reference

![UI states](../mockups/screenshots/s7-ui-states.png)

| State            | Visual                         | Meaning                            |
| ---------------- | ------------------------------ | ---------------------------------- |
| Skeleton loading | Pulsing gray rectangles        | Data is being fetched              |
| Empty state      | Dashed border card             | No submissions yet                 |
| Locked form      | Green info card with lock icon | Form submitted, read-only          |
| Validation error | Red border on input            | Required field is empty or invalid |
| Toast: success   | Green left-border card         | Action completed                   |
| Toast: error     | Red left-border card           | Action failed, retry available     |
| Toast: warning   | Yellow left-border card        | Approaching deadline               |

---

## Page Map

| Page                        | URL                              | Who Uses It                |
| --------------------------- | -------------------------------- | -------------------------- |
| Login                       | `/login`                         | Everyone (unauthenticated) |
| My Report (Lead Form)       | `/report`                        | Lead                       |
| My Report (specific period) | `/report?period=2026-W15`        | Lead                       |
| Lead History                | `/history`                       | Lead                       |
| Dashboard                   | `/dashboard`                     | Head, Admin                |
| Weekly Report               | `/report/weekly`                 | Head, Admin                |
| Weekly Report (past)        | `/report/weekly?period=2026-W15` | Head, Admin                |
| Admin Panel                 | `/admin`                         | Admin                      |
| Admin Panel (specific tab)  | `/admin?tab=products`            | Admin                      |

All pages are bookmarkable — period selection and tab state are stored in URL
query parameters, not client-side state.

---

## Language Policy

- **UI labels, buttons, headings, navigation**: English
- **Status badges**: English (On Track, At Risk, Blocked, Draft, Submitted, Published)
- **SDLC stage names**: English (Planning, Analysis, Design, Dev, Testing, DevOps, Support)
- **User-entered content** (task descriptions, risks, priorities): Russian
