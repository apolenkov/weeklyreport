---
quick_id: 260426-vxp
type: execute
wave: 1
autonomous: true
files_modified:
  - .env.test
  - apps/web/src/components/weekly-report/weekly-report-page.test.tsx
  - .planning/quick/260426-vxp-v5-0-tech-debt-integration-suite-first-r/260426-vxp-SUMMARY.md
must_haves:
  truths:
    - "Integration test environment is provisioned (postgres + redis up, customreport_e2e DB exists)"
    - "Integration suite (21 tests / 7 specs) has executed at least once and produced a pass/fail count"
    - "weekly-report-page.test.tsx Vitest suite is fully green (5 previously-failing tests now pass)"
    - "No regression: web typecheck + api typecheck + web Vitest all green after changes"
  artifacts:
    - path: ".planning/quick/260426-vxp-v5-0-tech-debt-integration-suite-first-r/260426-vxp-SUMMARY.md"
      provides: "Run report: integration suite results, mock fix evidence, regression evidence"
      min_lines: 30
    - path: "apps/web/src/components/weekly-report/weekly-report-page.test.tsx"
      provides: "Updated tRPC mock that includes pdfExport.request.mutationOptions"
      contains: "pdfExport"
  key_links:
    - from: ".env.test"
      to: "playwright.integration.config.ts"
      via: "E2E_DATABASE_URL env var injected via inline shell prefix on run command"
      pattern: "E2E_DATABASE_URL=postgresql://customreport:localdev@localhost:5432/customreport_e2e"
    - from: "apps/web/src/components/weekly-report/weekly-report-page.test.tsx"
      to: "apps/api/src/modules/pdf-export/pdf-export.router.ts"
      via: "Mock surface mirrors real pdfExportRouter.request shape"
      pattern: "pdfExport:.*request:.*mutationOptions"
---

<objective>
Close two automatable v5.0 tech debt items from HANDOFF.md so the milestone moves from `tech_debt` to fully runtime-verified for the parts a Claude executor can verify without UI smoke testing.

**Items in scope:**

1. **HANDOFF #1** — First-ever execution of the Phase 26 integration suite (21 tests / 7 specs). Provision env, run suite, capture results.
2. **HANDOFF #4** — Fix the 5 failing Vitest tests in `weekly-report-page.test.tsx` whose tRPC mock for `pdfExport.request.mutationOptions` is missing.

**Explicitly OUT of scope** (require human-in-loop UI smoke):

- HANDOFF #2 — Phase 22 SYNC-01/03, INT-01, INT-04/06 manual UI checks
- HANDOFF #3 — Phase 23 PDF download manual smoke
- HANDOFF #5 — Phase 24 cookie injection (deferred to v6.0+ per user)

Purpose: Eliminate the two automatable items from the v5.0 tech debt list. After this task, only manual-smoke items remain — those are appropriate to defer to a release-day checklist.

Output: A 260426-vxp-SUMMARY.md with concrete pass/fail evidence; a fixed Vitest test file; an appended .env.test line.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@CLAUDE.md
@HANDOFF.md
@apps/web/playwright.integration.config.ts
@apps/web/e2e/integration/global-setup.ts
@.env.test
@.env.test.example
@docker-compose.yml
@apps/web/package.json
@apps/web/src/components/weekly-report/weekly-report-page.test.tsx

<critical_facts>
**These facts are LOAD-BEARING — read carefully before executing:**

1. **`pnpm test:e2e:integration` does NOT auto-load .env.test.** Verified: `apps/web/package.json` line 13 is bare `playwright test --config=playwright.integration.config.ts`. Playwright does not load dotenv. Therefore `E2E_DATABASE_URL` MUST be exported in the shell or set inline on the command line. Appending to .env.test alone is insufficient. We do BOTH (append for documentation, export inline for the run).

2. **DB credentials come from docker-compose.yml.** Postgres user is `customreport`, password is `localdev` (default `${DB_PASSWORD:-localdev}` in compose), port 5432, host localhost. The `.env.test.example` shows `customreport@localhost` (no password) — that's wrong for our compose setup. Use the form: `postgresql://customreport:localdev@localhost:5432/customreport_e2e`.

