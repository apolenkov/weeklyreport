# 02-auth — UAT Scenarios

**Route:** `/auth/dev-login`, `/auth/saml/login`, `/auth/logout`, `/`
**Role:** unauthenticated visitor (pre-auth), then role-specific (lead/head/admin/viewer/director)
**State preconditions:** dev-mode (AUTH_DEV_MODE=true for /auth/dev-login paths)

---

## Primary authentication flows

### AUTH-01 — SAML login button renders on landing

**Element:** `data-testid="primary-cta"` | role=link
**Route:** `/` (production mode with real SAML)
**Role:** unauthenticated

Steps:

1. Navigate to `/` in production environment (AUTH_DEV_MODE=false).
2. Observe the primary CTA button.

Expected: button text shows "Sign in with SSO"; aria-label confirms "Sign in with corporate SSO".

Edge cases:

- Dev mode (AUTH_DEV_MODE=true) → button text changes to "Enter Application"; button points to `/auth/dev-login` or last-role resume.

Playwright hook: `tests/e2e/auth.spec.ts › AUTH-01`
Status: `[P]`

---

### AUTH-02 — Dev-mode landing shows "Enter Application" CTA

**Element:** `data-testid="primary-cta"` | role=link
**Route:** `/` (dev mode)
**Role:** unauthenticated, no prior session
**State precondition:** AUTH_DEV_MODE=true, no lastRole in localStorage

Steps:

1. Set `AUTH_DEV_MODE=true` (build env).
2. Clear browser localStorage.
3. Navigate to `/`.

Expected:

- Button text: "Enter Application".
- Default href: `/auth/dev-login?role=admin&email=admin@customreport.local&redirect=%2Fadmin`.
- Subtitle: "Dev mode · default role: admin · switch role from in-app menu".

Edge cases:

- Page reload → button target unchanged (always admin default).

Playwright hook: `tests/e2e/auth.spec.ts › AUTH-02`
Status: `[ ]`

---

## Last-role resume (dev-mode only)

### AUTH-03 — Last-role hint renders after previous session

**Element:** `data-testid="last-role-hint"` | container
**Route:** `/` (dev mode)
**Role:** unauthenticated
**State precondition:** AUTH_DEV_MODE=true, lastRole stored in localStorage

Steps:

1. Log in as `lead` (sets lastRole in localStorage).
2. Logout via dev-role switcher or `/auth/logout`.
3. Revisit `/`.

Expected:

- `last-role-hint` container appears with smooth max-height/opacity transition.
- Shows "Last session: <Name> · <Role>" (e.g., "Last session: Lead 1 · Lead").
- "Change role" button visible below hint.

Edge cases:

- No prior login → hint container hidden (max-height: 0).
- Persisted for all roles (lead/head/admin/viewer/director).

Playwright hook: `tests/e2e/auth.spec.ts › AUTH-03`
Status: `[ ]`

---

### AUTH-04 — Primary CTA resumes last role

**Element:** `data-testid="primary-cta"` | role=link
**Route:** `/` (dev mode, lastRole present)
**Role:** unauthenticated
**State precondition:** AUTH_DEV_MODE=true, lastRole in localStorage

Steps:

1. Return to `/` after prior logout (lastRole is "lead", email "lead1@customreport.local").
2. Click the primary "Enter Application" button.

Expected:

- Button href points to `/auth/dev-login?role=lead&email=lead1@customreport.local&redirect=%2Flead%2Freport`.
- Navigates to `/lead/report` after session is issued.

Playwright hook: `tests/e2e/auth.spec.ts › AUTH-04`
Status: `[ ]`

---

### AUTH-05 — "Change role" button expands role switcher

**Element:** `data-testid="last-role-change"` | role=button
**Route:** `/` (dev mode, lastRole present)
**Role:** unauthenticated

Steps:

1. Navigate to `/`.
2. Click "Change role" button within the last-role-hint.

Expected:

