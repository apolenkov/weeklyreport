# AI UI Driver (behavioral-ui-regression-gate task 3.1)

The **Driver** is the AI-agent sibling of the automated catalog sweep
(`e2e/sweep/catalog-sweep.spec.ts`). Where the sweep is a Layer-1 check (every
route loads + axe + console), the Driver explores *within-route flow and logic*
— it interacts with the page and compares what it observes against the
documented intent in the Scenario Catalog (`e2e/catalog/<role>.yaml`). It finds
the flow/logic bugs the sweep cannot, by design.

It runs in **two phases**, deliberately kept low-overhead (one shared browser →
the drive is sequential; only verification fans out):

## Phase 1 — Drive (one agent per role, sequential)

A single agent drives a real browser through the **Playwright MCP** server. It
is **not** a parallel fan-out: there is one shared browser instance, so each
role is driven sequentially, and routes within a role are walked in order.

Prerequisites (the Driver does not boot these — start them first, with the
sweep's env so dev-only widgets and proxy noise stay out):

```bash
# API (port 3101)
cd apps/api && PORT=3101 AUTH_DEV_MODE=true NODE_ENV=test \
  FRONTEND_URL=http://127.0.0.1:3100 LOG_DIR=.logs/driver \
  node --env-file=../../.env --import @swc-node/register/esm-register src/main.ts &

# Web (port 3100) — NEXT_PUBLIC_DISABLE_DEVTOOLS keeps the Agentation widget out
NEXT_PUBLIC_API_URL=http://127.0.0.1:3101 AUTH_DEV_MODE=true NODE_ENV=test \
  NEXT_PUBLIC_AUTH_STUB=true NEXT_PUBLIC_DISABLE_DEVTOOLS=true \
  NEXT_DIST_DIR=.next-sweep \
  pnpm --filter @customreport/web exec next dev -p 3100 &
```

Loopback proxy note: if the machine sets `HTTP_PROXY` without `127.0.0.1` in
`NO_PROXY`, plain `fetch`/`curl` to the app may 502 — the Playwright-MCP
Chromium is unaffected (it does not use the env proxy), but see
`e2e/no-proxy-localhost.ts` for the sweep's fix.

Drive protocol (the agent prompt), parametric in `<role>`:

- Log in: navigate to
  `http://127.0.0.1:3100/auth/dev-login?role=<role>&email=<seeded-email>&redirect=<role-landing>`.
  Seeded emails: `lead1@`, `head@`, `admin@`, `viewer@customreport.local`.
- **Oracle:** read `e2e/catalog/<role>.yaml`. Each intent's `then`/`note` is the
  expected behavior. An anomaly is real ONLY when the observation *contradicts*
  the documented `then`, or there is a console error / pageerror / failed nav /
  infinite skeleton / layout break. Behavior that matches `then` is not an
  anomaly — never report "works as expected".
- Walk each route in order: navigate, settle, read console errors, snapshot
  (shallow), and exercise the intents that can be observed **without
  irreversible actions** (no publish / permanent delete / irrevocable mutation —
  record those as `coverageNotes` instead).
- **Canary (proof-of-life, task 3.4):** exactly once, inject
  `console.error('DRIVER_CANARY_42')` via `browser_evaluate` and confirm the
  console capture detects it. `canary.detected=false` means the Driver is
  blind — its empty findings cannot be trusted (the Monitor "silence is not
  success" principle).
- Emit compact candidate anomalies (route, intentId, kind, observed, expected,
  evidence, severity) — **never paste full snapshots**.

The verbatim, parametric prompt lives in `drive-prompt.md` (this directory) with
a per-role substitution table — copy it and swap `<ROLE>`, the seeded email, and
the landing route to drive another role.

## Phase 2 — Verify (adversarial fan-out)

Raw driver output is a known false-positive factory (the 621→10 sweep lesson),
so every candidate is judged by an **independent, code-reading skeptic** that
tries to *refute* it and defaults to "not a bug" when the source does not prove a
defect. This is where parallelism helps (no browser needed), so it is a
Workflow:

```
Workflow({ scriptPath: "openspec/changes/behavioral-ui-regression-gate/workflow/lead-driver-verify.workflow.mjs",
           args: { candidates: [ ...phase-1 output... ] } })
```

Each verifier returns `{ isReal, confidence, classification, rootCause,
reasoning, suggestedFix }`. Only `isReal` findings reach the report.

## Output

A per-role report in the sweep's shape — `e2e/sweep/.reports/<role>-driver.md`
(role · route · anomaly), listing only verified-real findings plus the canary
result and coverage notes. Report-only; never fails CI (Layer-1/2 gating is the
sweep's job, not the Driver's).
