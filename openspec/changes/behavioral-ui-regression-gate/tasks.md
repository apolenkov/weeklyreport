# Tasks

Gates after every code step: `pnpm typecheck && pnpm lint && pnpm test`.

> **Session status (2026-06-07).** All four role catalogs
> (`lead`/`viewer`/`head`/`admin`) landed; harness built AND **run live**. The
> dev-env `node_modules` (broken earlier) was rebuilt; gates GREEN (`pnpm
typecheck`, `pnpm lint`, `pnpm test`). The automated Layer-1 sweep ran live —
> `pnpm test:uat` → `4 passed (1.6m)` against docker Postgres+Redis + the seeded
> dev DB, reports in `e2e/sweep/.reports/` (~621 anomalies: real a11y + a real
> duplicate-`key` warning + env noise). Old e2e harness removed (4.1) and gates
> re-confirmed green (4.2). Remaining: 3.1 the AI **agent** Driver (the automated
> sweep is its non-AI sibling), the injected-canary check, anomaly triage + a
> console noise filter, and a commit (everything is uncommitted on `main`).
>
> NOTE (latent, not gate-blocking): the e2e suite is **eslint-ignored AND not
> typechecked by any gate** (it cannot resolve apps/web deps from the repo
> root). So the green `pnpm lint`/`typecheck` confirm the rest of the repo, not
> the e2e/sweep code. The harness was validated the way the project actually
> exercises e2e: `playwright test --list` (transpile + module-graph resolve +
> catalog parse → 4 tests) and `node --check` on the `.mjs` scripts (the
> generator validated by wrapping its body as a workflow function, since its
> top-level `return`/`await` are legal only inside the Workflow runtime).
> `e2e/tsconfig.json` gained `ignoreDeprecations: "6.0"` (cosmetic).

## 1. Generate the durable `lead` Scenario Catalog

- [x] 1.1 Decide the home/naming (`e2e/catalog/<role>.yaml`) and add a short
      `e2e/catalog/README.md`: behavior-anchored, `role · route · intent` +
      Given/When/Then prose, no `file:line`, durable high-level (not exhaustive),
      generated + human-reviewed. Includes a worked-example format contract and
      the verified `lead` route denominator (from the SSR layout guards).
