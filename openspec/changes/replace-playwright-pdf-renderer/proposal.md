# Proposal

## Why

The API's PDF export worker launches a full Playwright Chromium inside the API
process to render the print page. That couples a heavy browser runtime to the
API image (glibc base, `playwright install --with-deps chromium` in
`Dockerfile.api`, the `playwright` dependency and its `allowBuilds` entry) and
to the worker's memory/lifecycle, and it blocks the planned freeze: the
in-process browser is the last heavyweight render dependency inside the API
container. Moving rendering to a dedicated internal Gotenberg container
isolates the browser, shrinks the API image, and keeps the export contract
unchanged for users.

Evidence: `pdf-export.processor.ts` (`chromium.launch` + `page.pdf()`),
`Dockerfile.api` lines 7/111/135, `apps/api/package.json` `playwright ^1.62.1`,
`pnpm-workspace.yaml` `allowBuilds.playwright`, recon report
`gotenberg-recon.txt` (wave2, 2026-09-22), and the 2026-09-23
isolated-renderer probe and source-audit reports (`gotenberg-probes`,
`gotenberg-cookie-cleanup-followup`, `timeout-cleanup-probe`,
`storage-cache-followup`, `gotenberg-health-source-audit`,
`gotenberg-render-pipeline-audit`, `print-storage-usage-devin`,
`playwright-inventory-devin`; durable copies kept in the task backlog).

## What Changes

- The `pdf-export` worker stops launching Chromium in-process and instead posts
  the print URL to an internal Gotenberg container
  (`POST /forms/chromium/convert/url`), keeping the durable BullMQ job, the
  generation-fenced payload, the frozen-snapshot print route, the artifact
  store, and the checksum protocol unchanged.
- The worker still mints the short-lived render JWT at execution time; the
  token travels in Gotenberg's `cookies` form field — probe-verified on the
  real renderer, including a single-label `domain` host matching
  `PDF_BASE_URL`; the `extraHttpHeaders` `Cookie` header is the measured
  fallback — so `trpc.context` PDF fallback auth is unchanged.
- Readiness gating moves into the render request: `waitForExpression` asserts
  `data-print-state="ready"` plus loaded fonts; a page that settles on `error`
  or never reaches `ready` fails the attempt.
- Renderer responses map onto existing job semantics with a fail-safe bias
  (probe-measured surface): only a direct forbidden-URL rejection (HTTP 403)
  and failures the worker proves locally while constructing the request are
  terminal; every ambiguous outcome — HTTP 400 (documented for invalid form
  fields and main-page network errors), HTTP 409 (main-page HTTP error status,
  including the pinning proxy's 502 for a dead upstream), HTTP 503 (request
  deadline, which includes queue wait under serialized conversions),
  transport errors, timeouts, and invalid PDF bodies — consumes the normal
  `attempts: 3` retry budget, matching today's retryable `page.goto`
  failures.
- A new internal `gotenberg` service joins the Compose graph:
  `gotenberg/gotenberg:8.37.0-chromium` pinned by sha256 digest per
  `deploy-config-integrity`, internal-only exposure (no published host port),
  allow-listed outbound navigation, bounded request timeout, serialized
  conversions (`CHROMIUM_MAX_CONCURRENCY=1`), and between-conversion clearing
  (`CHROMIUM_CLEAR_COOKIES`, `CHROMIUM_CLEAR_STORAGE`,
  `CHROMIUM_CLEAR_CACHE`) so jobs sharing one browser never share a
  credential or page state.
- The API gains a dedicated PDF-renderer health signal that reports renderer
  reachability without joining the `/health/ready` aggregate — a renderer
  outage degrades exports, it does not take the API down, and the API has no
  startup dependency on the renderer at all. Full PDF development and
  acceptance run under `pnpm dev:watch`; ordinary host-source `pnpm dev`
  boots with the renderer signal `down` (the compose-internal hostname does
  not resolve on the host) while `/health/ready` stays unaffected.
- **BREAKING (build/deploy)**: the `playwright` dependency, its browser
  install step, `PLAYWRIGHT_BROWSERS_PATH`, the browser-keyed cookie shape,
  and every gate/doc asserting the in-process browser are removed or reworked
  (Playwright-Test-only ignore entries go too; agent-browser tool entries and
  deny-only cleanliness rules stay, and the prod-compose ban on
  `pnpm exec playwright` remains as a regression guard); `GOTENBERG_URL`
  becomes required fail-closed configuration.

## Capabilities

### New Capabilities

- `pdf-renderer-service`: the internal Gotenberg render service contract —
  request shape, readiness gate, error classification surface, SSRF/allow-list
  boundary, timeout/size bounds, health endpoint, pinning, internal-only
  exposure.

### Modified Capabilities

- `pdf-export-integrity`: the worker's readiness/capture contract moves from
  in-process `page.pdf()` to the remote render request; the colocated-test
  contract moves to an HTTP-boundary seam instead of forbidding a separate
  browser harness outright.
- `api-health-indicators`: a dedicated non-gating PDF-renderer health signal is
  added; `/health/ready` aggregation is unchanged.
- `deploy-healthchecks`: the new renderer service gets a compose healthcheck
  exercising its real `/health` endpoint.

## Non-goals

- No change to job lifecycle, generation fencing, reconciliation, orphan
  recovery, artifact publication, or download authorization.
- No external exposure of the renderer (no Caddy route, no public port).
- No queue/schema/Prisma changes. The only web change is server rendering of
  the worker-token print view (D3).
