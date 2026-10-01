# Design

## Context

Today `PdfExportProcessor`
(`apps/api/src/infrastructure/bullmq/pdf-export.processor.ts`) renders the
print page with an in-process Playwright browser: `chromium.launch()` →
mint a 5-minute HS256 JWT → `context.addCookies(buildAuthCookies(token))`
(cookie keyed by `url`, not `domain`) → `page.goto(reportUrl, 60s)` →
`waitForSelector('[data-print-state="ready"],[data-print-state="error"]', 30s)`
→ require `ready` → `waitForFunction(document.fonts.status === 'loaded', 30s)`
→ `page.pdf({format:"A4", printBackground:true})` → `browser.close()` in
`finally`. Everything around that render block — payload validation,
generation fencing, `assertPdfExportJobIdentity`, artifact publication,
checksum, `onJobFailed → reconcileTerminalState`, orphan recovery — is a
load-bearing protocol this change deliberately does not touch (see
`recover-orphaned-pdf-exports`).

The web print route (`apps/web/src/app/print/[reportId]/page.tsx`) authenticates
the token as a tRPC-context fallback and renders only when `pdfReportId` /
`pdfJobId` match; the browser's `/trpc` calls hit the `web` origin and Next.js
rewrites proxy them to the API (`apps/web/next.config.ts`), so the renderer
only ever needs to reach the configured `PDF_BASE_URL` origin.

Gotenberg facts verified against primary docs on 2026-09-22
(`gotenberg.dev/docs`) and measured on isolated probes on 2026-09-23 (the
`gotenberg-probes`, `gotenberg-cookie-cleanup-followup`,
`timeout-cleanup-probe`, and `storage-cache-followup` reports; linux/arm64
only, no published ports, no application/DB/Redis/report-data contact;
durable copies kept in the task backlog):
`POST /forms/chromium/convert/url` multipart — `url` (required, `file://` →
400), `paperWidth`/`paperHeight` (A4 = 8.27×11.7 in), `printBackground`,
`waitForSelector`, `waitForExpression` (async/Promise awaited), `cookies`
(JSON; `name`/`value`/`domain` required — measured: a single-label
`domain=web` is accepted and reaches the main document and same-origin
subrequests), `extraHttpHeaders` (JSON — measured: a `Cookie` header reaches
subrequests too), `Gotenberg-Trace` correlation header; responses 200 / 400 /
403 / 409 / 503 — where `400` covers invalid form fields and, per the
documented surface, critical main-page network errors (`net::ERR_*`),
`409` reports a main-page HTTP status matching `failOnHttpStatusCodes`
(default `[499,599]`; measured: an HTTP-500 page → `409`, and a dead
upstream → pinning-proxy `502` → `409`, not a `400` transport error), `403`
is a forbidden URL (measured: direct disallowed origin rejected
immediately), and `503` means the conversion exceeded its configured
duration (measured: a never-ready `waitForExpression`, and a redirect into
a disallowed origin — the blocked upstream received zero bytes — both ended
as `503`, not `403`). Config: `API_TIMEOUT` default **30s** — measured to
include queue-wait time under serialized concurrency, `CHROMIUM_ALLOW_LIST`
/ `CHROMIUM_DENY_LIST` regexes, `CHROMIUM_DENY_PRIVATE_IPS` /
`CHROMIUM_DENY_PUBLIC_IPS` (default false; allow-list match bypasses
IP-class checks; deny-list always wins), `CHROMIUM_CLEAR_COOKIES` (default
false; clears **between** conversions — measured after a successful render,
a `failOnHttpStatusCodes` failure, a readiness timeout, and a client
abort), `CHROMIUM_CLEAR_STORAGE` (clears localStorage between conversions —
measured on the same four paths; required: without it a committed
localStorage sentinel crossed to the next conversion), `CHROMIUM_CLEAR_CACHE` (clears the
Chromium HTTP cache between conversions — measured: with the flag off, a
cacheable resource was served stale to the next conversion with zero
network requests), `CHROMIUM_MAX_CONCURRENCY` (default **6** — one shared
Chromium browser serves concurrent conversions, so overlapping requests
share the cookie jar), `CHROMIUM_RESTART_AFTER`, always-on DNS-rebind
pinning proxy; `GET /health`, `GET /version`.

