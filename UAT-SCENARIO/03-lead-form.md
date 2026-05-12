# 03 — Lead Form

**Route:** `/lead/report` | `/lead/report/[reportId]`  
**Role:** lead (primary), head (read-only mode)  
**State preconditions:** period open, lead has an active section

---

## Autosave & save indicator

### LF.01 — Autosave indicator

**Element:** `data-testid="autosave-indicator"`  
**Precondition:** period open, lead has unsaved changes

Steps:

1. Log in as `lead`.
2. Navigate to `/lead/report`.
3. Edit any text field (e.g. "This week" description).
4. Wait 3 seconds (autosave debounce).

Expected: indicator changes from "Unsaved" → "Saving…" → "Saved at HH:MM".  
Edge cases:

- Network offline → indicator shows "Error" with retry option.
- No changes made → indicator shows "Saved" without a network call.

Playwright hook: `tests/e2e/lead-form.spec.ts › LF.01`  
Status: `[ ]`

---

### LF.02 — Save Version button (manual snapshot)

**Element:** `data-testid="save-version-btn"` | role=button "Save Version"  
**Precondition:** period open, lead has any content

Steps:

1. Log in as `lead`.
2. Navigate to `/lead/report`.
3. Click "Save Version".

Expected:

- Toast "Version saved" appears.
- Version History nav shows a new entry with current timestamp.
- `VersionSnapshot` row created in DB (verify via Admin snapshot count).

Edge cases:

- Double-click → only one snapshot created (mutation in-flight guard).
- Read-only period → button absent from DOM.

Playwright hook: `tests/e2e/lead-form.spec.ts › LF.02`  
Status: `[ ]`

---

### LF.03 — Auto-versioning (A16): snapshot once per minute

**Element:** (background behaviour, no UI trigger)  
**Precondition:** period open, lead edits content for >1 minute

Steps:

1. Log in as `lead`.
2. Edit text fields over the course of 1 minute.
3. Do NOT click "Save Version".
4. After 61 seconds, check Admin → Periods → section → version count.

Expected: one new `VersionSnapshot` created automatically.  
Edge cases:

- No edits in the minute → no snapshot created.
- Form submitted → interval cleared, no further snapshots.

Playwright hook: `tests/e2e/lead-form.spec.ts › LF.03` (requires vi.useFakeTimers)  
Status: `[ ]`

---

## Current week section

### LF.04 — This week description field

**Element:** `data-testid="this-week-description"` | textarea  
**Precondition:** period open, section not submitted

Steps:

1. Navigate to `/lead/report`.
2. Click into "This week" description textarea.
3. Type 500 characters.

Expected:

- Character count badge updates in real-time.
- Autosave fires after 3s of inactivity.
- Saved content survives page reload.

Edge cases:

- Paste 2001 characters → truncated at the schema limit, error shown inline.

Playwright hook: `tests/e2e/lead-form.spec.ts › LF.04`  
Status: `[ ]`

---

### LF.05 — Next week plans field

**Element:** `data-testid="next-week-description"` | textarea

Steps: (same as LF.04 for the "Next week" field)

Expected: same autosave and persistence behavior as LF.04.

Playwright hook: `tests/e2e/lead-form.spec.ts › LF.05`  
Status: `[ ]`

---

### LF.06 — Scroll fade affordance (A14)

**Element:** `.relative > div[style*="overflow-y"]` wrapper  
**Precondition:** content in lead form overflows the 420px max-height

Steps:

1. Add enough projects/risks to overflow the current-week section.
2. Observe the bottom of the section.

Expected: a gradient fade appears at the bottom when there is more content below.  
Edge cases:

- Scrolled to bottom → fade disappears.
- Section short enough to not scroll → fade never shown.

Playwright hook: `tests/e2e/lead-form.spec.ts › LF.06` (visual check, may be `[M]`)  
Status: `[M]`

---

## Projects (traffic lights)

### LF.07 — Add project status row

**Element:** `data-testid="add-project-btn"` | role=button "Add"

Steps:

1. Navigate to `/lead/report`.
2. Click "Add" next to "Projects".
3. Fill project name and select status.
4. Click "Save" in the inline editor.

Expected:

- New row appears in the projects list.
- Autosave queued.
- Row survives page reload.

Edge cases:

- Empty project name → inline validation, Save disabled.
- Duplicate project name → allowed (same product can have multiple rows).

