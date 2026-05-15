# 07 — Admin → Integrations Tab (Settings)

**Route:** `/admin?tab=settings` → Integrations sub-tab  
**Role:** admin / head

### AI.01 — Telegram card shows "Coming Soon" badge (A11)

**Element:** `data-testid="integration-badge-telegram"` | span  
**data-state:** `coming-soon`  
Steps: Navigate to `/admin?tab=settings`, select Integrations sub-tab.  
Expected: Telegram row shows "Coming Soon" badge (not "Active"/"Inactive").  
Status: `[P]` (covered by settings-tab.test.tsx)

### AI.02 — Slack card shows "Coming Soon" badge (A11)

**Element:** `data-testid="integration-badge-slack"` | span  
**data-state:** `coming-soon`  
Status: `[P]` (covered by settings-tab.test.tsx)

### AI.03 — Telegram Coming Soon helper text is English (A10)

**Element:** text inside `data-testid="integration-row-telegram"`  
Expected: English-only copy (no Russian literals).  
Status: `[P]` (covered by settings-tab.test.tsx)

<!-- TODO(A38-1): add items for other integration rows, settings persistence. -->
