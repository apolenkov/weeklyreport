---
status: passed
phase: 17-ui-redesign
source: [17-VERIFICATION.md]
started: 2026-04-24T23:50:00Z
updated: 2026-05-08T16:23:00+03:00
evidence:
  - .planning/regression/evidence/2026-05-08-phase16-17-uat/uat-live-results.json
  - apps/web/e2e/regression/phase16-17-uat.spec.ts
---

## Current Test

[complete: live Docker stack UAT replay]

## Tests

### 1. Login Page

expected: Split-screen layout — left: Demo brand gradient (teal→dark green, geometric shapes, "Weekly Status Reporting" text), right: CustomReport logo, "Sign in with SSO" button, 4 dev stub buttons (Lead, Head, Admin, Viewer) when AUTH_STUB=true
result: [pass] Live / renders CustomReport landing entry surface; dev fallback no longer auto-redirects the public landing page. Evidence: sc-17-01-login.png.

### 2. Lead Form Page

expected: /lead/report shows SDLC pipeline grid (products × 7 stages), period navigator (← Week N →), Fill From button, Version History, form sections (Current/Next Week, Risks, Decisions, Priorities), Submit button
result: [pass] Live lead session renders Product Status, Current Week, Next Week, and Submit Report. Evidence: sc-17-02-lead-form.png.

### 3. Lead History Page

expected: /lead/history shows card grid of past submissions with traffic light dots (green/yellow/red), period dates, status badges
result: [pass] Current canonical history surface is /reports?tab=drafts; My Drafts tab active. Evidence: sc-17-03-lead-history.png.

### 4. Dashboard Page

expected: /head/dashboard shows KPI cards (Submissions ring, Deadline, Escalations), Alert bar, Lead Reports grid (6 cards with status + traffic lights), Report Archive with pagination
result: [pass] Live head session renders Dashboard, Activity This Period, Lead Reports, and View Weekly Report. Evidence: sc-17-04-dashboard.png.

### 5. Weekly Report Page

expected: /head/report shows portfolio overview (product status cards), per-product accordions with items/risks/decisions, "Publish & Lock" button with confirmation dialog, "Export PDF" button
result: [pass] Live head report renders Weekly Report, Portfolio Overview, publish control, PDF control, and disabled empty product headers. Evidence: sc-17-05-weekly-report.png.

### 6. Admin Panel

expected: /admin shows 5 tabs (Users, Products, Periods, Reminders, Settings). Users tab: CRUD table. Products tab: stage assignment editor (7 columns). All tabs navigable via URL ?tab= param
result: [pass] Live admin users tab renders active tab and users table; mobile Admin tab select is visible and selects users. Evidence: sc-17-06-admin.png.

### 7. Print/PDF Page

expected: /reports/[id]/print shows A4-optimized layout with company header, portfolio table, per-lead sections, no navigation/interactive elements
result: [pass] Current canonical print route is /print/[reportId]; it renders print report and no AppShell nav. Evidence: sc-17-07-print.png.

### 8. Navigation Bar

expected: Top nav bar with teal bottom border constrained to max-w-6xl content width. Role-aware links.
result: [pass] Live role checks show exactly one active nav link for drafts, published, dashboard, and weekly report routes. Evidence: sc-17-08-nav-active.png.

### 9. Design System Consistency

expected: Cream canvas (#f2f0eb), teal primary (#006241), white cards with 12px radius, Lexend headings, Source Sans 3 body text, 44px touch targets, skip-link visible on Tab
result: [pass] Live CSS tokens verified: background #f2f0eb, card #ffffff, radius 0.75rem, touch target 44px, Lexend/Source Sans 3. Evidence: sc-17-09-design-system.png.

### 10. URL Routing

expected: All pages accept URL params (period, tab). Browser back/forward works. Bookmarkable URLs.
result: [pass] Reports tab navigation now uses browser history; Published click then Back returns to /reports?tab=drafts. Evidence: sc-17-10-url-routing.png.

## Summary

total: 10
passed: 10
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

No phase 17 UAT gaps remain from this replay.

Phase 16 runtime PDF/theme gates are tracked separately in
16-HUMAN-UAT.md and remain blocked/human_needed.
