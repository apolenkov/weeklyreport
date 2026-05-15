# 99 — Cross-Cutting: Nav-bar, Skeletons, Hydration

**Routes:** all  
**Roles:** all

### CC.01 — Nav-bar right-rail skeleton prevents layout shift (A1)

**Element:** `data-testid="navbar-right-skeleton"` | div (shown pre-auth.me)  
Steps: Hard reload any app page. Expected: skeleton renders in nav-bar right rail before auth.me resolves (zero CLS).  
Status: `[ ]`

### CC.02 — Nav-bar resolves to correct role actions after auth.me

**Element:** `data-testid="navbar-user-menu"` | menu  
Steps: Reload page. Expected: user menu appears with correct role label once auth.me resolves.  
Status: `[ ]`

### CC.03 — 404 → redirect to / for unauthenticated

**Element:** / (redirect destination)  
Steps: Navigate to `/some-nonexistent-path` unauthenticated. Expected: redirect to landing page.  
Status: `[ ]`

### CC.04 — Submission progress ring tooltip (A30)

**Element:** `data-testid="submission-ring"` | title attribute  
Steps: Navigate to `/head/dashboard`. Hover the progress ring.  
Expected: tooltip shows "N of M leads submitted this week (P%)".  
Status: `[ ]`

### CC.05 — formatPeriodRange consistent across surfaces (A26)

**Element:** any period date range text  
Steps: Compare period range display in: admin periods tab, head dashboard, lead history.  
Expected: all show same format (e.g. "May 4–10, 2026").  
Status: `[ ]`

<!-- TODO(A38-1): add items for theme/dark mode, keyboard traps in modals,
     ARIA roles, focus management, skip-to-content link. -->
