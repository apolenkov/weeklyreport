# AI UI Driver (behavioral-ui-regression-gate task 3.1)

The **Driver** is the AI-agent sibling of the automated catalog sweep
(`e2e/sweep/catalog-sweep.spec.ts`). Where the sweep is a Layer-1 check (every
route loads + axe + console), the Driver explores _within-route flow and logic_
— it interacts with the page and compares what it observes against the
documented intent in the Scenario Catalog (`e2e/catalog/<role>.yaml`). It finds
the flow/logic bugs the sweep cannot, by design.

It runs in **four phases** (drive → environment feedback → verify → output),
deliberately kept low-overhead (one shared browser → the drive is sequential;
only verification fans out):

The installed compatible setup is OpenCode `1.18.11` plus
`@playwright/mcp@0.0.78`. Start exactly one shared server before a drive:

```bash
npx -y @playwright/mcp@0.0.78 \
  --browser chromium \
  --headless --isolated --shared-browser-context \
  --viewport-size 1440x900 --port 8931 --host localhost
opencode mcp list # must show: playwright connected
```

OpenCode configuration points `mcp.playwright` at
`http://localhost:8931/mcp`. Codex launches one role/profile session at a time
with `opencode run --model opencode-go/gpt-5.6-luna --variant max --format json`
and resumes the recorded session id until a `final_answer` event exists.

## Phase 1 — Drive (one Luna Max session per role/profile, sequential)

A single agent drives a real browser through the **Playwright MCP** server. It
is **not** a parallel fan-out: there is one shared browser instance, so each
role is driven sequentially, and routes within a role are walked in order.

