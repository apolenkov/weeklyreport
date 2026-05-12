# 05 — Admin → Periods Tab

**Route:** `/admin?tab=periods`  
**Role:** admin / head

<!-- TODO(A38-1): expand with all DOM elements from periods-tab.tsx.
     Covers: create dialog, edit dialog, archive/unarchive buttons,
     delete confirm, deadline validation, weekLabel prefill (A6a/A6b). -->

### AP.01 — Periods table renders active periods

**Element:** `data-testid="periods-active-table"` | table  
Steps: Navigate to `/admin?tab=periods`. Expected: rows for scheduled/open/published periods.  
Status: `[ ]`

### AP.02 — Create Period dialog opens

**Element:** `data-testid="periods-create-dialog"` | role=dialog  
Steps: Click "New period" button. Expected: dialog with period-start, period-end, deadline, label fields.  
Status: `[ ]`

### AP.03 — Deadline validation blocks submit (A6b)

**Element:** `data-testid="periods-deadline-error"` | text  
Steps: Set deadline before period start. Expected: red hint + Submit disabled.  
Status: `[ ]`

### AP.04 — Edit pre-fills weekLabel (A6a)

**Element:** `data-testid="periods-create-label"` | input  
Steps: Click Edit on a period with a weekLabel. Expected: label field prefilled.  
Status: `[ ]`

### AP.05 — Delete period shows confirm dialog

**Element:** `data-testid="periods-delete-dialog"` | role=dialog  
Status: `[ ]`

### AP.06 — Archive/Unarchive buttons trigger state change

**Element:** `data-testid="archive-period-btn"` | button  
Status: `[ ]`

### AP.07 — Submission progress badge shows tooltip (A29)

**Element:** `data-testid="period-progress-badge"` | title attribute  
Status: `[ ]`
