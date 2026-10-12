# Spec Delta

## MODIFIED Requirements

### Requirement: Numeric Fields On A Public Beacon Are Range-Bounded

A Zod schema validating a body posted to an unauthenticated public ingress surface MUST bound every numeric field with both a lower and an upper limit, not a lower bound alone.

For example, `webVitalBeaconSchema` on `POST /api/web-vitals` is one such
surface. An unbounded numeric field on a public endpoint lets a single
adversarial or buggy request corrupt derived aggregates (e.g. a Prometheus
histogram's `_sum`) that assume realistic input.

For `POST /api/web-vitals`, the system MUST accept CLS scores only in the inclusive range 0–10 and timing metrics (`LCP`, `FCP`, `INP`, `TTFB`) only in the inclusive range 0–300000 milliseconds. The CLS ceiling is an input validation bound, not a product performance threshold.

#### Scenario: An out-of-range web-vital value is rejected

- **WHEN** an unauthenticated caller posts a `webVitalBeaconSchema` body whose
  `value` exceeds the documented maximum
- **THEN** the beacon is rejected before any metric write
- **AND** a realistic in-range `value` for every supported `name`
  (`LCP`, `CLS`, `FCP`, `INP`, `TTFB`) still parses successfully

#### Scenario: Oversized CLS is rejected without an observation

- **WHEN** an unauthenticated caller posts a CLS beacon with `value` above 10
- **THEN** the response is 400 and no histogram observation is written
- **AND** validation identifies the `value` field

#### Scenario: Inclusive metric-specific boundaries remain accepted

- **WHEN** a caller posts CLS with `value` 0 or 10, or a timing metric with `value` 300000
- **THEN** the beacon is accepted and recorded in its corresponding histogram
