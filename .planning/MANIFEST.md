# MANIFEST — CustomReport v4.0

Technical specification for the weekly status reporting system of the CoreDev department.

**Domain:** ~12 products, ~6 leads, 7 canonical SDLC stages, weekly reporting cycle.

---

## 1. Roles & Access Model

Three roles with distinct access patterns:

| Role      | Description         | Sees                                            | Can Do                                                                                                                                                                                                       |
| --------- | ------------------- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Admin** | Superuser           | Everything                                      | Configure products, SDLC stages, stage assignees, users, periods, reminder rules. Full CRUD on all entities. Enter any lead's form to edit/submit. Revoke lead submissions. Publish & Lock / Reopen periods. |
| **Head**  | Department Director | Dashboard, Weekly Report, Admin Panel (limited) | Review auto-generated report, Publish & Lock, Reopen period, send reminders, export PDF, revoke lead submissions. View all lead forms from Dashboard.                                                        |
| **Lead**  | Team Lead           | My Report (lead form), History                  | Fill weekly report for assigned stages only. See only products where they own at least 1 stage. Edit only their own stages and kanban items. Request Reopen on locked forms.                                 |

Role assignment is managed by Admin in the Admin Panel (Users tab).

---

## 2. Two-Level Access Model

Access is enforced at two levels, both derived from SDLC stage assignments:

### Level 1: Product Access

A Lead sees a product in their form **if and only if** they are assigned to at least 1 SDLC stage in that product.

- Products with 0 assigned stages for this Lead: **not shown** in the Lead Form at all.
- Example: Polenkov A. has stages in 6 of 12 products, so his Lead Form shows 6 products. The Assembled Report (Head view) shows all 12 across all leads.

### Level 2: Stage Access

Within a product the Lead can see, each SDLC stage falls into one of these categories:

| Category                | Condition                               | Visual                                                 | Interaction                                          |
| ----------------------- | --------------------------------------- | ------------------------------------------------------ | ---------------------------------------------------- |
| **Your stage (filled)** | Assigned to you, status set this period | Solid border, colored background                       | Editable — click to change status                    |
| **Your stage (empty)**  | Assigned to you, no status set yet      | Pulsing dashed border                                  | Editable — click to fill                             |
| **Locked stage**        | Assigned to another person              | `opacity: .35`, `grayscale(.5)`, `cursor: not-allowed` | Read-only, no hover effects                          |
| **Unassigned stage**    | Stage exists but no assignee set        | Dashed border, muted colors                            | Read-only for everyone, tooltip says "Contact admin" |

Key rule: a Lead can **see** all stages of a product they have access to, but can **edit** only stages assigned to them.

---

## 3. SDLC Pipeline

### 7 Canonical Stages

```text
Planning → Analysis → Design → Dev → Testing → DevOps → Support
```

These are the maximum possible stages. Each product can have 1 to 7 stages, configured by Admin in the Products tab.

### Stage Configuration (Admin)

For each product, Admin defines:

- Which stages are active (subset of the 7 canonical stages)
- Who is assigned to each stage (one person per stage, or unassigned)

### Stage States (per reporting period)

Each stage in a product has a status for the current reporting period:

| State          | Icon | Background          | Meaning                                  |
| -------------- | ---- | ------------------- | ---------------------------------------- |
| **On Track**   | `✓`  | Green (`#d4e9e2`)   | Proceeding normally                      |
| **At Risk**    | `!`  | Yellow (`#fef3c7`)  | Potential problems, may need attention   |
| **Blocked**    | `✕`  | Red (`#fee2e2`)     | Cannot proceed, needs escalation         |
| **Empty**      | `○`  | Neutral (`#f9f9f9`) | Not yet filled for this period           |
| **Unassigned** | `○`  | Neutral, dashed     | No assignee — cannot be filled by anyone |

Stage status is set by the assigned Lead when filling their weekly report. The status resets to Empty each new reporting period.

---