Prerequisites (the Driver does not boot these — start them first, with the
sweep's env so dev-only widgets and proxy noise stay out):

```bash
# Use a disposable database only; do not inherit a development DATABASE_URL.
export E2E_DATABASE_URL='postgresql://localhost/customreport_e2e_test'
export DATABASE_URL="$E2E_DATABASE_URL"
export PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION='Databases (`_dev`/`_test`/`_uat`) are disposable.'

# API (port 3101)
cd apps/api && PORT=3101 AUTH_DEV_MODE=true NODE_ENV=test \
  FRONTEND_URL=http://127.0.0.1:3100 LOG_DIR=.logs/driver \
  node --env-file=../../.env --import tsx src/main.ts &

# Web (port 3100) — NEXT_PUBLIC_DISABLE_DEVTOOLS keeps the Agentation widget out
# NEXT_PUBLIC_SENTRY_DSN wires web error boundaries to Bugsink so browser-side
# errors surface in the environment-feedback channel (Phase 2.5). Copy the DSN
# from http://localhost:8000 after creating a project there.
NEXT_PUBLIC_API_URL=http://127.0.0.1:3101 AUTH_DEV_MODE=true NODE_ENV=test \
  NEXT_PUBLIC_AUTH_STUB=true NEXT_PUBLIC_DISABLE_DEVTOOLS=true \
  NEXT_DIST_DIR=.next-sweep \
  NEXT_PUBLIC_SENTRY_DSN="${NEXT_PUBLIC_SENTRY_DSN}" \
  pnpm --filter @customreport/web exec next dev -p 3100 &
```

Loopback proxy note: if the machine sets `HTTP_PROXY` without `127.0.0.1` in
`NO_PROXY`, plain `fetch`/`curl` to the app may 502 — the Playwright-MCP
Chromium is unaffected (it does not use the env proxy), but see
`e2e/no-proxy-localhost.ts` for the sweep's fix.

Native OTLP note: the API start command above loads `.env` via `--env-file`,
which defaults `OTEL_EXPORTER_OTLP_ENDPOINT=http://otel-lgtm:4318` — a Docker
hostname that only resolves inside Compose. For the native sweep API to ship
logs to Loki, set `OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318` in your
shell before starting the API (or the collector degrades gracefully when the
Loki channel has no streams — it marks the channel "blind", not "clean").

Drive protocol (the agent prompt), parametric in `<role>`:

- Log in: navigate to
  `http://127.0.0.1:3100/auth/dev-login?role=<role>&email=<seeded-email>&redirect=<role-landing>`.
  Seeded emails: `lead1@`, `head@`, `admin@`, `viewer@customreport.local`.
- **Oracle:** read `e2e/catalog/<role>.yaml`. Each intent's `then`/`note` is the
  expected behavior. An anomaly is real ONLY when the observation _contradicts_
  the documented `then`, or there is a console error / pageerror / failed nav /
  infinite skeleton / layout break. Behavior that matches `then` is not an
  anomaly — never report "works as expected".
- Walk the exact cells and `controlKey` list supplied by the Codex-owned prompt
  assignment. Navigate, settle, read console errors, snapshot (shallow), and
  execute only each bounded cell action. The guarded E2E database is disposable,
  so declared publish, delete, revoke, and restore cells are exercised before
  reset/reseed.
- **Canary (proof-of-life, task 3.4):** exactly once, inject
  `console.error('DRIVER_CANARY_42')` via `browser_evaluate` and confirm the
  console capture detects it. `canary.detected=false` means the Driver is
  blind — its empty findings cannot be trusted (the Monitor "silence is not
  success" principle).
- Emit one `covered` or `blocked` `controlResults` entry, with evidence refs, for
  every assigned control. Emit compact candidates (`candidateId`, `cellId`,
  `kind`, `summary`, `evidenceRefs`) — **never paste full snapshots**.
- The Codex orchestrator persists the final JSON and transcripts. The Driver
  does not write archive files or campaign evidence.

The verbatim, parametric prompt lives in `drive-prompt.md` (this directory) with
a per-role substitution table — copy it and swap `<ROLE>`, the seeded email, and
the landing route to drive another role.

## Phase 2.5 — Environment feedback (post-drive, pre-verify)

After the drive and before the verify fan-out, the bundled collector
(`collect-env-feedback.mjs`) sweeps four environment channels for signal
that occurred during the drive window recorded in the `timeline` block:

1. **Browser console** — `.playwright-mcp/console-*.log`, filtered to the
   run window. The `DRIVER_CANARY_42` injection proves this channel is live.
2. **API log** — `apps/api/.logs/driver/app.log`, filtered by JSON `timestamp`
   and `"level":"error|warn"`. Never bare-grep: SQL column names in debug
   lines false-positive.
3. **Bugsink** — HTTP API at `http://localhost:8000`; lists events created
   in the run window (single-user mode, no auth required).
4. **Loki** — Grafana datasource proxy at `http://localhost:3003`; the
   collector uses Node's built-in `fetch` (which ignores `HTTP_PROXY`),
   so no `--noproxy` flag is needed.

**Channel liveness contract:** each channel reports `reachable` / `hasStreams`
/ `blind`. An empty result from a blind channel is **not clean** — report it
as blind. "Silence is not success" (Monitor principle).

Correlated hits flow into Phase 3 as candidates with `kind: "env"` and no
`intentId` (no oracle, judged as hard failures). See `SKILL.md` for the full
skill orchestration.

## Phase 3 — Verify (adversarial fan-out)

Raw driver output is a known false-positive factory (the 621→10 sweep lesson),
so every candidate is judged by an **independent, code-reading skeptic** that
tries to _refute_ it and defaults to "not a bug" when the source does not prove a
defect. This is where parallelism helps (no browser needed), so it is a
Workflow:

```
Workflow({ scriptPath: "openspec/changes/behavioral-ui-regression-gate/workflow/lead-driver-verify.workflow.mjs",
           args: { candidates: [ ...phase-1 output... ] } })
```

Each verifier returns `{ isReal, confidence, classification, rootCause,
reasoning, suggestedFix }`. Only `isReal` findings reach the report.

## Output

The orchestrator writes the schema-valid JSON report and transcripts under the
campaign archive, alongside merged per-cell results and the digestable
`driver-report` evidence refs. The report records the canary, exact assigned
cells/control results, and candidates; the Driver itself writes no artifacts.
