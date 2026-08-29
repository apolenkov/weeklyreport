## Context

See `proposal.md` for motivation. The current tree has a complete core journey and strong unit/mechanical gates, but acceptance is split across source-only checks, six unfinished mobile changes, integration suites excluded from CI, and stale repository evidence. The implementation must preserve the period dual-state invariant, canonical role middleware chains, exact destructive-database guard, and visible deferred-feature pattern.

Current write flow:

```text
request -> service pre-read -> decision -> later Prisma write
                         ^ race window ^
```

Target write flow:

```text
request -> validated command -> database-enforced predicate/constraint
                              -> one commit or typed conflict
                              -> audit/side effects only after winner
```

## Goals / Non-Goals

**Goals:**

- Close every confirmed repository-owned product, data-integrity, fast-test, mobile, and operations gap in dependency order.
- Produce current, exact-SHA evidence with no fake coverage, skipped required dependency, stale catalogue, or browser result from another tree.
- Leave Git and local runtime clean after a reviewed commit is pushed to `main` and CI reads back green.

**Non-Goals:**

- No standing E2E/UAT/browser/catalogue/campaign platform.
- No unrelated deferred feature implementation and no restoration of archived drivers.
- No claim that local repository work creates external alert receivers, off-host storage, branch protection, or release-governance evidence.

## Decisions

### 1. Put concurrency invariants at the database boundary

An append-only PostgreSQL migration will add a partial range-overlap exclusion constraint for editable live (`scheduled`/`open`) periods after a preflight proves those rows are valid. Published and archived rows remain outside the constraint because republish history is a durable analytics contract. Every period writer that can hit the constraint will map its database error to `AdminPeriodOverlapError`. This is preferred to a service pre-read or process mutex because it protects multiple API instances and scheduler/manual races.

Published/archived report deletion will use one guarded delete predicate; a zero-row result is read back only to map the outcome. Revoke will include the parent report lifecycle relation in its write predicate. Carry-over will lock and re-read the target section before creating execution or child rows. Side effects and success logs occur only after the winning commit.

The existing dual-state transition builder remains the single owner of lifecycle tuple writes. A real-database rollback test will satisfy the existing dual-state contract. The period-module repair imports the owner of `APP_LOGGER` and gains a composition test that resolves the actual providers, not only metadata.

### 2. Keep product fixes narrow and shared

Compiled history will distinguish lead-specific draft entries from compiled published/archived entries before rendering submission copy. PDF delivery will stay in the current page: after a completed job it attempts the same-origin attachment download and always exposes the durable fallback link. It never opens a temporary browser tab.

Compact control geometry will be repaired in the shared segmented toggle and the two action owners. Responsive minimums apply only below 48 rem; the admin users table remains an intentional contained horizontal scroller. Existing six mobile changes share the final browser pass so global touch/overflow evidence cannot disagree across changes.

### 3. Separate fast unit, required integration, and coverage evidence

`pnpm test` remains the quick unit lane. CI gains a serial API integration job with disposable PostgreSQL, Redis DB 15, and Mailpit; required SMTP tests fail instead of skipping. API and Web gain explicit coverage commands/jobs with non-empty summaries and current thresholds. Coverage exclusions and thresholds are not changed merely to obtain green.

Every Node 26 image and Actions job installs the package-manager version pinned by `packageManager` explicitly because Node 26 does not provide `corepack`. The existing runtime-sync gate owns both the Node-major and pnpm-version declarations. The obsolete Playwright-base-image sync contract is retired because the API image now installs Chromium through its resolved production `playwright` dependency.

No Playwright test dependency or browser suite is introduced. Production PDF generation keeps its existing browser runtime.

### 4. Treat the tracked-file registry as disposable evidence

A temporary TypeScript classifier will join `git ls-files` to role, owner, lens, verdict, and evidence records. Bounded independent review packets may adjudicate cohorts, but a fresh second read-only pass must reconcile every path and all totals. Only curated conclusions and current documentation changes enter Git; the 4,374-row baseline/final registries and raw browser logs go to the external archive. The temporary generator is deleted after use.

Historical OpenSpec archives remain provenance. Current specs receive a complete KEEP/UPDATE/RETIRE disposition; semantic retirements and wording changes land through a separate, focused OpenSpec change rather than direct untracked edits during this change.

### 5. Make repository-owned operations internally truthful

Development docs will choose one application owner: observability infrastructure plus source apps, or the full Compose stack, never both. Production runbooks will enumerate every required Compose variable and be checked by `docker compose config`. Backup cadence/retention validate before loops; post-update hooks propagate failures; Mailpit/Grafana/metrics/staging documentation matches real service and route ownership.

Browser telemetry will use a same-origin tunnel so the enforced `connect-src 'self'` policy remains closed while configured error delivery works. A repository check will prove the tunnel/config/CSP relationship. External receiver delivery and off-host recovery remain separate read-back prerequisites.

### 6. Converge acceptance on one immutable candidate

Implementation proceeds product/data -> UI/mobile -> fast tests/CI -> operations/docs/spec disposition. After the candidate commit, all local gates, strict OpenSpec validation, one-off browser checks, the complete file registry, and an independent read-only review are rerun on that SHA. Any source edit invalidates downstream evidence. Only then is the commit pushed to `main`; remote SHA and CI are read back before cleanup.

## Risks / Trade-offs

- **Existing overlapping periods block the exclusion migration** -> run a read-only preflight and resolve only proven disposable/demo conflicts; never silently rewrite unknown data.
- **Constraint errors differ from Prisma unique errors** -> map by named database constraint and prove the public typed error with real PostgreSQL races.
- **Automatic attachment download can be suppressed by browser policy** -> keep the visible download link after every completed job and test that no popup is created.
- **Coverage lanes can expose substantial latent debt** -> fix tests/source or make a separately justified scope decision; do not lower thresholds inside the implementation batch.
- **Complete per-file review can become a campaign product** -> keep sharding scripts and raw registries outside Git and delete temporary execution material after the independent reconciliation.
- **External production readiness cannot be completed locally** -> report repository PASS and external BLOCKED independently, with no decorative workflow or placeholder receiver.

## Migration Plan

1. Add focused regression tests, then land atomic API writers and the append-only overlap constraint after preflight.
2. Land web/mobile fixes and focused accessibility/interaction tests.
3. Add required integration and coverage commands/jobs; make dependency absence fail closed.
4. Repair repository-owned operations/config/docs and generate the tracked-file/spec dispositions.
5. Complete and archive the six mobile changes; create the focused semantic spec-retirement change from the proven disposition set.
6. Create the candidate commit, rerun exact-SHA local gates/browser/review, push to `main`, read back CI, then remove temporary processes, containers started for the run, caches, and external scratch data.

Rollback uses an ordinary code revert. A database constraint rollback, if ever required, is a new reviewed forward migration; committed migration history is never rewritten.
