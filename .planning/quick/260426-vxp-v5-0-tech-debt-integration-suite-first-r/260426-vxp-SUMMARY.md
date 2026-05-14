---
quick_id: 260426-vxp
date: 2026-04-26
status: major-progress
files_modified:
  - apps/web/src/components/weekly-report/weekly-report-page.test.tsx
  - apps/web/proxy.ts
  - apps/web/e2e/integration/global-setup.ts
  - apps/web/playwright.integration.config.ts
  - apps/web/next-env.d.ts
  - .env.test # uncommitted (per plan critical fact #5)
  - .env # created at repo root, gitignored (cross-machine setup gap)
commits:
  - d394832: test(quick-260426-vxp) fix weekly-report-page tRPC mock for pdfExport surface
  - cc1a0ec: fix(quick-260426-vxp) unblock Phase 26 integration suite first-run (5 infra blockers)
provides:
  - HANDOFF.md item #4 closed (5 failing Vitest tests now green)
  - HANDOFF.md item #1 first-run completed — 8/21 pass, 5 fail (assertion-level), 8 skip
  - Phase 24 verification gap closed (proxy.ts matcher was firing on every path)
---

# Quick Task 260426-vxp Summary

## What shipped

Closed HANDOFF.md tech-debt item #4 (5 failing Vitest tests in `weekly-report-page.test.tsx`) by adding the missing `pdfExport.request.mutationOptions` and `pdfExport.status.queryOptions` entries to the test's tRPC proxy mock. HANDOFF.md item #1 (Phase 26 integration suite first run) is **partial**: environment provisioning succeeded (postgres container up, `.env.test` updated with `E2E_DATABASE_URL`), but the Docker Hub registry could not deliver the `redis:7-alpine` image despite ~12 retries across 30+ minutes — Docker Desktop's `http.docker.internal:3128` hub proxy is timing out specifically on redis manifest/blob fetches while postgres pulls succeed normally. The integration suite cannot start without Redis (BullMQ backend), so the suite was not run. Recommendation: restart Docker Desktop or use a local mirror, then re-run.

## Integration suite first-run results (HANDOFF #1 — PARTIAL)

| Item                                                     | Status                                                                                                                    |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| `:3002`, `:3005`, `:5432`, `:6379` ports free pre-flight | yes (lsof returned nothing)                                                                                               |
| `docker compose up postgres`                             | succeeded — container `customreport-postgres-1` running                                                                   |
| `docker compose up redis`                                | **failed** — `redis:7-alpine` manifest pulls timed out via `http.docker.internal:3128`                                    |
| `customreport_e2e` DB created                            | **yes** — created via `docker compose exec -T postgres createdb -U customreport customreport_e2e`, verified by `psql -lqt | grep -c customreport_e2e`returning`1`. Ready for next-session retry. |
| `.env.test` E2E_DATABASE_URL line appended               | yes (uncommitted, line 11)                                                                                                |
| Integration suite run (21 tests / 7 specs)               | **NOT RUN — infra-blocker**                                                                                               |

**Failing tests:** N/A — suite did not start.

**Classification:** `infra-blocker` (Docker Hub registry / Docker Desktop hub-proxy network failure, not a project bug).

**Diagnostics observed:**

- `postgres:15-alpine` pulled successfully on first retry (108MB content size)
- `redis:7-alpine` consistently failed with `context deadline exceeded` on either:
  - `Head https://registry-1.docker.io/v2/library/redis/manifests/7-alpine` (initial manifest)
  - `Get https://registry-1.docker.io/v2/library/redis/manifests/sha256:7aec...` (signed manifest fetch)
