## ADDED Requirements

### Requirement: Redirect targets are validated as same-origin before use

The system SHALL accept a user-influenced redirect target only when it resolves
to the application's own origin, and SHALL otherwise fall back to a trusted
default route. Validation MUST resolve the candidate with the WHATWG URL parser
relative to the application origin and confirm the resolved `origin` equals the
expected origin; manual rejection of scheme-relative and backslash-escaped forms
is applied as defense-in-depth, not as the primary mechanism.

#### Scenario: Same-origin relative path is accepted

- **GIVEN** a redirect candidate `/lead/report`
- **WHEN** the system validates it against the application origin
- **THEN** the candidate is accepted and used as the redirect destination

#### Scenario: Backslash bypass is rejected

- **GIVEN** a crafted redirect candidate `/\evil.com`
- **WHEN** the system validates it against the application origin
- **THEN** the resolved origin differs from the application origin
- **AND** the candidate is rejected and the trusted default route is used instead

#### Scenario: Scheme-relative and absolute off-origin targets are rejected

- **GIVEN** a redirect candidate `//evil.com` or `https://evil.com`
- **WHEN** the system validates it against the application origin
- **THEN** the candidate is rejected and the trusted default route is used instead

#### Scenario: Empty or absent target uses the default

- **GIVEN** no redirect candidate is supplied
- **WHEN** the system resolves the redirect destination
- **THEN** the trusted default route for the visitor is used

### Requirement: The web landing page only follows a validated redirect

The web landing page SHALL pass every `next` query value through same-origin
validation before using it as the auto-redirect destination or embedding it in
the SSO sign-in link.

#### Scenario: Authenticated auto-redirect honours only a validated target

- **GIVEN** an authenticated visitor lands on `/` with `next=/\evil.com`
- **WHEN** the page auto-redirects the session
- **THEN** the navigation goes to the visitor's role default, not `evil.com`

#### Scenario: SSO link carries only a validated next

- **GIVEN** an anonymous visitor lands on `/` with an off-origin `next` value
- **WHEN** the SSO sign-in link is built
- **THEN** the link carries the role default rather than the off-origin value

### Requirement: Auth-route redirects validate and construct with one parser

The dev-mode auth routes SHALL validate the `next`/`redirect` query value with
the same hardened same-origin rule and SHALL construct the final redirect URL
with the same URL parser used to validate it, so a value cannot pass validation
yet resolve to a different origin when the redirect is issued.

#### Scenario: SAML dev short-circuit rejects the backslash bypass

- **GIVEN** AUTH_DEV_MODE is enabled and `/auth/saml/login?next=/\evil.com`
- **WHEN** the short-circuit forwards to dev-login
- **THEN** the forwarded `redirect` carries the role default, not `evil.com`

#### Scenario: Dev-login rejects userinfo-injection via concatenation

- **GIVEN** AUTH_DEV_MODE is enabled and dev-login receives `redirect=@evil.com`
- **WHEN** the route issues the post-login redirect
- **THEN** the Location resolves to the application origin, not host `evil.com`

#### Scenario: Dev-login honours a legitimate same-origin redirect

- **GIVEN** AUTH_DEV_MODE is enabled and dev-login receives `redirect=/admin`
- **WHEN** the route issues the post-login redirect
- **THEN** the Location is the application origin path `/admin`
