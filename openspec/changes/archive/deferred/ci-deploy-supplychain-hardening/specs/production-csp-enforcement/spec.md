## ADDED Requirements

### Requirement: The policy is validated before it is enforced

The Content-Security-Policy SHALL be validated against the production Next.js
bundle before it is switched to enforcing, so flipping the header does not break
the application. Validation MUST confirm that legitimate script, style, image,
and connect sources the app actually uses are permitted by the policy (in
particular any inline/nonce script needs of the Next.js runtime), and any
required directive (for example a `script-src` with nonces) MUST be added to the
policy before enforcement.

#### Scenario: App functions under the candidate policy in report mode

- **GIVEN** the candidate enforcing policy expressed as `Content-Security-Policy-Report-Only`
- **WHEN** the production web app is exercised across the role surfaces
- **THEN** no legitimate resource is reported as a violation, and any directive
  needed to admit a legitimate source is added before enforcement

### Requirement: The production edge enforces CSP, not Report-Only

The Caddy edge SHALL serve the enforcing `Content-Security-Policy` header in
production rather than `Content-Security-Policy-Report-Only`, so the policy
actually blocks disallowed sources. Both `deploy/caddy/Caddyfile` and
`deploy/caddy/Caddyfile.staging` MUST emit the enforcing header once the policy
is validated; the `-Report-Only` variant MUST NOT remain the only CSP source in
production.

#### Scenario: Enforcing header is sent in both Caddy configs

- **GIVEN** the updated `deploy/caddy/Caddyfile` and `Caddyfile.staging`
- **WHEN** the edge response headers are inspected
- **THEN** each config emits a `Content-Security-Policy` header (enforcing), and
  neither relies on `Content-Security-Policy-Report-Only` as its only CSP source

#### Scenario: A disallowed inline script is blocked

- **GIVEN** the enforcing CSP is live at the edge
- **WHEN** a response attempts to load a script from a source the policy does
  not permit
- **THEN** the browser blocks that script per the enforced policy, rather than
  only reporting it

### Requirement: A violation report sink is optional, not required

CSP enforcement SHALL NOT depend on a violation report sink existing, so the
absence of a `report-uri` / `report-to` endpoint does not block flipping the
policy to enforcing. A report sink MAY be wired for monitoring, but it is
optional.

#### Scenario: Enforcement holds without a report sink

- **GIVEN** the enforcing CSP is live
- **WHEN** no `report-uri` / `report-to` endpoint is configured
- **THEN** the policy still blocks disallowed sources, and the missing sink only
  means violations are not collected, not that the policy fails open