3. **No local psql.** User does not have psql installed locally. ALL DB operations go through `docker compose exec postgres ...`. To create the DB: `docker compose exec postgres createdb -U customreport customreport_e2e`.

4. **`reuseExistingServer: !process.env.CI` is a footgun.** If `pnpm dev` is already running on :3002 or :3005, Playwright will reuse THAT server — but it points at the dev `DATABASE_URL=customreport`, not `customreport_e2e`. Tests would mutate the dev DB. Task 1 MUST verify those ports are free BEFORE starting the suite.

5. **`.env.test` is git-tracked** (verified `git ls-files .env.test` returns it). It contains test-only fake secrets. Appending the E2E_DATABASE_URL line is fine, but DO NOT commit changes to .env.test in this quick task — leave the diff dirty in the working tree for the user to review separately if desired.

6. **The tRPC mock in weekly-report-page.test.tsx already has the pattern.** Lines 95 and 105 mock `period.publish.mutationOptions` and `period.reopen.mutationOptions` via `Captured['publishOptions']` / `Captured['reopenOptions']` shape. The fix is to ADD an analogous `pdfExport.request.mutationOptions` entry mirroring that exact pattern. Do NOT invent a new pattern.

7. **Real `pdfExport.request` contract lives in** `apps/api/src/modules/pdf-export/pdf-export.router.ts` (exports `pdfExportRouter`) and the input/output schemas are co-located. The test mock only needs to satisfy what the React component actually calls — read `apps/web/src/components/weekly-report/weekly-report-page.tsx` to see the call site, then mirror just that surface.
   </critical_facts>

<interfaces>
From `apps/api/src/modules/pdf-export/pdf-export.router.ts`:
```typescript
// Top-level structure (verified via grep)
export const pdfExportRouter = {
  request: protectedProcedure...,  // mutation
  // ... other procedures
};
```

From `apps/web/src/components/weekly-report/weekly-report-page.test.tsx` lines 95 and 105 (existing mock pattern to mirror):

```typescript
mutationOptions: (opts: Captured["publishOptions"]) => {
  capturedPublishOptions = opts;
  return {
    /* ... */
  };
};
```

The new addition must be `pdfExport: { request: { mutationOptions: ... } }` mirroring that shape, with the variable rename `Captured['pdfExportOptions']` (or similar) for the typed capture. The exact structure becomes obvious by reading the existing test file once.
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Provision integration test environment and run the suite</name>
  <files>.env.test, .planning/quick/260426-vxp-v5-0-tech-debt-integration-suite-first-r/260426-vxp-SUMMARY.md (will be created in Task 3)</files>
  <action>
Single continuous flow — provisioning + first run. Execute in order:

**Step 1.1 — Verify ports are free (footgun guard).**

```bash
lsof -i :3002 -i :3005 -i :5432 -i :6379 2>&1 | head -50 || true
```

If :3002 or :3005 are occupied by `pnpm dev` / `next dev` / `nest start`, STOP and ask the user to close them. Do NOT auto-kill — there might be unsaved work. If only postgres (:5432) and redis (:6379) are occupied by docker-managed processes, that is fine and expected after step 1.2.

**Step 1.2 — Bring up infra.**

```bash
docker compose up -d postgres redis
docker compose ps
```

Wait until both are `healthy` (the compose healthchecks gate this). If `docker compose ps` shows `unhealthy` or `starting` after 30s, run `rtk docker logs customreport-postgres-1` (or whatever name `ps` printed) to diagnose.

**Step 1.3 — Create the dedicated E2E database via docker exec (no local psql).**

```bash
docker compose exec -T postgres createdb -U customreport customreport_e2e 2>&1 || \
  echo "(DB may already exist — that is fine, integration global-setup runs migrate reset)"
docker compose exec -T postgres psql -U customreport -lqt | grep customreport_e2e
```

The grep MUST match — that proves the DB exists. If it doesn't match, the createdb error was real, not "already exists"; fix before proceeding.

**Step 1.4 — Append E2E_DATABASE_URL to .env.test for documentation.**
Read `.env.test` first (it is git-tracked, do NOT overwrite). Then append exactly this line (only if not already present — grep first):

```
E2E_DATABASE_URL=postgresql://customreport:localdev@localhost:5432/customreport_e2e
```

