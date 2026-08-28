# E2E verification

WeeklyReport uses focused E2E suites plus one deliberately small browser
acceptance contour. The suites share generic helpers where the contract is
identical; browser acceptance does not duplicate the product test matrix.

| Layer               | Command                       | Purpose                                                   |
| ------------------- | ----------------------------- | --------------------------------------------------------- |
| Integration         | `pnpm test:e2e:integration`   | Deterministic business and cross-role behavior            |
| Seed profiles       | `pnpm test:e2e:seed-profiles` | Minimal, demo, full, and stress seed viability            |
| Route health        | `pnpm test:uat`               | Role routes, console, page, network, HTTP, and axe checks |
| Lifecycle smoke     | `pnpm test:acceptance:smoke`  | One lead write -> head publish -> viewer read lifecycle   |
| Combined acceptance | `pnpm test:acceptance`        | Route health plus the same lifecycle smoke                |

Production-build and CSP verification remain separate:

```bash
pnpm test:e2e:prodbuild
pnpm test:e2e:csp
```

## Layout

```text
e2e/
+-- acceptance/       route health and one representative lifecycle smoke
+-- integration/      isolated deterministic journeys and global setup
+-- seed-profiles/    checked-in profile smoke verification
+-- catalog/          canonical role route/intent YAML
+-- sweep/            catalog parser and reusable route helpers
+-- helpers/          reusable database, Redis, navigation, and seed boundaries
+-- csp/              production CSP policy checks
```

## Safety boundary

Every destructive E2E run requires an explicit `E2E_DATABASE_URL` that differs
from `DATABASE_URL`. The guard accepts only loopback PostgreSQL URLs whose raw
path is exactly the legacy technical identifier `customreport_e2e` or
`customreport_e2e_lane_[a-o]_test`; encoded, case-folded, whitespace, query,
fragment, and multi-segment aliases are rejected.

Immediately before each reset, seed, cleanup, or Redis flush, pass the exact
per-run consent:

```bash
PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION='давай'
```

No command may use `DATABASE_URL`, production, shared, or unknown data as a
destructive target. Playwright owns only its API/web processes and temporary
outputs; it does not create or delete Docker containers or volumes.

## Acceptance scope

The acceptance contour is smoke-only:

- route health authenticates the four canonical roles and visits their catalog
  routes while collecting HTTP, console, page, network, and axe failures;
- the lifecycle smoke proves one real write, publication, and downstream
  read-back across lead, head, and viewer, with a basic admin landing check;
- PDF, revoke, configuration, action log, detailed authorization, ordering, and
  edge cases remain in focused unit, integration, seed-profile,
  production-build, or CSP suites.

Acceptance starts from deterministic seed state and never resumes a previous
run. Standard Playwright reports and failure traces are sufficient evidence;
there are no campaign ledgers, lane runners, continuation checkpoints, AI
imports, or exhaustive interaction graphs.