## Goals / Non-Goals

**Goals:**

- Remove the browser runtime from the API process and image while preserving
  every observable export guarantee (frozen snapshot, ready-gated capture,
  generation fencing, checksum, ownership-bound download).
- Keep the failure contract: only `ready` pages produce artifacts; renderer
  failures map onto the existing retry/terminal semantics.
- Renderer outage is a degraded export capability, not an API outage:
  `/health/ready` must not depend on Gotenberg.

**Non-Goals:**

- No change to job/queue/artifact protocol, token claims/TTL, print route, or
  download authorization.
- No new capability for humans; no Caddy route or published port for the
  renderer.

## Decisions

### D1: Internal Gotenberg container over in-process or external renderers

Chosen: a `gotenberg` service on the internal compose network, pinned by tag
and sha256 digest (inherits `deploy-config-integrity`'s immutable-image rule).

Alternatives considered:

- **Keep Playwright in-process** — rejected: browser stays inside the API
  image/process (the thing being removed), keeps glibc + install step.
- **Sidecar Playwright/puppeteer service we build ourselves** — rejected:
  re-invents exactly what Gotenberg ships (convert-URL route, allow/deny
  filtering, health endpoint); maintenance burden for no gain.
- **External PDF SaaS** — rejected: sends report data off-premise, adds a
  public-network dependency and credentials, and violates the internal-only
  posture.

### D2: HTTP seam at a `PdfRenderer` port

The processor keeps owning the job protocol; the browser block is replaced by
a narrow port (e.g. `PdfRenderer.render(input): Promise<Buffer>`) in
`pdf-export.ports.ts` with a Gotenberg adapter. Colocated tests substitute the
port/HTTP boundary (MSW) — no real browser in unit/integration tests. The
adapter builds `multipart/form-data`: `url`, `paperWidth=8.27`,
`paperHeight=11.7`, `printBackground=true`, the readiness expression (D3),
the credential (D4), and `Gotenberg-Trace` = job identity for log
correlation.

### D3: Readiness gate becomes a `waitForExpression`

The request carries an expression equivalent to
`document.querySelector('[data-print-state="ready"]') !== null &&
document.fonts.status === 'loaded'`, replacing both worker-side waits. A page
that settles on `data-print-state="error"` or never reaches `ready` makes the
expression never hold, so the conversion times out and the attempt fails —
the "never capture a spinner/error page" invariant is preserved by the gate,
not by post-hoc inspection.

The print route renders the worker-token view on the server
(`apps/web/src/app/print/[reportId]/page.tsx` via `getPdfExportRender`), so the
readiness marker is present in the server markup and the gate does not depend
on client hydration inside the renderer's Chromium.

Accepted simplification: the failure reason no longer distinguishes
"error marker" from "never ready" (both surface as a bounded wait timeout).
The durable contract — job fails, no artifact — is unchanged; the failure
message loses one word of cause. If the distinction is later needed, the
print template can expose a readable marker or a tiny probe endpoint; not
required for parity.

### D4: Token transport — `cookies` JSON under serialized conversions (settled by probe)

Chosen: Gotenberg `cookies` JSON `[{name, value, domain, path, httpOnly,
sameSite}]` with `domain` = the `PDF_BASE_URL` host. **Measured 2026-09-23:**
Chromium-via-Gotenberg accepts a single-label `domain=web` cookie and sends
it to the main document, the same-origin tRPC subrequest, and
`/favicon.ico`; `extraHttpHeaders` with a scoped `Cookie` header also
reaches subrequests and stays the measured fallback. The Playwright
`url`-keyed cookie form is no longer needed — the reason it existed
(IP/localhost hosts, `pdf-export.service.ts` comment) is covered by the
probe-verified `domain` form for our internal hostname.

**Isolation invariant (measured, with scoped gaps):** Gotenberg runs one
shared Chromium with `CHROMIUM_MAX_CONCURRENCY` defaulting to **6**
concurrent conversions, and overlapping conversions share the cookie jar —
the cookie transport is only safe when conversions cannot overlap.
**Measured:** credential-free conversions immediately after a credentialed
success, a credentialed `failOnHttpStatusCodes` failure (409), a readiness
timeout (503), and a client abort (renderer-side 499) all carried no
cookie. Without `CHROMIUM_CLEAR_STORAGE`, a committed localStorage sentinel
leaked to the next conversion (probe FAIL); with it, localStorage is
cleared on all tested paths. Without `CHROMIUM_CLEAR_CACHE`, a cacheable
same-origin resource crossed conversions and served stale bytes with zero
network requests; with it, the second conversion re-fetches. The deploy
therefore MUST pin all four — `CHROMIUM_MAX_CONCURRENCY=1`,
`CHROMIUM_CLEAR_COOKIES=true`, `CHROMIUM_CLEAR_STORAGE=true`,
`CHROMIUM_CLEAR_CACHE=true` — and the compose gate asserts the effective
values, not mere env presence. **Not exercised by probes:** sessionStorage,
IndexedDB, Cache Storage API, and service-worker state — accepted for now
because the print-route source audit at `c1781215` finds no JavaScript
persistent-storage API anywhere in the reachable `/print` tree (source
evidence, not runtime proof; the finding does not generalize beyond that
ref, so a fresh reachable-print-source audit MUST re-run on the final
implementation candidate). **Not yet proven on the app stack:** real two-requester identity
isolation — it stays a runtime acceptance item, so the serialization
invariant stands regardless. A per-request credential transport MAY relax
serialization later, only after isolation is demonstrated live.

### D5: Error classification onto existing job semantics — fail-safe bias

The status surface is ambiguous (see Context): `400` conflates "invalid form
fields" with "main page unreachable" per the documented surface, `409`
covers main-page 4xx/5xx via `failOnHttpStatusCodes` (default `[499,599]`)
— measured to include the pinning proxy's `502` for a dead upstream — and
`503` covers both an unsatisfied readiness gate and navigations blocked
mid-flight (a redirect into a disallowed origin times out as `503`, never
reaching the blocked upstream and never surfacing as `403`). A
page-unreachable failure was retryable under Playwright (`page.goto` threw
a retryable error), so the mapping preserves parity by retrying ambiguity:

- `403` (URL forbidden by allow-list/IP filter): deterministic policy
  rejection that can never succeed on retry → `UnrecoverableError`; BullMQ
  terminal-fails immediately and the retained job is reconciled to `failed`
  by the existing pass — same path as today's malformed-payload failures.
- Failures the worker proves _locally_ while constructing the request
  (before any bytes leave — e.g. the print URL itself fails validation):
  `UnrecoverableError`, same reasoning.
- `400`, `409`, `503`, transport errors (connect/DNS/reset), client-side
  timeout: retryable within `attempts: 3` + exponential backoff. `400`
  stays retryable even though the tested dead-upstream path surfaced as
  `409` — it remains ambiguous and documented for main-page network
  errors. A genuinely malformed request still converges to terminal
  failure — just after the bounded retry budget instead of on attempt 1.
- `200` with a missing/invalid PDF body: treated as ambiguous → retryable;
  the artifact store and `markExportCompleted` see only validated bytes.

The current worker's `onJobFailed` handler gates reconciliation on
`attemptsMade >= attempts`, which is correct for ordinary retryable failures
but misses BullMQ `UnrecoverableError`: BullMQ can mark that job failed while
`attemptsMade < attempts`. The render change MUST remove that count-only
early return and let the existing generation-scoped queue-state read plus
`reconcileTerminalState` decide under the export-row lock. A delayed/waiting/
active current job leaves the durable row queued; only a re-read terminal
failure with matching job/report/requester/generation identity writes failed.
The extra reconciliation call for intermediate failures adds queue reads and
a row lock, but avoids maintaining a second, stale error-class/count policy.

### D6: Bounded render request — timeout covers queue wait, not just render

`API_TIMEOUT` bounds the whole request lifecycle **including queue wait**:
measured under `CHROMIUM_MAX_CONCURRENCY=1`, a fast request behind a 5 s
render completed at ~5.24 s, while behind a 14 s render with a 12 s timeout
both requests died at their own deadlines — the deadline starts at request
receipt, not at slot grant. Initial deployment values (advisor-recommended
starting points, not capacity or production performance evidence):
`API_TIMEOUT=150s` on the renderer and an API-side HTTP client timeout of
`160s` that includes response-body consumption, so a wedged conversion
fails instead of hanging the attempt. Response bytes are bounded by an
explicit initial maximum of 64 MiB enforced while streaming the body —
following the existing bounded-reader shape in
`apps/api/src/modules/search/infrastructure/openai-compatible.response-body.ts`,
which cancels and releases the stream on overflow, rather than a new
abstraction — and the body is validated as a minimal PDF (non-empty body,
`%PDF-` header, `%%EOF` marker after trailing whitespace) before the
artifact store sees it. The 64 MiB figure is an explicit initial safety
bound, not measured capacity evidence. The
five-minute render-token TTL is unchanged and is not the binding
constraint: the token is minted fresh inside each BullMQ processor attempt,
so queue backoff before an attempt does not consume token lifetime — only
the in-flight render window does. These starting values do not prove queue
saturation is harmless; bounded queue-wait/saturation observation stays a
runtime acceptance item.

### D7: SSRF boundary — allow-list the print origin only

`CHROMIUM_ALLOW_LIST` is anchored to the configured print origin
(`^http://web:3000/` in dev; prod derives the pattern from `PDF_BASE_URL`),
and `CHROMIUM_DENY_PRIVATE_IPS=true` + `CHROMIUM_DENY_PUBLIC_IPS=true` deny
everything the allow-list does not explicitly permit (precedence: deny-list >
allow-list > IP-class). Every outbound navigation and sub-resource resolves
through Gotenberg's always-on DNS-rebind pinning proxy. The service listens
only on the internal compose network — no published host port, no Caddy
route, no basic-auth requirement inside the trusted network (recorded as an
explicit decision, not an omission).

### D8: Separate PDF-renderer health signal

New dedicated probe endpoint `GET /health/pdf-renderer`: bounded (~2s) probe
of `GET {GOTENBERG_URL}/health`, returns up/down with 200/503, unauthenticated
like the other health routes, no internal error details leaked. The fetch
aborts promptly inside the shared readiness bound and releases response
resources (`AbortSignal` plus body cancellation), so a lost race leaves no
lingering socket. It is NOT
aggregated into `/health/ready` — `api-health-indicators`'s indicator set
(`database`, `redis`, `bullmq`, `memory_heap`) is unchanged. The API declares
**no `depends_on` edge on the renderer at all**. Compose `depends_on` does
have an optional mode (`required: false`, since Compose 2.20.0 — a missing
dependency only warns instead of blocking startup), but even an optional
edge would declare a startup ordering the system does not have: the API
never contacts the renderer during boot, and renderer availability is a
runtime property governed by retryable job failures and the health signal.
A cold API start with the renderer down or undeployed MUST succeed, with the
outage visible only on `/health/pdf-renderer` and in retryable export
failures.

The same boundary governs development modes: full PDF development and
acceptance run under `pnpm dev:watch` (Compose-source), while ordinary
host-source `pnpm dev` boots with `GOTENBERG_URL=http://gotenberg:3000` —
a compose-internal hostname that does not resolve on the host — so the
renderer signal reports `down` while boot and `/health/ready` stay
unaffected. The API performs no DNS or reachability validation of
`GOTENBERG_URL` at boot: fail-closed means the variable must exist and
parse as a URL, nothing more. This is the owner-approved form of the
advisor's "separate PDF degradation" recommendation.

### D9: Configuration and removal contract

- `GOTENBERG_URL` joins `envSchema` as required fail-closed (no default), same
  posture as `PDF_BASE_URL`; missing or malformed fails boot. Timeout and
  allow-list stay code constants or renderer-side config, not new API envs.
- Environment wiring: Compose sets `PDF_BASE_URL=http://web:3000` and
  `GOTENBERG_URL=http://gotenberg:3000`; the host `.env.example` keeps
  `PDF_BASE_URL=http://localhost:3000` and carries the same required
  `GOTENBERG_URL=http://gotenberg:3000` with a comment that the
  compose-internal hostname is unavailable to host-source mode (D8).
- Image pin: `gotenberg/gotenberg:8.37.0-chromium` by the multi-platform
  manifest-list digest
  `sha256:0d28ae9a96441588ef739623726bd500ad0720b77266c6f1351a13e333fbd61c`
  (v8.37.0, released 2026-09-11). The probes exercised the linux/arm64
  manifest digest
  `sha256:56bc8933e838e3fc83723dbf4e6970ad46f43ea90d8384a620498937f056f20e`;
  ARM64 results do not certify other platforms.
- Renderer-side config pinned in compose: `API_TIMEOUT=150s` (D6),
  `CHROMIUM_MAX_CONCURRENCY=1`, `CHROMIUM_CLEAR_COOKIES=true`,
  `CHROMIUM_CLEAR_STORAGE=true`, `CHROMIUM_CLEAR_CACHE=true` (D4 isolation
  invariant), the anchored `CHROMIUM_ALLOW_LIST` (`^http://web:3000/` in
  dev), and both IP-class denies (D7) — the prod compose gate asserts all
  of them as effective values, not mere env presence.
- Memory cap: `deploy.resources.limits.memory: 1G` on the `gotenberg`
  service — identical in the base compose (inherited by the source-watch
  overlay) and `docker-compose.prod.yml`, with the compose gate asserting
  the rendered limit in all three graphs. The 1 GiB value is an initial,
  provisional containment bound with no sufficiency evidence: runtime
  acceptance item 16 measures the actual ceiling, and the cap is revised
  from observed data before any capacity claim is made.
- Removal set (per the inventory audit): `playwright` from
  `apps/api/package.json`; the `import { chromium }` line, browser launch,
  context/cookie plumbing, `page.goto`/wait/`page.pdf` calls, and
  `browser.close()` in `pdf-export.processor.ts`; the Playwright `url`-keyed
  cookie shape in `buildAuthCookies` plus its comment and test fixtures;
  the `playwright install --with-deps chromium` step, both
  `PLAYWRIGHT_BROWSERS_PATH` lines, and the glibc/`--ignore-scripts`
  comments in `Dockerfile.api` (Debian base kept — minimal diff; an Alpine
  swap is an optional follow-up); `allowBuilds.playwright` in
  `pnpm-workspace.yaml`; the browser fakes in `pdf-export.processor.test.ts`
  (rewritten to HTTP-boundary stubs); the positive playwright-install
  assertion in `prod-compose-gate.test.ts` (replaced by gotenberg
  service/pinning assertions, and the runner-layer ordering assertion
  re-anchors — the negative `pnpm exec playwright` ban stays as a
  regression guard); Playwright-Test-only ignore entries
  (`playwright-report`, `test-results`) in `.gitignore`/`.dockerignore` —
  agent-browser tool entries (`.playwright-cli/`, `.playwright-mcp/`) and
  the `repository-cleanliness` deny-only artifact rules stay; the
  "pdf-export worker is in-process" passage in `docs/operations.md`; stale
  comments in `Dockerfile.pdf-artifact-migrator`, `env.schema.ts`,
  `.env.example`, and the `openspec/config.yaml` project metadata.
  `pnpm-lock.yaml` regenerates through `pnpm install` only — never
  hand-edited — as a serialized step owned with the shared Nest/env wiring
  and run after the manifest edits land in the task worktree; the result is
  compared against the pre-step lockfile (unrelated package updates are
  rejected) and verified with `pnpm install --frozen-lockfile`; upstream
  optional peer metadata (`@playwright/test` on next,
  `@vitest/browser-playwright` on vitest, `electron-to-chromium`) and
  historical evidence stay, so no claim that every `playwright` string
  disappears — remaining matches are classified, not erased.

## Risks / Trade-offs

- [Cookie `domain` acceptance] → Resolved by probe (D4): the single-label
  `domain=web` form is accepted and reaches the main document and
  same-origin subrequests; `extraHttpHeaders` Cookie header is the measured
  fallback.
- [Shared browser state across conversions] → Cookie clearing is measured
  after success, `failOnHttpStatusCodes` failure, readiness timeout, and
  client abort; localStorage and the HTTP cache demonstrably crossed
  conversion boundaries without their flags, so `CHROMIUM_CLEAR_STORAGE` and
  `CHROMIUM_CLEAR_CACHE` join `CHROMIUM_MAX_CONCURRENCY=1` /
  `CHROMIUM_CLEAR_COOKIES` as gate-asserted deploy invariants (D4).
  sessionStorage, IndexedDB, Cache Storage, and service workers were not
  exercised — the print tree uses no persistent-storage API per the source
  audit at `c1781215`, re-checked on the final implementation candidate.
  Real two-requester identity isolation remains a runtime acceptance item.
- [Ambiguous renderer statuses could strand a real config bug in retries] →
  Accepted (D5): a malformed request burns the bounded retry budget and still
  converges to terminal failure; the alternative (terminal-on-400) would
  strand jobs on a transient print-page outage, which was retryable under
  Playwright.
- [Readiness error/timeout collapse loses failure detail] → Accepted (D3);
  the job still fails and reconciliation records the timeout reason.
- [Renderer availability now bounds export success] → Bounded retry budget +
  dedicated health signal + `recovery_required` path unchanged; an operator
  sees degradation on `/health/pdf-renderer`, not a dead API, and the API
  boots with the renderer absent.
- [A terminal `UnrecoverableError` can have attempts remaining] → Reconcile
  from the current generation-scoped queue state under the existing row lock;
  do not infer terminality only from `attemptsMade`.
- [Serialized conversions bound render throughput] → Accepted for MVP export
  volume; measured: queue wait counts against each request's own
  `API_TIMEOUT`, so a conversion queued behind a long render can exhaust its
  deadline before receiving a slot — bounded retryable `503`s plus the
  150s/160s starting budgets absorb this (D6). Raising
  `CHROMIUM_MAX_CONCURRENCY` is allowed only after a per-request credential
  transport is proven isolated (D4).
- [Allow-list drift between dev (`web:3000`) and prod (public origin)] →
  Prod compose requires an operator-set allow-list matching `PDF_BASE_URL`;
  the prod compose gate asserts the pattern is anchored (`^`, host-scoped).
- [In-flight jobs during the switch] → Same canonical-writer protocol and
  unchanged queue payloads mean old/new workers differ only in the render
  block; deploy during low export activity per existing rollout norms.

## Migration Plan

1. Done: isolated probes (2026-09-23, see Evidence below) settled the
   credential transport, the status surface, the timeout scope, and the
   image pin; the remaining isolation cases are runtime acceptance items,
   not implementation gates.
2. Land the `gotenberg` compose service + `GOTENBERG_URL` schema first;
   the new worker path replaces the Playwright block in one change.
3. Remove Playwright from package/Dockerfile/workspace in the same change;
   with those manifest edits already in the tree, regenerate
   `pnpm-lock.yaml` via `pnpm install` in the isolated task worktree,
   compare against the pre-step lockfile (reject unrelated updates), and
   verify with `pnpm install --frozen-lockfile` — no temporary commit is
   required to obtain a clean status.
4. Flip the compose gates and docs in the same change.
5. Rollback = redeploy the previous image/compose; no data migration exists
   (job rows, artifacts, tokens are unchanged).

## Runtime Acceptance

Finite evidence matrix for the implemented change (real compose stack, real
PDF bytes, browser/network-observable — no mocked renderer; screenshot, DOM,
and network evidence tied to the exact candidate SHA). Items marked
_probe-covered_ were demonstrated on the isolated 2026-09-23 renderer and
are re-verified here against the real print route — probes do not
substitute for the application flow; everything else is unrun until
demonstrated:

1. `docker compose up` / `pnpm dev:watch`: the `gotenberg` container reports
   `healthy` via its `GET /health` healthcheck; API `/health/ready` is up on
   its own dependency set and `/health/pdf-renderer` reports `up`.
2. Host-source `pnpm dev`: `GOTENBERG_URL=http://gotenberg:3000` does not
   resolve on the host; the API still boots, `/health/ready` reports `up`
   on its own dependency set, `/health/pdf-renderer` reports `down`, and an
   export attempt fails retryably rather than blocking boot.
3. Real export end-to-end, UI-driven: an export requested through the real
   UI via an agent-browser named session → durable job → conversion through
   the container → row `completed` with a sha256 matching the canonical
   `${jobId}-g{generation}.pdf` file; `/pdfs/{jobId}.pdf` serves the owner
   and rejects a non-owner.
4. A render that settles on `data-print-state="error"` fails the job to a
   terminal state with no artifact file (renderer surface: `409` for a page
   HTTP error, `503` for a never-ready gate).
5. Cookie clearing after success and after a failed render (_probe-covered_):
   a credential-free conversion immediately after a credentialed success,
   and immediately after a credentialed `failOnHttpStatusCodes` failure,
   carries no cookie on the real print route.
6. Cleanup under timeout/interruption (_probe-covered_): a credentialed
   conversion that hits `API_TIMEOUT` (503) or is aborted mid-flight (499)
   leaves no cookie or localStorage sentinel visible to the next
   conversion — re-verified on the real print route.
7. Cache/storage isolation under the pinned flags (_probe-covered_): with
   `CHROMIUM_CLEAR_STORAGE=true` and `CHROMIUM_CLEAR_CACHE=true`, no
   localStorage state or HTTP-cached bytes cross conversions.
   sessionStorage, IndexedDB, Cache Storage API, and service-worker state
   were not probed — accepted because the reachable `/print` tree at the
   audited ref uses no persistent-storage API; that audit predates the
   implementation, so a fresh reachable-print-source check MUST re-run on
   the final implementation candidate.
8. Real two-requester isolation: two export jobs for different reports and
   requesters dispatched together both complete with their own correct
   artifacts — under `CHROMIUM_MAX_CONCURRENCY=1` no job's token is visible
   to the other's conversion. (Probes used a single synthetic origin; the
   two-requester identity case is proven here.)