## 4. Data Flow: Lead Form → Assembled → Published

### 4.1. Lead Submission Lifecycle

Three lead-level states:

| State         | Meaning                                   | Form State                                |
| ------------- | ----------------------------------------- | ----------------------------------------- |
| **Pending**   | Lead has not started the report           | Form empty, not visited                   |
| **Draft**     | Lead has started filling, autosave active | Form editable, badge "Autosaved"          |
| **Submitted** | Lead clicked "Submit Report"              | Form locked, read-only, badge "Submitted" |

After submission, the Lead's form is locked for the current period. The submit action is confirmed via a modal showing item/risk/decision counts.

### 4.2. Period Lifecycle

Three period-level states:

| State                  | Meaning                       | Lead Form                        | Weekly Report                                |
| ---------------------- | ----------------------------- | -------------------------------- | -------------------------------------------- |
| **Open**               | Accepting lead submissions    | Editable (until lead submits)    | Auto-generated, badge "Live · 4/6 Submitted" |
| **Published (Locked)** | Head clicked "Publish & Lock" | Read-only for all leads          | Frozen, badge "Published · Week 16"          |
| **Reopened**           | Head/Admin clicked "Reopen"   | Editable again (lead can resume) | Returns to "Live" state                      |

The Weekly Report is **auto-generated** from submitted lead data — there is no manual "create report" step. The report compiles automatically as leads submit their forms. The only Head actions on the report are: **Export PDF** and **Publish & Lock**.

### 4.2.1. Publish & Lock Flow (D-56)

1. Head clicks **"Publish & Lock"** on the Weekly Report page.
2. If pending leads exist, a warning is shown: "2 leads haven't submitted. Publish anyway?"
3. On confirmation, all lead forms for this period become **read-only** (locked).
4. The Weekly Report badge changes to "Published".
5. Only Head or Admin can **Reopen** the period for edits.
6. A locked Lead sees a banner: "Report published by [Head Name] on [Date]. Request Reopen if changes needed."
7. Lead can click **"Request Reopen"** — sends notification to Head/Admin.

### 4.2.2. Revoke Submit (D-57)

Admin or Head can revoke a specific lead's submission from the Dashboard:

1. In the **Lead Reports** section of Dashboard, each submitted lead has a **"Revoke"** button.
2. Clicking "Revoke" returns that lead's form to **editable** (Draft) state.
3. The lead's submission status reverts from "Submitted" to "Draft".
4. The Weekly Report updates automatically (removes the revoked lead's data from the compiled view).
5. The lead receives a notification that their submission was revoked.

### 4.2.3. Period-Based Form Access (D-64)

The Lead Form is period-aware — a Lead can navigate between periods:

| Period State                    | Lead Form Behavior                                                              |
| ------------------------------- | ------------------------------------------------------------------------------- |
| **Open (current)**              | Editable — Lead fills and submits                                               |
| **Open (not yet started)**      | Admin created the period but deadline hasn't passed — Lead can fill             |
| **Published**                   | Read-only — banner "Report published by [Head] on [Date]" with "Request Reopen" |
| **Past (not created by admin)** | No form available — period doesn't exist in the system                          |
| **Past (submitted)**            | Read-only — banner "Viewing past period · Week 15" with submission timestamp    |

Navigation: Lead Form has a **period navigator** (← combobox →) to switch between periods. Past periods show a "Read-Only" badge. Only the current open period allows editing.

### 4.2.4. Fill From (D-65)

Lead can fill data from any past submitted period, not just the previous one:

1. **"Fill from Previous"** button fills from the most recent submitted period (quick action).
2. **▼ dropdown** opens a searchable dialog listing all past periods with item/risk/decision counts. Search by week number, date range, or month.
3. If the current form already has data, a **warning dialog** is shown: "Current form contains: 3 items, 1 risk. This data will be replaced."
4. Lead must confirm "Replace & Fill" or cancel.
5. What gets filled: Current Week items (as new items), Risks, Decisions. **Priorities are NOT filled** (must be set fresh each week). **Next Week items** from the source become Current Week suggestions.

### 4.2.5. Period Navigation on Weekly Report (D-66)

The Weekly Report page has a **period navigator** (← combobox →) allowing Head/Admin to browse historical reports:

- **Current period**: Shows "Live · 4/6 Submitted" badge, editable actions (Publish & Lock, Export PDF).
- **Past period (published)**: Shows "Published · Week 15" badge, read-only, Export PDF only.
- Combobox lists all periods with "(current)" label on the active one.
- Left/right arrows for quick prev/next navigation. Right arrow is disabled on the latest period.

### 4.2.6. Autosave Version History (D-67)

Each Lead Form autosave creates a version snapshot. The Lead can navigate and roll back to any previous version within the current period.

**UI:** Version navigator (← v3 →) in the period line of the Lead Form header, next to "CoreDev Department · Polenkov A."

**Navigation:**

1. **← / →** arrows step through versions (like an undo/redo stack).
2. Clicking **"v3"** opens the Version History modal with all snapshots.
3. Right arrow (→) is disabled on the latest version.

**Version History modal:**

1. Lists all autosave snapshots: version number, timestamp, item/risk/decision counts.
2. **Diff preview** — clicking a version expands a summary of changes vs the current version: items added/removed/edited, risks added, decisions changed.
3. **"Restore"** button per version.

**Branching behavior (linear, not tree):**

- If the Lead navigates back to v1 and starts editing, **all newer versions (v2, v3) are discarded**.
- The next autosave creates v2 (a new timeline).
- This is linear history (like `git reset`), not branching.
- Warning before editing from a past version: "Editing from v1 will discard v2 and v3. Continue?"

**Scope:** Versions are scoped to the current period only. Past periods have a single final snapshot. Version count resets each new period.

### 4.2.7. Login Stub for Development (D-68)

For initial development, the Login page bypasses SSO and shows role selection buttons:

1. **Login page** shows 3-4 role buttons instead of "Sign in with SSO":
   - "Enter as Lead" → redirects to `/report`
   - "Enter as Head" → redirects to `/dashboard`
   - "Enter as Admin" → redirects to `/dashboard`
   - "Enter as Viewer" → redirects to `/dashboard` (read-only)
2. Each button sets a mock JWT with the selected role (no Keycloak needed).
3. The SSO button remains visible but disabled with tooltip "Coming soon — SAML integration".
4. **Production:** Replace stub with real Keycloak SAML flow. The stub is guarded by `NEXT_PUBLIC_AUTH_STUB=true` env variable.

### 4.2.8. URL-Based Routing (D-69)

All application state is derived from the URL, not client-side state. This is NOT a SPA — it uses Next.js App Router file-based routing:

| URL Pattern                      | Page                                            | Role        |
| -------------------------------- | ----------------------------------------------- | ----------- |
| `/login`                         | Login (role selector in dev, SSO in prod)       | Public      |
| `/report`                        | Lead Form (My Report) — current period          | Lead        |
| `/report?period=2026-W15`        | Lead Form — specific period (read-only if past) | Lead        |
| `/history`                       | Lead History                                    | Lead        |
| `/dashboard`                     | Dashboard (central hub)                         | Head, Admin |
| `/report/weekly`                 | Weekly Report — current period                  | Head, Admin |
| `/report/weekly?period=2026-W15` | Weekly Report — specific past period            | Head, Admin |
| `/admin`                         | Admin Panel                                     | Admin       |
| `/admin?tab=products`            | Admin Panel — specific tab                      | Admin       |
| `/report/lead/:userId`           | View/edit specific lead's form (Admin only)     | Admin       |

**Principles:**

- Every page is bookmarkable and shareable via URL.
- Browser back/forward works naturally (no client-side history manipulation).
- Period selection updates `?period=` query param, not React state.
- Admin tab selection updates `?tab=` query param.
- No `window.history.pushState` — only Next.js `<Link>` and `router.push`.
- SSR: pages render on server with correct data based on URL params.

### 4.3. What Each Lead Fills

Each Lead fills the following sections, scoped to their assigned stages:

1. **Product Status (SDLC)** — Set On Track / At Risk / Blocked for each of their assigned stages
2. **Current Week** — Kanban items for tasks done or in progress this week
3. **Next Week** — Kanban items for planned tasks next week
4. **Risks & Blockers** — Free-text risk descriptions scoped to specific product + stage. Severity badge (At Risk / Blocked) is inherited from the associated SDLC stage status.
5. **Decisions** — Items requiring management decision, tagged to a product
6. **Top 3 Priorities** — Ranked list of the Lead's top priorities (max 3)

### 4.4. How Weekly Report Is Built (D-58)

The Weekly Report is **auto-compiled** from all submitted lead data. There is no separate "Assembled" or "Draft" report page — a single **Weekly Report** page shows the current state:

```text
Lead Forms (6 leads) → [auto-compile] → Weekly Report (live view) → Publish & Lock (frozen)
```

During an **Open** period, the report shows a "Live · 4/6 Submitted" badge and updates in real-time as leads submit. After **Publish & Lock**, the report is frozen and shows "Published · Week 16".

---

## 5. Kanban Model

### Item Scoping

Items (Current Week / Next Week) are scoped to a specific **product + stage**:

- Each item belongs to one product
- Items display the stage they relate to (e.g., "Data Analytics Suite -- Testing")
- Items display the assignee (the person who created them)

### Item Workflow Statuses

| Status          | Used In      | Visual                                   |
| --------------- | ------------ | ---------------------------------------- |
| **Completed**   | Current Week | Green badge "Completed"                  |
| **In Progress** | Current Week | Teal badge "In Progress"                 |
| **Blocked**     | Current Week | Red badge "Blocked", red card background |
| **Planned**     | Next Week    | Gray badge "Planned", dashed card border |

### Access Rules

- A Lead can add/edit/delete items only for products where they have assigned stages
- Items are grouped by product in the Lead Form, with product + stage shown as column header
- A Lead does not see items from other leads' stages

### Head View

- In the Assembled Report, items are grouped by **Lead → Product → Stage**
- All items from all leads are visible
- Items are read-only in the Assembled and Published views

---

## 6. Report Compilation Logic (Assembled Report)

The Assembled Report compiles data from all submitted Lead forms into a single document. It has these sections:

### 6.1. Portfolio Overview

Aggregates all products across all leads. Shows one row per product with:

- Product name
- Worst-case status (derived from all stages across all leads):
  - Any stage **Blocked** → product status is **Blocked**
  - Else any stage **At Risk** → product status is **At Risk**
  - Else all stages **On Track** → product status is **On Track**
- Contributing leads listed
- Stage count summary (e.g., "6/7 On Track")

Example: 12 products in the Portfolio Overview, even though each lead sees only their subset.

### 6.2. Per-Lead Sections

Each lead gets an expandable accordion section containing:

- **Current Week items** — grouped by Product → Stage, with status badges
- **Next Week items** — grouped by Product → Stage, with "Planned" badges
- **Risks & Blockers** — with product + stage tag and severity badge
- **Decisions** — with product tag
- **Top 3 Priorities** — numbered list

The accordion shows a summary line: lead name, product count, item counts, risk count, decision count.

### 6.3. Escalations (Consolidated)

A single consolidated section at the bottom of the Assembled/Published Report that aggregates:

- All **Blocked** stages from all leads
- All **At Risk** stages from all leads
- All risk entries from all leads

This is NOT duplicated per-lead. Each escalation entry shows:

- Severity badge (Blocked / At Risk)
- Product + Stage tag
- Risk description text

### 6.4. Numbers

Summary KPIs displayed on the Dashboard:

| Metric               | Computation                                                                                     |
| -------------------- | ----------------------------------------------------------------------------------------------- |
| **Submissions**      | Count of leads with status "Submitted" out of total leads                                       |
| **Deadline**         | Countdown to period deadline (e.g., "2d 5h")                                                    |
| **Portfolio Health** | Count of On Track / At Risk / Blocked stages across all products, with delta from previous week |
| **Escalations**      | Count of risks + count of decisions requiring action                                            |

---

## 7. UI State Rules

### SDLC Stage Interaction States

For **editable stages** (your stage, filled):

| Current Status       | Hover Behavior                                                 | Rationale                                        |
| -------------------- | -------------------------------------------------------------- | ------------------------------------------------ |
| **On Track (green)** | Desaturate + dim (`opacity: .8`, `saturate(.5)`) + subtle ring | Hint: "this is OK, click to change away from OK" |
| **At Risk (yellow)** | Ring only (`box-shadow`), no desaturation                      | Already flagged — hover means "click to update"  |
| **Blocked (red)**    | Ring only (`box-shadow`), no desaturation                      | Already flagged — hover means "click to update"  |

For **empty stages** (your stage, unfilled):

- Pulsing dashed border animation (3s infinite cycle)
- On hover: animation stops, solid ring appears
- Click opens the stage status popover

For **locked stages** (other person's stage):

- `opacity: .35`
- `filter: grayscale(.5)`
- `cursor: not-allowed`
- No hover effects
- Tooltip shows assignee name + "No edit permissions"

For **unassigned stages**:

- Dashed border, muted colors
- `cursor: not-allowed`
- Tooltip: "Unassigned -- Contact admin"

### Other UI States

| State                   | Trigger              | Visual                                               |
| ----------------------- | -------------------- | ---------------------------------------------------- |
| **Skeleton loading**    | Data fetching        | Pulsing gray rectangles                              |
| **Error + Retry**       | API failure          | Red warning icon, "Retry" button                     |
| **Empty state**         | No submissions yet   | Dashed border card, explanatory text                 |
| **Locked form**         | After submission     | Green info card with lock icon, submission timestamp |
| **Validation error**    | Required field empty | Red border on input, error message below             |
| **Delete confirmation** | Delete action        | Modal with item preview, Cancel / Delete buttons     |
| **Toast: success**      | Submit/save success  | Left green border card, auto-dismiss                 |
| **Toast: error**        | Save failure         | Left red border card, retry prompt                   |
| **Toast: warning**      | Approaching deadline | Left yellow border card                              |

---

## 8. Language Policy

| Content Type                          | Language                 | Examples                                                                                                        |
| ------------------------------------- | ------------------------ | --------------------------------------------------------------------------------------------------------------- |
| **UI labels, nav, headings, buttons** | English                  | "Submit Report", "Current Week", "Risks & Blockers", "Dashboard"                                                |
| **Status values and badges**          | English                  | "On Track", "At Risk", "Blocked", "In Progress", "Completed", "Planned", "Draft", "Submitted", "Published"      |
| **SDLC stage names**                  | English                  | "Planning", "Analysis", "Design", "Dev", "Testing", "DevOps", "Support"                                         |
| **Product names**                     | English                  | "CRM Platform", "Data Analytics Suite", "Integration Gateway"                                                   |
| **Person names**                      | English (transliterated) | "Polenkov A.", "Ivanov A.", "Petrova M."                                                                        |
| **Content text (user-entered)**       | Russian                  | Task descriptions, risk descriptions, priority text, decision text                                              |
| **System messages / notifications**   | Russian                  | Confirmation dialogs, validation errors, empty states                                                           |
| **Login page**                        | English                  | "Product Engineering & Operations", "CustomReport", "Sign in with SSO", "Keycloak -- SAML 2.0 -- Corporate SSO" |

---

## 9. Admin Panel

Four tabs managed by Admin/Head:

### Users Tab

- CRUD for users (name, email, role, department)
- Role picker: Lead / Head / Admin
- Assigned products list (tags with remove)

### Products Tab

- CRUD for products (name, status: Active/Archived)
- Per product: list of active SDLC stages with assignee dropdowns
- Add/remove stages from the canonical 7
- Assign/unassign persons to each stage
- **Stage Assignment Validation (D-63):** System must prevent assigning the same user to the same stage on the same product twice. When editing stage assignments, validate no two identical user+stage+product combinations exist. This prevents race conditions and priority conflicts.

### Periods Tab

- Create reporting periods with start date, end date, deadline, week label
- Week label auto-generated (e.g., "Week 17") but overridable

### Reminders Tab

- Toggle-based reminder rules:
  - Auto-reminder on deadline day (10:00, to non-submitted leads)
  - Remind 24h before deadline (to leads who haven't started)
  - Weekly summary for manager (Friday 17:00)
- Manual "Send Reminder" from Dashboard (targets specific pending leads)

---

## 10. Schema Evolution Note

The current Prisma schema (`prisma/schema.prisma`) reflects a v3 data model with a single `leadId` per `Project` and `TrafficLightStatus` at the project level. The v4.0 model described in this manifest requires:

- **Product → Stage mapping** with per-stage assignees (replaces single `leadId` on Project)
- **Stage-level status** per reporting period (replaces project-level `ProjectStatus`)
- **Item scoping** to product + stage (not just product)
- **Risk scoping** to product + stage with severity derived from stage status
- **Admin role** addition to the Role enum
- **User-Product-Stage assignment** junction table

This schema migration is a separate engineering task that should reference this manifest as the target state.

---

## 11. Page Map (D-59, D-60)

| Page                      | URL Pattern      | Role Access                    | Purpose                                                            |
| ------------------------- | ---------------- | ------------------------------ | ------------------------------------------------------------------ |
| **Login**                 | `/login`         | All (unauthenticated)          | Split-screen SSO entry: PEO brand left, SSO form right (D-61)      |
| **Lead Form** (My Report) | `/report`        | Lead                           | Fill weekly report for assigned stages                             |
| **Lead History**          | `/history`       | Lead                           | View own past submissions                                          |
| **Dashboard**             | `/dashboard`     | Head, Admin                    | Central hub: KPIs, Lead Reports, Blocked & At Risk, Report Archive |
| **Weekly Report**         | `/report/weekly` | Head, Admin                    | Auto-compiled report from all leads, Export PDF, Publish & Lock    |
| **Admin Panel**           | `/admin`         | Admin (Head: read-only subset) | Users, Products, Periods, Reminders, General Settings              |

### 11.1. Dashboard as Central Hub (D-59)

Login → Dashboard is the **first page** after SSO for Head and Admin roles (Lead goes to My Report).

Dashboard sections:

1. **KPI Cards** (3): Submissions (4/6 + progress bar), Deadline (countdown), Escalations (count)
2. **Alert Bar**: Yellow banner listing pending leads with "Send Reminder" button
3. **My Report Hero Card**: Quick link to current period's Weekly Report
4. **Blocked & At Risk**: Collapsible table of products with issues
5. **Lead Reports** (D-62): All 6 leads listed. Admin/Head can click any lead to view/edit their form. Submitted leads show "Revoke" button.
6. **Report Archive** (D-60): Paginated list of past weekly reports (← 1 2 3 →). Replaces the former standalone Archive page.

### 11.2. Admin Lead Reports (D-62)

- All 6 leads are visible and clickable on Dashboard for Admin/Head
- Lead role: only own card is clickable, others show lock icon
- Admin can enter any lead's form to edit/submit on their behalf
- "Revoke" button per submitted lead (returns form to editable state)

### 11.3. Login Split-Screen (D-61)

- **Left panel**: PEO brand — teal gradient background, abstract geometric shapes, "Product Engineering & Operations" text
- **Right panel**: CustomReport logo, title, "Sign in with SSO" button, Keycloak footer
- All static text in English
