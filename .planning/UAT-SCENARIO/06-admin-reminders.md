# 06 — Admin → Reminders Tab

**Route:** `/admin?tab=reminders`  
**Role:** admin / head

<!-- TODO(A38-1): expand with all DOM elements from reminders-tab.tsx. -->

### AR.01 — Empty state shows "No reminder policies yet" heading + CTA (A8)

**Element:** `data-testid="reminders-empty-state"` | section  
Steps: Delete all policies. Expected: icon + "No reminder policies yet" + "Create first policy" button.  
Status: `[P]` (covered by reminders-tab.test.tsx)

### AR.02 — New Policy button opens form

**Element:** `data-testid="new-policy-button"` | button  
Status: `[P]` (covered by reminders-tab.test.tsx)

### AR.03 — Policy row shows kind, offset, audience, validity

**Element:** `data-testid="policy-row-<id>"` | row  
Status: `[P]` (covered by reminders-tab.test.tsx)

### AR.04 — Expand policy row shows derived rules

**Element:** `data-testid="derived-rules-<id>"` | section  
Status: `[P]` (covered by reminders-tab.test.tsx)

### AR.05 — Remove policy shows confirmation with rule count

**Element:** `data-testid="remove-<id>"` | button  
Status: `[P]` (covered by reminders-tab.test.tsx)

### AR.06 — validUntil < validFrom disables Save

**Element:** `data-testid="policy-validity-hint"` | text  
Status: `[P]` (covered by reminders-tab.test.tsx)
