# CustomReport — Regression Test Scenarios

**Version:** v5.1
**Last Updated:** 2026-04-22
**Total Scenarios:** 223

## Overview

This document defines executable regression test scenarios for CustomReport, a weekly status reporting system for the CoreDev department. The system serves 3 roles (Admin, Head, Lead), manages ~12 products with 7 SDLC stages each, and enforces a two-level access model (product + stage).

### Roles

| Role      | Description                                                                  | Key Pages                                              |
| --------- | ---------------------------------------------------------------------------- | ------------------------------------------------------ |
| **Lead**  | Team lead responsible for specific SDLC stages across multiple products      | My Report, History                                     |
| **Head**  | Department head who reviews and publishes the weekly report                  | Dashboard (hub), Weekly Report, Admin (limited)        |
| **Admin** | System administrator with full CRUD + ability to edit/submit any lead's form | Dashboard (hub), Weekly Report, Admin Panel (all tabs) |

### SDLC Stages

Planning, Analysis, Design, Dev, Testing, DevOps, Support

### Products (12 total)

CRM Platform, Data Analytics Suite, Mobile Applications, Cloud Infrastructure, AI/ML Platform, Integration Gateway, Payment Gateway, Auth Service, Notification Hub, Admin Portal, Logging Platform, CDN Service

---

## 1. Lead Form (Most Critical)

The Lead Form is the primary weekly input surface used by every lead. It contains: Product Status (SDLC pipeline), Current Week items, Next Week items, Risks & Blockers, Decisions, and Top 3 Priorities.

### SC-01: Lead sees only products with assigned stages

**Role:** Lead
**Precondition:** Lead "Polenkov A." is logged in. Admin has assigned him stages on 6 products (CRM Platform: Dev, Data Analytics Suite: Testing, Mobile Applications: DevOps, Cloud Infrastructure: Dev, AI/ML Platform: Testing, Integration Gateway: Dev). The remaining 6 products have zero stages assigned to this lead.
**Steps:**

1. Navigate to "My Report" page.
2. Expand the "Product Status" section.
3. Count the displayed products.
   **Expected:** Exactly 6 products are shown. The 6 products without any assigned stages for this lead (Payment Gateway, Auth Service, Notification Hub, Admin Portal, Logging Platform, CDN Service) are not visible in the Product Status section or anywhere in the Lead Form.

---

### SC-02: Lead can edit only their SDLC stages (sdlc-mine), others locked

**Role:** Lead
**Precondition:** Lead "Polenkov A." is logged in. CRM Platform has 7 stages: Planning (PM), Analysis (Ivanov A.), Design (Petrova M.), Dev (Polenkov A.), Testing (Novikova E.), DevOps (Sidorov P.), Support (Support).
**Steps:**

1. Navigate to "My Report" page.
2. Expand "Product Status" section.
3. Locate CRM Platform product.
4. Observe the "Dev" stage (assigned to Polenkov A.).
5. Observe the other 6 stages (Planning, Analysis, Design, Testing, DevOps, Support).
6. Click on the "Dev" stage chip.
7. Attempt to click on the "Analysis" stage chip (assigned to Ivanov A.).
   **Expected:**

- The "Dev" stage has class `sdlc-mine`, shows a pointer cursor, and displays tooltip "Your stage - At Risk - Click to change" on hover.
- All other stages have class `sdlc-locked`, show `cursor: not-allowed`, appear at reduced opacity (0.35) with grayscale filter, and display the assignee name below.
- Clicking "Dev" opens the SDLC stage status popover with status options (On Track / At Risk / Blocked).
- Clicking "Analysis" does nothing (no popover, no navigation).

---

### SC-03: Lead can add/edit/delete Current Week items for their stages only

**Role:** Lead
**Precondition:** Lead "Polenkov A." is logged in with existing Current Week items for CRM Platform (4 items).
**Steps:**

1. Navigate to "My Report" page.
2. Expand "Current Week" section.
3. Verify the item count badge shows "11 items".
4. Under "CRM Platform" column, click "+ Add" button.
5. In the Add Item modal, fill in Description "New task for this week", select Status "In Progress", verify Assignee is "Polenkov A.".
6. Click "Save Item".
7. On the first existing item ("Integratsiia OAuth2..."), hover to reveal Edit and Delete action buttons.
8. Click the Edit button on the item.
9. In the Edit Item modal, change the description text.
10. Click "Save Item".
    **Expected:**

- The "+ Add" button is visible under each product column where the lead has assigned stages.
- New item appears in the CRM Platform column with "In Progress" badge.
- Item count badge updates from "11 items" to "12 items".
- Edit modal opens pre-filled with current item data.
- After save, item text reflects the edited description.

---

### SC-04: Lead can add/edit/delete Next Week items for their stages only

**Role:** Lead
**Precondition:** Lead "Polenkov A." is logged in. Next Week section has 6 items with "Planned" badges.
**Steps:**

1. Navigate to "My Report" page.
2. Expand "Next Week" section.
3. Verify the item count badge shows "6 items".
4. Under "CRM Platform" column, click "+ Add" button.
5. Fill in Description "Plan for next sprint", verify Status defaults to "Planned".
6. Click "Save Item".
7. On the newly created item, hover to reveal action buttons.
8. Click the Delete button.
9. Confirm deletion in the confirmation dialog.
   **Expected:**

- New item appears in the CRM Platform column with dashed border and "Planned" badge.
- Badge updates to "7 items" after adding, back to "6 items" after deletion.
- Items have dashed border styling to visually distinguish planned items from current work.

---

### SC-05: Lead can add/edit/delete Risks for their stages only

**Role:** Lead
**Precondition:** Lead "Polenkov A." is logged in. One existing risk for CRM Platform Dev stage ("At Risk" status).
**Steps:**

1. Navigate to "My Report" page.
2. Expand "Risks & Blockers" section.
3. Verify badge shows "1".
4. Verify existing risk shows product badge "CRM Platform" with stage "Dev stage" and "At Risk" label.
5. Edit the risk textarea content.
6. Click "+ Add Risk" button at the bottom.
7. Fill in the new risk details for a product where the lead has an assigned stage.
8. On the first risk, click the delete button (trash icon).
9. Confirm deletion in the dialog.
   **Expected:**

- Risk textarea is editable and autosaves on change.
- Badge count updates after adding (to "2") and deleting (back to "1").
- Risk entries show the product name and stage as contextual labels.
- Risks for stages not owned by this lead cannot be created (no option in product/stage selector for locked stages).

---

### SC-06: Lead can add/edit/delete Decisions

**Role:** Lead
**Precondition:** Lead "Polenkov A." is logged in. Two existing decisions: one for Cloud Infrastructure, one for AI/ML Platform.
**Steps:**

1. Navigate to "My Report" page.
2. Expand "Decisions" section.
3. Verify badge shows "2".
4. Click on the first decision input field and edit the text.
5. Click "+ Add Decision" button.
6. Fill in a new decision with product badge.
7. On the second decision, click the delete button.
8. Confirm deletion.
   **Expected:**

- Decision inputs are editable inline.
- Badge updates to "3" after adding, to "2" after deleting.
- Each decision shows its associated product badge (e.g., "Cloud Infrastructure", "AI/ML Platform").
- Decisions are not stage-scoped (any lead can add decisions for any of their visible products).

---

### SC-07: Lead can set Top 3 Priorities

**Role:** Lead
**Precondition:** Lead "Polenkov A." is logged in. Three priority slots exist (numbered 1, 2, 3).
**Steps:**

1. Navigate to "My Report" page.
2. Expand "Top 3 Priorities" section.
3. Verify badge shows "3/3".
4. Edit Priority 1 input text.
5. Clear Priority 3 input completely.
6. Verify badge updates.
   **Expected:**

- All three priority inputs are editable.
- Priority 1 has a gold background with white number circle.
- Priority 2 has a lighter gold background.
- Priority 3 has a neutral canvas background.
- Badge updates to "2/3" when Priority 3 is cleared.
- Maximum 3 priorities (no option to add a 4th).

---

### SC-08: Lead submits report -- form locks

**Role:** Lead
**Precondition:** Lead "Polenkov A." is logged in with a complete report (items, risks, decisions, priorities filled).
**Steps:**

1. Navigate to "My Report" page.
2. Click "Submit Report" button in the header.
3. Observe the Submit Report confirmation dialog.
4. Verify dialog shows summary: "6 products - 11 items - 1 risk - 2 decisions".
5. Verify dialog warns: "After submission, editing will be locked."
6. Click "Submit Report" in the dialog.
7. Wait for submission to complete.
8. Observe the form state after submission.
   **Expected:**

- Confirmation dialog appears before submission with accurate counts.
- After submission, the form displays a "Locked" banner: green background with lock icon, text "Report locked", and submission timestamp.
- All input fields become read-only (text inputs, textareas, selects).
- All "+ Add" buttons are hidden or disabled.
- All Edit/Delete action buttons on items are hidden.
- SDLC stage chips for owned stages become non-clickable.
- "Submit Report" button is replaced with a "Submitted" badge or is disabled.
- Autosave badge changes from "Autosaved" to showing submission time.

---

### SC-09: Autosave works (badge shows "Autosaved")

**Role:** Lead
**Precondition:** Lead "Polenkov A." is logged in with a draft report (not yet submitted).
**Steps:**

1. Navigate to "My Report" page.
2. Observe the "Autosaved" badge in the header area (green badge with checkmark).
3. Edit a Current Week item description.
4. Wait 2-3 seconds without further input.
5. Observe the autosave badge behavior.
6. Edit a Risk textarea.
7. Observe autosave behavior again.
   **Expected:**

- Before any edits, badge shows "Autosaved" with a green checkmark.
- During editing, badge may briefly change to indicate saving in progress.
- After autosave completes, badge returns to "Autosaved" with updated timestamp.
- No manual "Save" button needed for individual fields.
- Autosave fires on all editable sections: Current Week, Next Week, Risks, Decisions, Priorities, SDLC stage statuses.

---

### SC-10: Delete confirmation dialog appears

**Role:** Lead
**Precondition:** Lead "Polenkov A." is logged in with at least one Current Week item.
**Steps:**

1. Navigate to "My Report" page.
2. Hover over a Current Week item to reveal the delete button (trash icon with red hover state).
3. Click the delete button.
4. Observe the confirmation dialog.
   **Expected:**

- Dialog title: "Delete Current Week item?"
- Dialog subtitle: "This action cannot be undone."
- Dialog shows the item text in a preview block (quoted in a canvas-colored box).
- Two buttons: "Cancel" (secondary/outlined) and "Delete Item" (red filled).
- Clicking "Cancel" closes the dialog without deleting.
- Clicking "Delete Item" removes the item and updates the section badge count.

---

### SC-11: Empty state when no items

**Role:** Lead
**Precondition:** Lead "Polenkov A." is logged in. A specific product column (e.g., Integration Gateway) has zero Current Week items (all have been deleted or none were created).
**Steps:**

1. Navigate to "My Report" page.
2. Expand "Current Week" section.
3. Locate the Integration Gateway column with zero items.
   **Expected:**

- Column shows an empty state with a dashed border card.
- Empty state text: "No items yet" or similar placeholder.
- The "+ Add" button remains visible and functional.
- No broken layout or collapsed column.

---

### SC-12: Validation error on empty required fields

**Role:** Lead
**Precondition:** Lead "Polenkov A." is logged in.
**Steps:**

1. Navigate to "My Report" page.
2. Under a Current Week product column, click "+ Add".
3. In the Add Item modal, leave the Description field empty.
4. Click "Save Item".
   **Expected:**

- The Description input field shows a red border (`border-color: var(--red)`).
- An error message appears below the field: "Description is required."
- The error text is red (13px font size).
- The modal does not close.
- The item is not created.
- Focus moves to the invalid field.

---

### SC-13: SDLC stage click opens popover to change status

**Role:** Lead
**Precondition:** Lead "Polenkov A." is logged in. CRM Platform has a "Dev" stage assigned to Polenkov with current status "At Risk" (yellow).
**Steps:**

1. Navigate to "My Report" page.
2. In the Product Status section, locate CRM Platform.
3. Click on the "Dev" stage chip (yellow, "! Dev").
4. Observe the popover/modal that opens.
   **Expected:**

- Popover shows title "Dev -- CRM Platform".
- Popover shows an Assignee dropdown (pre-selected: "Polenkov A.").
- Popover shows three status chips: "On Track" (green), "At Risk" (yellow, currently selected/active), "Blocked" (red).
- Clicking "On Track" changes the chip selection.
- Clicking "Save" updates the stage to the new status.
- Clicking "Cancel" closes the popover without changes.
- The stage chip color updates after saving (green for On Track, yellow for At Risk, red for Blocked).

---

### SC-14: At Risk / Blocked hover shows ring only (no desaturation)

**Role:** Lead
**Precondition:** Lead "Polenkov A." is logged in. CRM Platform Dev stage is "At Risk" (yellow background). Data Analytics Suite has a "Blocked" stage (not owned by lead -- but check with an owned At Risk stage).
**Steps:**

1. Navigate to "My Report" page.
2. Hover over the "Dev" stage chip on CRM Platform (At Risk, sdlc-mine).
3. Observe the visual feedback.
   **Expected:**

- Hover shows a ring shadow: `box-shadow: 0 0 0 3px rgba(0,0,0,.18)`.
- No desaturation or opacity change on hover.
- No `filter: saturate()` applied.
- The yellow/red background color remains fully vivid.
- This indicates "click to update" rather than "click to change away from OK."

---

### SC-15: On Track hover shows desaturation hint

**Role:** Lead
**Precondition:** Lead "Polenkov A." is logged in. Data Analytics Suite Testing stage is "On Track" (green background, sdlc-mine).
**Steps:**

1. Navigate to "My Report" page.
2. Hover over the "Testing" stage chip on Data Analytics Suite (On Track, sdlc-mine).
3. Observe the visual feedback.
   **Expected:**

- Hover reduces opacity to 0.8 and applies `filter: saturate(.5)`.
- A subtle ring shadow appears: `box-shadow: 0 0 0 2.5px rgba(0,0,0,.12)`.
- The green becomes desaturated/muted, hinting "you can change away from OK."
- This visual distinction differentiates from At Risk/Blocked hover behavior (SC-14).

---

### SC-16: Lead sees read-only items from other leads' stages

**Role:** Lead
**Precondition:** Lead "Polenkov A." is logged in. Cloud Infrastructure has Current Week items authored by Sidorov P. (who owns DevOps stage on that product).
**Steps:**

1. Navigate to "My Report" page.
2. Expand "Current Week" section.
3. Locate "Cloud Infrastructure" column.
4. Observe items authored by "Sidorov P." (e.g., "Monitoring K8s + alerts Grafana").
   **Expected:**

- Items from other leads are visible but marked as read-only (class `kb-card ro`).
- Read-only cards have reduced opacity (0.6).
- Hover on read-only cards does not show Edit/Delete action buttons.
- The lead can still add their own items via the "+ Add" button (items will be scoped to their assigned stage).

---

### SC-17: Empty SDLC stage shows dashed pulse animation

**Role:** Lead
**Precondition:** Lead "Polenkov A." is logged in. AI/ML Platform has Testing stage assigned to Polenkov with no status set yet.
**Steps:**

1. Navigate to "My Report" page.
2. Locate AI/ML Platform in Product Status.
3. Observe the "Testing" stage chip (empty, assigned to Polenkov).
   **Expected:**

- Stage chip shows "circle Testing" text with dashed border.
- Class `sdlc-empty` is applied.
- A subtle pulse animation cycles the border color between `rgba(0,117,74,.3)` and `rgba(0,117,74,.7)` over 3 seconds.
- Cursor is `pointer`.
- Tooltip shows "Your stage - Click to fill".
- Clicking opens the status popover to set initial status.

---

### SC-18: Unassigned SDLC stages show locked state

**Role:** Lead
**Precondition:** Lead "Polenkov A." is logged in. Integration Gateway has DevOps and Testing stages that are unassigned ("-- unassigned").
**Steps:**

1. Navigate to "My Report" page.
2. Locate Integration Gateway in Product Status.
3. Observe the unassigned Testing and DevOps stages.
   **Expected:**

- Unassigned stages show "circle Testing" / "circle DevOps" with dashed border and neutral background.
- Class `sdlc-locked` is applied.
- Cursor is `not-allowed`.
- Tooltip says "Unassigned - Contact admin".
- Text below the stage shows "-- unassigned" in muted color.
- Clicking does nothing.

---

### SC-19: Product with blockers shows risk indicator

**Role:** Lead
**Precondition:** Lead "Polenkov A." is logged in. Data Analytics Suite has a blocked Dev stage (owned by Kozlov D.).
**Steps:**

1. Navigate to "My Report" page.
2. Locate Data Analytics Suite in Product Status.
3. Observe the product header area.
   **Expected:**

- Product card has a pink-tinted background (`background: #fdf8f8; border: 1px solid rgba(200,32,20,.15)`).
- A pulsing red risk dot appears next to the product name with text "1 blocker".
- Hovering over the risk dot shows a tooltip: "Dev (Kozlov D.): Utechka pamyati ETL".
- Stage badges in the header show "Blocked" (red) for Dev and "On Track" (green) for Testing.

---

## 2. Dashboard (Head)

The Dashboard is the Head's command center for monitoring lead submissions and portfolio health.

### SC-20: Shows all 12 products in Portfolio Health

**Role:** Head
**Precondition:** Head "Director H." is logged in. All 12 products are configured as Active in Admin.
**Steps:**

1. Navigate to "Dashboard" page.
2. Locate the "Portfolio Health" KPI card.
3. Count the traffic-light indicators.
   **Expected:**

- Three columns show counts: Green (On Track) = 14 with "+2" trend, Yellow (At Risk) = 5 with "--" (unchanged), Red (Blocked) = 2 with "+1" trend.
- Total stage counts across all products: 14 + 5 + 2 = 21 (represents individual stage statuses, not product counts).
- Trend indicators are color-coded: green for positive changes, red for negative, gray for unchanged.

---

### SC-21: Blocked products table accurate

**Role:** Head
**Precondition:** Head "Director H." is logged in. Data Analytics Suite has a Blocked Dev stage. Mobile Applications has At Risk Design + Dev stages.
**Steps:**

1. Navigate to "Dashboard" page.
2. Locate "Blocked & At Risk Products" table in the house-green card.
3. Verify table contents.
   **Expected:**

- Table has columns: Product, Stage, Lead, Risk, Status.
- Row 1: Data Analytics Suite | Dev | Maria K. | "Utechka pamyati ETL, patch vendora 25 aprelya" | Blocked (red badge).
- Row 2: Mobile Applications | Design + Dev | Igor V. | "Zaderzhka tokenov dizayna, risk sdviga sprinta" | At Risk (yellow badge).
- Products with all-green stages are not listed.
- Table is inside a "card-house" styled container (green-tinted background with teal-light border).

---

### SC-22: Lead Reports show correct status and actions (D-57, D-62)

**Role:** Head, Admin
**Precondition:** Head "Director H." is logged in. 6 leads total: 4 submitted, 1 draft, 1 not started.
**Steps:**

1. Navigate to "Dashboard" page.
2. Scroll to "Lead Reports" section.
3. Count and verify each lead entry.
4. Check available actions per lead.
   **Expected:**

