## ADDED Requirements

### Requirement: The web-vitals endpoint validates its payload before recording

The system SHALL validate every `POST /api/web-vitals` body against a fixed
schema before any metric is recorded, and SHALL reject an invalid body with a
`400` response while recording nothing. `name` MUST be one of the known vitals
(`LCP`, `CLS`, `FCP`, `INP`, `TTFB`); `value` MUST be a finite number; `id` MUST
be a non-empty string; `navigationType` is optional. A missing, non-numeric, or
otherwise malformed field MUST NOT cause an unhandled exception or a `500`.

#### Scenario: A well-formed vital is accepted and recorded

- **GIVEN** a body `{ "name": "LCP", "value": 1234.5, "id": "v1", "navigationType": "navigate" }`
- **WHEN** the endpoint receives it
- **THEN** the response status is a 2xx success
- **AND** the corresponding `web_vital_lcp` metric records the observation

#### Scenario: A non-numeric value is rejected without a 500

- **GIVEN** a body `{ "name": "LCP", "id": "v1" }` with no `value`
- **WHEN** the endpoint receives it
- **THEN** the response status is `400`
- **AND** no metric is recorded and no unhandled exception is thrown

#### Scenario: An unknown metric name is rejected

- **GIVEN** a body `{ "name": "BOGUS", "value": 10, "id": "v1" }`
- **WHEN** the endpoint receives it
- **THEN** the response status is `400`
- **AND** no metric is recorded

### Requirement: navigationType is whitelisted to a bounded label set

The system SHALL map the client-supplied `navigationType` to a fixed,
finite set of label values before using it as a Prometheus label, so the number
of distinct `navigation_type` label values cannot grow with arbitrary client
input. Recognised values are the `web-vitals` navigation types
(`navigate`, `reload`, `back-forward`, `back-forward-cache`, `prerender`,
`restore`); an absent or unrecognised value MUST collapse to a single bounded
fallback bucket (`other`).

#### Scenario: A recognised navigation type is used verbatim

- **GIVEN** a valid vital with `navigationType` of `reload`
- **WHEN** the endpoint records it
- **THEN** the observation carries the `navigation_type="reload"` label

#### Scenario: An unrecognised navigation type collapses to the fallback bucket

- **GIVEN** a valid vital with `navigationType` of `"; DROP" ` or any value outside the whitelist
- **WHEN** the endpoint records it
- **THEN** the observation carries the `navigation_type="other"` label
- **AND** no new distinct label value is created for the raw client string

#### Scenario: An absent navigation type collapses to the fallback bucket

- **GIVEN** a valid vital with no `navigationType` field
- **WHEN** the endpoint records it
- **THEN** the observation carries the `navigation_type="other"` label

### Requirement: Vitals are recorded as histograms, not last-write-wins gauges

The system SHALL record each web vital as a Prometheus `Histogram` with buckets
appropriate to that metric and SHALL record each sample with `observe(value)`,
so `/metrics` exposes a distribution (enabling p75/p95 quantiles) rather than a
single overwritten gauge value. The `web_vital_*` series MUST NOT be `Gauge`
instruments.

#### Scenario: Repeated samples accumulate into a distribution

- **GIVEN** three valid `LCP` vitals with values `800`, `1500`, and `4200`
- **WHEN** each is recorded in turn
- **THEN** the `web_vital_lcp` histogram count reflects all three observations
- **AND** the bucket and sum series reflect the distribution, not only the last value

#### Scenario: Each vital uses metric-appropriate buckets

- **GIVEN** the histograms for `LCP`, `FCP`, `TTFB`, `INP` (milliseconds) and `CLS` (unitless score)
- **WHEN** the metrics are registered
- **THEN** each histogram declares explicit buckets sized for that metric's range
- **AND** the `CLS` buckets differ from the millisecond-scaled vitals' buckets

### Requirement: The web-vitals endpoint is rate-limited

The system SHALL apply a dedicated rate limit to `POST /api/web-vitals` so an
unauthenticated client cannot flood the endpoint, and SHALL return the standard
rate-limit response once the per-window limit is exceeded. The endpoint MAY
remain anonymous (the browser beacon fires before or without an authenticated
session); the rate limit is the abuse boundary, not authentication.

#### Scenario: Traffic within the limit is recorded normally

- **GIVEN** a client posting valid vitals below the per-window limit
- **WHEN** the requests arrive
- **THEN** each is accepted and recorded

#### Scenario: Traffic above the limit is throttled

- **GIVEN** a client exceeding the per-window vitals limit from one source
- **WHEN** the next request arrives
- **THEN** the response status is `429`
- **AND** the `rateLimitHitsTotal` counter increments for the vitals bucket