- Button aria-expanded toggles from false → true.
- `last-role-switcher` container becomes visible (grid layout, 2 columns).
- Button text changes to "Hide options".

Edge cases:

- Click again → grid collapses, aria-expanded → false, button text back to "Change role".

Playwright hook: `tests/e2e/auth.spec.ts › AUTH-05`
Status: `[ ]`

---

### AUTH-06 — Role switcher grid renders all roles

**Element:** `data-testid="last-role-switcher"` | list (grid layout)
**Route:** `/` (dev mode, lastRole present, grid expanded)
**Role:** unauthenticated

Steps:

1. Navigate to `/`.
2. Expand the role switcher grid.
3. Count visible role option buttons.

Expected:

- Exactly 5 buttons: lead, head, admin, viewer, director (in 2-column grid).
- Each button labeled with ROLE_LABEL.
- Each has testid: `data-testid="last-role-option-<role>"`.

Playwright hook: `tests/e2e/auth.spec.ts › AUTH-06`
Status: `[ ]`

---

### AUTH-07 — Click role option resumes as that role

**Element:** `data-testid="last-role-option-head"` (or other role)
**Route:** `/` (dev mode, role grid expanded)
**Role:** unauthenticated

Steps:

1. Expand the role switcher grid.
2. Click "Head" button (or any role option).

Expected:

- Navigates to `/auth/dev-login?role=head&email=head@customreport.local&redirect=%2Fhead%2Fdashboard`.
- Session issued → browser redirects to role default landing route.

Edge cases:

- Invalid role (manually edited URL) → /auth/dev-login returns 400 error.

Playwright hook: `tests/e2e/auth.spec.ts › AUTH-07`
Status: `[ ]`

---

## Dev-login endpoint

### AUTH-08 — /auth/dev-login accepts role + email + redirect params

**Element:** (backend endpoint, no UI testid)
**Route:** `/auth/dev-login?role=lead&email=lead1@customreport.local&redirect=%2Flead%2Freport`
**Role:** unauthenticated
**State precondition:** AUTH_DEV_MODE=true

Steps:

1. Navigate directly to `/auth/dev-login?role=lead&email=lead1@customreport.local&redirect=%2Flead%2Freport`.

Expected:

- Response sets `customreport_session` cookie with JWT (valid role claim).
- Response 302 redirects to the `redirect` query param value.
- Session persists across page reloads.

Edge cases:

- Missing `role` → defaults to "head".
- Invalid `role` → 400 with error JSON.
- Missing `email` → uses emailByRole[role] fallback.
- Invalid `redirect` (e.g., "//evil.com") → rejected.
- No `redirect` → uses DEFAULT_FOR_ROLE[role].

Playwright hook: `tests/e2e/auth.spec.ts › AUTH-08`
Status: `[P]`

---

### AUTH-09 — /auth/dev-login sets role claim in JWT

**Element:** (JWT payload, no DOM)
**Route:** `/auth/dev-login?role=admin&email=admin@customreport.local`
**Role:** unauthenticated

Steps:

1. Navigate to `/auth/dev-login?role=admin&email=admin@customreport.local`.
2. Wait for redirect.
3. Check session via `trpc.auth.me()`.

Expected:

- Returned session has `role: 'admin'`.
- Cookie persists across reloads (HttpOnly, SameSite=Lax).

Playwright hook: `tests/e2e/auth.spec.ts › AUTH-09`
Status: `[P]`

---

### AUTH-10 — /auth/dev-login accepts custom email (non-seeded)

**Element:** (backend logic)
**Route:** `/auth/dev-login?role=head&email=custom@example.com`
**Role:** unauthenticated

Steps:

1. Navigate to `/auth/dev-login?role=head&email=custom@example.com`.
2. Check session.

Expected:

- Session issued with email=custom@example.com.
- samlId generated as `dev-custom@example.com`.
- displayName from nameByRole fallback ("Head").

Playwright hook: `tests/e2e/auth.spec.ts › AUTH-10`
Status: `[ ]`

---

## SAML login (production path)

