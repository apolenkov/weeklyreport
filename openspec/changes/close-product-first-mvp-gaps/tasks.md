## 1. Shared contracts and UI foundations

- [x] 1.1 Reconcile the compiled and lead-specific history entry model so submission state is representable without fabrication; verify shared/web typecheck and focused history-model tests pass.
- [x] 1.2 Make every compact `SegmentedToggle` action meet the 44 by 44 px floor while preserving desktop sizing; verify existing component semantics/class tests and `pnpm --filter @customreport/web typecheck` pass.
- [x] 1.3 Apply the same responsive floor to the dev role switcher and admin-user row actions, preserving dropdown labels and the contained table scroller; verify focused DOM tests cover every named action.

## 2. API integrity and composition

- [x] 2.1 Add a read-only overlap preflight and an append-only PostgreSQL range-exclusion migration; verify the migration accepts non-overlapping fixtures and rejects overlapping create/update races on an exact disposable lane database.
- [x] 2.2 Map the named overlap constraint in manual and scheduled period writers to `AdminPeriodOverlapError`, with side effects only after commit; verify focused repository tests and a real concurrent integration test pass.
- [x] 2.3 Replace report read-then-delete with one lifecycle-guarded atomic delete and typed zero-row mapping; verify draft, published, archived, publish-race, and delete/delete integration scenarios pass.
- [x] 2.4 Lock and re-read carry-over target sections inside the write transaction before execution/child writes; verify submitted-target and submit-vs-carry-over race tests leave no partial rows.
- [x] 2.5 Add `archived = false` and canonical open/reopened relation predicates to individual and bulk revoke writes; verify archive-vs-revoke and ordinary revoke integration tests pass.
- [x] 2.6 Complete the `PeriodModule` logger-provider import repair and replace metadata-only coverage with a real provider-resolution composition test; verify focused module tests and API typecheck pass.
- [x] 2.7 Add the required real-database dual-state rollback test without changing the transition owner; verify both lifecycle representations and governed fields remain at the prior tuple after rollback.

## 3. Web product fixes

- [x] 3.1 Stop compiled published/archived history cards from rendering `Submitted: Not submitted` while retaining the draft lead fallback; verify focused render tests cover both variants.
- [x] 3.2 Remove the temporary PDF popup flow; after completion attempt one current-page attachment download and retain a visible fallback link; verify interaction tests prove no tab opens, the attempt occurs once, and failure remains retryable.
- [x] 3.3 Run the focused web/UI unit suites for all six existing mobile changes plus the three newly repaired controls; verify every named control, focus semantic, and overflow class contract passes.

## 4. Required test and CI evidence

- [x] 4.1 Add a serial required API integration CI job with accepted disposable PostgreSQL, Redis DB 15, and Mailpit services; verify workflow/config tests prove the service variables and `--fileParallelism=false` invocation.
- [x] 4.2 Make SMTP integration tests fail when Mailpit is absent in the required lane while retaining any explicitly optional local mode; verify the required invocation executes tests rather than recording skips.
- [x] 4.3 Add explicit API and Web coverage commands/jobs with non-empty summary checks and unchanged thresholds/exclusions; verify both commands fail on an empty report and pass only when current floors are met.
- [x] 4.4 Prove the ordinary `pnpm test` lane still excludes database integration work and remains the fast unit contour; verify repository-test ownership and unit timing/output are current.
- [x] 4.5 Make the durable Markdown reference gate terminate on empty, punctuation-only, and nested inline-code spans; verify a planted regression case and the live tracked corpus both complete successfully.

## 5. Repository-owned operations

