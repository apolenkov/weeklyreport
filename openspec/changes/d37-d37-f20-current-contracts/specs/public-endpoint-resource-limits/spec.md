## MODIFIED Requirements

### Requirement: Public ingress body sizes are bounded by an explicit limit

Each unauthenticated api ingress surface that parses a request body MUST cap the
body size with an explicit, named limit rather than an implicit framework
default. The tRPC express adapter (`trpcExpress.createExpressMiddleware` in
`apps/api/src/main.ts`) MUST be given an explicit body-size bound (via
`maxBodySize` or a preceding `express.json` limit) using a named byte constant,
matching how the `/api/client-logs` handler already sets `express.json({ limit:
"128kb" })` explicitly.

#### Scenario: an oversized tRPC mutation body

- **WHEN** a tRPC mutation arrives with a serialized body larger than the
  configured limit
- **THEN** the request is rejected with `413` before the procedure runs

#### Scenario: a normal tRPC mutation body

- **WHEN** a tRPC mutation arrives with a body within the configured limit
- **THEN** the request is parsed and the procedure executes as before

#### Scenario: the limit is auditable in code

- **WHEN** a reviewer inspects the tRPC ingress mount
- **THEN** the body-size bound is a named constant visible at the mount site,
  not an undocumented adapter default

The local Web `/api/client-logs` proxy MUST enforce its existing 128 KiB byte
budget while reading the body stream. Content-Length is a hint: a declared
oversize MUST reject before body-reader acquisition, and absent, malformed or
understated values MUST NOT bypass the stream bound. Crossing the stream budget
MUST return 413 and cancel the reader without waiting for EOF or forwarding the
body; the reader lock MUST be released. Valid UTF-8 JSON at the byte boundary
MUST be forwarded unchanged. Configuration failure remains fail-loud; ordinary
transport failures retain the existing best-effort response. Canonical
production Caddy forwards this API-owned path directly to API; this requirement
does not claim a demonstrated production memory attack through Web.

#### Scenario: A direct-Web stream crosses the body budget without EOF

- **WHEN** the local Web client-log route receives more than 128 KiB without stream EOF
- **THEN** it cancels the stream and returns 413 before any upstream fetch
- **AND** missing or malformed Content-Length does not bypass that bound

#### Scenario: A direct-Web body exactly meets the byte budget

- **WHEN** the local Web client-log route receives valid UTF-8 JSON of exactly 128 KiB
- **THEN** it forwards the bounded body unchanged
- **AND** an explicitly oversized Content-Length rejects before acquiring a body reader
