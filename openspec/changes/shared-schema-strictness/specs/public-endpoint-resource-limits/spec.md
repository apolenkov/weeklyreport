## ADDED Requirements

### Requirement: Numeric Fields On A Public Beacon Are Range-Bounded

A Zod schema validating a body posted to an unauthenticated public ingress surface MUST bound every numeric field with both a lower and an upper limit, not a lower bound alone.

For example, `webVitalBeaconSchema` on `POST /api/web-vitals` is one such
surface. An unbounded numeric field on a public endpoint lets a single
adversarial or buggy request corrupt derived aggregates (e.g. a Prometheus
histogram's `_sum`) that assume realistic input.

#### Scenario: An out-of-range web-vital value is rejected

- **WHEN** an unauthenticated caller posts a `webVitalBeaconSchema` body whose
  `value` exceeds the documented maximum
- **THEN** the beacon is rejected before any metric write
- **AND** a realistic in-range `value` for every supported `name`
  (`LCP`, `CLS`, `FCP`, `INP`, `TTFB`) still parses successfully