- All 6 leads are listed (clickable for Admin/Head).
- Submitted leads (4): Polenkov A. ("2h ago, 6 products"), Maria K. ("5h ago, 4 products"), Igor V. ("1d ago, 3 products"), Dmitry S. ("3h ago, 5 products"). All show green "Submitted" badge and a "Revoke" button (D-57).
- Draft lead (1): Olga N. ("Saved 1h ago", "Draft" warning badge). No Revoke button.
- Pending lead (1): Sergey T. ("Not started", "Pending" gray badge). No Revoke button.
- **Admin/Head:** All lead cards are clickable (navigate to lead's form).
- **Lead role (if viewing Dashboard):** Only own card is clickable, others show lock icon.

---

### SC-23: Deadline countdown accurate

**Role:** Head
**Precondition:** Head "Director H." is logged in. Current period deadline is Friday 18:00. Current time is Wednesday 12:55.
**Steps:**

1. Navigate to "Dashboard" page.
2. Locate the "Deadline" KPI card.
   **Expected:**

- Shows countdown in format "2d 5h" (or equivalent based on current time).
- Subtitle shows "Friday 18:00".
- Card has a yellow left border indicating approaching deadline.
- Countdown uses tabular numerals (`font-variant-numeric: tabular-nums`) for stable width.

---

### SC-24: Send reminder to pending leads

**Role:** Head
**Precondition:** Head "Director H." is logged in. 2 leads have not submitted: Olga N. (Draft) and Sergey T. (Pending).
**Steps:**

1. Navigate to "Dashboard" page.
2. Observe the yellow alert banner at top: "2 leads pending: Olga N., Sergey T."
3. Click "Send Reminder" button.
4. Observe the reminder dialog.
   **Expected:**

- Dialog title: "Remind about report submission?"
- Shows 2 lead cards: Olga N. (avatar ON, "Draft - Saved 1h ago") and Sergey T. (avatar ST, "Not started").
- Two buttons: "Cancel" and "Send Email".
- Clicking "Send Email" triggers email notifications via SMTP to the pending leads.
- After sending, the alert banner updates or shows a success notification.

---

### SC-25: Submissions progress bar and historical comparison

**Role:** Head
**Precondition:** Head "Director H." is logged in. 4 out of 6 leads have submitted.
**Steps:**

1. Navigate to "Dashboard" page.
2. Locate the "Submissions" KPI card (largest card, spanning 2 columns).
   **Expected:**

- Large number display: "4" in teal, "/ 6" in muted color.
- Progress bar filled to 66% (4/6) with green fill.
- Historical context below: "Last week: 6/6 - Avg: 5.2".
- Card has a teal left border.

---

## 3. Weekly Report (Head/Admin)

The Weekly Report auto-compiles all lead submissions into a single document. No manual "create" step — the report updates in real-time as leads submit (D-58).

### SC-30: Portfolio Overview shows all 12 products with correct statuses

**Role:** Head
**Precondition:** Head "Director H." is logged in. At least 4 leads have submitted. Period is Week 16.
**Steps:**

1. Navigate to "Weekly Report" page.
2. Verify the header shows badge "Live · 4/6 Submitted" (or "Published" if locked).
3. Locate "Portfolio Overview -- 12 products" card.
4. Count products and verify statuses.
   **Expected:**

- Exactly 12 product tiles displayed in a 3-column grid.
- Each tile shows: traffic-light dot, product name, and summary text.
- CRM Platform: green dot, "6/7 On Track - Polenkov, Sidorov".
- Data Analytics Suite: red dot, "Blocked - Kozlov, Polenkov".
- Mobile Applications: yellow dot, "At Risk - Smirnov, Polenkov".
- Cloud Infrastructure: yellow dot, "At Risk - Polenkov, Sidorov".
- AI/ML Platform: green dot, "5/7 On Track - Smirnov, Polenkov".
- Integration Gateway: green dot, "2/5 On Track - Polenkov".
- Remaining 6 products show their respective statuses and assigned leads.
- Background color matches status: green-tinted for On Track, red-tinted for Blocked, yellow-tinted for At Risk.

---

### SC-31: Per-lead accordion shows correct data

**Role:** Head
**Precondition:** Head "Director H." is logged in. Polenkov A. has submitted a report.
**Steps:**

1. Navigate to "Weekly Report" page.
2. Locate the accordion for "Polenkov A. - Dev Lead".
3. Verify the accordion header shows: avatar, name, "Submitted" badge, "1 risk" indicator.
4. Expand the accordion (if not already open).
5. Verify each data section.
   **Expected:**

- **Current Week**: Shows "11 items" with entries grouped by product line (CRM Platform - Dev, Data Analytics Suite - Testing, Mobile Applications - DevOps, Cloud Infrastructure - Dev, AI/ML Platform - Testing, Integration Gateway - Dev). Each item has a status badge (In Progress, Completed).
- **Next Week**: Shows items grouped by product with "Planned" badges and dashed borders.
- **Risks & Blockers**: Shows "1" with CRM Dev risk in yellow background.
- **Decisions**: Shows "2" entries with product badges.
- **Top 3 Priorities**: Numbered list with gold-tinted backgrounds.

---

### SC-32: Item counts match lead form data

**Role:** Head
**Precondition:** Head "Director H." is logged in. Polenkov A. submitted with 11 current week items, 6 next week items, 1 risk, 2 decisions.
**Steps:**

1. Navigate to "Weekly Report" page.
2. Expand Polenkov A.'s accordion.
3. Count items in each section.
4. Compare against the section header badges.
   **Expected:**

- "Current Week - 11 items" header matches exactly 11 list entries.
- "Next Week - 6 items" header matches exactly 6 list entries.
- "Risks & Blockers - 1" header matches exactly 1 risk entry.
- "Decisions - 2" header matches exactly 2 decision entries.
- "Top 3 Priorities" shows exactly 3 numbered entries.
- These counts match what the lead entered in their Lead Form.

---

### SC-33: Export PDF works

**Role:** Head
**Precondition:** Head "Director H." is logged in. Weekly Report has data from at least 4 leads.
**Steps:**

1. Navigate to "Weekly Report" page.
2. Click "Export PDF" button (outlined style).
3. Wait for PDF generation (async BullMQ job).
   **Expected:**

- PDF generation begins (progress indicator or toast notification).
- Generated PDF downloads to the browser or opens in a new tab.
- PDF contains: Portfolio Overview grid, all lead sections with their data, risks, decisions, priorities.
- PDF file size is within expected range (59-125KB per Playwright generation).
- PDF formatting preserves the visual hierarchy: section headers, traffic-light dots, badges.

---

### SC-34: Publish & Lock button works (D-56)

**Role:** Head
**Precondition:** Head "Director H." is logged in. Weekly Report page shows "Live · 4/6 Submitted". 2 leads have not submitted.
**Steps:**

1. Navigate to "Weekly Report" page.
2. Click "Publish & Lock" button (primary green style).
3. Observe the confirmation dialog.
4. Verify dialog warns: "2 leads haven't submitted. Publish anyway?"
5. Verify dialog shows: "Week 16 - Apr 14-20 - 4/6 leads submitted".
6. Click "Publish & Lock" in the dialog.
   **Expected:**

- Confirmation dialog warns about pending leads and that all forms will be locked.
- After publishing, the Weekly Report badge changes from "Live" to "Published · Week 16".
- All 6 lead forms become read-only (locked), regardless of submission status.
- The report appears in Dashboard's Report Archive section with "Published" badge.
- Email notifications are sent to configured recipients (director, other departments).
- A "Reopen" button appears on the Weekly Report page (visible to Head/Admin only).

---

## 4. Published (Locked) Report (Head)

After Publish & Lock, the Weekly Report becomes read-only. This is NOT a separate page — it's the same Weekly Report page in "Published" state (D-56, D-58).

### SC-40: All leads' data shown after Publish & Lock

**Role:** Head
**Precondition:** Head "Director H." is logged in. Weekly Report for Week 16 has been published with 4 submitted leads' data.
**Steps:**

1. Navigate to "Weekly Report" page.
2. Verify the header shows badge "Published · Week 16" with "Apr 14-20, 2026".
3. Scroll through all lead sections.
   **Expected:**

- Portfolio Overview shows all 12 products with correct status indicators.
- First lead section (Polenkov A.) is expanded with full data: Current Week (showing 4 of 11 items with "+ 7 more items" collapsed), Next Week (3 items shown with "+ 3 more items"), Decisions (2), Top Priorities (3).
- Remaining submitted leads shown as collapsed cards: Maria K. ("4 products - 8 current + 4 planned - 1 risk"), Igor V. ("3 products - 5 current + 3 planned"), Dmitry S. ("5 products - 10 current + 6 planned").
- Each collapsed lead card shows "Submitted" badge.
- Leads who did not submit (Olga N., Sergey T.) show "Not submitted" muted state.
- A "Reopen" button is visible at the top (for Head/Admin only).

---

### SC-41: Escalations consolidated (not per-lead)

**Role:** Head
**Precondition:** Head "Director H." is logged in. Weekly Report (published) contains risks from multiple leads.
**Steps:**

1. Navigate to "Weekly Report" page.
2. Locate the "Escalations - All Leads" section at the bottom.
3. Verify it is a single consolidated section, not repeated per lead.
   **Expected:**

- Section title: "Escalations - All Leads" in red, inside a house-green card.
- All risks and blockers from all leads are merged into one list.
- Each escalation shows: product+stage badge, severity label (Blocked/At Risk), and description.
- Example entries:
  - Red: "Analytics - Dev" -- "Blocked: Utechka pamyati ETL, OOM na >10GB. Patch vendora 25 aprelya."
  - Yellow: "Analytics - Testing" -- "At Risk: QA lid v otpuske, zaderzhka do 3 dney."
  - Yellow: "Mobile - Design+Dev" -- "At Risk: Tokeny dizayn-sistemy ne finalizirovany."
- No duplicate entries.
- Escalations are visually distinguished: red background for Blocked, yellow background for At Risk.

---

### SC-42: Download PDF from published report works

**Role:** Head
**Precondition:** Head "Director H." is logged in. Weekly Report for Week 16 is in "Published" state.
**Steps:**

1. Navigate to "Weekly Report" page (showing "Published · Week 16" badge).
2. Click "Export PDF" button (outlined style, top-right of header).
3. Wait for PDF generation.
   **Expected:**

- PDF downloads with the published report content.
- PDF includes: portfolio overview, all lead sections (expanded), consolidated escalations.
- PDF does not include interactive elements (no edit buttons, no accordions).
- File naming convention includes the week identifier (e.g., "CustomReport-Week16-2026.pdf").

---

### SC-43: Report Archive in Dashboard shows historical reports (D-60)

**Role:** Head
**Precondition:** Head "Director H." is logged in. Multiple reports have been published in April and March 2026.
**Steps:**

1. Navigate to "Dashboard" page.
2. Scroll to "Report Archive" section at the bottom.
3. Observe the report listing with pagination.
   **Expected:**

- Reports listed in reverse chronological order.
- Each report entry shows: date range ("Apr 14 -- Apr 20"), product count ("12 products"), lead count ("6 leads"), publication date ("Published Apr 21"), and "Published" badge.
- Most recent report shows traffic-light summary dots.
- Entries are clickable links to view the full published Weekly Report.
- Pagination controls at the bottom: ← 1 2 3 →.
- No separate "Archive" page exists in the navigation.

---

## 5. Admin

Admin panel provides CRUD operations for Users, Products, Periods, and Reminder settings.

### SC-50: CRUD Users

**Role:** Admin (or Head with admin access)
**Precondition:** Admin is logged in. Admin Panel is accessible. Users tab is available.
**Steps:**

1. Navigate to "Admin" page.
2. Click "Users" tab.
3. Click "+ Add User" button (if visible).
4. In the Add User form, fill in: Full Name "Novikov D.", Email "d.novikov@company.com", Role "Lead", Department "CoreDev".
5. Add assigned products: click "+ Add Product", select "CRM Platform" and "Cloud Infrastructure".
6. Click "Save User".
7. Locate the newly created user in the list.
8. Click "Edit" on the user.
9. Change the role from "Lead" to "Head".
10. Click "Save User".
11. Click the delete button on the user.
12. Confirm deletion.
    **Expected:**

- Add User form has fields: Full Name (required), Email (required), Role dropdown (Lead/Head/Admin), Department dropdown.
- Assigned Products section shows selected products as removable badges.
- After creation, user appears in the users list.
- Edit opens the same form pre-filled with existing data.
- After role change, user permissions update accordingly.
- Deletion removes user from the system after confirmation.

---

### SC-51: CRUD Products with SDLC stage configuration

**Role:** Admin
**Precondition:** Admin is logged in. Products tab is active in Admin Panel.
**Steps:**

1. Navigate to "Admin" page.
2. Click "Products" tab (currently active in mockup).
3. Observe the product list showing 6 products (with "+ 4 more" indicator for pagination).
4. Click "+ Add Product" button.
5. Fill in Product Name "New Service", Status "Active".
6. Under SDLC Stages, click "+ Add Stage".
7. Add stages: Planning (assign PM), Dev (assign Polenkov A.), Testing (leave unassigned).
8. Click "Save Product".
9. Locate "CRM Platform" in the list.
10. Click "Edit" on CRM Platform.
11. In the edit form, observe 7 SDLC stages with assignee dropdowns.
12. Change the Dev stage assignee from "Polenkov A." to "Smirnov K.".
13. Click the X button on the "Support" stage to remove it.
14. Click "Save Product".
    **Expected:**

- Product form has: Product Name (required), Status dropdown (Active/Archived).
- SDLC Stages section shows an ordered list of stages, each with a name label, assignee dropdown, and remove (X) button.
- "+ Add Stage" button appends a new stage row.
- Assignee dropdowns list all users with "Lead" role plus special entries (PM, Support).
- After saving, the product's SDLC pipeline updates.
- Removing a stage shows confirmation if data exists for that stage.
- Stage order in the product reflects the SDLC pipeline order (Planning -> Analysis -> Design -> Dev -> Testing -> DevOps -> Support).

---

### SC-52: CRUD Periods

**Role:** Admin
**Precondition:** Admin is logged in. Periods tab is selected in Admin Panel.
**Steps:**

1. Navigate to "Admin" page.
2. Click "Periods" tab.
3. Click "Create Period" button.
4. In the Create Period form, fill in: Start Date "2026-04-21", End Date "2026-04-27", Deadline "2026-04-25T18:00".
5. Observe the Week Label field auto-suggests "Week 17".
6. Click "Create Period".
7. Verify the period appears in the periods list.
   **Expected:**

- Create Period form has: Start Date (required, date picker), End Date (required, date picker), Deadline (required, datetime-local), Week Label (auto-generated but editable).
- Week Label auto-increments based on existing periods.
- After creation, the new period becomes the active reporting period.
- End Date must be after Start Date (validation).
- Deadline must be between Start Date and a reasonable buffer after End Date.

---

### SC-53: Reminder settings toggle

**Role:** Admin
**Precondition:** Admin is logged in. Reminders tab is selected in Admin Panel.
**Steps:**

1. Navigate to "Admin" page.
2. Click "Reminders" tab.
3. Observe 3 reminder toggles:
   a. "Auto-reminder on deadline day" (currently ON) -- "Send at 10:00 to leads who haven't submitted".
   b. "Remind 24h before deadline" (currently ON) -- "Send to all leads who haven't started".
   c. "Weekly summary for manager" (currently OFF) -- "Submission status every Friday at 17:00".
4. Toggle "Weekly summary for manager" to ON.
5. Toggle "Auto-reminder on deadline day" to OFF.
   **Expected:**

- Each toggle shows a title, description, and a switch control.
- ON state: green background (`var(--tealA)`), white circle positioned right.
- OFF state: gray background (`var(--ceramic)`), white circle positioned left.
- Toggling immediately saves the setting (autosave).
- Changes affect the BullMQ scheduled jobs for email reminders.

---

## 6. Access Control (Critical)

These scenarios verify that the role-based and stage-based access model is correctly enforced.

### SC-60: Lead cannot see products with 0 assigned stages

**Role:** Lead
**Precondition:** Lead "Polenkov A." is logged in. He has stages assigned on 6 products. The remaining 6 products (Payment Gateway, Auth Service, Notification Hub, Admin Portal, Logging Platform, CDN Service) have zero stages assigned to him.
**Steps:**

1. Navigate to "My Report" page.
2. Examine the Product Status section.
3. Examine all sections: Current Week, Next Week, Risks, Decisions.
4. Check the browser developer tools Network tab for API responses.
   **Expected:**

- Only 6 products are visible across all Lead Form sections.
- The 6 unassigned products do not appear in any dropdown, column, or selector.
- API responses do not contain data for unassigned products (server-side filtering, not just UI hiding).
- Navigation does not reveal any route to view unassigned product data.

---

### SC-61: Lead cannot edit locked stages (cursor:not-allowed)

**Role:** Lead
**Precondition:** Lead "Polenkov A." is logged in. CRM Platform has Analysis stage assigned to Ivanov A.
**Steps:**

1. Navigate to "My Report" page.
2. Locate CRM Platform in Product Status.
3. Hover over the "Analysis" stage chip (locked, assigned to Ivanov A.).
4. Click on the "Analysis" stage chip.
5. Try right-clicking the stage chip.
6. Try accessing the stage via keyboard (Tab + Enter).
   **Expected:**

- Cursor shows `not-allowed` on hover.
- Stage chip has `opacity: .35` and `filter: grayscale(.5)`.
- No click handler fires.
- No popover or modal opens.
- Tooltip shows "Ivanov A. - No edit permissions".
- No keyboard focus is possible on locked stages (they are not in the tab order).
- No API endpoint exists that would accept a status change from a non-assigned user.

---

### SC-62: Lead cannot add items to other leads' product columns

**Role:** Lead
**Precondition:** Lead "Polenkov A." is logged in. Another lead (Sidorov P.) has items in Cloud Infrastructure under the DevOps stage. Polenkov owns Dev stage on this product.
**Steps:**

1. Navigate to "My Report" page.
2. Expand "Current Week" section.
3. Locate the Cloud Infrastructure column.
4. Click "+ Add" and attempt to create an item.
5. In the item creation form, check the assignee options.
   **Expected:**

- The "+ Add" button creates items scoped to Polenkov's assigned stage (Dev) on that product.
- The Assignee dropdown only shows the current lead (Polenkov A.) or team members under their stage.
- Items cannot be created with another lead's stage scope.
- Existing items from Sidorov P. (DevOps stage) are read-only and cannot be edited or deleted by Polenkov.

---

### SC-63: Head/Admin can view lead forms from Dashboard (D-62)

**Role:** Head, Admin
**Precondition:** Head "Director H." is logged in. Polenkov A. has submitted a report. Period is Open.
**Steps:**

1. Navigate to "Dashboard" page.
2. Locate "Lead Reports" section.
3. Click on Polenkov A.'s card.
4. Observe the lead's form.
   **Expected:**

- Clicking a lead card navigates to that lead's form view.
- **Head role:** Lead form data is read-only. No Edit/Delete buttons. Head can only view.
- **Admin role:** Admin can enter any lead's form and edit/submit on their behalf. Full edit access to all sections.
- For submitted leads, a "Revoke" button is visible on the Dashboard (not inside the form).
- The lead's form shows whose data it is (e.g., "Viewing: Polenkov A.'s Report").

---

### SC-64: Admin has full access to everything

**Role:** Admin
**Precondition:** Admin user is logged in with Admin role.
**Steps:**

1. Verify Admin can access Dashboard page.
2. Verify Admin can access Assembled Report page.
3. Verify Admin can access Published Report page.
4. Verify Admin can access Archive page.
5. Verify Admin can access Admin Panel (all tabs: Users, Products, Periods, Reminders).
6. In Admin Panel, verify CRUD operations are available for all entities.
   **Expected:**

- Admin has access to all navigation items that Head has.
- Admin additionally has full CRUD on Users, Products, Periods, and Reminders.
- Admin does not have a Lead Form (Admins do not submit reports unless they also have a Lead role).
- Admin can create/delete any user including other Admins.
- Admin can modify any product's SDLC configuration.
- Admin can create/modify any reporting period.

---

### SC-65: Unauthenticated user redirected to Login — split-screen (D-61)

**Role:** None (unauthenticated)
**Precondition:** No active session. Browser cookies cleared.
**Steps:**

1. Navigate to any application URL (e.g., `/dashboard`, `/report`, `/admin`).
2. Observe the redirect.
3. On the login page, observe the split-screen UI.
   **Expected:**

- User is redirected to the Login page.
- **Left panel:** PEO brand — teal gradient background, abstract geometric shapes, "Product Engineering & Operations" text. All in English.
- **Right panel:** CustomReport logo (CR circle), "CustomReport" title, "Sign in with SSO" button (green pill), "Keycloak -- SAML 2.0 -- Corporate SSO" footer. All in English.
- Single "Sign in with SSO" button (no local username/password form).
- Clicking "Sign in with SSO" redirects to Keycloak IdP for SAML authentication.
- After successful SSO: Lead → redirected to `/report`, Head/Admin → redirected to `/dashboard`.
- No local username/password form exists (SSO only).

---

### SC-66: Role-based navigation visibility (D-59)

**Role:** Lead, Head, Admin
**Precondition:** Three separate sessions for each role.
**Steps:**

1. Login as Lead. Observe the navigation bar.
2. Login as Head. Observe the navigation bar.
3. Login as Admin. Observe the navigation bar.
   **Expected:**

- **Lead navigation:** "My Report", "History" only. No Dashboard, Report, Admin links.
- **Head navigation:** "Dashboard", "Report", "Admin". No "My Report" link (unless the Head also has Lead role). No separate Archive or Published page.
- **Admin navigation:** Same as Head ("Dashboard", "Report", "Admin"). Admin Panel shows all tabs (Users, Products, Periods, Reminders).
- Accessing restricted URLs directly returns 403 or redirects to the user's default page.
- After SSO: Lead → `/report`, Head/Admin → `/dashboard`.

---

### SC-67: Session timeout and re-authentication

**Role:** Lead
**Precondition:** Lead is logged in. JWT token has 1h expiry.
**Steps:**

1. Login as Lead.
2. Wait for JWT token to expire (or simulate by deleting the token).
3. Attempt to perform an action (e.g., save an item).
   **Expected:**

- API returns 401 Unauthorized.
- Application shows a notification or redirects to login.
- Any unsaved data is preserved via autosave (last successful save).
- After re-authentication via SSO, user returns to the same page.

---

## 7. Data Integrity

These scenarios ensure data consistency across all views (Lead Form, Assembled, Published).

### SC-70: Item counts in badges match actual items

**Role:** Head
**Precondition:** Head "Director H." is logged in. Multiple leads have submitted.
**Steps:**

1. Navigate to "Weekly Report" page.
2. For each lead accordion, note the item count in the header.
3. Expand each accordion.
4. Manually count items in Current Week, Next Week, Risks, Decisions sections.
5. Compare badge counts with actual item counts.
   **Expected:**

- Polenkov A.: "Current Week - 11 items" matches 11 actual entries. "Next Week - 6 items" matches 6 entries. "Risks & Blockers - 1" matches 1 entry. "Decisions - 2" matches 2 entries.
- All lead accordions follow the same pattern: badge counts match actual items.
- Product status summary badges (e.g., "6/7 On Track") match the actual stage status breakdown.

---

### SC-71: Risk counts match across Lead Form, Assembled, Published

**Role:** Head (cross-referencing Lead data)
**Precondition:** Polenkov A. submitted with 1 risk. The system has 3 total escalations across all leads.
**Steps:**

1. View Polenkov A.'s Lead Form (as Polenkov): Risks section shows "1".
2. View Assembled Report (as Head): Polenkov A.'s accordion shows "1 risk" badge and 1 risk entry.
3. View Published Report (as Head): Polenkov A.'s section summary shows "1 risk". Consolidated Escalations section includes Polenkov's risk among 3 total.
   **Expected:**

- Polenkov's risk count is "1" consistently across all three views.
- The risk text is identical in all views (no truncation or modification).
- The consolidated Escalations section in the Published Report contains exactly the sum of all leads' risks (3 total from the mockup).
- No risk is duplicated or omitted in any view.

---

### SC-72: Product names consistent everywhere

**Role:** Head
**Precondition:** 12 products configured in Admin. Reports submitted.
**Steps:**

1. Note all product names from Admin Panel -> Products tab.
2. Check product names in Lead Form (Product Status, Current/Next Week columns, Risk badges, Decision badges).
3. Check product names in Dashboard (Portfolio Health, Blocked Products table, Lead cards).
4. Check product names in Assembled Report (Portfolio Overview, per-lead sections).
5. Check product names in Published Report (Portfolio Overview, lead sections, Escalations).
   **Expected:**

- Every occurrence of a product name uses the exact same string (e.g., "Data Analytics Suite", not "Data Analytics" or "Analytics Suite").
- Product names in the Lead Form match Admin configuration.
- Product names in Dashboard match Admin configuration.
- Product names in Assembled and Published reports match Admin configuration.
- No product name appears with different casing, spelling, or abbreviation across views.

---

### SC-73: Stage assignees match between SDLC pipeline and Admin config

**Role:** Admin, Lead
**Precondition:** Admin configured CRM Platform with 7 stages and specific assignees.
**Steps:**

1. As Admin, open Admin Panel -> Products tab -> CRM Platform -> note each stage's assignee.
2. As Lead (Polenkov A.), open "My Report" -> Product Status -> CRM Platform -> note each stage's assignee label.
3. As Head, open Assembled Report -> Portfolio Overview -> CRM Platform -> note the lead names listed.
   **Expected:**

- Admin config shows: Planning=PM, Analysis=Ivanov A., Design=Petrova M., Dev=Polenkov A., Testing=Novikova E., DevOps=Sidorov P., Support=Support.
- Lead Form shows the same assignees under each stage chip.
- Assembled Report's product summary includes all unique assignee names from the pipeline.
- Changing an assignee in Admin and refreshing the Lead Form reflects the update immediately (no caching inconsistency).

---

## 8. UI States and Error Handling

### SC-80: Skeleton loading state displays correctly

**Role:** Any
**Precondition:** User is authenticated. Page is loading data.
**Steps:**

1. Navigate to any data-heavy page (Dashboard, Assembled Report).
2. Observe the loading state before data renders.
   **Expected:**

- Skeleton placeholders appear: gray rounded rectangles with pulse animation.
- Layout matches the final content structure (cards, grids, badges).
- Skeleton animation is smooth: opacity cycles between 1 and 0.4 over 1.5 seconds.
- Skeleton respects `prefers-reduced-motion` (animation duration reduced to 0.01ms).
- No layout shift when real content replaces skeletons.

---

### SC-81: Error state with retry button

**Role:** Any
**Precondition:** API is unreachable or returns a 500 error.
**Steps:**

1. Simulate a network failure (disconnect, API down).
2. Navigate to a page that requires API data.
3. Observe the error state.
4. Click the "Retry" button.
   **Expected:**

- Error card shows: warning triangle icon (36px, red), heading "Failed to load", subtext "Check your connection and try again."
- "Retry" button is centered below the text (primary green style).
- Clicking "Retry" re-fetches the data.
- If the API recovers, normal content loads.
- If still failing, error state persists.

---

### SC-82: Notification toasts display correctly

**Role:** Lead
**Precondition:** Lead is logged in and performing actions.
**Steps:**

1. Submit a report. Observe the success notification.
2. Trigger a save error (e.g., network disconnect during autosave). Observe the error notification.
3. Approach the deadline. Observe the warning notification.
   **Expected:**

- **Success toast:** Green left border, checkmark icon, title "Report submitted", subtitle "Sent to the manager for review." Dismissable via X button.
- **Error toast:** Red left border, warning triangle icon, title "Save error", subtitle "Check your connection and try again." Dismissable via X button.
- **Warning toast:** Yellow left border, exclamation icon, title "Deadline approaching", subtitle "Submit by Friday 18:00." Dismissable via X button.
- Toasts stack vertically if multiple are active.
- Max width ~340px.

---

### SC-83: Form locking visual treatment after submission

**Role:** Lead
**Precondition:** Lead has submitted the report for the current period.
**Steps:**

1. Navigate to "My Report" page after having already submitted.
2. Observe the locked state.
   **Expected:**

- A locked banner appears at the top: green-tinted background (`var(--tealL)`) with lock icon, text "Report locked", and submission timestamp.
- Banner has a subtle border: `1px solid rgba(0,98,65,.2)`.
- All form sections below are visually muted or explicitly non-interactive.
- The page header no longer shows the "Submit Report" button.

---

## 9. Edge Cases and Boundary Conditions

### SC-90: Lead with stages on only 1 product

**Role:** Lead
**Precondition:** A lead has only 1 product with assigned stages (e.g., assigned Testing on CDN Service only).
**Steps:**

1. Login as this lead.
2. Navigate to "My Report".
3. Observe all sections.
   **Expected:**

- Product Status shows only 1 product.
- Current Week, Next Week show only 1 product column (not a 3-column grid with empty spaces).
- Risks, Decisions, Priorities sections work normally.
- Badge shows "1 product" in Product Status header.
- Layout adapts gracefully (no stretched or awkward single-column layout).

---

### SC-91: Stage assignment validation prevents duplicates (D-63)

**Role:** Admin
**Precondition:** Admin attempts to assign two leads to the Dev stage on CRM Platform.
**Steps:**

1. Navigate to Admin -> Products -> CRM Platform -> Edit.
2. Under SDLC Stages, locate "Dev" stage (currently assigned to Polenkov A.).
3. Attempt to assign the same user (Polenkov A.) to another stage (e.g., Testing) on the same product.
4. Attempt to assign the same stage (Dev) to a second user (duplicate).
   **Expected:**

- The system enforces **one assignee per stage per product** (each stage has a single dropdown, not a multi-select).
- Changing the assignee replaces the previous one.
- **Validation (D-63):** If an admin tries to create a duplicate assignment (same user + same stage + same product), the system shows an error: "This stage is already assigned to [User]. Replace?"
- No two identical user+stage+product combinations can exist in the database.
- The same user CAN be assigned to different stages on the same product (e.g., Polenkov → Dev AND Testing on CRM Platform).

---

### SC-92: Period with zero submissions at deadline

**Role:** Head
**Precondition:** Deadline has passed for the current period. No leads have submitted.
**Steps:**

1. Login as Head.
2. Navigate to "Dashboard".
3. Observe the submission status.
4. Navigate to "Weekly Report" page.
   **Expected:**

- Dashboard shows "0/6" submissions with an empty progress bar.
- Alert banner lists all 6 leads as pending.
- Weekly Report shows "Live · 0/6 Submitted".
- Portfolio Overview may show empty or "No data" state for all products.
- "Publish" button may be disabled or show a warning about incomplete submissions.

---

### SC-93: Concurrent edits by two leads on different products

**Role:** Lead (two separate sessions)
**Precondition:** Lead A and Lead B are both logged in editing their reports for the same period.
**Steps:**

1. Lead A adds a Current Week item for CRM Platform.
2. Lead B adds a Current Week item for Payment Gateway at the same time.
3. Both save (autosave triggers).
4. Head views the Assembled report.
   **Expected:**

- No data conflict or overwrite occurs (each lead writes to their own section/stage).
- Both items appear in the Assembled report under their respective lead accordions.
- Autosave uses optimistic locking or per-section isolation to prevent conflicts.
- No "conflict resolution" dialog is needed (architecture prevents write conflicts by design).

---

## 10. Responsive and Accessibility

### SC-94: Keyboard navigation through Lead Form

**Role:** Lead
**Precondition:** Lead is logged in. Lead Form is displayed.
**Steps:**

1. Press Tab to navigate through the form.
2. Verify focus indicators on all interactive elements.
3. Press Enter on an SDLC stage chip.
4. Press Escape to close a popover.
5. Tab through the Current Week kanban cards.
   **Expected:**

- All interactive elements (buttons, inputs, selects, SDLC chips) receive focus via Tab.
- Focus ring: `box-shadow: 0 0 0 3px rgba(0,98,65,.3)` with `border-radius: 8px`.
- Enter activates buttons and opens popovers/modals.
- Escape closes open popovers and modals.
- Locked SDLC stages (`sdlc-locked`) are not in the tab order.
- Action buttons on kanban cards (Edit, Delete) are focusable when the card has focus.
- Touch targets meet 44px minimum (buttons, action icons, toggle switches).

---

### SC-95: Touch targets meet 44px minimum

**Role:** Lead (mobile/tablet)
**Precondition:** Accessing the application on a touch device.
**Steps:**

1. Measure touch target sizes for: kanban card action buttons, SDLC stage chips, "+ Add" buttons, delete buttons, toggle switches (Admin reminders).
   **Expected:**

- All interactive elements have minimum 44px x 44px touch targets.
- Kanban card action buttons: visual size is 24px but touch target extends to 44px via padding/hitSlop (noted in mockup CSS comment).
- SDLC stage chips: min-width 85px, padding sufficient for touch.
- Delete buttons (`btn-del`): `min-width: 44px; min-height: 44px`.
- Toggle switches in Admin Reminders: `width: 44px; height: 24px` (meets width requirement).
- "+ Add" buttons: `min-height: 44px` via `kb-add` class.

---

### SC-96: Collapsible sections maintain state

**Role:** Lead
**Precondition:** Lead is logged in. Lead Form has 5 collapsible sections (Product Status, Current Week, Next Week, Risks, Decisions, Priorities).
**Steps:**

1. Collapse the "Current Week" section by clicking its header.
2. Observe the accordion animation.
3. Expand it again.
4. Collapse "Product Status".
5. Navigate to History page and back to My Report.
   **Expected:**

- Clicking the header toggles the accordion: `grid-template-rows` animates between `0fr` (collapsed) and `1fr` (expanded) over 0.3s with cubic-bezier easing.
- The chevron icon rotates: 0 degrees when expanded, -90 degrees when collapsed.
- `aria-expanded` attribute toggles between "true" and "false".
- After navigation, section collapse state may reset to default (all expanded) or persist via session storage.

---

### SC-97: Reduced motion preference respected

**Role:** Any
**Precondition:** User has `prefers-reduced-motion: reduce` set in their OS accessibility settings.
**Steps:**

1. Navigate to any page.
2. Observe animations: skeleton pulse, SDLC empty stage pulse, accordion transitions, card hover effects.
   **Expected:**

- All animations have `animation-duration: .01ms` (effectively instant).
- All transitions have `transition-duration: .01ms` (effectively instant).
- Functional behavior remains intact (sections still toggle, hovers still change state).
- No motion-sickness-inducing movement occurs.

---

## 15. Period Navigation & Copy (D-64, D-65, D-66)

### SC-111: Lead views past period in read-only mode (D-64)

**Role:** Lead
**Priority:** P0
**Precondition:** Lead "Polenkov A." is logged in. Week 15 report was submitted. Current period is Week 16.
**Steps:**

1. Navigate to "My Report" page.
2. In the period navigator, select "Week 15 · Apr 7–13 ✓".
3. Observe the form state.
   **Expected:**

- Banner appears: "Viewing past period · Week 15 · Apr 7–13, 2026 · Submitted Apr 13, 16:45" with "Read-Only" badge.
- All form sections show data from Week 15 submission.
- All input fields, "+ Add" buttons, Edit/Delete actions are disabled/hidden.
- SDLC stage chips are non-clickable.
- "Submit Report" button is hidden.
- "Copy Previous" / "Copy from" buttons are hidden (can't copy into a past period).
- Switching back to "Week 16 (current)" restores the editable form.

---

### SC-112: Lead cannot fill form for non-existent period (D-64)

**Role:** Lead
**Priority:** P1
**Precondition:** Lead "Polenkov A." is logged in. Admin has not created a period for Week 17 yet.
**Steps:**

1. Navigate to "My Report" page.
2. Check the period navigator combobox options.
   **Expected:**

- Only existing periods appear in the dropdown (Week 16 current, Week 15, 14, 13...).
- No "Week 17" option exists until Admin creates it.
- Right arrow (→) is disabled on the latest period.

---

### SC-113: Copy from specific past period (D-65)

**Role:** Lead
**Priority:** P1
**Precondition:** Lead "Polenkov A." is logged in. Current period Week 16 is open. Past periods Week 15, 14, 13 have submitted data.
**Steps:**

1. Navigate to "My Report" page (Week 16 current).
2. Click the dropdown arrow on the "Copy" split button.
3. Observe the "Copy from" dialog.
4. Select "Week 14 · Mar 31–Apr 6" (not the previous week).
5. Click "Copy".
   **Expected:**

- Dialog shows list of past periods with radio buttons.
- Each period shows: week label, date range, item/risk/decision counts.
- Most recent period is pre-selected and labeled "Previous".
- Clicking "Copy" copies items, risks, decisions from Week 14 into Week 16.
- Priorities are NOT copied.
- Next Week items from Week 14 appear as Current Week suggestions.
- Toast: "Copied 8 items from Week 14."

---

### SC-114: Copy warning when form has existing data (D-65)

**Role:** Lead
**Priority:** P0
**Precondition:** Lead "Polenkov A." is logged in. Current period Week 16 already has 3 items and 1 risk filled.
**Steps:**

1. Click "Copy Previous" button.
2. Observe the warning dialog.
   **Expected:**

- Warning dialog appears: "Replace existing data?"
- Shows current form contents: "Current form contains: 3 items · 1 risk · 0 decisions"
- Warning text: "This data will be replaced with Week 15 data."
- Two buttons: "Cancel" and "Replace & Copy" (gold/warning color).
- Clicking "Cancel" returns to form without changes.
- Clicking "Replace & Copy" replaces all current data with copied data.

---

### SC-115: Weekly Report period navigation (D-66)

**Role:** Head
**Priority:** P1
**Precondition:** Head "Director H." is logged in. Multiple published periods exist.
**Steps:**

1. Navigate to "Weekly Report" page.
2. Observe the period navigator (← combobox →).
3. Select "Week 15 · Apr 7–13" from the combobox.
4. Observe the page state.
5. Click left arrow (←) to go to Week 14.
6. Click right arrow (→) to go back to Week 15.
   **Expected:**

- Current period shows "Live · 4/6 Submitted" badge with Publish & Lock button.
- Switching to Week 15: badge changes to "Published · Week 15", Publish & Lock button hidden, only "Export PDF" available.
- Switching to Week 14: same published state.
- Right arrow (→) is disabled when on the latest (current) period.
- Left arrow (←) navigates to the previous period.
- Combobox shows "(current)" label on the active period.

---

### SC-116: Autosave version history and rollback (D-67)

**Role:** Lead
**Priority:** P1
**Precondition:** Lead "Polenkov A." is logged in. Current period Week 16. Report has been autosaved 3 times (v1, v2, v3 current).
**Steps:**

1. Navigate to "My Report" page.
2. Observe the "v3" badge next to "Autosaved".
3. Click the "v3" badge.
4. Observe the Version History dialog.
5. Click "Restore" on v1 (3 items, 0 risks).
6. Confirm in the warning.
   **Expected:**

- Version History dialog shows 3 versions: v3 (current, active), v2, v1.
- Each version lists: timestamp, item/risk/decision counts.
- v3 has "Active" badge, v1 and v2 have "Restore" buttons.
- Warning: "Restoring will replace your current data. A backup of current version will be created automatically."
- After restore: form data reverts to v1 state (3 items, 0 risks).
- Version counter increments to v4 (v3 is preserved as backup).
- Toast: "Restored to v1. Previous version saved as v4 backup."

---

## 16. Fill From (D-65) -- Deep Scenarios

### SC-120: Fill from Previous -- happy path on empty form

**Role:** Lead
**Priority:** P0
**Precondition:** Lead "Polenkov A." is logged in. Current period Week 16 form is empty (no items, risks, or decisions). Week 15 has submitted data: 9 items, 0 risks, 1 decision.
**Steps:**

1. Navigate to "My Report" page (Week 16 current).
2. Verify the form is empty (all section badges show "0").
3. Click "Fill from Previous" button (left part of the split button).
4. Observe the form after fill completes.
   **Expected:**

- No warning dialog appears (form is empty, nothing to overwrite).
- Current Week items from Week 15 are copied as new items in Week 16.
- Next Week items from Week 15 become Current Week suggestions (pre-populated as "Planned" items in Current Week).
- Risks from Week 15 are copied with original text, product, and stage scope.
- Decisions from Week 15 are copied with original text and product badges.
- Priorities are NOT copied (Top 3 Priorities section remains empty, badge "0/3").
- Section badges update to reflect copied counts: "9 items" for Current Week, "0" for Next Week (since Week 15 Next Week items moved to Current Week), "0 risks", "1 decision".
- Toast notification: "Copied 9 items from Week 15."
- Autosave badge briefly shows "Saving..." then "Autosaved" after save completes.

---

### SC-121: Fill from specific period via dropdown search

**Role:** Lead
**Priority:** P1
**Precondition:** Lead "Polenkov A." is logged in. Current period Week 16 form is empty. Past periods Week 15, 14, 13, 12, 11 have submitted data.
**Steps:**

1. Navigate to "My Report" page (Week 16 current).
2. Click the dropdown arrow (right part of the split button) to open the "Fill from" dialog.
3. Observe the dropdown panel listing past periods.
4. Verify the search input is present with placeholder "Search reports...".
5. Type "Week 14" in the search input.
6. Verify the list filters to show only "Week 14 - Mar 31--Apr 6".
7. Click on the "Week 14" entry.
8. Observe the fill result.
   **Expected:**

- Dropdown panel opens below the split button with width ~340px.
- Panel contains a search input at the top and a scrollable list of past periods.
- Each period entry shows: week label, date range, item/risk/decision counts.
- Week 15 is highlighted and labeled "Previous" (pre-selected).
- Typing "Week 14" filters the list to show only matching entries.
- Clicking "Week 14" fills from that period (not the most recent).
- Toast: "Copied 8 items from Week 14."
- Dropdown closes after selection.

---

### SC-122: Search filtering in dropdown by month name

**Role:** Lead
**Priority:** P2
**Precondition:** Lead "Polenkov A." is logged in. Past periods include entries in March and April.
**Steps:**

1. Open the "Fill from" dropdown.
2. Type "March" in the search input.
3. Observe filtered results.
4. Clear the search and type "Apr".
5. Observe filtered results.
   **Expected:**

- Typing "March" shows all periods with dates in March: Week 14 (Mar 31--Apr 6), Week 13 (Mar 24--30), Week 12 (Mar 17--23), Week 11 (Mar 10--16).
- Typing "Apr" shows all periods with dates in April: Week 16 (excluded -- current period), Week 15 (Apr 7--13), Week 14 (Mar 31--Apr 6 if April is in the range).
- Search is case-insensitive.
- Search matches against week label, date range text, and month names.
- If no results match, the list shows an empty state: "No matching periods."

---

### SC-123: Fill when form has existing data -- warning dialog

**Role:** Lead
**Priority:** P0
**Precondition:** Lead "Polenkov A." is logged in. Current period Week 16 has 3 items, 1 risk, 0 decisions already filled. Week 15 has 9 items, 0 risks, 1 decision.
**Steps:**

1. Navigate to "My Report" page.
2. Click "Fill from Previous" button.
3. Observe the warning dialog.
4. Verify dialog content.
5. Click "Cancel".
6. Verify form data unchanged.
7. Click "Fill from Previous" again.
8. Click "Replace & Fill" in the warning dialog.
9. Observe the form after fill.
   **Expected:**

- Warning dialog appears with title "Replace existing data?"
- Dialog shows current form contents: "Current form contains: 3 items - 1 risk - 0 decisions".
- Warning text: "This data will be replaced with Week 15 data."
- Two buttons: "Cancel" (secondary) and "Replace & Fill" (gold/warning color).
- Clicking "Cancel" closes the dialog; form retains the original 3 items and 1 risk.
- Clicking "Replace & Fill" replaces all current data with Week 15 data.
- After fill: Current Week shows 9 items (from Week 15), Risks shows "0", Decisions shows "1".
- The 3 original items and 1 original risk are removed and replaced.
- Toast: "Copied 9 items from Week 15."

---

### SC-124: Fill preserves product scoping

**Role:** Lead
**Priority:** P0
**Precondition:** Lead "Polenkov A." is logged in. He currently has 6 assigned products. In Week 14, he had 5 assigned products (Integration Gateway was not yet assigned). Week 14 has items for 5 products.
**Steps:**

1. Navigate to "My Report" page (Week 16 current).
2. Open "Fill from" dropdown and select "Week 14 - Mar 31--Apr 6".
3. Observe the filled data.
   **Expected:**

- Items are copied only for products the lead currently has assigned stages on.
- If Week 14 contained items for a product the lead no longer has access to, those items are skipped.
- If Week 14 did not have items for Integration Gateway (newly assigned), that product column remains empty.
- No items appear for products the lead does not have access to in the current period.

---

### SC-125: Fill from period where lead had different products

**Role:** Lead
**Priority:** P1
**Precondition:** Lead "Polenkov A." is logged in. In Week 11, he was assigned to only 4 products (CRM Platform, Data Analytics Suite, Cloud Infrastructure, AI/ML Platform). Currently assigned to 6 products.
**Steps:**

1. Navigate to "My Report" page.
2. Open "Fill from" dropdown and select "Week 11 - Mar 10--16".
3. Observe the filled data.
   **Expected:**

- Items from Week 11 are copied only for products that exist in both the source period and current assignments.
- Mobile Applications and Integration Gateway columns remain empty (no data in Week 11 for those products).
- CRM Platform, Data Analytics Suite, Cloud Infrastructure, AI/ML Platform columns are populated from Week 11 data.
- SDLC stage statuses are NOT copied (stages reset each period).
- Toast shows the actual number of items copied (only from matching products).

---

### SC-126: Fill does not copy priorities

**Role:** Lead
**Priority:** P1
**Precondition:** Lead "Polenkov A." is logged in. Week 15 had 3 priorities set. Current form has 0 priorities.
**Steps:**

1. Click "Fill from Previous".
2. Observe the Top 3 Priorities section after fill.
   **Expected:**

- Top 3 Priorities section remains empty after fill (badge shows "0/3").
- All three priority input fields are blank.
- The rationale is that priorities must be set fresh each week based on current context.

---

### SC-127: Fill -- Next Week items from source become Current Week suggestions

**Role:** Lead
**Priority:** P1
**Precondition:** Lead "Polenkov A." is logged in. Week 15 had 3 Next Week items: "A/B testing framework", "SSO integration", "Email template builder". Week 15 also had 6 Current Week items.
**Steps:**

1. Click "Fill from Previous".
2. Observe the Current Week section after fill.
3. Observe the Next Week section after fill.
   **Expected:**

- Current Week section contains the 6 original Current Week items from Week 15 PLUS the 3 Next Week items from Week 15 (total 9 items).
- The 3 Next Week items appear with their original descriptions but may have status changed to "Planned" or "In Progress".
- Next Week section is empty after fill (items moved to Current Week).
- Badge counts: "9 items" for Current Week, "0 items" for Next Week.

---

### SC-128: Fill and immediately submit

**Role:** Lead
**Priority:** P1
**Precondition:** Lead "Polenkov A." is logged in. Form is empty. Week 15 has complete data.
**Steps:**

1. Click "Fill from Previous".
2. Wait for fill to complete and autosave to trigger.
3. Immediately click "Submit Report".
4. Confirm submission in the dialog.
   **Expected:**

- Fill completes and autosave saves all copied data.
- Submit dialog shows accurate counts reflecting the filled data.
- Submission succeeds; form locks.
- The submitted data matches exactly what was filled from Week 15 (minus priorities).
- No data loss between fill and submit.

---

### SC-129: Fill from oldest available period

**Role:** Lead
**Priority:** P2
**Precondition:** Lead "Polenkov A." is logged in. Oldest available period is Week 11 (Mar 10--16) with 10 items.
**Steps:**

1. Open "Fill from" dropdown.
2. Scroll to the bottom of the list.
3. Select "Week 11 - Mar 10--16" (the oldest entry).
4. Observe the fill result.
   **Expected:**

- Week 11 data is copied successfully despite being 5 weeks old.
- All items from Week 11 that match current product assignments are copied.
- Fill works regardless of how old the source period is.
- Toast shows correct count of copied items.

---

## 17. Version History (D-67) -- Deep Scenarios

### SC-130: View version history modal

**Role:** Lead
**Priority:** P1
**Precondition:** Lead "Polenkov A." is logged in. Current period Week 16. Report has been autosaved 3 times (v1, v2, v3 current).
**Steps:**

1. Navigate to "My Report" page.
2. Locate the version navigator in the header: "v3" button between left/right arrows.
3. Click the "v3" button.
4. Observe the Version History modal.
   **Expected:**

- Modal opens showing all 3 versions in a list.
- v3 shows "Active" badge with current timestamp.
- v2 shows timestamp and counts: items/risks/decisions at that snapshot.
- v1 shows timestamp and counts: items/risks/decisions at that snapshot.
- Each non-active version has a "Restore" button.
- v3 (active) does not have a "Restore" button.
- Modal has a close button (X) and can be dismissed with Escape key.
- Modal title: "Version History" or similar.

---

### SC-131: Navigate versions with left/right arrows

**Role:** Lead
**Priority:** P1
**Precondition:** Lead "Polenkov A." is logged in. Version v3 is current. Versions v1, v2, v3 exist.
**Steps:**

1. Navigate to "My Report" page.
2. Verify the version navigator shows "v3".
3. Click the left arrow (Previous version).
4. Observe the form changes to v2 data.
5. Click the left arrow again.
6. Observe the form changes to v1 data.
7. Verify the left arrow is now disabled (no earlier version).
8. Click the right arrow.
9. Observe the form returns to v2 data.
   **Expected:**

- Left arrow navigates to the previous version (v3 -> v2 -> v1).
- Right arrow navigates to the next version (v1 -> v2 -> v3).
- Version badge updates to reflect the viewed version ("v2", "v1").
- Form data updates to show the snapshot from that version.
- Left arrow is disabled when on v1 (oldest version).
- Right arrow is disabled when on v3 (latest version, `opacity: .35`, `cursor: not-allowed`).
- Viewing a past version does NOT trigger autosave.

---

### SC-132: Diff preview shows correct counts

**Role:** Lead
**Priority:** P2
**Precondition:** Lead "Polenkov A." is logged in. v1 had 3 items, 0 risks. v2 had 7 items, 1 risk (4 added, 1 risk added). v3 has 11 items, 3 risks (4 more items, 2 more risks).
**Steps:**

1. Click "v3" to open Version History modal.
2. Click on v1 to expand its diff preview.
3. Observe the change summary.
   **Expected:**

- Diff preview shows: "8 items added, 3 risks added, 2 decisions added" (difference between v1 and v3 current).
- Changes are categorized: added/removed/edited counts.
- No incorrect counts (diff is computed against the current active version, not adjacent versions).

---

### SC-133: Restore to v1 from v3 -- data rolls back

**Role:** Lead
**Priority:** P0
**Precondition:** Lead "Polenkov A." is logged in. v3 is current (11 items, 3 risks, 2 decisions). v1 had 3 items, 0 risks, 0 decisions.
**Steps:**

1. Click "v3" to open Version History modal.
2. Click "Restore" on v1 (3 items, 0 risks).
3. Observe the warning dialog.
4. Click "Restore" to confirm.
5. Observe the form state.
   **Expected:**

- Warning dialog: "Restoring will replace your current data. A backup of current version will be created automatically."
- After restore: form data reverts to v1 state (3 items, 0 risks, 0 decisions).
- Version counter increments to v4 (v3 is preserved as automatic backup).
- Section badges update: "3 items" for Current Week, "0" for Risks, "0" for Decisions.
- Toast: "Restored to v1. Previous version saved as v4 backup."
- The v4 backup contains the v3 data (11 items, 3 risks, 2 decisions).

---

### SC-134: Restore creates automatic backup

**Role:** Lead
**Priority:** P1
**Precondition:** Lead "Polenkov A." is logged in. Currently at v3. Restores to v1.
**Steps:**

1. Restore to v1 (per SC-133 steps).
2. Click the version badge (now showing "v4" or updated value).
3. Open Version History modal.
4. Verify v4 exists as a backup of v3.
   **Expected:**

- Version History now shows 4 versions: v1, v2, v3, v4.
- v4 is marked as "Restored from v1" or "Active" and contains v1 data.
- v3 is preserved and shows its original data counts (11 items, 3 risks).
- The backup ensures no data is permanently lost from restore operations.

---

### SC-135: Linear history -- edit from v1 discards v2, v3

**Role:** Lead
**Priority:** P1
**Precondition:** Lead "Polenkov A." is logged in. Navigated back to v1 using the left arrow. v1, v2, v3 exist.
**Steps:**

1. Navigate to v1 using the left arrow.
2. Start editing a field (e.g., add a new Current Week item).
3. Observe the warning dialog.
4. Click "Continue" to confirm editing from v1.
5. Wait for autosave to trigger.
6. Open Version History modal.
   **Expected:**

- Warning dialog: "Editing from v1 will discard v2 and v3. Continue?"
- Two buttons: "Cancel" (returns to viewing v1 without edits) and "Continue" (enables editing).
- After confirming and autosaving, the version becomes v2 (new timeline).
- Version History now shows only v1 and v2 (the new v2 from editing).
- Old v2 and v3 are permanently discarded (linear history, like `git reset`).

---

### SC-136: Warning before editing from past version

**Role:** Lead
**Priority:** P1
**Precondition:** Lead "Polenkov A." is logged in. Currently viewing v1 (not the latest version).
**Steps:**

1. Navigate to v1 using the left arrow.
2. Attempt to edit a Current Week item description.
3. Observe the warning dialog.
4. Click "Cancel".
5. Verify no changes were made.
   **Expected:**

- Any edit attempt while viewing a past version triggers the warning dialog.
- Warning: "Editing from v1 will discard v2 and v3. Continue?"
- Clicking "Cancel" prevents the edit; form remains read-only at v1 state.
- No autosave triggers; no version is created.

---

### SC-137: Version counter resets each period

**Role:** Lead
**Priority:** P2
**Precondition:** Lead "Polenkov A." is logged in. Week 15 had 5 versions (v1--v5). Week 16 is the current period with fresh data.
**Steps:**

1. Navigate to "My Report" page (Week 16 current).
2. Check the version badge.
3. Switch to Week 15 (past period).
4. Check the version badge for Week 15.
   **Expected:**

- Week 16 starts at v1 (or whatever the current autosave count is for this period).
- Version numbering is independent per period.
- Week 15 shows its final version count (e.g., "v5" from its submission).
- Switching periods changes the version navigator to reflect that period's versions.

---

### SC-138: Version created on each autosave

**Role:** Lead
**Priority:** P1
**Precondition:** Lead "Polenkov A." is logged in. Current period is fresh with v1.
**Steps:**

1. Navigate to "My Report" page.
2. Verify version badge shows "v1".
3. Edit a Current Week item description.
4. Wait for autosave to complete.
5. Verify version badge updates to "v2".
6. Add a new Risk entry.
7. Wait for autosave to complete.
8. Verify version badge updates to "v3".
   **Expected:**

- Each successful autosave increments the version counter.
- v1 -> v2 after first autosave.
- v2 -> v3 after second autosave.
- Each version captures a full snapshot of the form state at that moment.
- The version badge in the header updates immediately after autosave completes.

---

### SC-139: Version history empty for new period (only v1)

**Role:** Lead
**Priority:** P2
**Precondition:** Lead "Polenkov A." is logged in. Admin just created a new period (Week 17). Lead has not edited anything yet.
**Steps:**

1. Navigate to "My Report" page.
2. Select "Week 17" from the period navigator.
3. Click the version badge.
4. Observe the Version History modal.
   **Expected:**

- Version badge shows "v1".
- Version History modal shows only one entry: v1 with timestamp of period creation or first page load.
- v1 shows "Active" badge with counts: 0 items, 0 risks, 0 decisions.
- Left/right arrows are both disabled (only one version exists).
- "Restore" button is not shown (nothing to restore to).

---

## 18. Period Navigation (D-64, D-66) -- Deep Scenarios

### SC-140: Lead Form -- switch to past period shows read-only state

**Role:** Lead
**Priority:** P0
**Precondition:** Lead "Polenkov A." is logged in. Week 15 was submitted. Current period is Week 16 (editable).
**Steps:**

1. Navigate to "My Report" page (Week 16 current, editable).
2. In the period navigator combobox, select "Week 15 - Apr 7--13".
3. Observe the form state.
   **Expected:**

- A read-only banner appears: "Viewing past period - Week 15 - Apr 7--13, 2026 - Submitted Apr 13, 16:45" with "Read-Only" badge.
- All form sections show data from Week 15 submission.
- All input fields are disabled (text inputs, textareas show data but cannot be edited).
- All "+ Add" buttons are hidden.
- All Edit/Delete action buttons on kanban cards are hidden.
- SDLC stage chips are non-clickable (no popover on click).
- "Submit Report" button is hidden.
- "Fill from Previous" split button is hidden.
- "Toggle All" button still works (collapse/expand is a view action, not an edit).

---

### SC-141: Lead Form -- switch back to current period restores editable state

**Role:** Lead
**Priority:** P0
**Precondition:** Lead "Polenkov A." is logged in. Currently viewing Week 15 (read-only past period).
**Steps:**

1. In the period navigator, select "Week 16 - Apr 14--20 (current)".
2. Observe the form state.
   **Expected:**

- Read-only banner disappears.
- All form sections return to editable state.
- "+ Add" buttons are visible and functional.
- Edit/Delete action buttons appear on hover over kanban cards.
- SDLC stage chips for owned stages are clickable.
- "Submit Report" button reappears in the header.
- "Fill from Previous" split button reappears.
- Data shown is Week 16's current draft data (not Week 15 data).

---

### SC-142: Lead Form -- past period shows correct submitted data

**Role:** Lead
**Priority:** P1
**Precondition:** Lead "Polenkov A." is logged in. Week 15 was submitted with: 9 items, 0 risks, 1 decision, 3 priorities. Week 14 was submitted with: 8 items, 1 risk, 0 decisions.
**Steps:**

1. Switch to "Week 15" in the period navigator.
2. Verify all section badges and data match Week 15 submission.
3. Switch to "Week 14" in the period navigator.
4. Verify all section badges and data match Week 14 submission.
   **Expected:**

- Week 15: Current Week shows "9 items", Next Week shows correct count, Risks shows "0", Decisions shows "1", Priorities shows "3/3".
- Week 14: Current Week shows "8 items", Risks shows "1", Decisions shows "0".
- Data is frozen at the time of submission -- no live updates.
- Each period switch loads the correct historical snapshot.

---

### SC-143: Lead Form -- buttons hidden on past period

**Role:** Lead
**Priority:** P1
**Precondition:** Lead "Polenkov A." is logged in. Viewing Week 15 (past, submitted).
**Steps:**

1. Switch to Week 15 in the period navigator.
2. Scan the header area for buttons.
3. Scan each section for interactive elements.
   **Expected:**

- "Submit Report" button: hidden.
- "Fill from Previous" split button: hidden.
- All "+ Add" buttons in sections: hidden.
- "+ Add Risk" button: hidden.
- "+ Add Decision" button: hidden.
- Delete buttons on all items/risks/decisions: hidden.
- Edit buttons on all items: hidden.
- Only visible actions: "Toggle All" (view-only) and navigation controls.

---

### SC-144: Lead Form -- right arrow disabled on latest period

**Role:** Lead
**Priority:** P2
**Precondition:** Lead "Polenkov A." is logged in. Week 16 is the current (latest) period.
**Steps:**

1. Navigate to "My Report" page (Week 16 current).
2. Observe the right arrow button (-->) in the period navigator.
   **Expected:**

- Right arrow has `opacity: .35` and `cursor: not-allowed`.
- Right arrow has `disabled` attribute.
- Clicking the right arrow does nothing.
- Title/tooltip: "Latest period".
- Left arrow is active and navigable to Week 15.

---

### SC-145: Weekly Report -- switch to past published report

**Role:** Head
**Priority:** P1
**Precondition:** Head "Director H." is logged in. Week 16 is current (Live). Week 15 is published.
**Steps:**

1. Navigate to "Weekly Report" page (Week 16 showing "Live - 4/6 Submitted").
2. In the period navigator, select "Week 15 - Apr 7--13".
3. Observe the page state.
   **Expected:**

- Header badge changes from "Live - 4/6 Submitted" to "Published - Week 15".
- "Publish & Lock" button disappears (already published).
- "Export PDF" button remains visible and functional.
- "Reopen" button does not appear for past published periods (only applicable to current period).
- Portfolio Overview shows Week 15's data (may differ from Week 16).
- Per-lead accordions show Week 15's submitted data.
- Escalations section shows Week 15's consolidated risks.

---

### SC-146: Weekly Report -- past report shows only Export PDF

**Role:** Head
**Priority:** P1
**Precondition:** Head "Director H." is logged in. Viewing Week 15 (published, past).
**Steps:**

1. Navigate to Weekly Report for Week 15.
2. Observe available action buttons in the header.
   **Expected:**

- "Export PDF" button: visible and functional.
- "Publish & Lock" button: hidden (already published).
- "Reopen" button: hidden (not applicable to past periods, only current).
- "Toggle All" button: visible and functional (view-only action).

---

### SC-147: Weekly Report -- combobox shows (current) label

**Role:** Head
**Priority:** P2
**Precondition:** Head "Director H." is logged in. Week 16 is the current period.
**Steps:**

1. Navigate to "Weekly Report" page.
2. Click/open the period navigator combobox.
3. Observe the option labels.
   **Expected:**

- Week 16 option shows "Week 16 - Apr 14--20 (current)" with "(current)" label.
- Week 15 shows "Week 15 - Apr 7--13" without "(current)".
- Earlier weeks follow the same pattern.
- The combobox lists all periods created by Admin in reverse chronological order.
- Right arrow is disabled on Week 16 (latest).

---

### SC-148: Period not created by Admin -- not in dropdown

**Role:** Lead
**Priority:** P2
**Precondition:** Lead "Polenkov A." is logged in. Admin has created periods for Weeks 11--16 only. Week 17 does not exist.
**Steps:**

1. Open the period navigator combobox.
2. Verify available options.
   **Expected:**

- Only Weeks 11 through 16 appear in the dropdown.
- No "Week 17" option exists.
- No "Create new period" option exists for Leads.
- Right arrow is disabled on Week 16 (latest created period).

---

## 19. Publish & Lock (D-56) -- E2E Deep Scenarios

### SC-150: Full lifecycle: Open, leads submit, Publish & Lock, all locked

**Role:** Head, Lead
**Priority:** P0
**Precondition:** Period Week 16 is Open. 0 leads have submitted.
**Steps:**

1. As Lead "Polenkov A.": Fill the form, click "Submit Report", confirm.
2. As Lead "Maria K.": Fill the form, click "Submit Report", confirm.
3. (Repeat for Igor V. and Dmitry S.)
4. As Head "Director H.": Navigate to Dashboard. Verify "4/6 Submitted".
5. Navigate to "Weekly Report" page. Verify "Live - 4/6 Submitted".
6. Click "Publish & Lock". Confirm in dialog (acknowledging 2 pending leads).
7. As Lead "Polenkov A.": Navigate to "My Report".
8. As Lead "Olga N." (not submitted): Navigate to "My Report".
   **Expected:**

- Step 4: Dashboard shows "4/6" submissions, 2 pending alert.
- Step 5: Weekly Report shows data from 4 submitted leads.
- Step 6: After publish, badge changes to "Published - Week 16".
- Step 7: Polenkov sees locked banner: "Report published by Director H. on [date]." All fields disabled. "Request Reopen" button visible.
- Step 8: Olga N. also sees locked banner despite not having submitted. Her form shows whatever draft data existed, but all fields are disabled. "Request Reopen" button visible.
- No lead can edit anything for Week 16 after publish.

---

### SC-151: Publish with 0 submissions -- warning

**Role:** Head
**Priority:** P1
**Precondition:** Head "Director H." is logged in. Week 16 is Open. 0 out of 6 leads have submitted.
**Steps:**

1. Navigate to "Weekly Report" page.
2. Verify badge: "Live - 0/6 Submitted".
3. Click "Publish & Lock".
4. Observe the confirmation dialog.
   **Expected:**

- Dialog warns: "6 leads haven't submitted: Polenkov A., Maria K., Igor V., Dmitry S., Olga N., Sergey T."
- Warning text: "No leads have submitted. The published report will be empty."
- Publishing is still allowed (Head's decision).
- After publishing, all 6 lead forms are locked (all in Draft or Pending state).

---

### SC-152: Publish with partial submissions -- warning with names

**Role:** Head
**Priority:** P0
**Precondition:** Head "Director H." is logged in. 4/6 leads submitted. Olga N. (Draft) and Sergey T. (Pending) have not.
**Steps:**

1. Navigate to "Weekly Report" page.
2. Click "Publish & Lock".
3. Observe the dialog.
   **Expected:**

- Dialog title: "Publish & Lock Report?"
- Warning: "2 leads haven't submitted: Olga N., Sergey T."
- Shows: "Week 16 - Apr 14--20 - 4/6 leads submitted".
- Two buttons: "Cancel" and "Publish & Lock Anyway".
- Clicking "Cancel" returns to the report without changes.
- Clicking "Publish & Lock Anyway" proceeds with publishing.

---

### SC-153: After publish -- Lead sees locked banner with Head name and date

**Role:** Lead
**Priority:** P0
**Precondition:** Period Week 16 has been published by "Director H." at 2026-04-21 14:30.
**Steps:**

1. Login as Lead "Polenkov A.".
2. Navigate to "My Report" page.
   **Expected:**

- Locked banner at the top of the form: green-tinted background with lock icon.
- Banner text: "Report published by Director H. on Apr 21, 2026 at 14:30."
- Banner includes "Request Reopen" button.
- All form fields are disabled/read-only.
- "Submit Report" button is not visible.
- "Fill from Previous" button is not visible.
- SDLC stage chips are non-clickable for owned stages.
- Version navigator is still visible (can browse history but not edit).

---

### SC-154: After publish -- Lead tries to edit, all fields disabled

**Role:** Lead
**Priority:** P0
**Precondition:** Period is Published. Lead "Polenkov A." is logged in viewing their form.
**Steps:**

1. Navigate to "My Report" page.
2. Try clicking on a Current Week item to edit.
3. Try clicking on an SDLC stage chip (owned stage).
4. Try clicking "+ Add" if visible.
5. Try editing a Priority input field.
6. Try editing a Risk textarea.
   **Expected:**

- All text inputs and textareas have `readonly` or `disabled` attribute.
- SDLC stage chips do not respond to click (no popover).
- "+ Add" buttons are hidden or disabled.
- Edit/Delete action buttons on kanban cards are hidden.
- No API calls are made for any attempted edit action.
- Cursor shows `not-allowed` on interactive elements.

---

### SC-155: After publish -- Weekly Report shows "Published" badge

**Role:** Head
**Priority:** P1
**Precondition:** Period Week 16 has been published.
**Steps:**

1. Login as Head "Director H.".
2. Navigate to "Weekly Report" page.
   **Expected:**

- Header badge shows "Published - Week 16" (green/teal badge).
- "Publish & Lock" button is replaced by "Reopen" button.
- "Export PDF" button remains visible.
- Portfolio Overview and per-lead sections show frozen data.
- The report displays identically to the moment of publishing (no live updates).

---

### SC-156: Reopen -- leads can edit again

**Role:** Head, Lead
**Priority:** P0
**Precondition:** Period Week 16 is Published. Head "Director H." is logged in.
**Steps:**

1. Navigate to "Weekly Report" page.
2. Click "Reopen" button.
3. Confirm in the dialog.
4. Switch to Lead "Polenkov A." session.
5. Navigate to "My Report" page.
6. Switch to Lead "Olga N." session (was not submitted before publish).
7. Navigate to "My Report" page.
   **Expected:**

- Weekly Report badge changes back to "Live - 4/6 Submitted".
- "Reopen" button disappears; "Publish & Lock" button reappears.
- Polenkov (submitted before publish): form remains locked in "Submitted" state. He needs to have his submission revoked to edit again.
- Olga N. (not submitted): form becomes editable again. She can continue filling and submit.
- Sergey T. (not started): form becomes accessible for filling.
- Leads receive notification: "Period reopened by Director H."

---

### SC-157: Re-publish after reopen

**Role:** Head
**Priority:** P1
**Precondition:** Head "Director H." has reopened Week 16. Olga N. has now submitted (making it 5/6). Head wants to re-publish.
**Steps:**

1. Navigate to "Weekly Report" page. Verify "Live - 5/6 Submitted".
2. Click "Publish & Lock".
3. Confirm in dialog (1 lead pending: Sergey T.).
   **Expected:**

- Dialog shows: "1 lead hasn't submitted: Sergey T."
- After confirm: badge changes to "Published - Week 16" again.
- All 6 lead forms locked again.
- The report now includes Olga N.'s newly submitted data (5 leads' data).
- "Reopen" button reappears for another potential reopen cycle.

---

### SC-158: Double publish attempt (already published)

**Role:** Head
**Priority:** P2
**Precondition:** Period Week 16 is already Published.
**Steps:**

1. Navigate to "Weekly Report" page.
2. Verify the state shows "Published - Week 16".
3. Look for "Publish & Lock" button.
   **Expected:**

- "Publish & Lock" button is not visible (replaced by "Reopen").
- There is no way to "publish again" without first reopening.
- If the user somehow triggers a publish API call on an already-published period, the API returns an error: "Period is already published."

---

## 20. Revoke Submit (D-57) -- Deep Scenarios

### SC-160: Revoke specific lead's submission

**Role:** Admin
**Priority:** P0
**Precondition:** Admin is logged in. Dashboard shows 6 leads: 4 submitted (Polenkov, Maria, Igor, Dmitry), 1 draft (Olga), 1 pending (Sergey). Period is Open.
**Steps:**

1. Navigate to "Dashboard" page.
2. Locate "Lead Reports" section.
3. Find Polenkov A.'s entry with "Submitted" badge.
4. Click "Revoke" button next to Polenkov A.
5. Observe the confirmation dialog.
6. Click "Revoke" to confirm.
   **Expected:**

- Confirmation dialog: "Revoke Polenkov A.'s submission? Their form will become editable again."
- After revoke: Polenkov's status changes from "Submitted" (green badge) to "Draft" (yellow badge).
- "Revoke" button disappears from Polenkov's entry.
- Submissions KPI updates from "4/6" to "3/6".
- Progress bar updates to 50% (3/6).
- Alert banner updates to show 3 pending leads.

---

### SC-161: After revoke -- lead's form becomes editable

**Role:** Lead
**Priority:** P0
**Precondition:** Admin has revoked Polenkov A.'s submission (per SC-160).
**Steps:**

1. Login as Lead "Polenkov A.".
2. Navigate to "My Report" page.
   **Expected:**

- Locked banner is removed from the form.
- "Autosaved" badge reappears (replacing "Submitted" state).
- All input fields are editable again.
- "+ Add" buttons are visible and functional.
- Edit/Delete action buttons appear on hover over kanban cards.
- SDLC stage chips for owned stages are clickable.
- "Submit Report" button reappears in the header.
- Data from the previous submission is preserved (not cleared).
- Lead receives notification: "Your submission was revoked by [Admin]. Please review and resubmit."

---

### SC-162: After revoke -- KPI submissions count updates

**Role:** Head
**Priority:** P1
**Precondition:** Admin has revoked Polenkov A.'s submission. Originally 4/6 submitted.
**Steps:**

1. Login as Head "Director H.".
2. Navigate to "Dashboard" page.
3. Verify the Submissions KPI card.
4. Verify the alert banner.
   **Expected:**

- Submissions KPI shows "3/6" (down from "4/6").
- Progress bar shows 50% fill (down from 66%).
- Alert banner: "3 leads pending: Polenkov A., Olga N., Sergey T."
- "Send Reminder" button targets 3 leads instead of 2.

---

### SC-163: After revoke -- Weekly Report removes revoked lead's data

**Role:** Head
**Priority:** P0
**Precondition:** Admin has revoked Polenkov A.'s submission. Head views Weekly Report.
**Steps:**

1. Navigate to "Weekly Report" page.
2. Verify the header badge.
3. Look for Polenkov A.'s section.
   **Expected:**

- Badge updates to "Live - 3/6 Submitted" (down from 4/6).
- Polenkov A.'s accordion section changes from "Submitted" to "Draft" or shows reduced opacity.
- The compiled data no longer includes Polenkov's items in the consolidated view (or marks them as "unsubmitted draft").
- Portfolio Overview may update if Polenkov's stage statuses are excluded from the compiled view.
- Escalations section may remove Polenkov's risks from the consolidated list.

---

### SC-164: Revoke + lead re-submits

**Role:** Admin, Lead
**Priority:** P1
**Precondition:** Admin revoked Polenkov A.'s submission. Polenkov makes edits and re-submits.
**Steps:**

1. Admin revokes Polenkov's submission (per SC-160).
2. Polenkov edits his form (adds 2 new items, updates a risk).
3. Polenkov clicks "Submit Report" and confirms.
4. Head views Dashboard.
5. Head views Weekly Report.
   **Expected:**

- Polenkov can successfully re-submit after revoke.
- Dashboard shows Polenkov back as "Submitted" with updated timestamp.
- Submissions KPI goes back to "4/6".
- Weekly Report includes Polenkov's updated data (with the 2 new items and updated risk).
- The revoke+resubmit cycle can be repeated multiple times.

---

### SC-165: Revoke all leads simultaneously

**Role:** Admin
**Priority:** P2
**Precondition:** Admin is logged in. 4 leads are submitted.
**Steps:**

1. Revoke Polenkov A.'s submission. Verify "3/6".
2. Revoke Maria K.'s submission. Verify "2/6".
3. Revoke Igor V.'s submission. Verify "1/6".
4. Revoke Dmitry S.'s submission. Verify "0/6".
   **Expected:**

- Each revoke decrements the submission count.
- Final state: "0/6" submitted. All leads in Draft or Pending state.
- No "Revoke" buttons visible (no submitted leads remain).
- Alert banner lists all 6 leads as pending.
- Weekly Report shows "Live - 0/6 Submitted" with empty or minimal data.

---

### SC-166: Revoke during Published state

**Role:** Admin
**Priority:** P2
**Precondition:** Period is Published (all forms locked). Admin is logged in.
**Steps:**

1. Navigate to "Dashboard" page.
2. Locate "Lead Reports" section.
3. Check if "Revoke" buttons are visible.
   **Expected:**

- "Revoke" buttons are hidden or disabled when the period is Published.
- Revoking is only allowed during an Open period.
- If Admin tries to revoke via API on a Published period, the API returns an error: "Cannot revoke during a published period. Reopen the period first."
- To revoke: Admin must first "Reopen" the period, then revoke.

---

### SC-167: Revoke non-submitted lead -- button not shown

**Role:** Admin
**Priority:** P2
**Precondition:** Admin is logged in. Olga N. has status "Draft", Sergey T. has status "Pending".
**Steps:**

1. Navigate to "Dashboard" page.
2. Locate "Lead Reports" section.
3. Observe Olga N.'s entry.
4. Observe Sergey T.'s entry.
   **Expected:**

- No "Revoke" button on Olga N.'s entry (Draft status).
- No "Revoke" button on Sergey T.'s entry (Pending status).
- "Revoke" button only appears on leads with "Submitted" status.
- This matches SC-105 but verifies from the Admin perspective specifically.

---

## 21. Dashboard Interactions -- Deep Scenarios

### SC-170: Toggle All collapses all sections

**Role:** Head
**Priority:** P2
**Precondition:** Head "Director H." is logged in. Dashboard has collapsible sections: Blocked & At Risk, Lead Reports.
**Steps:**

1. Navigate to "Dashboard" page.
2. Verify sections are expanded (default state).
3. Click "Toggle All" button.
4. Observe all collapsible sections.
   **Expected:**

- All accordion sections collapse simultaneously.
- Chevron icons rotate to -90 degrees (collapsed state).
- `aria-expanded` attributes change to "false".
- Section content is hidden via `grid-template-rows: 0fr` with 0.3s animation.
- KPI cards and non-collapsible elements remain visible.

---

### SC-171: Toggle All expands all sections

**Role:** Head
**Priority:** P2
**Precondition:** Head "Director H." is logged in. All Dashboard sections are collapsed.
**Steps:**

1. Click "Toggle All" button again (after collapsing).
2. Observe all sections.
   **Expected:**

- All accordion sections expand simultaneously.
- Chevron icons rotate back to 0 degrees.
- `aria-expanded` attributes change to "true".
- Section content becomes visible with smooth animation.
- All data is accessible and rendered correctly.

---

### SC-172: Alert bar shows correct pending lead names

**Role:** Head
**Priority:** P0
**Precondition:** Head "Director H." is logged in. 2 leads pending: Olga N. (Draft) and Sergey T. (Not started).
**Steps:**

1. Navigate to "Dashboard" page.
2. Locate the yellow alert banner.
   **Expected:**

- Alert banner appears with yellow left border and yellow background (#fffbeb).
- Warning icon (triangle) in gold color.
- Text: "Olga N. (Draft) and Sergey T. (Not started) haven't submitted".
- "Send Reminder" button on the right side.
- If 1 lead pending: shows single name. If 3+ leads pending: lists all names.
- Names are bold.

---

### SC-173: Alert bar hidden when all submitted

**Role:** Head
**Priority:** P1
**Precondition:** Head "Director H." is logged in. All 6 leads have submitted.
**Steps:**

1. Navigate to "Dashboard" page.
2. Look for the yellow alert banner.
   **Expected:**

- Alert banner is not rendered.
- No empty space where the banner would be (layout adjusts).
- Submissions KPI shows "6/6" with full progress bar.

---

### SC-174: Send Reminder -- success flow

**Role:** Head
**Priority:** P1
**Precondition:** Head "Director H." is logged in. 2 leads pending.
**Steps:**

1. Click "Send Reminder" button in the alert banner.
2. Observe the reminder dialog (per SC-24).
3. Click "Send Email".
4. Observe the result.
   **Expected:**

- Dialog shows the 2 pending leads with avatars and status info.
- Clicking "Send Email" triggers SMTP email to both Olga N. and Sergey T.
- Success toast: "Reminder sent to Olga N. and Sergey T." with green left border.
- Dialog closes after sending.
- "Send Reminder" button may show a cooldown state (e.g., "Sent" for 5 minutes to prevent spam).

---

### SC-175: Report Archive -- page 1 default

**Role:** Head
**Priority:** P1
**Precondition:** Head "Director H." is logged in. 12 reports exist in total.
**Steps:**

1. Navigate to "Dashboard" page.
2. Scroll to "Report Archive" section.
3. Observe the report cards.
   **Expected:**

- Title: "Report Archive" with "12 reports total" meta text.
- First page shows 4 report cards in a grid (4 columns on large screens).
- Cards ordered by most recent first: Week 16 (Active), Week 15 (Published), Week 14 (Published), Week 13 (Published).
- Each card shows: week number, date range, submission count, product/risk/decision summary.
- Week 16 card has green left border and "Active" badge.
- Other cards have neutral left border and "Published" badge.
- Pagination at the bottom: 1 (active), 2, 3.

---

### SC-176: Report Archive -- navigate to page 2

**Role:** Head
**Priority:** P2
**Precondition:** Head is logged in. 12 reports exist. Page 1 is showing.
**Steps:**

1. Click page "2" in pagination controls.
2. Observe the report cards update.
   **Expected:**

- Page 2 loads with the next 4 report cards (Weeks 12, 11, 10, 9).
- Pagination updates: 1, 2 (active), 3.
- Left arrow (prev) is now active.
- Cards show published status and historical data.

---

### SC-177: Report Archive -- click report opens Weekly Report for that period

**Role:** Head
**Priority:** P1
**Precondition:** Head is logged in. Viewing Report Archive. Week 15 card is visible.
**Steps:**

1. Click on the "Week 15" card.
2. Observe navigation.
   **Expected:**

- Navigates to the Weekly Report page with period set to Week 15.
- Weekly Report shows "Published - Week 15" badge.
- Data reflects Week 15's published content.
- User can navigate back to Dashboard via the navigation bar.

---

### SC-178: KPI Escalations -- count matches Blocked & At Risk entries

**Role:** Head
**Priority:** P0
**Precondition:** Head "Director H." is logged in. Dashboard shows 2 Blocked and 3 At Risk entries in the Blocked & At Risk table.
**Steps:**

1. Navigate to "Dashboard" page.
2. Note the "Risks & Blockers" KPI card values: 2 Blocked, 3 At Risk.
3. Expand the "Blocked & At Risk" section.
4. Count the entries.
   **Expected:**

- KPI card shows "2" in red (Blocked) and "3" in gold (At Risk).
- The Blocked & At Risk table lists exactly 5 entries (2 Blocked + 3 At Risk).
- Each Blocked entry has a red badge; each At Risk entry has a yellow badge.
- KPI card also shows "2" in teal for Decisions.
- The counts match between KPI summary and detailed table.

---

### SC-179: Lead Reports -- traffic light dots match lead's actual product statuses

**Role:** Head
**Priority:** P1
**Precondition:** Head is logged in. Polenkov A. has 6 products: 3 green (On Track), 1 red (Blocked), 1 yellow (At Risk), 1 green.
**Steps:**

1. Navigate to "Dashboard" page.
2. Locate Polenkov A.'s entry in Lead Reports.
3. Observe the traffic light dot indicators next to his name.
   **Expected:**

- Traffic light dots match Polenkov's SDLC stage statuses across his 6 products.
- Dots are 18x18px circles with icons: green "checkmark" for On Track, red "X" for Blocked, yellow "!" for At Risk.
- Exact sequence from mockup: green, red, yellow, green, green, green (representing CRM, Data Analytics, Mobile, Cloud, AI/ML, Integration statuses).
- Dots provide a quick visual summary without needing to open the lead's form.

---

## 22. Lead Form Interactions -- Deep Scenarios

### SC-180: Autosave triggers on field change (debounced)

**Role:** Lead
**Priority:** P0
**Precondition:** Lead "Polenkov A." is logged in. Form has existing data. Autosave badge shows "Autosaved".
**Steps:**

1. Edit a Current Week item description (type "test").
2. Immediately observe the autosave badge.
3. Wait 2 seconds without further input.
4. Observe the autosave badge again.
5. Rapidly edit 3 different fields within 1 second.
6. Wait 2 seconds.
7. Observe the autosave badge.
   **Expected:**

- During typing, autosave does NOT fire on every keystroke (debounced).
- After 2 seconds of inactivity, autosave fires.
- Badge changes from "Autosaved" to "Saving..." during the save operation.
- Badge returns to "Autosaved" with checkmark after save completes.
- Rapid edits across multiple fields result in a single autosave (debounce coalesces).
- Version counter increments by 1 (not multiple times for rapid edits).

---

### SC-181: Autosave badge shows "Saving..." during save

**Role:** Lead
**Priority:** P1
**Precondition:** Lead "Polenkov A." is logged in with a draft report.
**Steps:**

1. Edit a field to trigger autosave.
2. Observe the badge transition.
   **Expected:**

- Badge text changes from "Autosaved" to "Saving..." (or shows a spinner).
- Badge color may change during save (e.g., from green to neutral).
- Duration of "Saving..." state depends on network latency (typically <1 second).
- After completion, badge returns to "Autosaved" with green checkmark and updated timestamp.

---

### SC-182: Autosave fails -- error toast

**Role:** Lead
**Priority:** P0
**Precondition:** Lead "Polenkov A." is logged in. Network is disconnected or API returns 500.
**Steps:**

1. Disconnect network (simulate).
2. Edit a field to trigger autosave.
3. Wait for autosave attempt.
4. Observe the badge and notification.
   **Expected:**

- Badge changes from "Autosaved" to "Save failed" or shows a red warning indicator.
- Error toast appears: red left border, warning icon, title "Save error", subtitle "Check your connection and try again."
- Data remains in the form (not lost from the client).
- When network reconnects, autosave retries automatically.
- On successful retry, badge returns to "Autosaved" and error toast can be dismissed.

---

### SC-183: Add item modal -- description required validation

**Role:** Lead
**Priority:** P1
**Precondition:** Lead "Polenkov A." is logged in.
**Steps:**

1. Under a Current Week product column, click "+ Add".
2. In the Add Item modal, leave the Description field empty.
3. Click "Save Item".
   **Expected:**

- The Description input field shows a red border (`border-color: var(--red)`).
- Error message below the field: "Description is required." in red (13px font size).
- Modal does not close.
- Item is not created.
- Focus moves to the invalid field.
- Pressing Enter does not bypass validation.

---

### SC-184: Add item modal -- cancel does not create item

**Role:** Lead
**Priority:** P1
**Precondition:** Lead "Polenkov A." is logged in. Currently has 11 Current Week items.
**Steps:**

1. Under CRM Platform column, click "+ Add".
2. Fill in Description "Test item".
3. Click "Cancel" button.
4. Observe the items list.
   **Expected:**

- Modal closes without creating the item.
- Current Week badge still shows "11 items" (unchanged).
- CRM Platform column shows the same 4 items as before.
- No autosave is triggered by the cancellation.

---

### SC-185: Edit item -- pre-filled data correct

**Role:** Lead
**Priority:** P1
**Precondition:** Lead "Polenkov A." is logged in. CRM Platform has an item: "Интеграция OAuth2 для партнёрского API" with status "In Progress".
**Steps:**

1. Hover over the first CRM Platform item.
2. Click the Edit button (pencil icon).
3. Observe the Edit Item modal.
   **Expected:**

- Modal opens with Description field pre-filled: "Интеграция OAuth2 для партнёрского API".
- Status dropdown pre-selected: "In Progress".
- Assignee field pre-filled: "Polenkov A."
- All fields are editable.
- Modal title: "Edit Item" or similar.
- "Save Item" and "Cancel" buttons are present.

---

### SC-186: Delete item -- confirmation dialog and confirm

**Role:** Lead
**Priority:** P0
**Precondition:** Lead "Polenkov A." is logged in. CRM Platform has 4 Current Week items. Badge shows "11 items" total.
**Steps:**

1. Hover over the first CRM Platform item.
2. Click the Delete button (trash icon with red hover state).
3. Observe the confirmation dialog.
4. Click "Delete Item".
5. Observe the items list.
   **Expected:**

- Confirmation dialog: "Delete Current Week item?"
- Subtitle: "This action cannot be undone."
- Item text shown in a preview block.
- Clicking "Delete Item" (red button) removes the item.
- CRM Platform column now shows 3 items.
- Badge updates from "11 items" to "10 items".
- Autosave triggers to persist the deletion.

---

### SC-187: Delete item -- cancel does not delete

**Role:** Lead
**Priority:** P1
**Precondition:** Lead "Polenkov A." is logged in. CRM Platform has 4 items.
**Steps:**

1. Hover over an item, click Delete.
2. In the confirmation dialog, click "Cancel".
3. Observe the items list.
   **Expected:**

- Dialog closes.
- Item remains in the list.
- Badge shows "11 items" (unchanged).
- No autosave triggered.

---

### SC-188: Kanban card hover shows Edit/Delete buttons

**Role:** Lead
**Priority:** P1
**Precondition:** Lead "Polenkov A." is logged in. Items exist in the form.
**Steps:**

1. Move the mouse to hover over a kanban card.
2. Observe the action buttons.
3. Move the mouse away.
   **Expected:**

- On hover: action buttons appear in the top-right corner of the card (Edit and Delete).
- Buttons transition from `opacity: .3` to `opacity: 1` over 0.15s.
- Edit button has a pencil icon. Delete button has a trash icon and class `del`.
- Delete button shows red hover state: `background: #fee2e2; color: var(--red)`.
- On mouse leave: buttons fade back to `opacity: .3`.
- On touch devices (`hover: none`): buttons stay at `opacity: .6` permanently.

---

### SC-189: Kanban card read-only (other lead's) -- no hover buttons

**Role:** Lead
**Priority:** P1
**Precondition:** Lead "Polenkov A." is logged in. Cloud Infrastructure has items from Sidorov P. (DevOps stage).
**Steps:**

1. Locate Sidorov P.'s items in Cloud Infrastructure column.
2. Hover over a Sidorov P. item.
   **Expected:**

- Item card has class `kb-card ro` with `opacity: .6`.
- Hover does NOT show Edit/Delete buttons (`.kb-card.ro .kb-actions { display: none !important }`).
- Card does not elevate or show enhanced border on hover.
- Cursor remains default.
- Item shows Sidorov P.'s assignee name at the bottom.

---

### SC-190: SDLC stage -- change status from On Track to At Risk

**Role:** Lead
**Priority:** P0
**Precondition:** Lead "Polenkov A." is logged in. Mobile Applications DevOps stage is "On Track" (green).
**Steps:**

1. Navigate to "My Report" page.
2. Click on "DevOps" stage chip for Mobile Applications (green, On Track).
3. In the popover, click "At Risk" chip (yellow).
4. Click "Save" in the popover.
5. Observe the stage chip update.
   **Expected:**

- Popover opens showing: title "DevOps -- Mobile Applications", assignee "Polenkov A.", three status chips.
- "On Track" chip is currently active (selected).
- Clicking "At Risk" selects it (yellow background with border `#d4a017`).
- "On Track" deselects (returns to outline style).
- After save: stage chip changes from green to yellow, icon from "checkmark" to "!".
- Product card background may tint yellow (At Risk detected).
- Autosave triggers to persist the status change.

---

### SC-191: SDLC stage -- click locked stage does nothing

**Role:** Lead
**Priority:** P1
**Precondition:** Lead "Polenkov A." is logged in. CRM Platform Analysis stage is assigned to Ivanov A. (locked).
**Steps:**

1. Click on the "Analysis" stage chip for CRM Platform.
   **Expected:**

- Nothing happens. No popover opens.
- Cursor shows `not-allowed`.
- No visual change on the chip.
- No API call is made.
- Tooltip shows "Ivanov A. - No edit permissions".

---

### SC-192: Risk -- add new risk with product+stage scope

**Role:** Lead
**Priority:** P0
**Precondition:** Lead "Polenkov A." is logged in. Currently has 3 risks.
**Steps:**

1. Scroll to "Risks & Blockers" section.
2. Click "+ Add Risk" button.
3. In the new risk form, select Product: "AI/ML Platform", Stage: "Testing".
4. Enter risk description: "Тестовые данные для ML моделей не готовы."
5. Observe the risk entry.
   **Expected:**

- New risk entry appears with product badge "AI/ML Platform" and stage label "Testing stage".
- Risk inherits the severity from the associated stage status (if Testing is On Track, badge shows "At Risk" as a manual risk entry; if Testing is Blocked, badge shows "Blocked").
- Badge count updates from "3" to "4".
- Risk textarea is editable and autosaves on change.
- The product/stage selector only shows products and stages assigned to this lead.

---

### SC-193: Priorities -- max 3, cannot add 4th

**Role:** Lead
**Priority:** P1
**Precondition:** Lead "Polenkov A." is logged in. All 3 priority slots are filled. Badge shows "3/3".
**Steps:**

1. Navigate to "Top 3 Priorities" section.
2. Attempt to find an "Add Priority" button or 4th slot.
   **Expected:**

- No "Add Priority" or "+ Add" button exists in the Priorities section.
- Exactly 3 input slots are shown (numbered 1, 2, 3).
- There is no way to create a 4th priority.
- Badge shows "3/3" indicating the maximum is reached.
- The constraint is enforced by the UI (no 4th input rendered) and the API (rejects >3).

---

### SC-194: Priorities -- clear one, badge updates

**Role:** Lead
**Priority:** P1
**Precondition:** Lead "Polenkov A." is logged in. 3/3 priorities filled.
**Steps:**

1. Clear the Priority 3 input completely (select all, delete).
2. Wait for autosave.
3. Observe the badge.
   **Expected:**

- Badge updates from "3/3" to "2/3".
- Priority 3 input shows empty with placeholder text.
- Priority 3 row background changes from canvas/neutral to match the empty state.
- Clearing Priority 1 or Priority 2 also updates the badge accordingly.

---

### SC-195: Submit Report -- confirmation dialog shows correct counts

**Role:** Lead
**Priority:** P0
**Precondition:** Lead "Polenkov A." is logged in with: 11 Current Week items, 6 Next Week items, 3 risks, 2 decisions, 3 priorities.
**Steps:**

1. Click "Submit Report" button.
2. Observe the confirmation dialog.
   **Expected:**

- Dialog title: "Submit Report?"
- Summary line: "6 products - 11 items - 3 risks - 2 decisions" (or similar format matching actual counts).
- Warning text: "After submission, editing will be locked."
- "Submit Report" button (primary green) and "Cancel" button.
- Counts match the actual section badges.

---

### SC-196: Submit Report -- after submit form locked, timestamp shown

**Role:** Lead
**Priority:** P0
**Precondition:** Lead "Polenkov A." has submitted successfully.
**Steps:**

1. Observe the form immediately after submission.
   **Expected:**

- Locked banner appears: green background with lock icon, "Report locked", timestamp "Submitted Apr 16, 2026 at 14:30" (or actual time).
- Banner style: `background: var(--tealL); border: 1px solid rgba(0,98,65,.2)`.
- "Submit Report" button disappears or changes to disabled "Submitted" badge.
- All form sections are read-only.
- Autosave badge changes to show submission timestamp.

---

## 23. Weekly Report Interactions -- Deep Scenarios

### SC-200: Toggle All collapses all accordion sections

**Role:** Head
**Priority:** P2
**Precondition:** Head "Director H." is logged in. Weekly Report page. All sections expanded.
**Steps:**

1. Navigate to "Weekly Report" page.
2. Click "Toggle All" button.
3. Observe all collapsible sections.
   **Expected:**

- Portfolio Overview, all lead accordions collapse simultaneously.
- Chevron icons rotate to -90 degrees.
- `aria-expanded` changes to "false" on all toggle buttons.
- Header and buttons remain visible.

---

### SC-201: Portfolio Overview -- 12 products shown with correct worst-case statuses

**Role:** Head
**Priority:** P0
**Precondition:** Head "Director H." is logged in. All 12 products configured. 4 leads submitted.
**Steps:**

1. Navigate to "Weekly Report" page.
2. Expand "Portfolio Overview -- 12 products" section.
3. Count and verify all product tiles.
   **Expected:**

- Exactly 12 product tiles in a 3-column grid.
- Each tile has: traffic-light dot, product name, status summary.
- Worst-case status per product (from all stages across all leads):
  - Data Analytics Suite: red dot "Blocked" (has a Blocked stage).
  - Mobile Applications: yellow dot "At Risk" (has At Risk stage, no Blocked).
  - Cloud Infrastructure: yellow dot "At Risk".
  - Admin Portal: yellow dot "At Risk".
  - CRM Platform: green dot "6/7 On Track".
  - AI/ML Platform: green dot "5/7 On Track".
  - All others: green dots.
- Background colors: green-tinted (tealL), yellow-tinted (#fef3c7), red-tinted (#fee2e2).

---

### SC-202: Per-lead accordion -- shows correct item counts and data

**Role:** Head
**Priority:** P0
**Precondition:** Head "Director H." is logged in. Polenkov A. submitted with 11 current items, 9 next items, 1 risk, 2 decisions, 3 priorities.
**Steps:**

1. Navigate to "Weekly Report" page.
2. Expand Polenkov A.'s accordion.
3. Verify each sub-section.
   **Expected:**

- Current Week: "11 items" with entries grouped by product line (CRM Platform - Dev, Data Analytics Suite - Testing, etc.).
- Next Week: items listed with "Planned" badges and dashed borders.
- Risks & Blockers: "1" entry with CRM Dev At Risk description.
- Decisions: "2" entries with product badges (Cloud Infrastructure, AI/ML Platform).
- Top 3 Priorities: numbered list with gold-tinted backgrounds.
- Items from different products are separated by product line group headers (uppercase, with divider line).

---

### SC-203: Export PDF -- button triggers generation

**Role:** Head
**Priority:** P1
**Precondition:** Head "Director H." is logged in. Weekly Report has data.
**Steps:**

1. Navigate to "Weekly Report" page.
2. Click "Export PDF" button (outlined style).
3. Wait for generation.
   **Expected:**

- Click triggers PDF generation (async BullMQ job).
- Progress indicator or toast: "Generating PDF..."
- After generation: PDF downloads to browser or opens in a new tab.
- PDF file name includes week identifier: "CustomReport-Week16-Apr14-20-2026.pdf".
- PDF size within expected range (59--125KB per Playwright generation).
- PDF content includes: Portfolio Overview grid, all lead sections, risks, decisions, priorities.
- PDF excludes interactive elements (no buttons, no input fields).

---

## 24. Admin Panel -- Deep Scenarios

### SC-220: Tab switching in Admin Panel

**Role:** Admin
**Priority:** P1
**Precondition:** Admin is logged in. Admin Panel is displayed with Products tab active.
**Steps:**

1. Navigate to "Admin" page.
2. Observe the tab bar: Users, Products (active), Periods, Reminders, Settings.
3. Click "Users" tab.
4. Observe the content changes.
5. Click "Periods" tab.
6. Click "Reminders" tab.
7. Click "Settings" tab.
   **Expected:**

- Each tab click switches the displayed content.
- Active tab has primary green background (`btn-pr` style) with white text.
- Inactive tabs have ghost button style with gray text.
- Content transitions are immediate (no loading delay for tab switch).
- Tab bar is a rounded pill-button group with consistent spacing.

---

### SC-221: Users -- add user with all fields

**Role:** Admin
**Priority:** P1
**Precondition:** Admin is logged in. Users tab active.
**Steps:**

1. Click "+ Add User" button.
2. Fill: Full Name "Novikov D.", Email "d.novikov@company.com", Role "Lead", Department "CoreDev".
3. Add assigned products: select "CRM Platform" and "Cloud Infrastructure".
4. Click "Save User".
5. Observe the users table.
   **Expected:**

- Add User form has: Full Name (required), Email (required, email validation), Role dropdown (Lead/Head/Admin), Department dropdown.
- Products section shows selectable products as badges.
- After save: new row appears in users table showing "Novikov D." with "Lead" badge, "2 products", "Active" status.
- Edit and Delete buttons are shown in the Actions column.

---

### SC-222: Users -- edit user role

**Role:** Admin
**Priority:** P1
**Precondition:** Admin is logged in. Users tab active. Polenkov A. has "Lead" role.
**Steps:**

1. Click "Edit" on Polenkov A.'s row.
2. Change Role from "Lead" to "Head".
3. Click "Save User".
   **Expected:**

- Edit form pre-fills with Polenkov A.'s data.
- Role dropdown changes to "Head".
- After save: Polenkov's badge changes from "Lead" (teal) to "Head" (gold).
- Polenkov's navigation changes on next login (gains Dashboard, Report, Admin access).
- Product assignments may change (Head sees all products).

---

### SC-223: Users -- delete user with confirmation

**Role:** Admin
**Priority:** P1
**Precondition:** Admin is logged in. Users tab active.
**Steps:**

1. Click delete button (trash icon) on a user row.
2. Observe the confirmation dialog.
3. Click "Delete" to confirm.
   **Expected:**

- Confirmation dialog: "Delete user [Name]? This action cannot be undone."
- If user has active stage assignments, additional warning: "This user is assigned to [N] stages. Those stages will become unassigned."
- After deletion: user disappears from the table.
- Total user count updates.

---

### SC-224: Products -- edit product SDLC stages

**Role:** Admin
**Priority:** P0
**Precondition:** Admin is logged in. Products tab active. CRM Platform has 7 stages.
**Steps:**

1. Click "Edit" on CRM Platform.
2. In the edit form, observe 7 SDLC stages with assignee dropdowns.
3. Change Dev stage assignee from "Polenkov A." to "Smirnov K.".
4. Click "Save Product".
   **Expected:**

- Edit form shows product name, status, and ordered list of SDLC stages.
- Each stage has: name label, assignee dropdown, remove (X) button.
- Assignee dropdown lists all users with "Lead" role plus special entries (PM, Support).
- After save: CRM Platform's Dev stage assignee updates to "Smirnov K."
- Polenkov A. loses Dev stage on CRM Platform (Lead Form updates on next load).
- Smirnov K. gains Dev stage on CRM Platform.

---

### SC-225: Products -- remove stage with data warning

**Role:** Admin
**Priority:** P1
**Precondition:** Admin is logged in. CRM Platform has Support stage with existing status data for the current period.
**Steps:**

1. Click "Edit" on CRM Platform.
2. Click the X button on the "Support" stage.
3. Observe the warning.
   **Expected:**

- Warning dialog: "Remove Support stage from CRM Platform? Data exists for this stage in the current period."
- If no data exists: stage is removed immediately without warning.
- After confirmation: Support stage is removed from the product.
- Stage pipeline displays 6 stages instead of 7.
- Existing data for the removed stage becomes orphaned (archived or deleted depending on policy).

---

### SC-226: Products -- stage assignment validation (D-63) -- no duplicates

**Role:** Admin
**Priority:** P1
**Precondition:** Admin is logged in. Editing CRM Platform. Dev stage is assigned to Polenkov A.
**Steps:**

1. Click "Edit" on CRM Platform.
2. On the Testing stage, change the assignee dropdown to "Polenkov A." (same user already on Dev).
3. Save the form.
   **Expected:**

- The system allows assigning the same user to multiple DIFFERENT stages on the same product (Polenkov on both Dev and Testing is valid).
- No validation error for this case.
- However, if admin tries to create a duplicate (same user + same stage + same product), the system shows: "This stage is already assigned to [User]. Replace?"
- Per D-63: only one assignee per stage per product is enforced.

---

### SC-227: Periods -- create new period

**Role:** Admin
**Priority:** P0
**Precondition:** Admin is logged in. Periods tab active. Latest period is Week 16.
**Steps:**

1. Click "+ Create Period" button.
2. Fill: Start Date "2026-04-21", End Date "2026-04-27", Deadline "2026-04-25T18:00".
3. Observe Week Label field auto-suggests "Week 17".
4. Click "Create Period".
   **Expected:**

- Create Period form has: Start Date, End Date, Deadline, Week Label.
- Week Label auto-generates as "Week 17" (incrementing from Week 16).
- After creation: new period appears in the periods table with "Active" status.
- Previous period (Week 16) may change status depending on publish state.
- End Date must be after Start Date (validation check).
- Deadline must be between Start Date and a reasonable buffer after End Date.

---

### SC-228: Periods -- date validation (end after start)

**Role:** Admin
**Priority:** P1
**Precondition:** Admin is logged in. Creating a new period.
**Steps:**

1. Click "+ Create Period".
2. Set Start Date "2026-04-27".
3. Set End Date "2026-04-21" (before start).
4. Click "Create Period".
   **Expected:**

- Validation error: "End Date must be after Start Date."
- End Date input field shows red border.
- Period is not created.
- Admin must correct the dates before saving.

---

### SC-229: Reminders -- toggle on/off with autosave

**Role:** Admin
**Priority:** P2
**Precondition:** Admin is logged in. Reminders tab active. 3 toggles: "Auto-reminder on deadline day" (ON), "Remind 24h before deadline" (ON), "Weekly summary for manager" (OFF).
**Steps:**

1. Toggle "Weekly summary for manager" to ON.
2. Observe the switch animation and autosave.
3. Toggle "Auto-reminder on deadline day" to OFF.
   **Expected:**

- Toggle ON: green background (`var(--tealA)`), white circle slides right.
- Toggle OFF: gray background (`var(--ceramic)`), white circle slides left.
- Each toggle change autosaves immediately (no separate "Save" button needed).
- Success indicator after save (subtle flash or no-op if seamless).
- Changes affect BullMQ scheduled jobs for email reminders.

---

### SC-230: Settings -- change default deadline day

**Role:** Admin
**Priority:** P2
**Precondition:** Admin is logged in. Settings tab active.
**Steps:**

1. Click "Settings" tab.
2. Locate "Default Deadline Day" setting.
3. Change from "Friday" to "Thursday".
4. Observe autosave.
   **Expected:**

- Settings tab shows configuration options for the reporting system.
- Default deadline day dropdown includes weekday options.
- After change: new periods auto-suggest the deadline on Thursday instead of Friday.
- Existing periods are not retroactively affected.
- Change is persisted via autosave.

---

## 25. Login & Auth -- Deep Scenarios

### SC-240: Split-screen layout renders correctly

**Role:** None (unauthenticated)
**Priority:** P1
**Precondition:** No active session. Navigating to the application.
**Steps:**

1. Navigate to any protected URL (e.g., `/dashboard`).
2. Observe the login page layout.
   **Expected:**

- Page splits 50/50 horizontally.
- Left panel: teal gradient background, abstract geometric shapes (circles, rounded rectangles), "Product Engineering & Operations" text in white.
- Right panel: white/cream background, CR logo circle, "CustomReport" title, "Sign in with SSO" green pill button, footer "Keycloak -- SAML 2.0 -- Corporate SSO".
- All text in English.
- No local username/password form.
- Page is responsive: on mobile, left panel hidden or collapsed to top banner.

---

### SC-241: SSO button redirects to Keycloak

**Role:** None (unauthenticated)
**Priority:** P0
**Precondition:** Login page is displayed.
**Steps:**

1. Click "Sign in with SSO" button.
2. Observe the redirect.
   **Expected:**

- Browser redirects to Keycloak IdP login page.
- URL changes to the Keycloak domain with SAML authentication request parameters.
- Keycloak login form is displayed.
- After successful Keycloak authentication, SAML assertion is posted back to the application.

---

### SC-242: After SSO -- Lead redirected to /report

**Role:** Lead
**Priority:** P0
**Precondition:** Lead "Polenkov A." completes SSO authentication via Keycloak.
**Steps:**

1. Complete SSO login as a user with Lead role.
2. Observe the redirect destination.
   **Expected:**

- After successful SAML assertion validation, Lead is redirected to `/report` (My Report page).
- Navigation bar shows Lead-appropriate links: "My Report" (active), "History".
- User avatar and name appear in the top-right corner.
- JWT token is set in the session/cookie.

---

### SC-243: After SSO -- Head redirected to /dashboard

**Role:** Head
**Priority:** P0
**Precondition:** Head "Director H." completes SSO authentication via Keycloak.
**Steps:**

1. Complete SSO login as a user with Head role.
2. Observe the redirect destination.
   **Expected:**

- After successful SAML assertion validation, Head is redirected to `/dashboard`.
- Navigation bar shows Head-appropriate links: "Dashboard" (active), "Report", "Admin".
- Dashboard loads with KPI cards and lead status.

---

### SC-244: After SSO -- Admin redirected to /dashboard

**Role:** Admin
**Priority:** P0
**Precondition:** Admin user completes SSO authentication.
**Steps:**

1. Complete SSO login as a user with Admin role.
2. Observe the redirect destination.
   **Expected:**

- Admin is redirected to `/dashboard` (same as Head).
- Navigation bar shows: "Dashboard" (active), "Report", "Admin".
- Admin Panel shows all tabs (Users, Products, Periods, Reminders, Settings).

---

### SC-245: JWT expiry -- redirect to login

**Role:** Lead
**Priority:** P1
**Precondition:** Lead is logged in. JWT has 1-hour expiry. Token has expired.
**Steps:**

1. Wait for JWT to expire (or simulate by clearing the token).
2. Attempt to navigate to a new page or perform an action.
   **Expected:**

- API returns 401 Unauthorized.
- Application redirects to the login page.
- Any unsaved data is preserved via the most recent successful autosave.
- After re-authentication, user returns to the same page they were on.
- No data is lost between autosave and session expiry.

---

### SC-246: Role from SAML mapped correctly

**Role:** Any
**Priority:** P0
**Precondition:** Keycloak is configured with roles: Lead, Head, Admin. SAML assertion contains the role attribute.
**Steps:**

1. Login via SSO as user with "Lead" role in Keycloak.
2. Verify application recognizes the role.
3. Login via SSO as user with "Head" role.
4. Verify application recognizes the role.
5. Login via SSO as user with "Admin" role.
6. Verify application recognizes the role.
   **Expected:**

- SAML assertion role attribute is parsed by `@node-saml/passport-saml`.
- Role is correctly mapped: Lead -> Lead navigation/permissions, Head -> Head navigation/permissions, Admin -> Admin navigation/permissions.
- Unknown roles are rejected (user sees an error or is treated as unauthorized).
- Role is stored in the JWT for subsequent API authorization.

---

### SC-247: Concurrent sessions (same user, two tabs)

**Role:** Lead
**Priority:** P2
**Precondition:** Lead "Polenkov A." is logged in. Two browser tabs open to "My Report".
**Steps:**

1. In Tab 1: edit a Current Week item description.
2. In Tab 2: add a new Risk entry.
3. Wait for autosave in both tabs.
4. Refresh both tabs.
   **Expected:**

- Both edits are preserved (no one tab overwrites the other).
- Autosave uses optimistic locking or conflict resolution.
- After refresh, both tabs show the same consistent data including both changes.
- No error or data loss.

---

### SC-248: Logout -- session cleared

**Role:** Lead
**Priority:** P1
**Precondition:** Lead "Polenkov A." is logged in.
**Steps:**

1. Click on the user avatar/name in the navigation bar.
2. Click "Logout" or "Sign Out" option.
3. Observe the result.
   **Expected:**

- JWT token is cleared from the session/cookie.
- User is redirected to the login page.
- Attempting to navigate to any protected URL redirects to login.
- No cached data from the previous session is accessible.
- SSO session at Keycloak may or may not be terminated (depends on SLO configuration).

---

## 26. Responsive & Mobile -- Deep Scenarios

### SC-250: Mobile viewport -- nav collapses or adapts

**Role:** Any
**Priority:** P2
**Precondition:** Application loaded on a mobile device (viewport width < 768px).
**Steps:**

1. Observe the navigation bar.
   **Expected:**

- Navigation bar adapts to mobile: either collapses to a hamburger menu or shows only essential links.
- Logo and CR icon remain visible.
- User avatar remains visible (possibly without the name text).
- Touch targets for all interactive elements meet 44px minimum.

---

### SC-251: Mobile -- no horizontal scroll

**Role:** Any
**Priority:** P1
**Precondition:** Application loaded on a mobile viewport (375px width).
**Steps:**

1. Navigate through all pages: Login, My Report, Dashboard, Weekly Report, Admin.
2. Check for horizontal overflow on each page.
   **Expected:**

- No horizontal scrollbar appears on any page.
- All content wraps or adapts within the viewport width.
- SDLC pipeline stages may wrap to multiple rows.
- Kanban columns stack vertically instead of 3-column grid.
- KPI cards stack vertically on mobile (single column).

---

### SC-252: Mobile -- kanban columns stack vertically

**Role:** Lead
**Priority:** P2
**Precondition:** Lead is logged in on a mobile viewport.
**Steps:**

1. Navigate to "My Report" page.
2. Expand "Current Week" section.
3. Observe the product columns.
   **Expected:**

- Kanban grid changes from 3-column to single-column layout.
- Products stack vertically: CRM Platform, Data Analytics Suite, etc.
- Each product column takes full width.
- "+ Add" buttons remain accessible.
- Cards display correctly without truncation.

---

### SC-253: Mobile -- SDLC pipeline wraps

**Role:** Lead
**Priority:** P2
**Precondition:** Lead is logged in on a mobile viewport. CRM Platform has 7 SDLC stages.
**Steps:**

1. Navigate to "My Report" page.
2. Expand "Product Status" section.
3. Observe CRM Platform's SDLC stages.
   **Expected:**

- Stages wrap to multiple rows if they exceed viewport width.
- Arrow separators (-->) between stages are still visible.
- Each stage chip maintains minimum width (90px) and remains tappable (44px touch target).
- Assignee names below stages remain readable.

---

### SC-254: Login -- left panel hidden on mobile

**Role:** None (unauthenticated)
**Priority:** P2
**Precondition:** Login page on mobile viewport (< 768px).
**Steps:**

1. Navigate to the login page on mobile.
2. Observe the layout.
   **Expected:**

- Left panel (PEO brand) is hidden or collapsed to a small top banner.
- Right panel (SSO form) takes full screen.
- "Sign in with SSO" button is centered and easily tappable.
- Footer text "Keycloak -- SAML 2.0 -- Corporate SSO" visible at the bottom.

---

## 27. Error Handling & Edge Cases -- Deep Scenarios

### SC-260: Network disconnect during autosave

**Role:** Lead
**Priority:** P0
**Precondition:** Lead "Polenkov A." is logged in. Network is intermittent.
**Steps:**

1. Edit a field to trigger autosave.
2. Disconnect network before autosave completes.
3. Observe the badge and toast behavior.
4. Reconnect network.
5. Observe retry behavior.
   **Expected:**

- Autosave attempt fails.
- Badge shows "Save failed" or warning state.
- Error toast: "Save error -- Check your connection and try again."
- Data is not lost from the client-side form (remains in the browser state).
- On network reconnect, autosave retries automatically.
- After successful retry: badge returns to "Autosaved", error toast dismisses.

---

### SC-261: Network disconnect during submit

**Role:** Lead
**Priority:** P0
**Precondition:** Lead "Polenkov A." is logged in. Network fails during "Submit Report" action.
**Steps:**

1. Click "Submit Report" and confirm in the dialog.
2. Network drops during the API call.
3. Observe the result.
   **Expected:**

- Submission fails.
- Error toast: "Submission failed -- Check your connection and try again."
- Form remains in editable (Draft) state -- NOT locked.
- "Submit Report" button remains active for retry.
- Data is preserved (autosaved before the submit attempt).
- Lead can retry submission once network recovers.

---

### SC-262: API 500 error -- error state with retry

**Role:** Any
**Priority:** P1
**Precondition:** API returns 500 Internal Server Error.
**Steps:**

1. Navigate to a data-heavy page (e.g., Dashboard).
2. API returns 500 for the data fetch.
3. Observe the error state.
4. Click "Retry" button.
   **Expected:**

- Error card: warning triangle icon (36px, red), heading "Failed to load", subtext "Check your connection and try again."
- "Retry" button centered below (primary green style).
- Clicking "Retry" re-fetches the data from the API.
- If API recovers: normal content loads, error state disappears.
- If still failing: error state persists, user can retry again.

---

### SC-263: Browser refresh preserves state

**Role:** Lead
**Priority:** P1
**Precondition:** Lead "Polenkov A." is logged in. Has edited several fields. Autosave completed.
**Steps:**

1. Make edits to Current Week items and Risks.
2. Wait for autosave to complete (badge shows "Autosaved").
3. Press F5 or Cmd+R to refresh the browser.
4. Observe the form state after reload.
   **Expected:**

- All data that was autosaved is preserved and loaded after refresh.
- Section collapse/expand states may reset to default (all expanded).
- Period navigator stays on the current period.
- Version badge shows the latest version number.
- No data loss for autosaved content.
- Any un-autosaved changes (within the debounce window) are lost.

---

### SC-264: Empty database (no products, no users, no periods)

**Role:** Admin
**Priority:** P2
**Precondition:** Fresh installation. No data in the database.
**Steps:**

1. Login as Admin (seeded admin user).
2. Navigate to Dashboard.
3. Navigate to Admin Panel.
   **Expected:**

- Dashboard shows empty states: "0/0" submissions, no deadline, no escalations.
- Lead Reports section shows empty state: "No leads configured."
- Report Archive shows empty state: "No reports yet."
- Admin Panel shows empty tabs with "Add" buttons:
  - Users: empty table with "+ Add User" button.
  - Products: empty list with "+ Add Product" button.
  - Periods: empty table with "+ Create Period" button.
- Application does not crash or show unhandled errors.

---

### SC-265: Maximum data -- 100+ items in one lead's form

**Role:** Lead
**Priority:** P2
**Precondition:** Lead "Polenkov A." has created 100+ Current Week items across all products (stress test).
**Steps:**

1. Navigate to "My Report" page.
2. Expand "Current Week" section.
3. Scroll through the items.
4. Submit the report.
   **Expected:**

- All 100+ items render without crashing or severe performance degradation.
- Kanban columns use `kb-scroll` class with `max-height: 420px` and scrollbar.
- Section badge shows correct count (e.g., "105 items").
- Submit dialog shows the correct item count.
- Autosave handles large payloads (may take slightly longer but completes successfully).
- Weekly Report displays all 100+ items in the lead's accordion (possibly with "+ N more items" collapse pattern).

---

### SC-266: Special characters in text fields (XSS prevention)

**Role:** Lead
**Priority:** P0
**Precondition:** Lead "Polenkov A." is logged in.
**Steps:**

1. Add a Current Week item with description: `<script>alert('XSS')</script>`.
2. Wait for autosave.
3. Reload the page.
4. View the item in Lead Form.
5. View the item in Weekly Report (as Head).
   **Expected:**

- The script tag is NOT executed.
- The text is displayed as plain text: `<script>alert('XSS')</script>`.
- HTML entities are properly escaped in all views.
- No JavaScript execution from user-entered content.
- Zod validation may strip or reject HTML tags.

---

### SC-267: Very long text in item description

**Role:** Lead
**Priority:** P2
**Precondition:** Lead "Polenkov A." is logged in.
**Steps:**

1. Add a Current Week item with a 5000-character description.
2. Observe the kanban card display.
3. View the item in Weekly Report.
   **Expected:**

- Item text is truncated visually in the kanban card (with ellipsis or line-clamp).
- Full text is visible in the edit modal.
- Weekly Report may show truncated text with "Read more" or full text in expanded view.
- API accepts and stores the full text (reasonable max length enforced, e.g., 10,000 chars).
- Layout does not break from extremely long text.

---

### SC-268: Unicode characters in names and content

**Role:** Lead
**Priority:** P2
**Precondition:** Lead has content with Cyrillic text, emojis, and special Unicode characters.
**Steps:**

1. Enter a risk description with mixed content: "Тестирование ETL -- ready."
2. Enter a decision with emoji: "Approval needed for GPU cluster."
3. Save and reload.
   **Expected:**

- All Unicode characters render correctly.
- Cyrillic text (Russian) displays without mojibake.
- Mixed Russian+English text within the same field works correctly.
- Content is preserved through autosave, submit, and PDF export.
- Database stores UTF-8 correctly (PostgreSQL handles this natively).

---

### SC-269: Concurrent edit same period by same user (two tabs)

**Role:** Lead
**Priority:** P1
**Precondition:** Lead "Polenkov A." has two browser tabs open on "My Report" for Week 16.
**Steps:**

1. Tab 1: Edit item A description to "Updated A".
2. Tab 2: Edit item B description to "Updated B" at the same time.
3. Wait for autosave in both tabs.
4. Refresh Tab 1.
   **Expected:**

- Both edits are preserved (last-write-wins or merge strategy).
- No "conflict resolution" dialog (autosave handles concurrent writes from the same user).
- Refreshed Tab 1 shows both "Updated A" and "Updated B".
- Version history shows the correct sequence of autosaves.

---

## 28. Accessibility -- Deep Scenarios

### SC-280: Screen reader reads page title

**Role:** Any
**Priority:** P1
**Precondition:** Screen reader active (VoiceOver, NVDA).
**Steps:**

1. Navigate to "My Report" page.
2. Listen to the screen reader announce the page.
   **Expected:**

- Screen reader announces the page title: "My Report" (from the h1 element).
- The document title reflects the current page.
- Heading hierarchy is correct: h1 for page title, h2 for section headers.

---

### SC-281: Screen reader reads KPI values

**Role:** Head
**Priority:** P1
**Precondition:** Head is logged in. Screen reader active. Dashboard is displayed.
**Steps:**

1. Navigate KPI cards with screen reader.
2. Listen to announcements.
   **Expected:**

- Submissions card: `aria-label="Submissions: 4 of 6, 2 pending"` is announced.
- Deadline card: `aria-label="Deadline: 2 days 5 hours, Friday 18:00"` is announced.
- Risks card: `aria-label="Risks: 2 blocked, 3 at risk, 2 decisions"` is announced.
- All KPI values are accessible without needing to visually parse the card layout.

---

### SC-282: Keyboard Tab order matches visual order

**Role:** Any
**Priority:** P1
**Precondition:** Any page loaded. Using keyboard only.
**Steps:**

1. Press Tab from the start of the page.
2. Note the focus order through interactive elements.
   **Expected:**

- Tab order follows the visual layout: top-to-bottom, left-to-right.
- Skip link ("Skip to content") receives focus first and works correctly.
- Navigation links receive focus in order.
- Within sections, buttons and inputs follow reading order.
- No focus jumps to unexpected elements.
- Locked SDLC stages (`sdlc-locked`) are NOT in the tab order.

---

### SC-283: Escape closes modals

**Role:** Any
**Priority:** P1
**Precondition:** A modal is open (e.g., Delete confirmation, Add Item, Version History).
**Steps:**

1. Open any modal (e.g., click Delete on a kanban card).
2. Press Escape key.
   **Expected:**

- Modal closes immediately.
- No action is performed (same as clicking "Cancel").
- Focus returns to the element that opened the modal.
- Works consistently across all modals: Delete confirmation, Add/Edit Item, Submit confirmation, Fill From dropdown, Version History.

---

### SC-284: Focus trap in modals

**Role:** Any
**Priority:** P1
**Precondition:** A modal is open.
**Steps:**

1. Open a modal (e.g., Add Item modal).
2. Tab through all focusable elements inside the modal.
3. Continue tabbing past the last element.
   **Expected:**

- Focus cycles within the modal (trapped).
- Tabbing from the last focusable element returns to the first.
- Shift+Tab from the first element goes to the last.
- Elements behind the modal are not focusable.
- Focus trap is released when the modal closes.

---

### SC-285: Skip link works

**Role:** Any
**Priority:** P2
**Precondition:** Any page loaded.
**Steps:**

1. Press Tab once from page load.
2. Observe the skip link appearing.
3. Press Enter on the skip link.
   **Expected:**

- Skip link "Skip to content" appears visually when focused (positioned at top-left with white background, teal text, box-shadow).
- Pressing Enter moves focus to `#main` content area.
- Skip link is off-screen when not focused (`left: -9999px`).
- Works on all pages (Lead Form, Dashboard, Weekly Report, Admin).

---

### SC-286: SDLC stages have correct aria-labels

**Role:** Lead
**Priority:** P2
**Precondition:** Lead "Polenkov A." is logged in. Product Status section visible.
**Steps:**

1. Navigate with screen reader through SDLC stages.
   **Expected:**

- Editable stages: `title="Your stage - On Track - Click to change"` or similar descriptive tooltip.
- Locked stages: `title="Ivanov A. - No edit permissions"`.
- Unassigned stages: `title="Unassigned - Contact admin"` and `aria-label="Unassigned stage"`.
- Empty stages (your stage, unfilled): `title="Your stage - Click to fill"`.
- All stages convey their state to assistive technology without requiring visual inspection.

---

### SC-287: Color contrast meets 4.5:1

**Role:** Any
**Priority:** P2
**Precondition:** Application rendered with default theme.
**Steps:**

1. Check key text elements against their backgrounds using a contrast checker.
   **Expected:**

- Body text `rgba(0,0,0,.87)` on `#f2f0eb` (canvas): contrast ratio >= 4.5:1.
- White text on `#00754A` (tealA buttons): contrast ratio >= 4.5:1.
- Gold text `#8a6d1b` on `#faf6ee` (goldLL background): contrast ratio >= 4.5:1.
- Red text `#c82014` on `#fee2e2` (error background): contrast ratio >= 4.5:1.
- Muted text `var(--fgm)` on various backgrounds: at least 3:1 for large text, 4.5:1 for body text.
- All badge text meets contrast requirements against badge backgrounds.

---

### SC-288: Reduced motion disables animations

**Role:** Any
**Priority:** P2
**Precondition:** OS setting `prefers-reduced-motion: reduce` is enabled.
**Steps:**

1. Navigate to any page.
2. Observe: skeleton pulse, SDLC empty stage pulse, accordion transitions, card hover effects.
   **Expected:**

- All CSS animations have `animation-duration: .01ms !important`.
- All CSS transitions have `transition-duration: .01ms !important`.
- Skeleton pulse appears static (no pulsing).
- SDLC empty stage border does not animate.
- Accordion open/close is instant (no slide animation).
- Card hover effects are instant (no smooth transition).
- All functional behavior remains intact (sections toggle, hovers change state).

---

## 29. Login Stub — Dev Mode (D-68)

### SC-290: Login page shows role selection buttons in dev mode

**Role:** None (unauthenticated)
**Priority:** P0
**Precondition:** `NEXT_PUBLIC_AUTH_STUB=true` in environment. No active session.
**Steps:**

1. Navigate to `/login`.
2. Observe the right panel of the split-screen login page.
3. Count the role selection buttons.
4. Verify each button label and icon.
   **Expected:**

- Four buttons are displayed vertically in the right panel:
  - "Enter as Lead" — person icon, teal outlined style.
  - "Enter as Head" — briefcase icon, teal outlined style.
  - "Enter as Admin" — shield icon, teal outlined style.
  - "Enter as Viewer" — eye icon, teal outlined style.
- The original "Sign in with SSO" button is visible but disabled (`opacity: 0.5`, `cursor: not-allowed`).
- Tooltip on SSO button: "Coming soon — SAML integration".
- Left panel (PEO branding) remains unchanged.
- No username/password fields exist.

---

### SC-291: Click "Enter as Lead" redirects to /report

**Role:** None → Lead
**Priority:** P0
**Precondition:** Login page with role selection buttons visible.
**Steps:**

1. Click "Enter as Lead" button.
2. Observe the URL in the browser address bar.
3. Observe the navigation bar.
4. Observe the page content.
   **Expected:**

- Browser navigates to `/report`.
- URL bar shows exactly `http://localhost:3000/report`.
- Navigation bar shows: "My Report" (active, highlighted), "History".
- Right side of nav shows: period badge "Apr 14–20 · Week 16", avatar "AP", "Polenkov A. · Dev Lead".
- Page content is the Lead Form with "My Report" title.
- A mock JWT cookie is set with `role: "lead"`, `userId: "polenkov"`.
- No Keycloak redirect occurs.

---

### SC-292: Click "Enter as Head" redirects to /dashboard

**Role:** None → Head
**Priority:** P0
**Precondition:** Login page with role selection buttons visible.
**Steps:**

1. Click "Enter as Head" button.
2. Observe the URL in the browser address bar.
3. Observe the navigation bar.
   **Expected:**

- Browser navigates to `/dashboard`.
- URL bar shows exactly `http://localhost:3000/dashboard`.
- Navigation bar shows: "Dashboard" (active), "Report", "Admin".
- Right side of nav shows: avatar "DH", "Director H. · Department Head".
- Page content is the Dashboard with KPI cards.

---

### SC-293: Click "Enter as Admin" redirects to /dashboard

**Role:** None → Admin
**Priority:** P0
**Precondition:** Login page with role selection buttons visible.
**Steps:**

1. Click "Enter as Admin" button.
2. Observe the URL.
3. Observe the navigation bar.
4. Navigate to `/admin`.
   **Expected:**

- Browser navigates to `/dashboard`.
- Navigation bar shows: "Dashboard" (active), "Report", "Admin".
- All Admin Panel tabs are accessible (Users, Products, Periods, Reminders, Settings).
- Admin can click any lead in Lead Reports section and navigate to their form.

---

### SC-294: Click "Enter as Viewer" redirects to /dashboard (read-only)

**Role:** None → Viewer
**Priority:** P1
**Precondition:** Login page with role selection buttons visible.
**Steps:**

1. Click "Enter as Viewer" button.
2. Navigate to `/dashboard`.
3. Navigate to `/report/weekly`.
4. Attempt to click "Publish & Lock".
5. Attempt to navigate to `/admin`.
   **Expected:**

- Viewer sees Dashboard and Weekly Report in read-only mode.
- No "Publish & Lock", "Send Reminder", or "Revoke" buttons are visible.
- Navigation to `/admin` returns 403 or redirects to `/dashboard`.
- Viewer can only view data, not modify anything.

---

### SC-295: SSO button disabled in dev mode

**Role:** None
**Priority:** P1
**Precondition:** `NEXT_PUBLIC_AUTH_STUB=true`. Login page visible.
**Steps:**

1. Observe the "Sign in with SSO" button.
2. Hover over the SSO button.
3. Click the SSO button.
   **Expected:**

- Button has `opacity: 0.5` and `cursor: not-allowed`.
- Hover shows tooltip: "Coming soon — SAML integration".
- Click does nothing — no redirect to Keycloak.
- Button is semantically disabled (`disabled` attribute or `aria-disabled="true"`).

---

### SC-296: Login stub disabled in production mode

**Role:** None
**Priority:** P0
**Precondition:** `NEXT_PUBLIC_AUTH_STUB=false` or variable not set. No active session.
**Steps:**

1. Navigate to `/login`.
2. Observe the right panel.
   **Expected:**

- Role selection buttons are NOT visible.
- Only "Sign in with SSO" button is shown (enabled, clickable).
- Clicking SSO redirects to Keycloak IdP for SAML authentication.
- No mock JWT is created — real auth flow only.

---

### SC-297: Switching roles requires re-login

**Role:** Lead → Head
**Priority:** P1
**Precondition:** Currently logged in as Lead (via stub). On `/report` page.
**Steps:**

1. Navigate to `/login` manually.
2. Observe the login page.
3. Click "Enter as Head".
4. Observe the new session.
   **Expected:**

- Navigating to `/login` shows the role selection page (previous session cleared).
- Clicking "Enter as Head" creates a new mock JWT with `role: "head"`.
- Previous Lead session cookie is replaced.
- Browser redirects to `/dashboard`.
- Navigation shows Head-specific items.

---

## 30. URL-Based Routing (D-69)

### SC-300: Every page has a unique, bookmarkable URL

**Role:** Head
**Priority:** P0
**Precondition:** Logged in as Head.
**Steps:**

1. Navigate to Dashboard. Note the URL.
2. Navigate to Weekly Report. Note the URL.
3. Navigate to Admin Panel. Note the URL.
4. Copy the Weekly Report URL.
5. Open a new browser tab.
6. Paste the URL into the new tab.
   **Expected:**

- Dashboard URL: `/dashboard` (no query params for default view).
- Weekly Report URL: `/report/weekly` (current period by default).
- Admin Panel URL: `/admin` (Products tab by default).
- Pasting the Weekly Report URL into a new tab loads the same page with the same data.
- No JavaScript-only routing — the page renders server-side from the URL.

---

### SC-301: Period selection updates URL query param

**Role:** Lead
**Priority:** P0
**Precondition:** Logged in as Lead. On `/report` (current period Week 16).
**Steps:**

1. Observe the URL: `/report`.
2. Select "Week 15 · Apr 7–13 ✓" from the period navigator combobox.
3. Observe the URL change.
4. Observe the page content.
5. Click browser Back button.
6. Observe the URL and page content.
   **Expected:**

- After selecting Week 15: URL changes to `/report?period=2026-W15`.
- Page shows Week 15 data in read-only mode with "Viewing past period" banner.
- Browser Back button returns to `/report` (current period, editable).
- No full page reload — Next.js handles the transition with shallow routing.
- The `?period=` param is the single source of truth for which period is displayed.

---

### SC-302: Weekly Report period selection updates URL

**Role:** Head
**Priority:** P0
**Precondition:** Logged in as Head. On `/report/weekly`.
**Steps:**

1. Observe URL: `/report/weekly`.
2. Select "Week 15 · Apr 7–13" from period combobox.
3. Observe URL.
4. Select "Week 14 · Mar 31–Apr 6".
5. Observe URL.
6. Click browser Back button twice.
   **Expected:**

- Week 15: URL → `/report/weekly?period=2026-W15`. Badge shows "Published · Week 15". Publish & Lock hidden.
- Week 14: URL → `/report/weekly?period=2026-W14`. Same published state.
- Back once: URL → `/report/weekly?period=2026-W15`.
- Back again: URL → `/report/weekly` (current period). Badge shows "Live · 4/6 Submitted".

---

### SC-303: Admin tab selection updates URL query param

**Role:** Admin
**Priority:** P1
**Precondition:** Logged in as Admin. On `/admin`.
**Steps:**

1. Observe URL: `/admin` (default tab = Products).
2. Click "Users" tab.
3. Observe URL.
4. Click "Periods" tab.
5. Observe URL.
6. Click "Settings" tab.
7. Observe URL.
8. Copy URL. Open new tab. Paste.
   **Expected:**

- Users tab: URL → `/admin?tab=users`.
- Periods tab: URL → `/admin?tab=periods`.
- Settings tab: URL → `/admin?tab=settings`.
- Pasting `/admin?tab=settings` in new tab opens Admin Panel with Settings tab active.
- Default `/admin` (no query param) opens Products tab.

---

### SC-304: Admin viewing lead's form via URL

**Role:** Admin
**Priority:** P0
**Precondition:** Logged in as Admin. Know Polenkov's userId.
**Steps:**

1. On Dashboard, click Polenkov A. in Lead Reports.
2. Observe URL.
3. Copy URL.
4. Open new tab. Paste URL.
5. Verify the page shows Polenkov's form.
   **Expected:**

- URL: `/report/lead/polenkov` (or `/report/lead/:userId`).
- Page shows Polenkov's Lead Form with "Editing: Polenkov A.'s Report" header.
- Admin has full edit access.
- Pasting this URL in another tab (while logged in as Admin) shows the same form.
- Accessing this URL as Lead returns 403.

---

### SC-305: Direct URL access enforces role-based access

**Role:** Lead
**Priority:** P0
**Precondition:** Logged in as Lead (Polenkov A.).
**Steps:**

1. Type `/dashboard` directly in the address bar. Press Enter.
2. Type `/admin` directly. Press Enter.
3. Type `/report/weekly` directly. Press Enter.
4. Type `/report/lead/maria-k` directly. Press Enter.
   **Expected:**

- `/dashboard`: Returns 403 or redirects to `/report` (Lead's default page).
- `/admin`: Returns 403 or redirects to `/report`.
- `/report/weekly`: Returns 403 or redirects to `/report`.
- `/report/lead/maria-k`: Returns 403 (Lead cannot view other leads' forms).
- Each denied access shows a brief error message before redirect.

---

### SC-306: Browser refresh preserves page state

**Role:** Head
**Priority:** P0
**Precondition:** Logged in as Head. On `/report/weekly?period=2026-W15`. Portfolio Overview section collapsed.
**Steps:**

1. Press F5 (browser refresh).
2. Observe the URL.
3. Observe the page content.
   **Expected:**

- URL remains `/report/weekly?period=2026-W15`.
- Page shows Week 15 published report (same as before refresh).
- Accordion collapse state may reset to default (server render), but period selection is preserved via URL.
- No redirect to login (JWT cookie still valid).

---

### SC-307: Browser forward/back navigation works naturally

**Role:** Head
**Priority:** P0
**Precondition:** Logged in as Head. Navigation history: `/dashboard` → `/report/weekly` → `/admin?tab=periods`.
**Steps:**

1. Click browser Back button.
2. Observe URL and page.
3. Click browser Back button again.
4. Observe URL and page.
5. Click browser Forward button.
6. Observe URL and page.
   **Expected:**

- Back from `/admin?tab=periods`: URL → `/report/weekly`. Weekly Report loads.
- Back from `/report/weekly`: URL → `/dashboard`. Dashboard loads.
- Forward from `/dashboard`: URL → `/report/weekly`. Weekly Report loads.
- Each transition is a real URL change, not client-side state manipulation.
- Scroll position is restored when going back to a previously visited page.

---

### SC-308: 404 page for invalid URLs

**Role:** Any
**Priority:** P1
**Precondition:** Logged in.
**Steps:**

1. Type `/nonexistent-page` in the address bar. Press Enter.
2. Type `/report/weekly?period=2099-W99` in the address bar. Press Enter.
3. Type `/report/lead/nonexistent-user` in the address bar. Press Enter.
   **Expected:**

- `/nonexistent-page`: Shows 404 Not Found page with "Page not found" message and link to Dashboard/Report.
- `/report/weekly?period=2099-W99`: Shows error "Period not found" with link to current period.
- `/report/lead/nonexistent-user`: Shows error "User not found" with link back to Dashboard.
- 404 page uses the same design system (cream canvas, teal accents, Lexend font).

---

### SC-309: Deep link sharing works across users

**Role:** Head, Admin
**Priority:** P1
**Precondition:** Head and Admin both logged in (separate browsers).
**Steps:**

1. Head navigates to `/report/weekly?period=2026-W15`.
2. Head copies the URL and sends to Admin (e.g., via Slack).
3. Admin opens the URL.
   **Expected:**

- Admin sees the same Week 15 published Weekly Report.
- The URL is the complete state — no client-side context needed.
- If a Lead opens the same URL, they get 403 (not authorized for Weekly Report).

---

### SC-310: Logout clears session and redirects to /login

**Role:** Any
**Priority:** P0
**Precondition:** Logged in as any role.
**Steps:**

1. Click user avatar or name in the nav bar.
2. Click "Logout" in the dropdown.
3. Observe the redirect.
4. Try navigating to `/dashboard` directly.
   **Expected:**

- Session cookie is cleared.
- Browser redirects to `/login`.
- Navigating to `/dashboard` (or any protected URL) redirects to `/login`.
- No cached page content is visible after logout.

---

## 31. Nav Bar Teal Line Constraint (D-70)

### SC-311: Nav bar teal bottom border matches content width

**Role:** Any
**Priority:** P1
**Precondition:** Logged in. On any page. Viewport width ≥ 1440px.
**Steps:**

1. Observe the teal bottom border on the navigation bar.
2. Observe the content area width below (max-w-6xl = 1152px).
3. Compare the left and right edges of the teal border with the content edges.
   **Expected:**

- The teal bottom border does NOT span the full viewport width.
- The border is constrained to the same width as the content area (max-w-6xl = 1152px).
- The border is horizontally centered, aligned with the content below.
- On narrower viewports (<1152px), the border spans the full available width minus padding.
- This alignment is consistent across ALL pages: Lead Form, Dashboard, Weekly Report, Admin, History.

---

## Scenario Index

| ID     | Name                                            | Area            | Role        | Priority |
| ------ | ----------------------------------------------- | --------------- | ----------- | -------- |
| SC-01  | Lead sees only assigned products                | Lead Form       | Lead        | P0       |
| SC-02  | Lead edits only sdlc-mine stages                | Lead Form       | Lead        | P0       |
| SC-03  | CRUD Current Week items                         | Lead Form       | Lead        | P0       |
| SC-04  | CRUD Next Week items                            | Lead Form       | Lead        | P0       |
| SC-05  | CRUD Risks                                      | Lead Form       | Lead        | P0       |
| SC-06  | CRUD Decisions                                  | Lead Form       | Lead        | P1       |
| SC-07  | Top 3 Priorities                                | Lead Form       | Lead        | P1       |
| SC-08  | Submit and lock                                 | Lead Form       | Lead        | P0       |
| SC-09  | Autosave badge                                  | Lead Form       | Lead        | P0       |
| SC-10  | Delete confirmation                             | Lead Form       | Lead        | P1       |
| SC-11  | Empty state                                     | Lead Form       | Lead        | P2       |
| SC-12  | Validation error                                | Lead Form       | Lead        | P1       |
| SC-13  | SDLC stage popover                              | Lead Form       | Lead        | P0       |
| SC-14  | At Risk hover (ring only)                       | Lead Form       | Lead        | P2       |
| SC-15  | On Track hover (desaturation)                   | Lead Form       | Lead        | P2       |
| SC-16  | Read-only items from other leads                | Lead Form       | Lead        | P1       |
| SC-17  | Empty SDLC stage pulse                          | Lead Form       | Lead        | P2       |
| SC-18  | Unassigned stages locked                        | Lead Form       | Lead        | P1       |
| SC-19  | Product blocker indicator                       | Lead Form       | Lead        | P1       |
| SC-20  | Portfolio Health counts                         | Dashboard       | Head        | P0       |
| SC-21  | Blocked products table                          | Dashboard       | Head        | P0       |
| SC-22  | Lead Reports + Revoke (D-57, D-62)              | Dashboard       | Head/Admin  | P0       |
| SC-23  | Deadline countdown                              | Dashboard       | Head        | P1       |
| SC-24  | Send reminder                                   | Dashboard       | Head        | P1       |
| SC-25  | Submissions progress bar                        | Dashboard       | Head        | P1       |
| SC-30  | Portfolio Overview 12 products                  | Weekly Report   | Head        | P0       |
| SC-31  | Per-lead accordion data                         | Weekly Report   | Head        | P0       |
| SC-32  | Item counts match                               | Weekly Report   | Head        | P0       |
| SC-33  | Export PDF                                      | Weekly Report   | Head        | P1       |
| SC-34  | Publish & Lock (D-56)                           | Weekly Report   | Head        | P0       |
| SC-40  | All leads data shown (published)                | Weekly Report   | Head        | P0       |
| SC-41  | Consolidated escalations                        | Weekly Report   | Head        | P0       |
| SC-42  | Download PDF (published)                        | Weekly Report   | Head        | P1       |
| SC-43  | Report Archive in Dashboard (D-60)              | Dashboard       | Head        | P2       |
| SC-50  | CRUD Users                                      | Admin           | Admin       | P1       |
| SC-51  | CRUD Products + SDLC stages                     | Admin           | Admin       | P0       |
| SC-52  | CRUD Periods                                    | Admin           | Admin       | P1       |
| SC-53  | Reminder settings                               | Admin           | Admin       | P2       |
| SC-60  | Lead cannot see unassigned products             | Access          | Lead        | P0       |
| SC-61  | Locked stages not editable                      | Access          | Lead        | P0       |
| SC-62  | No cross-lead item creation                     | Access          | Lead        | P0       |
| SC-63  | Head/Admin view lead forms (D-62)               | Access          | Head/Admin  | P0       |
| SC-64  | Admin full access                               | Access          | Admin       | P0       |
| SC-65  | Login split-screen SSO (D-61)                   | Access          | None        | P0       |
| SC-66  | Role-based navigation (D-59)                    | Access          | All         | P0       |
| SC-67  | Session timeout                                 | Access          | Lead        | P1       |
| SC-70  | Badge counts match items                        | Integrity       | Head        | P0       |
| SC-71  | Risk counts consistent                          | Integrity       | Head        | P0       |
| SC-72  | Product names consistent                        | Integrity       | All         | P0       |
| SC-73  | Stage assignees match config                    | Integrity       | All         | P0       |
| SC-80  | Skeleton loading                                | UI States       | Any         | P2       |
| SC-81  | Error state with retry                          | UI States       | Any         | P1       |
| SC-82  | Notification toasts                             | UI States       | Lead        | P1       |
| SC-83  | Locked form visual                              | UI States       | Lead        | P1       |
| SC-90  | Single-product lead                             | Edge Cases      | Lead        | P2       |
| SC-91  | Stage assignment validation (D-63)              | Edge Cases      | Admin       | P2       |
| SC-92  | Zero submissions at deadline                    | Edge Cases      | Head        | P2       |
| SC-93  | Concurrent edits                                | Edge Cases      | Lead        | P1       |
| SC-94  | Keyboard navigation                             | Accessibility   | Lead        | P1       |
| SC-95  | Touch targets 44px                              | Accessibility   | Lead        | P1       |
| SC-96  | Collapsible section state                       | Accessibility   | Lead        | P2       |
| SC-97  | Reduced motion                                  | Accessibility   | Any         | P2       |
| SC-98  | Copy from previous report                       | Lead Form       | Lead        | P1       |
| SC-100 | Publish & Lock freezes forms (D-56)             | Publish & Lock  | Head        | P0       |
| SC-101 | Reopen after Publish (D-56)                     | Publish & Lock  | Head/Admin  | P0       |
| SC-102 | Lead requests reopen (D-56)                     | Publish & Lock  | Lead        | P1       |
| SC-103 | Publish warns about pending (D-56)              | Publish & Lock  | Head        | P1       |
| SC-104 | Admin revokes submission (D-57)                 | Revoke Submit   | Admin       | P0       |
| SC-105 | Revoke not for non-submitted (D-57)             | Revoke Submit   | Admin       | P2       |
| SC-106 | Admin drills into lead form (D-62)              | Dashboard Hub   | Admin       | P0       |
| SC-107 | Lead sees only own card (D-62)                  | Dashboard Hub   | Lead        | P1       |
| SC-108 | Archive pagination (D-60)                       | Dashboard Hub   | Head        | P1       |
| SC-109 | Dashboard KPIs correct (D-59)                   | Dashboard Hub   | Head        | P0       |
| SC-110 | Login split-screen layout (D-61)                | Login           | None        | P1       |
| SC-111 | Past period read-only (D-64)                    | Period Nav      | Lead        | P0       |
| SC-112 | No form for non-existent period (D-64)          | Period Nav      | Lead        | P1       |
| SC-113 | Copy from specific period (D-65)                | Copy From       | Lead        | P1       |
| SC-114 | Copy warning on overwrite (D-65)                | Copy From       | Lead        | P0       |
| SC-115 | Weekly Report period nav (D-66)                 | Period Nav      | Head        | P1       |
| SC-116 | Autosave version history (D-67)                 | Version History | Lead        | P1       |
| SC-120 | Fill from Previous happy path (D-65)            | Fill From       | Lead        | P0       |
| SC-121 | Fill from specific period via dropdown (D-65)   | Fill From       | Lead        | P1       |
| SC-122 | Search filtering in dropdown by month           | Fill From       | Lead        | P2       |
| SC-123 | Fill warning when form has data (D-65)          | Fill From       | Lead        | P0       |
| SC-124 | Fill preserves product scoping                  | Fill From       | Lead        | P0       |
| SC-125 | Fill from period with different products        | Fill From       | Lead        | P1       |
| SC-126 | Fill does not copy priorities                   | Fill From       | Lead        | P1       |
| SC-127 | Next Week items become Current Week             | Fill From       | Lead        | P1       |
| SC-128 | Fill and immediately submit                     | Fill From       | Lead        | P1       |
| SC-129 | Fill from oldest available period               | Fill From       | Lead        | P2       |
| SC-130 | View version history modal (D-67)               | Version History | Lead        | P1       |
| SC-131 | Navigate versions with arrows (D-67)            | Version History | Lead        | P1       |
| SC-132 | Diff preview shows correct counts (D-67)        | Version History | Lead        | P2       |
| SC-133 | Restore to v1 from v3 (D-67)                    | Version History | Lead        | P0       |
| SC-134 | Restore creates automatic backup (D-67)         | Version History | Lead        | P1       |
| SC-135 | Linear history -- edit discards newer (D-67)    | Version History | Lead        | P1       |
| SC-136 | Warning before editing past version (D-67)      | Version History | Lead        | P1       |
| SC-137 | Version counter resets each period (D-67)       | Version History | Lead        | P2       |
| SC-138 | Version created on each autosave (D-67)         | Version History | Lead        | P1       |
| SC-139 | Version history empty for new period (D-67)     | Version History | Lead        | P2       |
| SC-140 | Lead Form past period read-only (D-64)          | Period Nav      | Lead        | P0       |
| SC-141 | Switch back to current restores editable (D-64) | Period Nav      | Lead        | P0       |
| SC-142 | Past period shows correct submitted data (D-64) | Period Nav      | Lead        | P1       |
| SC-143 | Buttons hidden on past period (D-64)            | Period Nav      | Lead        | P1       |
| SC-144 | Right arrow disabled on latest period (D-64)    | Period Nav      | Lead        | P2       |
| SC-145 | Weekly Report switch to past published (D-66)   | Period Nav      | Head        | P1       |
| SC-146 | Past report shows only Export PDF (D-66)        | Period Nav      | Head        | P1       |
| SC-147 | Combobox shows (current) label (D-66)           | Period Nav      | Head        | P2       |
| SC-148 | Non-existent period not in dropdown (D-64)      | Period Nav      | Lead        | P2       |
| SC-150 | Full Publish & Lock lifecycle (D-56)            | Publish & Lock  | Head/Lead   | P0       |
| SC-151 | Publish with 0 submissions warning (D-56)       | Publish & Lock  | Head        | P1       |
| SC-152 | Publish with partial submissions warning (D-56) | Publish & Lock  | Head        | P0       |
| SC-153 | Lead sees locked banner after publish (D-56)    | Publish & Lock  | Lead        | P0       |
| SC-154 | Lead all fields disabled after publish (D-56)   | Publish & Lock  | Lead        | P0       |
| SC-155 | Weekly Report Published badge (D-56)            | Publish & Lock  | Head        | P1       |
| SC-156 | Reopen allows unsubmitted leads to edit (D-56)  | Publish & Lock  | Head/Lead   | P0       |
| SC-157 | Re-publish after reopen (D-56)                  | Publish & Lock  | Head        | P1       |
| SC-158 | Double publish attempt blocked (D-56)           | Publish & Lock  | Head        | P2       |
| SC-160 | Revoke specific lead submission (D-57)          | Revoke Submit   | Admin       | P0       |
| SC-161 | After revoke lead form editable (D-57)          | Revoke Submit   | Lead        | P0       |
| SC-162 | After revoke KPI count updates (D-57)           | Revoke Submit   | Head        | P1       |
| SC-163 | After revoke Weekly Report updates (D-57)       | Revoke Submit   | Head        | P0       |
| SC-164 | Revoke + lead re-submits (D-57)                 | Revoke Submit   | Admin/Lead  | P1       |
| SC-165 | Revoke all leads simultaneously (D-57)          | Revoke Submit   | Admin       | P2       |
| SC-166 | Revoke during Published state blocked (D-57)    | Revoke Submit   | Admin       | P2       |
| SC-167 | Revoke non-submitted -- no button (D-57)        | Revoke Submit   | Admin       | P2       |
| SC-170 | Dashboard Toggle All collapses                  | Dashboard       | Head        | P2       |
| SC-171 | Dashboard Toggle All expands                    | Dashboard       | Head        | P2       |
| SC-172 | Alert bar shows pending lead names              | Dashboard       | Head        | P0       |
| SC-173 | Alert bar hidden when all submitted             | Dashboard       | Head        | P1       |
| SC-174 | Send Reminder success flow                      | Dashboard       | Head        | P1       |
| SC-175 | Report Archive page 1 default                   | Dashboard       | Head        | P1       |
| SC-176 | Report Archive navigate to page 2               | Dashboard       | Head        | P2       |
| SC-177 | Report Archive click opens Weekly Report        | Dashboard       | Head        | P1       |
| SC-178 | KPI escalations match Blocked & At Risk         | Dashboard       | Head        | P0       |
| SC-179 | Lead Reports traffic light dots accurate        | Dashboard       | Head        | P1       |
| SC-180 | Autosave debounced on field change              | Lead Form       | Lead        | P0       |
| SC-181 | Autosave badge Saving state                     | Lead Form       | Lead        | P1       |
| SC-182 | Autosave fails -- error toast                   | Lead Form       | Lead        | P0       |
| SC-183 | Add item -- description required validation     | Lead Form       | Lead        | P1       |
| SC-184 | Add item -- cancel does not create              | Lead Form       | Lead        | P1       |
| SC-185 | Edit item -- pre-filled data correct            | Lead Form       | Lead        | P1       |
| SC-186 | Delete item -- confirm removes and updates      | Lead Form       | Lead        | P0       |
| SC-187 | Delete item -- cancel does not delete           | Lead Form       | Lead        | P1       |
| SC-188 | Kanban card hover shows Edit/Delete             | Lead Form       | Lead        | P1       |
| SC-189 | Read-only card no hover buttons                 | Lead Form       | Lead        | P1       |
| SC-190 | SDLC stage change On Track to At Risk           | Lead Form       | Lead        | P0       |
| SC-191 | SDLC click locked stage -- nothing              | Lead Form       | Lead        | P1       |
| SC-192 | Risk add with product+stage scope               | Lead Form       | Lead        | P0       |
| SC-193 | Priorities max 3 enforced                       | Lead Form       | Lead        | P1       |
| SC-194 | Priorities clear one -- badge updates           | Lead Form       | Lead        | P1       |
| SC-195 | Submit dialog shows correct counts              | Lead Form       | Lead        | P0       |
| SC-196 | Submit locks form with timestamp                | Lead Form       | Lead        | P0       |
| SC-200 | Weekly Report Toggle All collapses              | Weekly Report   | Head        | P2       |
| SC-201 | Portfolio Overview 12 products worst-case       | Weekly Report   | Head        | P0       |
| SC-202 | Per-lead accordion correct data                 | Weekly Report   | Head        | P0       |
| SC-203 | Export PDF triggers generation                  | Weekly Report   | Head        | P1       |
| SC-220 | Admin tab switching                             | Admin           | Admin       | P1       |
| SC-221 | Users -- add user                               | Admin           | Admin       | P1       |
| SC-222 | Users -- edit role                              | Admin           | Admin       | P1       |
| SC-223 | Users -- delete with confirmation               | Admin           | Admin       | P1       |
| SC-224 | Products -- edit SDLC stages                    | Admin           | Admin       | P0       |
| SC-225 | Products -- remove stage with warning           | Admin           | Admin       | P1       |
| SC-226 | Products -- stage assignment validation (D-63)  | Admin           | Admin       | P1       |
| SC-227 | Periods -- create new period                    | Admin           | Admin       | P0       |
| SC-228 | Periods -- date validation                      | Admin           | Admin       | P1       |
| SC-229 | Reminders -- toggle autosave                    | Admin           | Admin       | P2       |
| SC-230 | Settings -- change default deadline             | Admin           | Admin       | P2       |
| SC-240 | Login split-screen layout                       | Login           | None        | P1       |
| SC-241 | SSO button redirects to Keycloak                | Login           | None        | P0       |
| SC-242 | After SSO Lead to /report                       | Login           | Lead        | P0       |
| SC-243 | After SSO Head to /dashboard                    | Login           | Head        | P0       |
| SC-244 | After SSO Admin to /dashboard                   | Login           | Admin       | P0       |
| SC-245 | JWT expiry redirect to login                    | Auth            | Lead        | P1       |
| SC-246 | SAML role mapped correctly                      | Auth            | All         | P0       |
| SC-247 | Concurrent sessions same user                   | Auth            | Lead        | P2       |
| SC-248 | Logout session cleared                          | Auth            | Lead        | P1       |
| SC-250 | Mobile nav collapses                            | Responsive      | Any         | P2       |
| SC-251 | Mobile no horizontal scroll                     | Responsive      | Any         | P1       |
| SC-252 | Mobile kanban stacks vertically                 | Responsive      | Lead        | P2       |
| SC-253 | Mobile SDLC pipeline wraps                      | Responsive      | Lead        | P2       |
| SC-254 | Login left panel hidden on mobile               | Responsive      | None        | P2       |
| SC-260 | Network disconnect during autosave              | Error Handling  | Lead        | P0       |
| SC-261 | Network disconnect during submit                | Error Handling  | Lead        | P0       |
| SC-262 | API 500 -- error state with retry               | Error Handling  | Any         | P1       |
| SC-263 | Browser refresh preserves state                 | Error Handling  | Lead        | P1       |
| SC-264 | Empty database -- graceful empty states         | Error Handling  | Admin       | P2       |
| SC-265 | Maximum data 100+ items                         | Error Handling  | Lead        | P2       |
| SC-266 | XSS prevention in text fields                   | Security        | Lead        | P0       |
| SC-267 | Very long text truncation                       | Error Handling  | Lead        | P2       |
| SC-268 | Unicode characters preserved                    | Error Handling  | Lead        | P2       |
| SC-269 | Concurrent edit same user two tabs              | Error Handling  | Lead        | P1       |
| SC-280 | Screen reader reads page title                  | Accessibility   | Any         | P1       |
| SC-281 | Screen reader reads KPI values                  | Accessibility   | Head        | P1       |
| SC-282 | Keyboard Tab order matches visual               | Accessibility   | Any         | P1       |
| SC-283 | Escape closes modals                            | Accessibility   | Any         | P1       |
| SC-284 | Focus trap in modals                            | Accessibility   | Any         | P1       |
| SC-285 | Skip link works                                 | Accessibility   | Any         | P2       |
| SC-286 | SDLC stages have aria-labels                    | Accessibility   | Lead        | P2       |
| SC-287 | Color contrast meets 4.5:1                      | Accessibility   | Any         | P2       |
| SC-288 | Reduced motion disables animations              | Accessibility   | Any         | P2       |
| SC-290 | Login stub role buttons (D-68)                  | Login Stub      | None        | P0       |
| SC-291 | Enter as Lead → /report (D-68)                  | Login Stub      | None→Lead   | P0       |
| SC-292 | Enter as Head → /dashboard (D-68)               | Login Stub      | None→Head   | P0       |
| SC-293 | Enter as Admin → /dashboard (D-68)              | Login Stub      | None→Admin  | P0       |
| SC-294 | Enter as Viewer → read-only (D-68)              | Login Stub      | None→Viewer | P1       |
| SC-295 | SSO button disabled in dev (D-68)               | Login Stub      | None        | P1       |
| SC-296 | Stub disabled in production (D-68)              | Login Stub      | None        | P0       |
| SC-297 | Switch roles requires re-login (D-68)           | Login Stub      | Any         | P1       |
| SC-300 | Bookmarkable URLs (D-69)                        | URL Routing     | Head        | P0       |
| SC-301 | Period param in Lead Form URL (D-69)            | URL Routing     | Lead        | P0       |
| SC-302 | Period param in Weekly Report URL (D-69)        | URL Routing     | Head        | P0       |
| SC-303 | Admin tab param in URL (D-69)                   | URL Routing     | Admin       | P1       |
| SC-304 | Admin views lead form via URL (D-69)            | URL Routing     | Admin       | P0       |
| SC-305 | URL access enforces role (D-69)                 | URL Routing     | Lead        | P0       |
| SC-306 | Browser refresh preserves state (D-69)          | URL Routing     | Head        | P0       |
| SC-307 | Back/forward navigation (D-69)                  | URL Routing     | Head        | P0       |
| SC-308 | 404 for invalid URLs (D-69)                     | URL Routing     | Any         | P1       |
| SC-309 | Deep link sharing (D-69)                        | URL Routing     | Head/Admin  | P1       |
| SC-310 | Logout clears session (D-69)                    | URL Routing     | Any         | P0       |
| SC-311 | Nav teal border matches content width (D-70)    | Layout          | Any         | P1       |

---

## Priority Distribution

| Priority  | Count   | Description                                                 |
| --------- | ------- | ----------------------------------------------------------- |
| **P0**    | 83      | Must-pass for any release. Core functionality and security. |
| **P1**    | 96      | Important for user experience. Should pass for production.  |
| **P2**    | 44      | Nice-to-have polish. Can defer to next sprint if needed.    |
| **Total** | **223** | Unique test scenarios across 31 areas.                      |

---

### SC-98: Copy from previous report

**Role:** Lead
**Priority:** P1
**Precondition:** Lead "Polenkov A." is logged in. Previous week's report (Week 15) exists with 9 items, 2 risks, 1 decision.
**Steps:**

1. Navigate to "My Report" page for current week (Week 16).
2. Click "Copy Previous" button in the header.
3. Confirmation dialog appears: "Copy data from Week 15 report? This will populate Current Week items, Risks, and Decisions from your previous submission. Existing data will not be overwritten."
4. Click "Copy" to confirm.
   **Expected:**

- Current Week items from Week 15 are copied as Planned items for Current Week 16.
- Risks and Decisions are copied with original text.
- Priorities are NOT copied (must be set fresh each week).
- Next Week items from Week 15 become Current Week suggestions.
- Items already filled in Week 16 are NOT overwritten.
- Toast notification: "Copied 9 items from Week 15."

---

## 11. Publish & Lock Flow (D-56)

### SC-100: Publish & Lock freezes all lead forms

**Role:** Head
**Priority:** P0
**Precondition:** Head "Director H." is logged in. Period is Open. 4/6 leads have submitted.
**Steps:**

1. Navigate to "Weekly Report" page.
2. Verify badge shows "Live · 4/6 Submitted".
3. Click "Publish & Lock" button.
4. Confirm in the dialog (which warns about 2 pending leads).
5. After publish, switch to Lead "Polenkov A." session.
6. Navigate to "My Report" page.
   **Expected:**

- Weekly Report badge changes to "Published · Week 16".
- All lead forms become read-only, including leads who had already submitted AND leads who had not.
- Polenkov's form shows locked banner: "Report published by Director H. on [date]."
- All input fields, "+ Add" buttons, Edit/Delete actions are disabled/hidden.
- SDLC stage chips are non-clickable.
- "Request Reopen" button is visible on the locked form.

---

### SC-101: Reopen after Publish & Lock

**Role:** Head, Admin
**Priority:** P0
**Precondition:** Period for Week 16 is in "Published" state (all forms locked).
**Steps:**

1. Login as Head "Director H."
2. Navigate to "Weekly Report" page.
3. Click "Reopen" button (visible only in Published state).
4. Confirm in the dialog.
5. Switch to Lead "Polenkov A." session.
6. Navigate to "My Report" page.
   **Expected:**

- Weekly Report badge changes back to "Live · 4/6 Submitted".
- Leads who had submitted: forms remain locked (submitted state preserved).
- Leads who had NOT submitted: forms become editable again.
- "Reopen" button disappears, "Publish & Lock" button reappears.
- Leads receive notification: "Period reopened by Director H."

---

### SC-102: Lead requests reopen on locked form

**Role:** Lead
**Priority:** P1
**Precondition:** Lead "Polenkov A." is logged in. Period is Published (Locked). Lead's form shows locked banner.
**Steps:**

1. Navigate to "My Report" page.
2. Observe the locked banner with "Request Reopen" button.
3. Click "Request Reopen".
4. Observe confirmation.
   **Expected:**

- Button sends a notification/email to Head and Admin users.
- Toast notification: "Reopen request sent to [Head Name]."
- Button changes to "Reopen Requested" (disabled state) to prevent duplicate requests.
- Head sees the request on Dashboard (alert or notification badge).

---

### SC-103: Publish & Lock warns about pending leads

**Role:** Head
**Priority:** P1
**Precondition:** Head "Director H." is logged in. 2 leads have not submitted (Olga N. — Draft, Sergey T. — Pending).
**Steps:**

1. Navigate to "Weekly Report" page.
2. Click "Publish & Lock" button.
3. Observe the confirmation dialog.
   **Expected:**

- Dialog title: "Publish & Lock Report?"
- Warning text: "2 leads haven't submitted: Olga N., Sergey T."
- Warning explains: "Their forms will be locked without submission data."
- Two buttons: "Cancel" and "Publish & Lock Anyway".
- Clicking "Cancel" returns to the report page without changes.
- Clicking "Publish & Lock Anyway" proceeds with locking.

---

## 12. Revoke Submit (D-57)

### SC-104: Admin revokes lead's submission

**Role:** Admin
**Priority:** P0
**Precondition:** Admin is logged in. Polenkov A. has status "Submitted" for the current period.
**Steps:**

1. Navigate to "Dashboard" page.
2. Locate "Lead Reports" section.
3. Find Polenkov A.'s entry with "Submitted" badge and "Revoke" button.
4. Click "Revoke" button.
5. Confirm in the dialog.
6. Switch to Lead "Polenkov A." session.
7. Navigate to "My Report" page.
   **Expected:**

- Confirmation dialog: "Revoke Polenkov A.'s submission? Their form will become editable again."
- After revoke, Polenkov's status changes from "Submitted" to "Draft" on Dashboard.
- The "Revoke" button disappears (no longer submitted).
- Submissions KPI updates (e.g., "3/6" instead of "4/6").
- Polenkov's form becomes editable again — all input fields, "+ Add" buttons, SDLC chips are interactive.
- Locked banner is removed from Polenkov's form.
- Polenkov receives notification: "Your submission was revoked by [Admin]. Please review and resubmit."

---

### SC-105: Revoke not available for non-submitted leads

**Role:** Admin
**Priority:** P2
**Precondition:** Admin is logged in. Olga N. has status "Draft", Sergey T. has status "Pending".
**Steps:**

1. Navigate to "Dashboard" page.
2. Locate "Lead Reports" section.
3. Check Olga N. and Sergey T. entries.
   **Expected:**

- No "Revoke" button is shown for Draft or Pending leads.
- "Revoke" button only appears next to leads with "Submitted" status.

---

## 13. Dashboard Hub & Admin Access (D-59, D-62)

### SC-106: Admin can drill into any lead's form

**Role:** Admin
**Priority:** P0
**Precondition:** Admin is logged in. Multiple leads have submitted reports.
**Steps:**

1. Navigate to "Dashboard" page.
2. Locate "Lead Reports" section.
3. Click on Maria K.'s card (a lead the admin is NOT).
4. Observe the form that opens.
5. Edit a Current Week item in Maria K.'s form.
6. Click "Submit Report" on behalf of Maria K.
   **Expected:**

- Admin navigates to Maria K.'s form with full edit access.
- Form header shows: "Editing: Maria K.'s Report" (or similar indicator).
- Admin can add/edit/delete items, change SDLC stages, modify risks/decisions.
- Admin can submit the report on behalf of Maria K.
- After submission, Maria K.'s status changes to "Submitted" on Dashboard.
- An audit log entry is created: "Submitted by [Admin] on behalf of Maria K."

---

### SC-107: Lead sees only own card clickable on Dashboard

**Role:** Lead
**Priority:** P1
**Precondition:** Lead "Polenkov A." is logged in. Dashboard is accessible (if lead has Dashboard access).
**Steps:**

1. Navigate to "Dashboard" page (if accessible to leads — depends on routing).
2. Locate "Lead Reports" section.
3. Observe all 6 lead cards.
4. Click on own card (Polenkov A.).
5. Attempt to click on Maria K.'s card.
   **Expected:**

- Own card is clickable and navigates to "My Report" page.
- Other leads' cards show a lock icon and `cursor: not-allowed`.
- Clicking other leads' cards does nothing.
- No route exists that would let a Lead view another Lead's form.

---

### SC-108: Report Archive in Dashboard with pagination (D-60)

**Role:** Head
**Priority:** P1
**Precondition:** Head "Director H." is logged in. At least 10 past reports exist.
**Steps:**

1. Navigate to "Dashboard" page.
2. Scroll to "Report Archive" section at the bottom.
3. Observe pagination controls.
4. Click page "2" in pagination.
5. Click "→" arrow to go to page 3.
   **Expected:**

- Archive shows a paginated list of past published reports.
- Default page size: ~5 reports per page.
- Pagination controls: ← 1 2 3 → with current page highlighted.
- Clicking a page number or arrow loads the corresponding set of reports.
- Each report entry is clickable to view the full Weekly Report.
- No separate Archive page exists in navigation — archive is embedded in Dashboard.

---

### SC-109: Dashboard KPIs show correct aggregated data (D-59)

**Role:** Head
**Priority:** P0
**Precondition:** Head "Director H." is logged in. 4/6 submitted. Deadline in 2 days. 5 escalations.
**Steps:**

1. Navigate to "Dashboard" page.
2. Verify the 3 KPI cards.
   **Expected:**

- **Submissions card:** Shows "4 / 6" with progress bar at 66%. Historical context: "Last week: 6/6".
- **Deadline card:** Shows countdown "2d 5h" with "Friday 18:00" subtitle.
- **Escalations card:** Shows "5" with breakdown or delta from last week.
- Cards have consistent styling: teal left border for submissions, yellow for deadline, red for escalations.

---

## 14. Login Split-Screen (D-61)

### SC-110: Login page split-screen layout and branding

**Role:** None (unauthenticated)
**Priority:** P1
**Precondition:** No active session. Navigating to any protected URL.
**Steps:**

1. Navigate to `/dashboard` (or any protected URL).
2. Observe the login page layout.
3. Verify left and right panels.
4. Verify all text is in English.
   **Expected:**

- Page is split 50/50 horizontally.
- **Left panel:** Teal gradient background (from `var(--teal)` to darker shade). Abstract geometric shapes (circles, rounded rectangles). Text: "Product Engineering & Operations" in white.
- **Right panel:** White/cream background. CustomReport CR logo circle. Title "CustomReport". "Sign in with SSO" button (green pill, login icon). Footer: "Keycloak -- SAML 2.0 -- Corporate SSO".
- All text is in English (no Russian on login page).
- Responsive: on mobile, left panel is hidden or collapses to a top banner.
- SSO button has `aria-label="Sign in with corporate SSO"`.
- No local username/password form.
