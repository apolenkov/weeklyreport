# observability-metrics-coverage Delta Specification

## ADDED Requirements

### Requirement: HTTP metric and access-log routes have bounded cardinality

Non-tRPC HTTP access logs and `http_request_duration_seconds` MUST use the same bounded route vocabulary. Known ingress families MAY use stable templates; every unmatched path MUST collapse to one fallback value rather than preserving request-controlled segments.

#### Scenario: An unmatched HTTP path is requested

- **WHEN** a client sends any number of distinct non-tRPC paths outside the known health, auth, PDF, queue, metrics, and client-log families
- **THEN** access logs and the latency metric record the same single unmatched route value without retaining attacker-controlled path segments