### AUTH-11 — /auth/saml/login initiates SAML auth in production

**Element:** (backend endpoint)
**Route:** `/auth/saml/login`
**Role:** unauthenticated
**State precondition:** AUTH_DEV_MODE=false

Steps:

1. Navigate to `/auth/saml/login`.

Expected:

- 302 redirect to Keycloak SAML login endpoint.
- After SSO success, callback returns to `/auth/saml/callback`.

Playwright hook: `tests/e2e/auth.spec.ts › AUTH-11`
Status: `[M]` (requires live Keycloak; skip in dev)

---

### AUTH-12 — /auth/saml/login redirects to /auth/dev-login in dev mode

**Element:** (backend endpoint)
**Route:** `/auth/saml/login`
**Role:** unauthenticated
**State precondition:** AUTH_DEV_MODE=true

Steps:

1. Navigate to `/auth/saml/login`.

Expected:

- 302 redirect to `/auth/dev-login?role=admin&email=admin@customreport.local`.
- No Keycloak contact.

Edge cases:

- `next` query param preserved: `/auth/saml/login?next=%2Fhead%2Fdashboard`.

Playwright hook: `tests/e2e/auth.spec.ts › AUTH-12`
Status: `[P]`

---

### AUTH-13 — /auth/saml/login respects `next` query param

**Element:** (backend query param handling)
**Route:** `/auth/saml/login?next=%2Fhead%2Fdashboard`
**Role:** unauthenticated

Steps:

1. Navigate to `/auth/saml/login?next=%2Fhead%2Fdashboard`.

Expected:

- Redirect to `/auth/dev-login?role=admin&...&redirect=%2Fhead%2Fdashboard`.
- After session issued, lands on `/head/dashboard`.

Edge cases:

- Invalid `next` (e.g., `//evil.com`) → rejected.

Playwright hook: `tests/e2e/auth.spec.ts › AUTH-13`
Status: `[ ]`

---

## Logout

### AUTH-14 — /auth/logout clears session cookie

**Element:** (backend endpoint)
**Route:** `/auth/logout` (POST)
**Role:** authenticated (any role)

Steps:

1. Log in as any role.
2. POST to `/auth/logout`.

Expected:

- Response sets `Set-Cookie: customreport_session=; Max-Age=0`.
- 302 redirect to `/`.
- Session no longer valid.

Edge cases:

- No session cookie → still returns 302 to `/` (idempotent).

Playwright hook: `tests/e2e/auth.spec.ts › AUTH-14`
Status: `[P]`

---

### AUTH-15 — /auth/logout audit logs the session before clearing

**Element:** (audit log)
**Route:** `/auth/logout` (POST)
**Role:** authenticated

Steps:

1. Log in as `head`.
2. POST to `/auth/logout`.
3. Check audit logs.

Expected:

- Audit event emitted: `{ action: "logout", userId, role, ip }`.

Playwright hook: `tests/e2e/auth.spec.ts › AUTH-15`
Status: `[M]`

---

## Dev-role-switcher in-app widget

### AUTH-16 — Dev role switcher button renders in dev mode

**Element:** `data-testid="dev-role-switcher-trigger"` | role=button
**Route:** (all authenticated routes)
**Role:** any authenticated
**State precondition:** NEXT_PUBLIC_DEV_ROLE_SWITCHER=true, NODE_ENV !== 'production'

Steps:

1. Log in as any role in dev environment.
2. Look for the fixed button in bottom-right corner.

Expected: "DEV: switch role" button visible, amber styling.

Edge cases:

- Production build → button not rendered.
- NEXT_PUBLIC_DEV_ROLE_SWITCHER=false → absent.

Playwright hook: `tests/e2e/auth.spec.ts › AUTH-16`
Status: `[P]`

---

### AUTH-17 — Dev role switcher dropdown loads user list per role

**Element:** `data-testid="dev-role-switcher-trigger"` (trigger)
**Route:** any authenticated page
**Role:** any authenticated