- [x] 1.2 Generator written:
      `openspec/changes/behavioral-ui-regression-gate/workflow/generate-catalog.workflow.mjs`.
      Code-reading (not live-DOM — that's the Driver), self-discovers the role's
      reachable routes from the SSR layout guards, fans out per route (Haiku),
      emits the YAML `role x route x intent` skeleton with NO `file:line`, and
      runs an entry-point completeness critic + coverage matrix. The parked
      backend+`file:line` generator was rejected as the base (rewrite, not
      retarget); the parked `ux-catalog` live-DOM script seeds the Driver (task 3).
- [x] 1.3 Run the Haiku fan-out for the `lead` surface (one agent per route, each
      navigating large files to their action surface — tRPC mutation call-sites +
      action components — not reading linearly) → draft `lead` catalog. Done
      2026-06-04: `e2e/catalog/lead.yaml` (10 routes, 41 intents).
- [x] 1.4 Run the **entry-point** completeness-critic + coverage matrix (every
      `role × route` has ≥1 intent scenario — NOT per-element) with its bounded
      repair loop; human-review the generated diff for behavior-only anchoring (no
      `file:line`, no implementation detail) and any uncovered role/route. NOTE:
      route-set completeness rests on this human review, not the critic — the
      critic only checks intents-per-route, not that Discover found every route.
      Done 2026-06-04: review caught 3 defects the critic could not (2 dropped
      routes, a 5-way id collision, 2 out-of-role intents) — all fixed; see
      `e2e/catalog/_lead-coverage.md`.
- [x] 1.4b Harden the generator from the 1.4 findings (so the misses do not recur
      on `head`/`admin`/`viewer`): a mechanical `find page.tsx` CENSUS denominator
      that Discover must fully account for (route-or-excluded-with-reason, asserted
      in-script before extract), plus a deterministic id-uniqueness assert gating
      the repair loop. Done 2026-06-04 in `generate-catalog.workflow.mjs`.
- [ ] 1.5 Fold in the `ok` rows from the archived `feedback-log.md` that the
      generator missed; dedup. The feedback-log stays the quick manual-UAT intake.

## 2. Restore the sweep harness (no re-derivation)

- [x] 2.1 Restore `dev-auth` (per-role login) from git history into the
      regenerated harness; confirm `lead`/`head`/`admin`/`viewer` login works.
      Done 2026-06-07: `dev-auth.ts` was still in the tree under
      `e2e/regression/helpers/` (a dir slated for removal in 4.1), so it was
      `git mv`d to `e2e/sweep/helpers/dev-auth.ts` (relocate, not re-derive;
      repo-root depth preserved so `seedAdvancedViaCli` still resolves). NOTE:
      live per-role login still to be confirmed against the running app.
- [x] 2.2 Add a fresh `playwright.config.ts` for the UI sweep and wire
      `pnpm test:uat`; reuse `@axe-core/playwright`. Done 2026-06-07:
      `e2e/sweep/playwright.config.ts` (API+web in dev-auth, ports 3100/3101 —
      distinct from integration 3102/3105, isolated `.next-sweep` distDir) +
      `e2e/sweep/catalog-sweep.spec.ts` (Layer-1 entry-point sweep: per role
      dev-login → walk catalog routes → console/pageerror/load + axe → per-role
      Markdown report; report-only, never fails CI). `[reportId]` resolved
      deterministically from seed-constants (viewer/`/reports/*`→published,
      `/lead/*`→active). `pnpm test:uat` wired. RAN LIVE 2026-06-07: `4 passed
(1.6m)` against a docker Postgres+Redis and the seeded dev DB; the config's
      own web+API booted; all 4 role reports written to `e2e/sweep/.reports/`.
      Found ~621 anomalies (lead 117, viewer 65, head 198, admin 241): real a11y
      violations (button-name/label critical, color-contrast, nested-interactive) + a real React duplicate-`key` warning + env noise (telemetry
      ERR_CONNECTION_REFUSED, recharts headless width(-1)). Triage + a noise
      filter are follow-ups.
- [x] 2.3 Confirm `e2e/integration/*` + `playwright.integration.config.ts` and
      all vitest unit tests are untouched and still run. Done 2026-06-07: the
      sweep is a separate dir/config on its own ports; the 4.1 removal kept
      integration + unit; `pnpm typecheck` and `pnpm lint` green after removal.

## 3. Build the Driver (human + AI agent)

- [x] 3.1 Author the AI-agent Driver: a Workflow where one agent per role reads
      the catalog, drives the browser via the **Playwright MCP** through
      `dev-auth`, explores each route's elements/transitions at run time, and
      records anomalies (console errors, broken flow vs expected, layout, axe).
      Done 2026-06-07, scoped to `lead`. Two-phase, low-overhead (one shared MCP
      browser → drive is sequential, only verify fans out):
      `e2e/sweep/driver/README.md` + `drive-prompt.md` (parametric drive
      protocol) and `workflow/lead-driver-verify.workflow.mjs` (adversarial
      code-reading verify). Drove all 10 `lead` routes (171 MCP tool-uses);
      verify confirmed 2 of 4 candidates real, dismissed 2 as seed artifacts.
      Report (generated, gitignored): `e2e/sweep/.reports/lead-driver.md`. The
      "one agent per role" fan-out across head/admin/viewer is deferred (reuse
      the same drive-prompt + verify workflow) — reopen when those roles are
      scoped.
- [x] 3.2 Add the human-Driver mode: render the same catalog as a per-role
      checklist for manual UAT, collecting pass/fail + notes in the same report
      shape. Done 2026-06-07: `e2e/sweep/render-checklist.mjs` (pure Node, no
      deps) reads every `e2e/catalog/*.yaml` and emits
      `e2e/sweep/.reports/checklist-<role>.md` — per-route, per-intent
      Given/When/Then with a PASS/FAIL + notes line. Verified with `node` on the
      landed catalogs.
- [x] 3.3 Define the per-role **report** format (role · route · anomaly), and
      confirm it is non-blocking (produces a report, does not fail CI). Done
      2026-06-07: both Driver modes share the role · route · anomaly shape — the
      automated sweep writes `e2e/sweep/.reports/<role>.md`. Report-only: no
      `expect()`, and navigation, axe, AND dev-auth login are each wrapped so a
      failure becomes a recorded anomaly (a broken login lands as a role-level
      `(dev-auth login)` anomaly) instead of a thrown test — a report is always
      written. Console classification mirrors `final-gates-resweep` (errors
      counted, favicon 404 ignored).
- [x] 3.4 Run the `lead` sweep under the agent Driver; confirm a deliberately
      broken route (failed load / injected console error) shows up in the report.
      Done 2026-06-07: the AI Driver drove all 10 `lead` routes live via
      Playwright MCP. The injected-canary check passed — the drive agent injected
      `console.error('DRIVER_CANARY_42')` via `browser_evaluate` and its
      console-capture re-read detected it (`canary.detected=true`), proving the
      capture path is live (an empty finding list is trustworthy, not silent
      failure). The Driver surfaced 2 real flow/logic bugs the Layer-1 sweep
      cannot see (see 3.1): (a) `search-input.tsx` routes `project` search hits to
      role-gated `/admin`, dead-ending a lead; (b) `lead-form.tsx` suppresses the
      legacy `?period=` read-only banner when the section is submitted. Both
      adversarially code-verified (high confidence); 2 other candidates were
      dismissed as seed artifacts.
- [x] 3.4b (implicit) Automated sweep proven to capture real anomalies live —
      see 2.2 run notes.
- [x] 3.5 Disposition of the 2 Driver-confirmed `lead` bugs: - **FIXED** — search `project`-hit dead-end. `SearchService` now drops
      `project` hits for lead sessions (no product destination → would land on
      the role-gated `/admin`). Tests added; verified live (lead "CRM" search
      returns only the actionable Task hit). Commit `fix(api): drop project
      search hits for leads`. - **DEFERRED (needs a product decision)** — `?period=` read-only banner.
      The adversarial verifier proposed a banner-only fix (drop the
      `!isSubmitted` gate on the legacy `?period=` path in
      `lead-form.tsx:1623`). On reading the data path, this is unsafe as-is:
      `targetReportId = pinnedReportId ?? activeReportId` (line 321) means
      `?period=<week>` NEVER resolves to that week's report — it loads the
      ACTIVE (current-week) report and only forces read-only. So showing
      "Viewing past period · 2026-W20" over current-week data would be a
      confident lie. The real question is what the legacy `?period=` bookmark
      should do (resolve+load the historical report, or just read-only the
      active report with an accurate banner). Low-traffic legacy path; left for
      the user to decide rather than baking a misleading symptom-fix. The
      Driver did its job: the bug is found, root-caused, and recorded.

## 4. Remove the old UI e2e harness

- [x] 4.1 Remove `e2e/auth.setup.ts`, `e2e/fixtures.ts`,
      `e2e/playwright.config.ts` (old), `e2e/regression/` (old), `e2e/helpers/`,
      `e2e/visual/`, and the `test:e2e` / `test:e2e:ui` scripts — superseded by
      the regenerated sweep. Keep integration + unit. Done 2026-06-07: all listed
      files `git rm`d (nothing imported them); removed `test:e2e`/`test:e2e:ui`
      from root and `visual:setup`/`visual:test`/`visual:update` from
      apps/web. TRADE-OFF: this drops the visual **screenshot** regression
      (Phase 39-06) — the sweep checks console + a11y, NOT pixel diffs. Recover
      via `git restore` if screenshot regression is wanted back.
- [x] 4.2 Confirm gates green and `pnpm test:uat` (lead) runs after removal. Done
      2026-06-07: `pnpm typecheck` + `pnpm lint` green; `pnpm test:uat` runs all
      4 roles green. Fixed a side effect: the sweep's `.next-sweep` distDir was
      being linted — added `**/.next-sweep/**` to `eslint.config.ts` ignores.

## 5. Extend to remaining roles + close out

- [ ] 5.1 Repeat 1+3 for `head`, then `admin`, then `viewer` (each lands
      separately, sweep reports per role). Catalog half (step 1) done
      autonomously 2026-06-07: all four roles now have catalogs — `lead` (10
      routes), `viewer` (6), `head` (15), `admin` (18) — `head`/`admin` generated
      and adversarially reviewed via the generator workflow. Six generation
      defects found and fixed (see `e2e/catalog/_generation-notes.md`): 3
      malformed route values + empty access (`viewer`/`head`/`admin`), a DOM
      selector leaked into an `admin` note, a vacuous `head` `then`, and 3
      hallucinated mutation intents on `head` `/reports/[reportId]/present` (a
      read-only view). The generator was hardened with a deterministic
      route-hygiene assert so the route defects can't silently recur. The Driver
      half (step 3, per-role sweep run) remains — needs the live app.
- [ ] 5.2 Document the loop in `e2e/catalog/README.md`: manual-UAT findings →
      feedback-log intake → graduate into the catalog → regenerate.
- [ ] 5.3 Record phase 2 (freeze critical paths into deterministic specs;
      consider MBT) as deferred-until-stabilization — do NOT build it here.
- [ ] 5.4 `openspec validate behavioral-ui-regression-gate --strict` green;
      archive.

## Out of scope (do NOT do here)

- [ ] 6.1 (NOTE, not a task) The `file:line` Coverage Catalog / drift gate stays
      deferred in `establish-scenario-catalog`. Do not reactivate it here.
- [ ] 6.2 (NOTE, not a task) The deterministic frozen gate and formal Model-Based
      Testing are phase 2, deferred until the product stabilizes.