- [x] 5.1 Remove the documented double-start path between observability and source development; verify the quick-start service/port set has one API and one Web owner.
- [x] 5.2 Reconcile every required production Compose variable, including `API_URL`, with the first-deploy runbook; verify the documented example environment passes `docker compose config`.
- [x] 5.3 Validate backup cadence and retention as positive integers before loop/cleanup work; verify empty, zero, negative, and non-numeric regression cases exit non-zero without a hot loop.
- [x] 5.4 Make post-merge and post-rewrite hooks propagate install/generation failures; verify planted command failures produce a non-zero hook result.
- [x] 5.5 Reconcile Mailpit service naming, Grafana password guidance, internal-only metrics routing, Prometheus template ownership, and the staging Caddy selection path; verify operations config/documentation tests match the actual files and routes.
- [x] 5.6 Route configured browser telemetry through a same-origin tunnel compatible with the enforced CSP; verify a repository check plus one-off browser error delivery succeeds without widening `connect-src`.
- [x] 5.7 Record alert receivers, off-host encrypted backups, restore drills/RPO-RTO, platform protection, immutable artifacts, and release records as external read-back prerequisites; verify no local placeholder is reported as production PASS.
- [x] 5.8 Replace unavailable Node 26 `corepack` setup in every Actions job with the exact `packageManager` pnpm pin, extend the runtime-sync guard to cover those jobs, and retire the obsolete Playwright-base-image sync requirement; verify the guard and strict dependency spec pass.
- [x] 5.9 Replace the broken local seed quick-start with one guarded exact-target create/migrate/seed bootstrap; verify unsafe targets, missing consent, step failure, native docs, and Docker database consumers fail closed.

## 6. File accountability, cleanup, and OpenSpec

- [x] 6.1 Generate an external one-off registry for every current `git ls-files` path with role, owner, lens, verdict, and evidence; verify no missing/duplicate paths and cohort totals equal the exact tracked denominator.
- [x] 6.2 Adjudicate all delete candidates against live references, source-of-truth duties, manager ownership, and provenance, then remove only proven junk; verify `rg`, Knip, dependency-cruiser, directory architecture, and repository tests remain green.
- [x] 6.3 Refresh or retire stale exemplary baseline/final evidence so no old branch/SHA can establish completion; verify current structure checks report PROVEN on the candidate tree.
- [x] 6.4 Reconcile curated README/onboarding/SDLC/quality counts and mobile status wording with live commands; verify `docs/README.md`, `openspec list`, and strict spec indexes have no stale or missing current entries.
- [x] 6.5 Create and apply the focused semantic OpenSpec-retirement change from the proven 165-spec dispositions, preserving historical archives; verify all KEEP/UPDATE/RETIRE totals reconcile and strict validation passes.
- [x] 6.6 Re-run a fresh independent read-only registry/spec review from compact cohort summaries; verify every final verdict has evidence before claiming the repository is exemplary.
- [x] 6.7 Bind the package-command Web launcher to one exact executable-entrypoint identity; verify the catalogue keeps it on the product floor while planted nearby paths remain ordinary orphan candidates.

## 7. Mobile and product acceptance

- [x] 7.1 Run one disposable source-bound browser pass for lead, head, viewer, and admin at desktop, 375 px phone, Pixel-class phone, tablet, and landscape sizes; verify console/network logs, root/nested overflow, every scoped 44 px control, dialog focus return, history copy, and PDF-tab cleanup.
- [x] 7.2 Update the six active mobile change task lists only from candidate-SHA browser and gate evidence; verify all six reach zero unchecked tasks and pass `openspec validate <change> --strict`.
- [ ] 7.3 Sync/archive completed product-first and mobile changes in the supported OpenSpec workflow; verify `openspec list --json` reports zero non-deferred unchecked remainder and durable specs retain the accepted requirements.

## 8. Exact-SHA verification and delivery

- [ ] 8.1 Run `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm --filter @customreport/api test:integration`, explicit API/Web coverage commands, `pnpm build`, and `openspec validate --all --strict`; record each exact command, exit code, and candidate SHA.
- [ ] 8.2 Create the candidate commit on `main`, prove tracked/untracked Git cleanliness, then repeat any gate whose evidence predates the commit; verify all final evidence names the commit SHA.
- [ ] 8.3 Obtain a fresh independent read-only final-blob review and resolve every confirmed finding; verify a PASS verdict names the exact candidate SHA and causes a full affected-gate rerun after any edit.
- [ ] 8.4 Push the authorized candidate to `origin/main`, read back remote SHA and required GitHub Actions jobs, and verify remote `main`, CI, local HEAD, and all evidence identify one SHA.
- [ ] 8.5 Stop only processes/containers started for this work, remove temporary browser/catalogue caches and scratch files, preserve external curated evidence, and verify clean Git plus clean task-owned runtime state.