9. Serialized-queue timeout/saturation (_probe-covered_ mechanism): with
   `CHROMIUM_MAX_CONCURRENCY=1`, a conversion queued behind a long render
   can exhaust its own `API_TIMEOUT` before receiving a slot; a bounded
   observation confirms saturation surfaces as retryable `503`s within the
   bounded retry policy, not hangs — the 150s/160s starting values alone do
   not prove saturation harmless.
10. Transient print-page outage recovers on retry: with `web`/the print
    route unreachable on attempt 1 (renderer `409` via the pinning proxy's
    `502`, or a documented `400` main-page network error), the same job is
    retried by BullMQ and completes on a later attempt once the page is
    reachable — the ambiguous status is not terminal.
11. Renderer stopped mid-cycle and restarted: the `gotenberg` service is
    stopped while a conversion is in flight; the interrupted HTTP
    conversion fails the attempt retryably within the bounded queue
    policy — the durable row is never written `failed` before the retry
    budget is exhausted and the job stays recoverable. After the renderer
    restarts, a later attempt of the same job completes with a valid
    artifact. Throughout, `/health/ready` stays `up` while
    `/health/pdf-renderer` reports `down` during the outage and `up` again
    after recovery.
12. Deterministic rejection stays terminal: a direct `403` from outbound
    filtering (or a locally proven malformed request) fails the job
    without consuming retries.
