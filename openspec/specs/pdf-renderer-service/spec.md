# pdf-renderer-service Specification

## Purpose

Define the contract of the internal Gotenberg render service the `pdf-export`
worker delegates page capture to: request/response surface, readiness gating,
credential transport, network boundary, bounds, and deployment posture.

## Requirements

### Requirement: The renderer converts the print URL through a bounded HTTP contract

The `pdf-export` worker MUST obtain PDF bytes by POSTing the job's print URL
to the internal renderer's URL-conversion route
(`POST /forms/chromium/convert/url`) as `multipart/form-data`. The request
MUST carry the print URL built from the configured print base
(`{PDF_BASE_URL}/print/{reportId}?jobId={jobId}`), A4 page dimensions
(`paperWidth` 8.27in, `paperHeight` 11.7in), and `printBackground=true`.
The response body on success MUST be the PDF byte stream consumed by the
existing artifact protocol.

#### Scenario: A render request describes the job's print page

- **WHEN** the worker submits a render request for job `J` of report `R`
- **THEN** the request URL field is `{PDF_BASE_URL}/print/{R}?jobId={J}`
- **AND** the request carries A4 dimensions and `printBackground=true`

#### Scenario: Renderer bytes feed the unchanged artifact protocol

- **WHEN** the renderer answers a render request with a PDF body
- **THEN** the worker treats the body as the artifact bytes and runs the
  existing attempt-owned publish, checksum, and completion path

### Requirement: The render request carries the readiness gate

The render request MUST gate conversion on the print template's ready
contract via the renderer's `waitForExpression` field: the expression MUST
hold only when `[data-print-state="ready"]` is present and
`document.fonts.status` is `loaded`. The expression MUST stay identical to
the marker tokens the print template emits. A render whose page settles on
`data-print-state="error"` or never reaches `ready` within the bounded wait
MUST fail the conversion — no PDF bytes are produced from a spinner or error
page.

#### Scenario: A ready page converts

- **GIVEN** the print page reaches `data-print-state="ready"` with fonts
  loaded inside the bounded wait
- **WHEN** the render request runs
- **THEN** the renderer returns the PDF bytes

#### Scenario: An error or never-ready page fails the conversion

- **GIVEN** the print page settles on `data-print-state="error"` or the ready
  marker never appears
- **WHEN** the render request runs
- **THEN** the conversion fails within its bounded duration
- **AND** no success body is returned to the worker

### Requirement: The render request carries the job-bound credential, scoped to the print origin

The render request MUST attach the worker's short-lived export token so the
print route's token verification resolves the pdf-export session. The
credential MUST be scoped to the configured print origin via the
renderer's `cookies` field with `domain` set to the print origin's host
(probe-verified, including a single-label cluster hostname), and MUST NOT
be sent to any other origin or persisted by the renderer
between conversions (`CHROMIUM_CLEAR_COOKIES`, `CHROMIUM_CLEAR_STORAGE`,
and `CHROMIUM_CLEAR_CACHE` enabled, or equivalent per-request isolation).
While the credential travels through the renderer's shared cookie jar,
conversions MUST be serialized so no two jobs' credentials can coexist
(see the concurrency requirement below).

#### Scenario: The print route authenticates the render

- **WHEN** the renderer loads the print URL with the attached token
- **THEN** the print route resolves the pdf-export session and renders the
  job's frozen snapshot

#### Scenario: The credential never crosses the origin boundary

- **WHEN** any sub-resource or navigation targets a non-print origin
- **THEN** the request carries no export credential
- **AND** outbound filtering rejects it outright

### Requirement: Renderer outbound traffic is restricted to the print origin

The renderer's outbound navigation and sub-resource fetches MUST be confined
to the configured print origin: an anchored allow-list matching that origin
MUST be the only permitted destination, and both private-IP and public-IP
deny classes MUST reject everything else. The renderer's DNS-rebind pinning
MUST remain active. `file://` URLs remain rejected by the conversion route.
A redirect into a disallowed origin MUST still produce zero requests to that
origin; the conversion then fails at its bounded timeout (measured `503`),
not as a direct rejection.

#### Scenario: A non-print URL is refused

- **WHEN** a conversion request or in-page navigation targets any URL outside
  the configured print origin
- **THEN** outbound filtering rejects it and no fetch occurs

#### Scenario: The print origin remains reachable

- **WHEN** the conversion targets the configured print origin
- **THEN** the allow-list admits it despite the IP-class denies

### Requirement: The render service reports its own outcome vocabulary