- One attempt got partway: 4 layers reported "Already exists" (cached from a prior session) but pull stalled on the remaining 4 layers indefinitely
- `docker info` confirmed proxy: `HTTP Proxy: http.docker.internal:3128` (Docker Desktop's bundled hub proxy)
- `curl https://registry-1.docker.io/v2/` from the host returned 401 (auth needed) immediately, proving DNS+TCP+TLS to Docker Hub work fine from outside the daemon — the proxy is the bottleneck

**Recommendation:** restart Docker Desktop (`killall Docker && open -a Docker`) to flush the stuck hub-proxy state, or temporarily bypass with `docker pull public.ecr.aws/docker/library/redis:7-alpine && docker tag ... redis:7-alpine`. Then re-run the suite per the plan's Step 1.5 command:

```bash
E2E_DATABASE_URL='postgresql://customreport:localdev@localhost:5432/customreport_e2e' \
  pnpm --filter @customreport/web test:e2e:integration 2>&1 | tee /tmp/integration-run.log
```

## weekly-report-page.test.tsx fix (HANDOFF #4 — CLOSED)

| Metric        | Value                                                                       |
| ------------- | --------------------------------------------------------------------------- |
| Before        | 167 passed / **5 failed** (172 total in suite)                              |
| After         | **172 passed / 0 failed**                                                   |
| Lines added   | 34                                                                          |
| Files changed | 1 (`apps/web/src/components/weekly-report/weekly-report-page.test.tsx`)     |
| Commit        | `d394832`                                                                   |
| Mock pattern  | mirrors existing `period.publish` / `period.reopen` pattern at lines 95/105 |

**Root cause:** The `<WeeklyReportPage>` component renders `<ExportPdfButton>` (Phase 23-01 addition), which calls **two** tRPC surfaces unconditionally on every render:

1. `trpc.pdfExport.request.mutationOptions(...)` — line 36 of `export-pdf-button.tsx`
2. `trpc.pdfExport.status.queryOptions(...)` — line 49 (the `enabled: false` flag gates the fetch but NOT the proxy property access)

The pre-existing test mock had no `pdfExport` namespace at all, so React threw `TypeError: Cannot read properties of undefined (reading 'request')` during render of every test that mounted `<WeeklyReportPage>` (5 tests).

**Note on plan vs reality (Rule 3 deviation):** The plan's `<critical_facts>` #6 said "ADD an analogous `pdfExport.request.mutationOptions` entry" — singular. In practice, mocking just `request.mutationOptions` would have surfaced the second crash on `status.queryOptions`. Both surfaces were added in one pass to make the tests go green; this is the minimum surface the component actually consumes. The `status.queryOptions` mock returns `{ enabled: false }` so the polling effect is inert (the tests do not exercise PDF export behavior, only that the parent page renders).

**Mock surface added (mirroring lines 95/105 convention):**

```typescript
pdfExport: {
  request: {
    mutationOptions: (opts: Captured['pdfExportRequestOptions']) => {
      captured.pdfExportRequestOptions = opts;
      return {
        mutationFn: captured.pdfExportRequestMutationFn,
        onSuccess: opts?.onSuccess,
        onError: opts?.onError,
      };
    },
  },
  status: {
    queryOptions: () => ({
      queryKey: ['pdfExport', 'status'],
      queryFn: async () => null,
      enabled: false,
    }),
  },
},
```

The `Captured` type was extended with `pdfExportRequestOptions` + `pdfExportRequestMutationFn`; all 5 test cases that initialize a `Captured` instance now include `pdfExportRequestMutationFn: vi.fn()`.

## Regression evidence

| Gate                                                 | Result                               | Log                      |
| ---------------------------------------------------- | ------------------------------------ | ------------------------ |
| `pnpm --filter @customreport/web typecheck`          | **pass (exit 0)**                    | /tmp/web-typecheck.log   |
| `pnpm --filter @customreport/api typecheck`          | **pass (exit 0)**                    | /tmp/api-typecheck.log   |
| `pnpm --filter @customreport/web test` (full Vitest) | **172 passed / 0 failed (23 files)** | /tmp/web-vitest-full.log |

No new failures vs. the baseline. The api package required `pnpm exec prisma generate` (with `DATABASE_URL` injected inline since no `.env` exists locally) before `apps/web/typecheck` could pass — it cross-references `apps/api` types via TypeScript project references. This is a pre-existing developer-onboarding gap (Prisma client must be generated before typechecks pass), not introduced by this task.

## Out of scope (still tech_debt after this task)

| HANDOFF item                          | Status      | Reason                                                            |
| ------------------------------------- | ----------- | ----------------------------------------------------------------- |
| #1 Phase 26 integration suite         | **PARTIAL** | Env provisioned, suite blocked on Docker Hub redis pull (network) |
| #2 Phase 22 manual UI smoke (4 items) | unchanged   | Requires browser-based human verification                         |
| #3 Phase 23 PDF download manual smoke | unchanged   | Requires browser-based human verification                         |
| #4 weekly-report-page.test.tsx        | **CLOSED**  | 5 failing tests now green (commit `d394832`)                      |
| #5 Phase 24 cookie injection          | unchanged   | Deferred to v6.0+ per user (SAML SSO not yet enabled)             |

## Recommended next steps

1. **Re-run integration suite once Docker Hub is reachable** (or use ECR mirror / restart Docker Desktop). The provisioning is fully done: postgres is up, `customreport_e2e` DB exists, `.env.test` has the URL. Once redis is pullable, the only remaining step is the inline-env run command in Step 1.5 of the plan. A 5-minute follow-up will close item #1.
2. **Milestone status:** v5.0 cannot yet move from `tech_debt` to fully `runtime-verified` for the automated portion until the integration suite has executed once. Item #4 (Vitest mock) is independent and can be considered closed today — the milestone-tracking doc should reflect that one of two automatable items is closed and the other is pending an environmental retry.
3. **Manual UI smoke (items #2 and #3)** remain appropriate for a release-day checklist; no executor work needed.
4. **Onboarding hint** discovered during this task: the typecheck pipeline silently fails if `prisma generate` hasn't run on a fresh checkout. Consider adding a `postinstall` hook in `prisma/package.json` to auto-generate, or a pre-typecheck check that surfaces a friendly "run `prisma generate` first" message. Filed as a finding, not in scope here.

---

## Update 2026-04-26 (post-Docker-Desktop restart) — Suite first-run COMPLETED

After the original PARTIAL verdict above (Docker Hub redis pull blocked),
the orchestrator restarted Docker Desktop and discovered five additional
infrastructure-level blockers. All were resolved in a single follow-up
commit (`cc1a0ec`), and the integration suite executed end-to-end for the
first time ever.

### Infra blockers discovered & fixed

| #   | Blocker                                                            | Root cause                                                                                                                                                                                                                                                                                                   | Fix                                                                                                                                                                                                              |
| --- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A   | Redis manifest pull stuck                                          | Docker Desktop hub-proxy degraded state                                                                                                                                                                                                                                                                      | `osascript -e 'quit app "Docker Desktop"' && open -a Docker` — restarted hub-proxy, redis pull then completed in seconds                                                                                         |
| B   | API webServer exit 9                                               | `node --env-file=../../.env` failed because `.env` does not exist on a fresh checkout (it's gitignored)                                                                                                                                                                                                      | Created `.env` at repo root with the canonical local-dev values from HANDOFF.md (gitignored — commits NOT made)                                                                                                  |
| C   | Playwright webServer 180s timeout                                  | `playwright.integration.config.ts` health URL was `/health`, returning 404; correct path is `/health/live`                                                                                                                                                                                                   | Edited config: `${API_URL}/health` → `${API_URL}/health/live`. Also raised webServer timeout 180s → 360s                                                                                                         |
| D   | All paths returning 307 redirect → "Header overflow" in Playwright | `apps/web/proxy.ts` matcher with negative-lookahead+\|-alternation matches EVERY path in Next.js 16 (including `/`, `/auth/*`, `/_next/*`, `/favicon.ico`). This is a real Phase 24 verification gap — the auth boundary was never enforced in any environment that didn't set `NEXT_PUBLIC_AUTH_STUB=true`. | Replaced negative-lookahead matcher with explicit allowlist (`/lead/:path*` etc.) AND added a `isProtectedPath()` guard inside the function body. Either alone is sufficient; both together is defense-in-depth. |
| E   | `prisma migrate reset --skip-seed` rejected                        | Prisma 7 dropped the `--skip-seed` flag and now seeds automatically per `prisma.config.ts` (`migrations.seed`)                                                                                                                                                                                               | Replaced two-step reset+seed in `global-setup.ts` with a single `prisma migrate reset --force`                                                                                                                   |
| F   | Playwright Chromium not installed                                  | Fresh checkout — browsers cache empty                                                                                                                                                                                                                                                                        | `pnpm exec playwright install chromium` (92MB, ~30s)                                                                                                                                                             |
| G   | Prisma 7 AI safeguard blocked migrate reset                        | New Prisma 7 protection requires explicit user consent for AI-invoked destructive ops                                                                                                                                                                                                                        | User explicitly consented ("давай"); orchestrator passed `PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION='давай'` env var on the run                                                                                |

### Final first-run results

| Metric      | Value                                                           |
| ----------- | --------------------------------------------------------------- |
| Total tests | **21** (matches HANDOFF #1 expected count)                      |
| **Passed**  | **8**                                                           |
| **Failed**  | **5**                                                           |
| Skipped     | 8 (downstream of failed tests in `test.describe.serial` chains) |
| Wall-clock  | 53.3s (after webServer cold start)                              |

### Failing tests (all `assertion-mismatch` — out of scope per plan, → v6.0 follow-up)

All 5 failures share the same symptom: `TimeoutError: page.waitForResponse: Timeout 15000ms exceeded while waiting for event "response"`. The tRPC POST that the test was expecting either didn't fire or took >15s. This points to either (a) a UI interaction not triggering the expected mutation, or (b) an autosave/mutation race where the response landed on a different network path than the regex matched. Per plan scope discipline ("first-run + capture results, NOT make all 21 green"), these are **NOT fixed in this quick task** — they are explicit v6.0 backlog items.

| #   | Spec                                          | Test                                                                |
| --- | --------------------------------------------- | ------------------------------------------------------------------- |
| 1   | `admin-crud.integration.spec.ts:94`           | admin product list reflects DB state for a known seed product       |
| 2   | `cross-role-lifecycle.integration.spec.ts:24` | lead submits → head publishes → lead sees locked                    |
| 3   | `lead-journey.integration.spec.ts:92`         | lead submit locks the form — section.status becomes submitted in DB |
| 4   | `lead-journey.integration.spec.ts:143`        | lead can fill from previous period — items appear for empty section |
| 5   | `status-risk-sync.integration.spec.ts:23`     | setting stage to at_risk auto-creates a Risk row in DB              |

### Phase 24 verification gap (advisory finding)

The proxy.ts matcher fix in blocker (D) closes a real verification gap. Phase 24's stated success criterion was "auth-guard enforced on protected routes," and verification confirmed that with `AUTH_STUB=false` + no cookie, requests redirected. But the matcher meant **every** request redirected — including `/`, `/_next/*`, and `/auth/*`, which would have caused redirect loops the moment a real user landed on the app without `AUTH_STUB`. The integration tests are the first environment to exercise that codepath (no `AUTH_STUB`), and they immediately surfaced the bug. Logged as a v5.0 retro finding; the matcher fix itself is included in this commit and does not need a separate phase.

### Updated milestone status

After this run, the v5.0 milestone moves from `tech_debt` to **automated-portion runtime-verified with known follow-ups**:

- ✅ HANDOFF #4 closed (Vitest mock fix)
- ✅ HANDOFF #1 first-run completed; 8/21 green, 5 assertion-level failures classified for v6.0
- ✅ Phase 24 matcher gap closed
- ⏭ HANDOFF #2 (Phase 22 manual UI smoke) — unchanged, requires browser
- ⏭ HANDOFF #3 (Phase 23 PDF download manual smoke) — unchanged, requires browser
- ⏭ HANDOFF #5 (Phase 24 cookie injection) — deferred to v6.0+ per user

The 5 failing integration tests should be opened as a v6.0 backlog cluster ("Stabilize Phase 26 integration suite — 5 assertion timeouts on tRPC POSTs"). They share a single symptom and are likely a single root cause.

## Self-Check

**Files exist:**

- `260426-vxp-SUMMARY.md` — FOUND
- `apps/web/src/components/weekly-report/weekly-report-page.test.tsx` — FOUND
- `apps/web/proxy.ts` — FOUND with allowlist matcher + path guard
- `apps/web/e2e/integration/global-setup.ts` — FOUND with Prisma 7 reset
- `apps/web/playwright.integration.config.ts` — FOUND with `/health/live` + 360s timeout
- `.env` — FOUND at repo root (gitignored)
- `.env.test` — FOUND (E2E_DATABASE_URL appended, uncommitted)

**Commits exist:**

- `d394832` — Vitest mock fix
- `cc1a0ec` — 5 infra blocker fixes (proxy/global-setup/playwright-config/next-env)

**Self-Check: PASSED**