13. A `recovery_required` row retried by a Head produces a `g+1` artifact
    through the renderer — the generation-fenced protocol is untouched.
14. A hung/slow print page fails inside the bounded request budget (`503` /
    client timeout) instead of pinning the job.
15. An expired or absent token still resolves to the error path and the
    human `/print` redirect is unchanged.
16. Memory-cap measurement under the provisional 1 GiB limit: record the
    effective Compose limit (rendered `docker compose config`), the actual
    container/cgroup limit (`docker inspect` and cgroup `memory.max`), peak
    container memory while exporting the largest representative synthetic
    report at `CHROMIUM_MAX_CONCURRENCY=1`, OOMKilled/restart events,
    export success and duration, and host memory headroom throughout the
    run. An OOM or inadequate host headroom stops the run — revise the cap
    from the observed data and repeat. Local measurements do not certify
    an unknown production host or platform.

## Evidence and Outstanding Runtime Conditions

Probes ran 2026-09-23 on isolated linux/arm64 containers — no published
ports, no application, database, Redis, or report-data access. Reports
(durable copies in the task backlog, not repo files): `gotenberg-probes`,
`gotenberg-cookie-cleanup-followup`, `timeout-cleanup-probe`,
`storage-cache-followup`, `gotenberg-health-source-audit`,
`gotenberg-render-pipeline-audit`, `print-storage-usage-devin`,
`playwright-inventory-devin`.