The renderer signals conversion outcomes through its status surface
(documented, and measured on 2026-09-23 probes): `200` with the PDF body on
success; `400` for invalid request fields and, per the documented surface,
critical main-page network errors; `403` for a URL forbidden by outbound
filtering; `409` for a main-page HTTP status matched by
`failOnHttpStatusCodes` (default `[499,599]`), which in this deployment
also covers the pinning proxy's `502` for a dead upstream; and `503` for a
conversion that did not complete within its configured duration — including
queue-wait time under serialized concurrency and navigations blocked
mid-flight. Because `400` conflates malformed input with a transient
print-page failure and `409`/`503` cover transient conditions, only `403`
is unambiguously deterministic; the worker's mapping MUST NOT treat
`400`/`409`/`503`, transport failures, or client-side timeouts as terminal.
The service MUST expose `GET /health` for container and API-side probing.

#### Scenario: Outcome statuses are distinguishable

- **WHEN** the worker receives `200`, `400`, `403`, `409`, `503`, or a
  transport failure
- **THEN** each outcome is independently classifiable for the job's
  terminal/retryable mapping
- **AND** only `403` maps to a terminal-without-retry outcome

### Requirement: Renderer conversions are serialized while the cookie jar carries credentials

The renderer serves conversions through one shared browser whose default
concurrency (`CHROMIUM_MAX_CONCURRENCY=6`) lets overlapping conversions share
the cookie jar. While the export credential is transported as a cookie, the
deployment MUST pin `CHROMIUM_MAX_CONCURRENCY=1` so no two conversions — and
their credentials — can overlap, and MUST keep `CHROMIUM_CLEAR_COOKIES=true`,
`CHROMIUM_CLEAR_STORAGE=true`, and `CHROMIUM_CLEAR_CACHE=true` so each
conversion starts with an empty cookie jar, cleared localStorage, and an
empty HTTP cache — localStorage and cacheable bytes were measured crossing
the conversion boundary without those flags. The flags do not clear
IndexedDB, and a tab orphaned by a client abort (only when the API process
dies mid-render) keeps running until its own deadline beside later
conversions; both are accepted because the `/print` tree uses no
persistent-storage API (reachable-print-source audit). Under serialization the renderer per-request
deadline includes queue waiting, so a queued conversion can exhaust its own
timeout before receiving a slot — a bounded, retryable outcome. This
invariant MUST be asserted by the production Helm gate against the
effective configured values, not mere env presence; it MAY be relaxed only
when the credential transport is proven to be per-request isolated from the
shared jar.

#### Scenario: Two jobs never share a credential

- **GIVEN** two export jobs for different reports and requesters are
  dispatched together
- **WHEN** both conversions run through the renderer
- **THEN** they execute serially, each print render resolves only its own
  job's session, and both artifacts contain the correct report

#### Scenario: The invariant is gate-enforced

- **WHEN** the rendered production Helm manifests are inspected by the
  configuration gate
- **THEN** the renderer service carries `CHROMIUM_MAX_CONCURRENCY=1`,
  `CHROMIUM_CLEAR_COOKIES=true`, `CHROMIUM_CLEAR_STORAGE=true`, and
  `CHROMIUM_CLEAR_CACHE=true`
- **AND** a change relaxing any of those values fails the gate

### Requirement: The render request is bounded in time and size

The renderer's per-request time limit (`API_TIMEOUT`, covering queue wait
plus navigation, the readiness wait, and capture) MUST exceed the export
render budget, and the API-side client MUST apply its own timeout just
above it — including response-body consumption — so a wedged conversion
cannot hang the job attempt. The initial deployment values are
`API_TIMEOUT=150s` with a `160s` API-side timeout; these are starting
values to be tuned by observed render times, not capacity evidence. The
worker MUST bound the response body at an explicit initial maximum of
64 MiB, enforced while streaming the body — cancelling and releasing the
stream on overflow — and MUST validate the bytes as a minimal PDF
(non-empty body, `%PDF-` header, `%%EOF` marker after trailing whitespace)
before the artifact store sees them. The 64 MiB figure is an explicit
initial safety bound, not measured capacity evidence.

#### Scenario: A hung conversion fails inside the budget

- **WHEN** a conversion exceeds the renderer's configured request limit
- **THEN** the renderer answers `503` within that bound
- **AND** the worker's client timeout never fires later than the job's
  attempt budget

### Requirement: The renderer service is internal-only and immutably pinned

The production `gotenberg` service MUST be declared in the Helm chart with an
immutable image reference — `gotenberg/gotenberg:8.39.0-chromium` pinned by
the multi-platform manifest-list sha256 digest — MUST NOT publish a host
port or a public ingress route, and MUST be reachable only by the API over
the internal network. The API MUST locate it through validated fail-closed
configuration (`GOTENBERG_URL`, no default) rather than a hardcoded
address.

#### Scenario: No external surface exists

- **WHEN** the rendered production Helm resources are inspected
- **THEN** the renderer has only an internal ClusterIP Service, no host port or host networking, and no ingress route
- **AND** the API reaches it only through `GOTENBERG_URL` on the internal
  network

#### Scenario: Missing renderer configuration fails boot

- **WHEN** `GOTENBERG_URL` is absent or malformed
- **THEN** API boot validation fails before the service accepts traffic
