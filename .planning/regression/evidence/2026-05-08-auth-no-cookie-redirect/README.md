# Auth No-Cookie Redirect Evidence - 2026-05-08

Purpose: close the manual UAT bug where opening a protected page without a
browser session could render the app shell and hang on dashboard skeletons.

## Rule

```text
No customreport_session cookie:
  protected route -> /?next=<original path>

Dev stub mode:
  login page may show dev users
  protected routes still require explicit browser cookie
```

## Change

```text
apps/web/src/proxy.ts
  removed NEXT_PUBLIC_AUTH_STUB protected-route bypass
  kept cookie-shape gate for /lead, /head, /reports, /admin
```

## Regression

```text
apps/web/proxy.test.ts
  redirects no-cookie protected pages even when NEXT_PUBLIC_AUTH_STUB=true
  preserves ?next=<path>
  passes through with JWT-shaped customreport_session
```

## Commands

```bash
rtk proxy pnpm --filter @customreport/web test -- proxy.test.ts trpc.test.ts
rtk proxy pnpm --filter @customreport/web typecheck
rtk proxy pnpm --filter @customreport/web lint
rtk proxy bash -lc 'set -a; source .env.test; set +a; \
  pnpm --filter @customreport/web exec playwright test \
  --config=playwright.integration.config.ts \
  e2e/integration/auth-guards.integration.spec.ts'
rtk git diff --check
```

Result:

```text
PASS
web test: 35 files, 284 tests
web typecheck: PASS
web lint: PASS
Playwright auth guards: 3 passed
diff check: PASS
```

## Live Browser

```text
PASS
Dedicated integration stack:
  api: 127.0.0.1:3102
  web: 127.0.0.1:3105
  db: customreport_e2e

Scenarios:
  unauthenticated /lead/report redirects to /?next=...
  clearing cookie redirects on next navigation
  invalid dev-login role returns 400
```
