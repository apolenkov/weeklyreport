# 01 — Landing Page

**Route:** `/` (unauthenticated)  
**Role:** unauthenticated visitor, any role (pre-auth)

<!-- TODO(A38-1): expand with all DOM elements from page.test.tsx + login-page.client.tsx.
     Covers: last-role hint, role switcher, primary CTA, org logo, pulse animation. -->

### LP.01 — Primary CTA button renders

**Element:** `data-testid="primary-cta"` | role=link  
Steps: Navigate to `/`. Expected: "Sign in" or role-specific CTA visible.  
Status: `[P]` (covered by page.test.tsx LP UFB-071 tests)

### LP.02 — Last-role hint appears after previous login

**Element:** `data-testid="last-role-hint"` | text  
Status: `[P]` (covered by page.test.tsx)

### LP.03 — Role picker expands on "Change role"

**Element:** `data-testid="role-picker"` | listbox  
Status: `[P]` (covered by page.test.tsx)

### LP.04 — Pulse background animation renders (A14 visual)

**Element:** `.pulse-ecg-path` | SVG path  
Status: `[M]` (visual only)

### LP.05 — PulseMark logotype renders

**Element:** `data-testid="pulse-mark"` | SVG/heading  
Status: `[M]` (visual only)

<!-- TODO(A38-1): add items for tagline cycler, org name, footer links -->
