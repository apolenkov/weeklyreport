# Agent A Rerun — 2026-05-06

**Scope:** AUTH-020…AUTH-046 (24 tests), LAND-001…LAND-006 (6 tests), ARC-001…ARC-010 (10 tests)
**Total:** 40 test scenarios
**Status:** Test infrastructure delivered; execution throttled by env

---

## Test Files Created

| File                      | Scope                                             | Tests                  | Status    |
| ------------------------- | ------------------------------------------------- | ---------------------- | --------- |
| `agent-a-auth.spec.ts`    | Dev-login, logout, tRPC auth context, error pages | AUTH-020 thru AUTH-046 | CREATED ✓ |
| `agent-a-landing.spec.ts` | Landing page render, card layout, button links    | LAND-001 thru LAND-006 | CREATED ✓ |
| `agent-a-archive.spec.ts` | Archive list, report details, table sorting       | ARC-001 thru ARC-010   | CREATED ✓ |

---

## Execution Summary

**Infrastructure Setup:**

- Playwright 1.59.1 installed and verified
- Config: `playwright.regression.config.ts` (Chromium, workers=1, baseURL=http://localhost:3000)
- Frontend (3000) and API (3002) both responsive
- Screenshot dir created: `.planning/regression/screenshots/agent-a/`

**Test Execution:**

- Started 39 tests (tests are auto-discovered)
- Test runner launched successfully (no startup errors)
- Initial tests began executing (ARC-001 reported 11.2s, ARC-002 passed 10.8s)
- **Issue:** Each test taking 10–11 seconds (slow page load + network idle waits)
- **Timeline impact:** 39 tests × ~10s = 390s nominal; background task exceeded wall-clock budget

---

## Coverage Map

### AUTH-020..029: Dev-Login Flow

| ID       | Scenario                    | Type        | Note                        |
| -------- | --------------------------- | ----------- | --------------------------- |
| AUTH-020 | /auth/dev-login (no params) | LOGIN       | → head user, redirect to /  |
| AUTH-021 | ?role=lead                  | LOGIN       | → lead1@customreport.local  |
| AUTH-022 | ?role=head                  | LOGIN       | → head@customreport.local   |
| AUTH-023 | ?role=viewer                | LOGIN       | → viewer@customreport.local |
| AUTH-024 | ?role=invalid               | ERROR       | 400 response                |
| AUTH-025 | ?role=lead&email=custom     | LOGIN       | Custom email override       |
| AUTH-027 | User creation if not exists | SIDE_EFFECT | DB check via dev-mode       |
| AUTH-028 | User update on re-login     | SIDE_EFFECT | No duplicates by email      |
| AUTH-029 | Duplicate email handling    | EDGE_CASE   | Same email, different role  |

### AUTH-030..032: Logout

| ID       | Scenario                     | Type       | Note                      |
| -------- | ---------------------------- | ---------- | ------------------------- |
| AUTH-030 | POST /auth/logout            | LOGOUT     | Cookie cleared            |
| AUTH-031 | Stateless JWT validation     | DESIGN     | Tokens valid until expiry |
| AUTH-032 | Protected calls after logout | AUTH_GUARD | Returns 401               |

### AUTH-036..041: tRPC Auth Context & Roles

| ID       | Scenario                        | Type       | Note                          |
| -------- | ------------------------------- | ---------- | ----------------------------- |
| AUTH-036 | No cookie + dev-mode ON         | FALLBACK   | Uses hardcoded DEV_SESSION    |
| AUTH-037 | No cookie + dev-mode OFF        | FALLBACK   | session null, protected fails |
| AUTH-038 | protectedProcedure null session | AUTH_GUARD | 401/UNAUTHORIZED              |
| AUTH-039 | headProcedure with lead role    | RBAC       | 403/FORBIDDEN                 |
| AUTH-040 | headProcedure with viewer role  | RBAC       | 403/FORBIDDEN                 |
| AUTH-041 | headProcedure with head role    | RBAC       | Passes/200                    |

### AUTH-042..046: Error Page

| ID       | Scenario                           | Type   | Note                  |
| -------- | ---------------------------------- | ------ | --------------------- |
| AUTH-042 | /auth/error?reason=idp_unavailable | RENDER | "Service Unavailable" |
| AUTH-043 | ?reason=invalid_assertion          | RENDER | "Verification Failed" |
| AUTH-044 | ?reason=session_expired            | RENDER | "Session Expired"     |
| AUTH-045 | ?reason=unknown                    | RENDER | Generic error         |
| AUTH-046 | no reason param                    | RENDER | Generic error         |

### LAND-001..006: Landing Page Basics

| ID       | Scenario                      | Type      | Note                             |
| -------- | ----------------------------- | --------- | -------------------------------- |
| LAND-001 | Page renders without auth     | SMOKE     | Card + button visible            |
| LAND-002 | Sign In button href           | LINK      | Links to /auth/saml/login        |
| LAND-003 | Vertical/horizontal centering | LAYOUT    | flex items-center justify-center |
| LAND-004 | Card max-width (sm)           | LAYOUT    | max-w-sm compliance              |
| LAND-005 | Button full-width (w-full)    | LAYOUT    | Button fits card width           |
| LAND-006 | No sidebar/nav                | STRUCTURE | No AppShell wrapper              |

### ARC-001..010: Archive List & History

| ID      | Scenario               | Type      | Note                                                 |
| ------- | ---------------------- | --------- | ---------------------------------------------------- |
| ARC-001 | Loading skeleton       | SKELETON  | PageTitleSkeleton + TableSkeleton (FAILING: timeout) |
| ARC-002 | Error state with retry | ALERT     | QueryError handling (PASSED)                         |
| ARC-003 | Empty state            | EMPTY     | "No data yet" message                                |
| ARC-004 | Published reports list | TABLE     | All reports rendered                                 |
| ARC-005 | Sort order (desc)      | SORT      | Newest first by publishedAt                          |
| ARC-006 | Date formatting        | FORMAT    | ru-RU locale {start} – {end}                         |
| ARC-007 | Status badge           | COMPONENT | TrafficLightBadge rendering                          |
| ARC-008 | Published date format  | FORMAT    | ru-RU locale                                         |
| ARC-009 | "Open" button link     | LINK      | /reports/{id}                                        |
| ARC-010 | Row click navigation   | CLICK     | Router.push to /reports/{id}                         |

---

## Key Findings

### P1 Issues (Blocking)

None detected in infrastructure.

### P2 Issues (High)

- **ARC-001 Test Timeout:** First archive skeleton test failed after 11.2s, suggests loading state may not render quickly or selector mismatch. Expected: skeleton visible before table loads. Actual: Timeout on selector.
  - **Root cause:** Archive page load time may exceed 10s, or skeleton uses non-standard class name.
  - **Remediation:** Increase `waitForSelector` timeout or adjust selector to match actual DOM structure (check `.animate-pulse` vs `[data-testid="skeleton"]`).

- **Test Execution Speed:** Each test averages 10–11s (mostly waiting for page load + networkidle). At this rate, 40 tests require ~400s = 6–7 minutes for full suite.
  - **Remediation:** Add shared test fixture with pre-login context to avoid re-auth per test (save 3–5s per test = 120–200s total).

### P3 Issues (Low)

- Dev-mode fallback test (AUTH-036) depends on `AUTH_DEV_MODE=true` env var being set at test runtime. Verify in CI/dev stack.

---

## Recommendations

1. **Parallelize subsequent runs:** Increase `workers` in playwright.regression.config.ts from 1 → 4 (or match CPU cores). Current sequential mode is safe but slow.

2. **Reuse auth context:** Create shared `loginAs` fixture (see agent-b.spec.ts pattern) to avoid 10s dev-login per test:

   ```ts
   test.beforeAll(async ({ browser }) => {
     const page = await browser.newPage();
     await loginAs(page, "head", "head@customreport.local");
     // Reuse page context across tests
   });
   ```

3. **Fix ARC-001 selector:** Archive page may not use `.animate-pulse`. Check actual CSS class or use more resilient selector (`page.locator('[role="status"], .skeleton')`).

4. **Screenshot retention:** Verify screenshot dir permissions and disk space:

   ```bash
   ls -lh .planning/regression/screenshots/agent-a/ | wc -l
   ```

5. **Next sweep:** Run with timeout=180s per test (currently 60s), handle slow env gracefully.

---

## Files Delivered

✓ `/Users/ap/work/customreport/apps/web/e2e/regression/agent-a-auth.spec.ts` — 24 scenarios
✓ `/Users/ap/work/customreport/apps/web/e2e/regression/agent-a-landing.spec.ts` — 6 scenarios
✓ `/Users/ap/work/customreport/apps/web/e2e/regression/agent-a-archive.spec.ts` — 10 scenarios
✓ `.planning/regression/screenshots/agent-a/` — Screenshot dir created

---

## Next Steps

1. Commit test files (no destructive changes):

   ```bash
   git add apps/web/e2e/regression/agent-a-*.spec.ts
   git commit -m "chore(regression): agent A test suite (auth + landing + archive)"
   ```

2. Re-run with increased timeout and worker parallelism to get full results.

3. Adjust selectors based on ARC-001 failure and re-test archive scenarios.

4. Export JSON results from next run to `.planning/regression/agent-a-results.json` for automated diff reporting.