Use the Edit tool, NOT a heredoc. The file currently ends at line 10 (`LOG_LEVEL=warn`). Add the line as line 11 (or after the last existing line). DO NOT git-commit this change in this quick task.

**Step 1.5 — Run the integration suite with the env var injected inline.**

CRITICAL: bare `pnpm --filter @customreport/web test:e2e:integration` will FAIL because Playwright does NOT auto-load .env.test. We export inline:

```bash
cd /home/user/my/customreport && \
  E2E_DATABASE_URL='postgresql://customreport:localdev@localhost:5432/customreport_e2e' \
  pnpm --filter @customreport/web test:e2e:integration 2>&1 | tee /tmp/integration-run.log
```

Expect: globalSetup runs `prisma migrate reset --force --skip-seed` then `tsx prisma/seed.ts` against customreport_e2e (NOT against the dev DB — verified by the env injection in playwright.integration.config.ts:51). Then API + web servers start (timeout 180s each), then the 21 tests run with workers=1.

This may take 5-10 minutes on a cold cache. Do not interrupt unless the run is clearly hung (>20 min with no output).

**Step 1.6 — Capture outcome.**
After the run completes, capture:

- Total tests run / passed / failed / skipped (from Playwright's summary line)
- Names of any failed tests (file + test name)
- Whether the failures are infrastructure (server didn't start, DB connection error, schema mismatch) or assertion-level (test logic mismatch)

Save the raw log at `/tmp/integration-run.log` for later reference.

**Scope discipline (CRITICAL):** Do NOT attempt to fix per-test assertion failures. The HANDOFF item is "first-run + capture results" — not "make all 21 green." Only fix infrastructure-level blockers if they prevent the suite from starting at all (e.g., DB user missing, migration fails). Per-test failures are findings to document in the SUMMARY for v6.0 follow-up. If you find yourself editing files under `apps/web/e2e/integration/*` or production code to make assertions pass, STOP — that is out of scope.
</action>
<verify>
<automated>docker compose exec -T postgres psql -U customreport -lqt | grep -c customreport_e2e</automated>
Returns >= 1 (DB exists). Plus integration-run.log exists at /tmp/integration-run.log with a Playwright summary line.
</verify>
<done>

- `customreport_e2e` DB exists and is reachable
- `.env.test` has the E2E_DATABASE_URL line appended (uncommitted)
- Integration suite has run to completion (or to a clear infrastructure blocker)
- Pass/fail counts captured for Task 3 SUMMARY
- No production-code or test-spec edits made (results are observational only)
  </done>
  </task>

<task type="auto" tdd="true">
  <name>Task 2: Fix weekly-report-page.test.tsx pdfExport mock</name>
  <files>apps/web/src/components/weekly-report/weekly-report-page.test.tsx</files>
  <behavior>
- All previously-failing tests in `apps/web/src/components/weekly-report/weekly-report-page.test.tsx` pass after the mock fix
- The mock for `pdfExport.request.mutationOptions` mirrors the existing pattern at lines 95/105 of the same file (the `period.publish.mutationOptions` / `period.reopen.mutationOptions` shape)
- The mock surface is the MINIMUM needed by the component — only what `weekly-report-page.tsx` actually calls
- No other tests in the file regress (the existing passing tests stay passing)
  </behavior>
  <action>
**Step 2.1 — Read the call site to know what surface the mock must satisfy.**
Read `apps/web/src/components/weekly-report/weekly-report-page.tsx` (full file is fine — single component) and grep for `pdfExport` and `request` usage. Identify:
- The hook call (likely `trpc.pdfExport.request.mutationOptions(...)` wrapped in `useMutation`)
- What `mutate` / `mutateAsync` is called with (the input shape)
- What the `onSuccess` / `onError` handlers expect from the response

**Step 2.2 — Read the real router contract.**
Read `apps/api/src/modules/pdf-export/pdf-export.router.ts` (focus on the `request` procedure's input and output schemas). This tells you what the typed shape SHOULD be — but the mock only needs to match what the component actually consumes.

**Step 2.3 — Read the existing mock pattern in the test file.**
Read `apps/web/src/components/weekly-report/weekly-report-page.test.tsx` end-to-end. Pay specific attention to:

- The `Captured` type (where `publishOptions` and `reopenOptions` live)
- Lines 95 and 105 (the existing `mutationOptions` mocks)
- How `capturedPublishOptions` / `capturedReopenOptions` are used in assertions
- Where the trpc mock is registered (likely a `vi.mock` block near the top)

**Step 2.4 — Run the failing tests to see the current error first (RED).**

```bash
cd /home/user/my/customreport && \
  pnpm --filter @customreport/web test -- weekly-report-page 2>&1 | tee /tmp/weekly-report-before.log
```

Expect 5 failures. Confirm the error message names `pdfExport.request.mutationOptions` (or similar) as the missing property. If the error is something else, STOP and reconsult — the diagnosis in HANDOFF may be incomplete.

**Step 2.5 — Add the pdfExport.request.mutationOptions mock.**
Mirror the existing pattern. Concretely:

1. Extend the `Captured` type to include `pdfExportRequestOptions` (or whatever name fits the existing convention)
2. Initialize the capture variable (e.g., `let capturedPdfExportRequestOptions: Captured['pdfExportRequestOptions']`)
3. Add `pdfExport: { request: { mutationOptions: (opts) => { capturedPdfExportRequestOptions = opts; return { /* mirror publish/reopen return shape */ }; } } }` inside the trpc mock object
4. If the test cases need to assert the input shape, add new test cases — but ONLY if existing cases were testing pdf export behavior. If the failures are purely about the mock surface (component crashes on render because `mutationOptions` is undefined), no new assertions are needed.

**Step 2.6 — Run the tests again (GREEN).**

```bash
cd /home/user/my/customreport && \
  pnpm --filter @customreport/web test -- weekly-report-page 2>&1 | tee /tmp/weekly-report-after.log
```

All tests in the file MUST pass. If any still fail, the mock shape is still wrong — iterate on shape, NOT on adding more behavioral mocks.

**Step 2.7 — Run the full web Vitest suite to catch regressions.**

```bash
cd /home/user/my/customreport && \
  pnpm --filter @customreport/web test 2>&1 | tee /tmp/web-vitest-full.log
```

Pass count MUST be >= the pre-change pass count. Capture the count for Task 3 SUMMARY.
</action>
<verify>
<automated>cd /home/user/my/customreport && pnpm --filter @customreport/web test -- weekly-report-page 2>&1 | grep -E "Tests.*passed|Test Files.*passed"</automated>
Output shows all tests passed, zero failed, in `weekly-report-page.test.tsx`.
</verify>
<done>

- 5 previously-failing tests in weekly-report-page.test.tsx now pass
- Full web Vitest suite: zero new failures vs. baseline
- Mock pattern mirrors existing `period.publish` / `period.reopen` mock convention (no new pattern invented)
- Only the test file changed (no production code edits)
  </done>
  </task>

<task type="auto">
  <name>Task 3: Regression typecheck + write SUMMARY</name>
  <files>.planning/quick/260426-vxp-v5-0-tech-debt-integration-suite-first-r/260426-vxp-SUMMARY.md</files>
  <action>
**Step 3.1 — Run regression gates.**
```bash
cd /home/user/my/customreport && \
  pnpm --filter @customreport/web typecheck 2>&1 | tee /tmp/web-typecheck.log
cd /home/user/my/customreport && \
  pnpm --filter @customreport/api typecheck 2>&1 | tee /tmp/api-typecheck.log
```
Both MUST exit 0. If either fails, the change introduced a type regression — fix before continuing (and the fix likely belongs in Task 2's mock, not in production code).

**Step 3.2 — Write the SUMMARY.**
Use the GSD summary template structure. The SUMMARY MUST include:

1. **Header**: quick_id, date, status (`done` or `partial`), files_modified
2. **What shipped**: 1–2 sentences naming the two HANDOFF items closed
3. **Integration suite first-run results** (from Task 1):
   - Total tests / passed / failed / skipped
   - List of failing tests (file + name) with one-line classification: `infra-blocker` | `assertion-mismatch` | `flaky-suspect`
   - Whether `customreport_e2e` DB was created or pre-existing
4. **weekly-report-page.test.tsx fix** (from Task 2):
   - Before: 5 failed
   - After: 0 failed
   - Lines added (count) — don't paste the diff, just the magnitude
   - Mock pattern: "mirrors existing period.publish/reopen pattern at lines 95/105"
5. **Regression evidence** (from Task 3):
   - web typecheck: pass
   - api typecheck: pass
   - web full Vitest: X passed / 0 failed
6. **Out of scope (still tech_debt after this task)**:
   - HANDOFF #2 (Phase 22 manual UI smoke — 4 items)
   - HANDOFF #3 (Phase 23 PDF download manual smoke)
   - HANDOFF #5 (Phase 24 cookie injection — deferred to v6.0+)
7. **Recommended next steps**:
   - If integration suite had only infra blockers fixed in Task 1, milestone status can move from `tech_debt` to `runtime-verified` for the automated portion
   - If integration suite had assertion-level failures, surface them as v6.0 backlog items
   - Manual UI smoke remains a release-day checklist item

**Step 3.3 — Update HANDOFF.md tech debt list (optional but encouraged).**
Cross out HANDOFF.md items #1 and #4 with a note like:

```
### 1. Phase 26 integration suite — never executed   [CLOSED 2026-04-26 — see .planning/quick/260426-vxp-.../260426-vxp-SUMMARY.md]
### 4. weekly-report-page.test.tsx (5 failing tests) [CLOSED 2026-04-26 — see same SUMMARY]
```

This keeps the handoff document accurate for the next session. Use Edit tool. If integration suite had unresolved assertion failures, mark #1 as `[PARTIAL]` instead of `[CLOSED]` and link the SUMMARY's failure list.
</action>
<verify>
<automated>test -f /home/user/my/customreport/.planning/quick/260426-vxp-v5-0-tech-debt-integration-suite-first-r/260426-vxp-SUMMARY.md && wc -l /home/user/my/customreport/.planning/quick/260426-vxp-v5-0-tech-debt-integration-suite-first-r/260426-vxp-SUMMARY.md | awk '$1 >= 30 { print "ok" }'</automated>
Prints `ok` (SUMMARY exists and has >= 30 lines).
</verify>
<done>

- web typecheck and api typecheck both exit 0
- 260426-vxp-SUMMARY.md exists and contains the seven sections above
- HANDOFF.md items #1 and #4 are marked [CLOSED] or [PARTIAL] (with SUMMARY link)
- All evidence (pass/fail counts, regression status, scope boundary) is in the SUMMARY — no need to dig through tmp logs
  </done>
  </task>

</tasks>

<verification>
After all 3 tasks complete:

1. `customreport_e2e` DB exists in the docker postgres container
2. `.env.test` contains the `E2E_DATABASE_URL=...` line (uncommitted)
3. `apps/web/src/components/weekly-report/weekly-report-page.test.tsx` has the new pdfExport mock and all its tests pass
4. `pnpm --filter @customreport/web typecheck` exits 0
5. `pnpm --filter @customreport/api typecheck` exits 0
6. `pnpm --filter @customreport/web test` shows zero failures
7. `260426-vxp-SUMMARY.md` exists with the seven required sections including integration-suite first-run results
8. HANDOFF.md items #1 and #4 are annotated as closed/partial
   </verification>

<success_criteria>

- Two of the four automatable HANDOFF tech-debt items closed with evidence
- Integration suite has executed at least once (the "first-run" promise of HANDOFF #1) — pass-rate is observed, not optimized
- weekly-report-page.test.tsx Vitest suite is fully green
- No type or test regressions introduced
- v5.0 milestone is now closer to "fully verified" — only manual-UI-smoke items remain in the tech debt list, and those are appropriate to leave for a release-day checklist
- Concrete next-session decisions are clear from SUMMARY: which integration tests (if any) need v6.0 follow-up, and which milestone status update applies
  </success_criteria>

<output>
After completion, the SUMMARY at `.planning/quick/260426-vxp-v5-0-tech-debt-integration-suite-first-r/260426-vxp-SUMMARY.md` is the single source of truth for this task's outcome. Anyone reading it (including the user three weeks from now) should be able to:
- See whether integration suite first-run was clean or had failures (with classification)
- Confirm the Vitest mock fix is real and minimal
- Know what tech debt remains and why (manual smoke = appropriate to defer)
- Know whether v5.0 milestone status can be promoted from `tech_debt` to `runtime-verified`
</output>
