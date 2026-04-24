---
status: testing
phase: 17-ui-redesign
source: [17-VERIFICATION.md]
started: 2026-04-24T23:50:00Z
updated: 2026-04-24T23:50:00Z
---

## Current Test

### 1. Login Page

## Tests

### 1. Login Page
expected: Split-screen layout — left: Demo brand gradient (teal→dark green, geometric shapes, "Weekly Status Reporting" text), right: CustomReport logo, "Sign in with SSO" button, 4 dev stub buttons (Lead, Head, Admin, Viewer) when AUTH_STUB=true
result: [pending]

### 2. Lead Form Page
expected: /lead/report shows SDLC pipeline grid (products × 7 stages), period navigator (← Week N →), Fill From button, Version History, form sections (Current/Next Week, Risks, Decisions, Priorities), Submit button
result: [pending]

### 3. Lead History Page
expected: /lead/history shows card grid of past submissions with traffic light dots (green/yellow/red), period dates, status badges
result: [pending]

### 4. Dashboard Page
expected: /head/dashboard shows KPI cards (Submissions ring, Deadline, Escalations), Alert bar, Lead Reports grid (6 cards with status + traffic lights), Report Archive with pagination
result: [pending]

### 5. Weekly Report Page
expected: /head/report shows portfolio overview (product status cards), per-product accordions with items/risks/decisions, "Publish & Lock" button with confirmation dialog, "Export PDF" button
result: [pending]

### 6. Admin Panel
expected: /admin shows 5 tabs (Users, Products, Periods, Reminders, Settings). Users tab: CRUD table. Products tab: stage assignment editor (7 columns). All tabs navigable via URL ?tab= param
result: [pending]

### 7. Print/PDF Page
expected: /reports/[id]/print shows A4-optimized layout with company header, portfolio table, per-lead sections, no navigation/interactive elements
result: [pending]

### 8. Navigation Bar
expected: Top nav bar with teal bottom border constrained to max-w-6xl content width. Role-aware links.
result: [pending]

### 9. Design System Consistency
expected: Cream canvas (#f2f0eb), teal primary (#006241), white cards with 12px radius, Lexend headings, Source Sans 3 body text, 44px touch targets, skip-link visible on Tab
result: [pending]

### 10. URL Routing
expected: All pages accept URL params (period, tab). Browser back/forward works. Bookmarkable URLs.
result: [pending]

## Summary

total: 10
passed: 0
issues: 0
pending: 10
skipped: 0
blocked: 0

## Gaps