Playwright hook: `tests/e2e/lead-form.spec.ts › LF.07`  
Status: `[ ]`

---

### LF.08 — Edit project status (traffic light)

**Element:** `data-testid="project-status-select"` | select  
**Precondition:** at least one project row exists

Steps:

1. Click the status indicator of an existing project row.
2. Change from "green" → "yellow".
3. Tab out.

Expected: status indicator re-renders immediately; autosave fires.

Edge cases:

- Multiple rapid changes within 3s → single autosave with final value.

Playwright hook: `tests/e2e/lead-form.spec.ts › LF.08`  
Status: `[ ]`

---

### LF.09 — Delete project row

**Element:** `data-testid="delete-project-btn"` | role=button  
**Precondition:** at least one project row exists

Steps:

1. Click "Delete" on a project row.
2. Confirm in the dialog that appears.

Expected: row removed, autosave queued, row absent after reload.  
Edge cases:

- Cancel confirmation → row unchanged.

Playwright hook: `tests/e2e/lead-form.spec.ts › LF.09`  
Status: `[ ]`

---

## Risks

### LF.10 — Add risk

**Element:** `data-testid="add-risk-btn"` | role=button "Add risk"

Steps:

1. Click "Add risk".
2. Fill title, description, severity (high/medium/low).
3. Click "Save".

Expected: risk row appears; autosave queued.  
Edge cases:

- Title empty → Save disabled.
- Severity = critical → row rendered with red badge.

Playwright hook: `tests/e2e/lead-form.spec.ts › LF.10`  
Status: `[ ]`

---

### LF.11 — Edit risk severity (A15: Blocker severity fix)

**Element:** `data-testid="risk-severity-select"` | select  
**Precondition:** at least one risk row exists

Steps:

1. Click "Edit" on a risk row.
2. Change severity from "medium" → "blocker".
3. Click "Save".

Expected:

- Risk row shows "blocker" badge.
- Severity persists after page reload (A15 regression check).

Regression tag: **A15** — previously severity reset on reload when set to "blocker".

Playwright hook: `tests/e2e/lead-form.spec.ts › LF.11`  
Status: `[ ]`

---

### LF.12 — Risk edit dialog does not reset on re-open (A13)

**Element:** `data-testid="risk-edit-dialog"` | role=dialog  
**Precondition:** at least one risk row, dialog previously closed

Steps:

1. Click "Edit" on a risk row.
2. Change the description field.
3. Close the dialog (Escape or Cancel).
4. Re-open the same risk dialog.

Expected: description field shows **server-saved** value, not the
unsaved local edit from step 2.

Regression tag: **A13** — previously the dialog reset to empty on re-open due
to useEffect dependency on a recreated array/fn reference.

Playwright hook: `tests/e2e/lead-form.spec.ts › LF.12`  
Status: `[ ]`

---

## Decisions

### LF.13 — Add decision

**Element:** `data-testid="add-decision-btn"` | role=button

Steps:

1. Click "Add decision".
2. Fill title and body.
3. Click "Save".

Expected: decision row appears; autosave queued; row persists on reload.

Playwright hook: `tests/e2e/lead-form.spec.ts › LF.13`  
Status: `[ ]`

---

### LF.14 — Decision dialog does not reset on re-open (A13)

**Element:** `data-testid="decision-edit-dialog"` | role=dialog

Steps: (mirror of LF.12 for Decisions dialog)

Regression tag: **A13**

Playwright hook: `tests/e2e/lead-form.spec.ts › LF.14`  
Status: `[ ]`

---

### LF.15 — Decision product name shown in card (A23)

**Element:** `data-testid="decision-product-name"` | text  
**Precondition:** at least one decision associated with a product

Steps:

1. Add a decision and associate it with a product.
2. View the decision card in read-only (head view).

Expected: product name shown on the card.

Playwright hook: `tests/e2e/lead-form.spec.ts › LF.15`  
Status: `[ ]`

---

## Priority flags

### LF.16 — Add priority flag

**Element:** `data-testid="add-priority-btn"` | role=button

Steps: (mirror of LF.13 for Priority flags)

Playwright hook: `tests/e2e/lead-form.spec.ts › LF.16`  
Status: `[ ]`

---

### LF.17 — Priority dialog does not reset on re-open (A13)

**Element:** `data-testid="priority-edit-dialog"` | role=dialog

Steps: (mirror of LF.12 for Priority dialog)

