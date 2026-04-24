---
phase: 18-e2e-tests
type: context
---

# Phase 18 Context — E2E Playwright Tests

## Purpose

Implement 223 regression scenarios from REGRESSION-SCENARIOS.md as automated
Playwright E2E tests. These validate every user journey, cross-role lifecycle,
error path, and visual baseline defined in the mockups.

## Spec Sources

- `REGRESSION-SCENARIOS.md` — 223 scenarios across 31 categories
- `REQUIREMENTS.md` — E2E-01..E2E-10
- `mockups/screenshots/` — visual reference for baselines
- `MANIFEST.md` — design decisions D-56..D-70

## Dependencies

- Phase 17 must be complete (all UI pages functional)
- Login stub must work for role switching
- API must return real data from seeded database

## Test Infrastructure

- Playwright 1.50+ (already in devDependencies)
- Auth via login stub (GET /auth/dev-login?role=...)
- Seeded database with known test data
- Screenshots stored in `apps/web/e2e/screenshots/`

## Test Categories (from REGRESSION-SCENARIOS.md)

1. Lead Form (SC-01..SC-19) — 19 scenarios
2. Dashboard (SC-20..SC-25) — 6 scenarios
3. Weekly Report (SC-26..SC-30) — 5 scenarios
4. Published Report (SC-31..SC-34) — 4 scenarios
5. Admin Panel (SC-35..SC-38) — 4 scenarios
6. Access Control (SC-39..SC-46) — 8 scenarios
7. Data Integrity (SC-47..SC-50) — 4 scenarios
8. UI States & Error Handling (SC-51..SC-54) — 4 scenarios
9. Edge Cases (SC-55..SC-58) — 4 scenarios
10. Responsive & Accessibility (SC-59..SC-62) — 4 scenarios
11-28. Advanced scenarios (SC-63..SC-190) — 127 scenarios
29. Login Stub (SC-191..SC-198) — 8 scenarios
30. URL-Based Routing (SC-199..SC-209) — 11 scenarios
31. Nav Bar (SC-210..SC-211) — 2 scenarios
+ Additional scenarios SC-212..SC-223

## Plan Structure

- 18-01: Auth + fixtures + Lead journey (E2E-01)
- 18-02: Head journey — dashboard + weekly report + publish (E2E-02)
- 18-03: Admin journey + settings (E2E-03)
- 18-04: Cross-role lifecycle + revoke (E2E-04, E2E-05)
- 18-05: Period navigation + Fill From + Version History (E2E-06..E2E-08)
- 18-06: Error paths + edge cases (E2E-09)
- 18-07: Visual regression baselines + a11y (E2E-10)
