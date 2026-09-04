# Acceptance evidence — 2026-09-04–05

Scoped acceptance is complete, with the unrelated repository failures below.
Evidence applies to the dirty local worktree, not a committed release SHA. No
commit or publication was performed; this is not a clean repository release.

## Verified

- Public web contract and unmodified component sync: 7/7 tests passed.
- Installed stock MCP against authenticated PostgreSQL adapter: 5/5 integration
  scenarios passed; existing deletion integration: 10/10 passed. Both suites
  use guarded disposable PostgreSQL and clean up only their own fixtures.
- Full `pnpm typecheck`: passed (6 tasks).
- Full `pnpm build`: passed (5 tasks), with isolated Next output subsequently
  moved outside the repository. Normal route types were regenerated.
- `pnpm spec:check`: 160/160 passed; this change validates strictly.
- Scoped ESLint for new contract tests/helper and shared schema: passed.
- Focused product-feedback suites: 55 API unit tests and 33 web tests passed.
- The 15 PostgreSQL integration scenarios passed again after adding an explicit
  `/status` assertion for PostgreSQL and disabled webhooks.
- Stylelint and runtime-version checks: passed.
- Chrome Lead created annotations with the stock 3.0.2 toolbar. Safari Admin
  displayed their server-derived author and deleted only these owned fixtures
  after the user confirmed. Active-stream deletion cleared the Chrome marker
  without reload. Deletion while away, followed by reload, did not recreate it.
- Back-navigation exposed a stale-marker case. The wrapper now remounts the
  public component on cached `pageshow`; its regression test passes. A repeat
  on `/reports` created the `2026-09-05 history restore` fixture, navigated Chrome
  to `about:blank`, deleted it in Safari, and returned to a connected Chrome
  toolbar without the marker. All five owned browser fixtures were deleted.
- Post-fix web product-feedback tests: 34/34 passed. Scoped widget ESLint passed.
- Final PostgreSQL rerun: 15/15 passed after the test harness switched from a
  nested package-manager invocation to the installed public `agentation-mcp`
  executable. MCP connection initialization has a four-second deadline so a
  stalled child can enter fixture cleanup before the suite hook deadline.

## Failures outside Agentation

- Full unit run: `carry-over-row-writes.test.ts` failed the cleared pause and
  next-step fields assertion. Do not change that parallel report work here.
- Full ESLint: export ordering in `features/report-sections/index.ts`.
- Full formatting: eight report/carry-over files plus this change's design
  initially failed; the design was subsequently formatted locally.
- Repository cleanliness: untracked parallel report/carry-over files.
- Live report loading: Prisma P2022, absent `t38.nextStepText` column. No
  migration, reset or seed was applied to work around this unrelated mismatch.
- Later web typecheck found missing `canResolve`/`canRestore` properties in
  `status-overview.test.tsx`, outside feedback. API watch restarts from parallel
  report edits caused transient browser disconnects and a failed first delete;
  a retry after recovery succeeded.
- Final root build completed four tasks, then nested pnpm failed before starting
  the web build (`Cannot set property message ... only a getter`, pnpm retry
  operation). A separate invocation of the same web build command is recorded
  independently, not as a passed root build.
- The separate web build reached webpack and failed in the parallel report
  module `use-inline-edit-unload-guard.ts`: `useEffect` is imported through a
  server-component chain without a client boundary. No Agentation file appears
  in that failing import chain. The earlier full build passed; it is not
  evidence that the latest parallel worktree builds.

## Closeout audit

- Upstream mechanisms and retained exceptions: `upstream-analysis.md` and the
  requirement/evidence matrix in `design.md`. Stock client and MCP remain in
  use; no supported PostgreSQL/auth injection was found. No forced storage or
  permission change was made to reduce adapter size.
- Public upgrade contracts replace compiled bundle-text assertions. The native
  browser tests execute installed package code; MCP scenarios invoke its public
  executable. Existing repository patches do not target Agentation packages.
- Server identity, roles/groups, immutable ownership, create retries, statuses,
  threads, action events, toolbar dismissal, administrative deletion, and scoped
  SSE replay have the named unit/integration evidence in the design matrix.
- Browser create/read, active deletion and return after deletion were observed
  with Chrome Lead and Safari Admin, using only owned disposable feedback.
- Dependency-update commands, installed exports/bin mapping, exact pins and
  required checks are documented. No claim is made about unknown future versions.
- Gates were run and separated from concurrent report failures. Build outputs
  were moved outside the repository and normal route types regenerated. Three
  owned fixture users left by the timed-out MCP setup were explicitly identified
  and removed from the guarded disposable DB; no reset or seed was used.
- Independent reviewer returned no verdict because its service usage limit was
  exhausted. The primary agent performed the source/test audit; independent
  approval is not claimed.

Logs for this run are outside the repository at
`/tmp/weeklyreport-agentation-acceptance.GnmDau`.