Regression tag: **A13**

Playwright hook: `tests/e2e/lead-form.spec.ts › LF.17`  
Status: `[ ]`

---

## Submission

### LF.18 — Submit button (final submit)

**Element:** `data-testid="submit-section-btn"` | role=button "Submit"  
**Precondition:** all required fields filled

Steps:

1. Fill "This week" and "Next week" fields.
2. Click "Submit".
3. Confirm in the dialog.

Expected:

- Section status changes to "submitted".
- Form switches to read-only mode.
- Toast "Submitted successfully".
- Head dashboard submission counter increments.

Edge cases:

- Submit with empty required field → button disabled, inline hint shown.
- Re-submit attempt after submit → button absent from DOM (read-only).

Playwright hook: `tests/e2e/lead-form.spec.ts › LF.18`  
Status: `[ ]`

---

### LF.19 — Revoke submission

**Element:** `data-testid="revoke-section-btn"` | role=button "Revoke"  
**Precondition:** section already submitted, period still open

Steps:

1. After submitting (LF.18), click "Revoke".
2. Confirm.

Expected: section status returns to "draft"; form becomes editable.

Playwright hook: `tests/e2e/lead-form.spec.ts › LF.19`  
Status: `[ ]`

---

## Version history navigation

### LF.20 — Version history nav renders saved versions

**Element:** `data-testid="version-history-nav"` | nav  
**Precondition:** at least 2 VersionSnapshots exist

Steps:

1. Save two explicit versions via "Save Version" button.
2. Scroll to version history nav.

Expected: two entries shown with timestamps; latest marked as "current".

Playwright hook: `tests/e2e/lead-form.spec.ts › LF.20`  
Status: `[ ]`

---

### LF.21 — Restore earlier version

**Element:** `data-testid="version-restore-btn"` | role=button  
**Precondition:** ≥2 VersionSnapshots

Steps:

1. Click "Restore" on the earlier version.
2. Confirm in the dialog.

Expected: form fields reset to the content of the earlier snapshot.

Playwright hook: `tests/e2e/lead-form.spec.ts › LF.21`  
Status: `[ ]`

---

## Section preview (A34)

### LF.22 — Preview link navigates to /preview

**Element:** `a[href*="/preview"]` or button "Preview"  
**Precondition:** lead is viewing their own report

Steps:

1. Navigate to `/lead/report`.
2. Click the "Preview" link/button.

Expected: navigates to `/lead/report/<id>/preview`; shows read-only slide view of own section.

Playwright hook: `tests/e2e/lead-form.spec.ts › LF.22`  
Status: `[ ]`

---

### LF.23 — Preview shows only own section (not other leads)

**Element:** `[data-testid="weekly-report-page"]` in preview  
**Precondition:** lead is one of multiple leads in the group

Steps:

1. Navigate to `/lead/report/<id>/preview`.
2. Inspect rendered sections.

Expected: only the current lead's products/sections are visible.

Playwright hook: `tests/e2e/lead-form.spec.ts › LF.23`  
Status: `[ ]`

---

## Read-only mode (head viewing lead form)

### LF.24 — Head sees lead form in read-only

**Element:** `data-testid="lead-form-readonly"` or absence of edit controls  
**Role:** head  
**Precondition:** period open

Steps:

1. Log in as `head`.
2. Navigate to `/lead/report` (simulating a lead URL).

Expected: form renders without autosave, submit, or edit buttons.

Playwright hook: `tests/e2e/lead-form.spec.ts › LF.24`  
Status: `[ ]`

---

## SDLC pipeline display

### LF.25 — SDLC pipeline renders for each product

**Element:** `data-testid="sdlc-pipeline"` | list  
**Precondition:** product has stages assigned

Steps:

1. Navigate to `/lead/report`.
2. Expand a product accordion.
3. Observe the SDLC pipeline section.

Expected: stages shown in order with their current status indicators.

Playwright hook: `tests/e2e/lead-form.spec.ts › LF.25`  
Status: `[ ]`

---

<!-- TODO(A38-2): expand with more items once DOM inventory scan is complete.
     Target: every data-testid in lead-form.tsx, lead-form-addressable.tsx,
     current-week-section.tsx, risk-edit-dialog.tsx, decision-edit-dialog.tsx,
     priority-edit-dialog.tsx, sdlc-pipeline.tsx, version-history-nav.tsx. -->