**Settled by probe or source audit:**

- Credential transport (D4): `cookies` JSON with a single-label
  `domain=web` reaches the print page, its same-origin subrequests, and
  `/favicon.ico`; an `extraHttpHeaders` `Cookie` header reaches
  subrequests too and is the fallback.
- Cookie clearing (D4): a credential-free conversion carried no cookie
  immediately after a credentialed success, a credentialed `409` failure,
  a readiness `503` timeout, and a client abort (renderer-side `499`).
- Browser state clearing (D4): without `CHROMIUM_CLEAR_STORAGE` a
  committed localStorage sentinel crossed to the next conversion (probe
  FAIL); with it, localStorage clears on success, `409`, `503`-timeout,
  and abort paths; without `CHROMIUM_CLEAR_CACHE` a cacheable resource
  served stale bytes to the next conversion with zero network requests,
  and with it the second conversion re-fetches (control container proved
  the test non-vacuous). Probes did not exercise sessionStorage, IndexedDB,
  Cache Storage API, or service-worker state.
- Status surface (D5): direct disallowed origin → `403`; page HTTP 500 →
  `409`; dead upstream → pinning-proxy `502` → `409`; never-ready gate →
  `503` at `API_TIMEOUT`; redirect into a disallowed origin → zero bytes
  to the blocked upstream, then `503` — not `403`; client disconnect →
  renderer-side `499` `context canceled` (the abort terminates the render
  and frees the serialized slot).