Steps:

1. Click "DEV: switch role".
2. Dropdown opens.

Expected:

- Menu sections for: Head, Admin, Director, Lead, Viewer.
- Each section labeled with role name and count.
- testids: `data-testid="dev-role-switcher-<role>-<email>"`.

Edge cases:

- Loading → "Loading…".
- Error → "Load error" in red.

Playwright hook: `tests/e2e/auth.spec.ts › AUTH-17`
Status: `[P]`

---

### AUTH-18 — Click user item switches to that role

**Element:** `data-testid="dev-role-switcher-lead-lead1@customreport.local"` (example)
**Route:** any authenticated page
**Role:** any authenticated

Steps:

1. Open dropdown.
2. Click lead user item.

Expected:

- Switches to lead role.
- Navigates to `/auth/dev-login?role=lead&email=lead1@customreport.local`.
- Session updated.

Playwright hook: `tests/e2e/auth.spec.ts › AUTH-18`
Status: `[P]`

---

### AUTH-19 — Reseed (minimum) wipes and reseeds DB

**Element:** `data-testid="dev-role-switcher-reseed-min"` | role=menuitem
**Route:** any authenticated page
**Role:** any authenticated

Steps:

1. Click "Wipe + Reseed (minimum)".

Expected: backend wipes reports/sections/versions, reseeds minimal data, hard-reloads page.

Playwright hook: `tests/e2e/auth.spec.ts › AUTH-19`
Status: `[ ]`

---

### AUTH-20 — Reseed (full) wipes everything and reseeds

**Element:** `data-testid="dev-role-switcher-reseed-full"` | role=menuitem

Steps:

1. Click "Wipe + Reseed (full)".

Expected: full wipe + reseed; session may be invalidated if user deleted.

Playwright hook: `tests/e2e/auth.spec.ts › AUTH-20`
Status: `[ ]`

---

### AUTH-21 — Wipe reports (manual UAT) preserves users and periods

**Element:** `data-testid="dev-role-switcher-wipe-manual-uat"` | role=menuitem

Steps:

1. Click "Wipe reports (manual UAT)".

Expected: reports/sections/versions wiped; users/periods preserved; session valid.

Playwright hook: `tests/e2e/auth.spec.ts › AUTH-21`
Status: `[ ]`

---

### AUTH-22 — Dev role switcher logout button clears session

**Element:** `data-testid="dev-role-switcher-logout"` | role=menuitem

Steps:

1. Click "Logout" menu item.

Expected: POST /auth/logout, cookie cleared, navigates to `/`.

Playwright hook: `tests/e2e/auth.spec.ts › AUTH-22`
Status: `[P]`

---

## Edge cases & error states

### AUTH-23 — Invalid role in /auth/dev-login returns 400

**Route:** `/auth/dev-login?role=invalid-role&email=test@local`

Expected: HTTP 400, JSON body with error, no session cookie set.

Playwright hook: `tests/e2e/auth.spec.ts › AUTH-23`
Status: `[ ]`

---

### AUTH-24 — Closed session redirects to landing

**Route:** any authenticated route
**State precondition:** session cookie deleted/expired

Steps:

1. Log in as lead.
2. Delete session cookie (DevTools).
3. Navigate to `/lead/report`.

Expected: API returns 401, proxy redirects to `/`.

Playwright hook: `tests/e2e/auth.spec.ts › AUTH-24`
Status: `[P]`

---

### AUTH-25 — Wrong role redirected to role default landing

**Route:** `/` + redirect params
**State precondition:** user logged in as "lead", tries `/admin`

Steps:

1. Log in as lead.
2. Navigate to `/admin`.

Expected: proxy middleware detects role mismatch, redirects to `/lead/report`.

Edge cases:

- Read-only routes (`/reports?tab=published`) accessible from viewer+.
- Director lands on `/head/dashboard` (read-only mode).

Playwright hook: `tests/e2e/auth.spec.ts › AUTH-25`
Status: `[P]`