- Timeout scope (D6): `API_TIMEOUT` includes queue wait under
  `CHROMIUM_MAX_CONCURRENCY=1` (a fast request behind a 14 s render with a
  12 s timeout died at its own deadline without receiving a slot).
- Image pin (D9): `gotenberg/gotenberg:8.37.0-chromium` — multi-platform
  manifest-list digest
  `sha256:0d28ae9a96441588ef739623726bd500ad0720b77266c6f1351a13e333fbd61c`;
  the probes exercised the linux/arm64 manifest digest
  `sha256:56bc8933e838e3fc83723dbf4e6970ad46f43ea90d8384a620498937f056f20e`.
  ARM64 results do not certify other platforms.
- Initial limits (D6): `API_TIMEOUT=150s`, API-side client timeout `160s`
  including response-body consumption — advisor-recommended starting
  values, not capacity or production performance evidence. The 5-minute
  token TTL is unchanged; the token is minted per BullMQ attempt.
- Source audits: `/health/ready` aggregates `database`, `redis`, `bullmq`,
  `memory_heap` only; the renderer probe is separate; `pnpm dev:watch` is
  the Compose-source workflow while host-source `pnpm dev` boots with the
  renderer signal `down` (D8); the reachable `/print` tree at `c1781215`
  uses no JavaScript persistent-storage API (IndexedDB, Cache Storage,
  service workers, localStorage, sessionStorage all absent — source
  evidence only); the Playwright removal surface is inventoried file by
  file (D9).

**Still unproven — runtime acceptance items, not claims:**

- Isolation of sessionStorage, IndexedDB, Cache Storage API, and
  service-worker state — not exercised by probes; accepted because the
  `/print` tree uses none at `c1781215`, and gated on a fresh
  reachable-print-source audit on the final implementation candidate (the
  storage findings do not generalize beyond that ref).
- Real two-requester identity isolation on the application stack (probes
  used a single synthetic origin).
- Serialized-queue saturation behavior under real export volume — the
  150s/160s figures are starting values and do not prove saturation is
  harmless.
- Sufficiency of the provisional 1 GiB renderer memory cap — an initial
  containment value only; item 16 captures the effective and actual
  limits, peak usage, OOM behavior, and host headroom, and a local pass
  does not certify an unknown production host or platform.
