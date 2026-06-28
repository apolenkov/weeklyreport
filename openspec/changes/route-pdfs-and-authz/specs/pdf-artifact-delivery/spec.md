## ADDED Requirements

### Requirement: Edge and dev proxy route the PDF download path to the API

The system SHALL route `/pdfs` and `/pdfs/*` requests to the API service at the
production edge, the staging edge, and the local dev proxy. The browser opens
the artifact same-origin via the relative download path, so the path MUST reach
the API rather than falling through to the web frontend.

#### Scenario: Production edge routes the download path to the API

- **GIVEN** the production `deploy/caddy/Caddyfile` is in effect
- **WHEN** a browser requests the PDF download path same-origin
- **THEN** the `@api` matcher includes `/pdfs` and `/pdfs/*`
- **AND** the request is reverse-proxied to the API service, not to `web:3000`

#### Scenario: Staging edge routes the download path to the API

- **GIVEN** the `deploy/caddy/Caddyfile.staging` (internal-CA) config is in effect
- **WHEN** a browser requests the PDF download path same-origin
- **THEN** the `@api` matcher includes `/pdfs` and `/pdfs/*`
- **AND** the request is reverse-proxied to the API service

#### Scenario: Local dev proxy routes the download path to the API

- **GIVEN** the Next.js dev server with the `next.config.ts` rewrites
- **WHEN** a browser requests the PDF download path same-origin
- **THEN** a rewrite forwards `/pdfs/:path*` to the configured API URL
- **AND** local PDF download succeeds against the API

### Requirement: PDF artifacts are served only through an authorized download endpoint

The system SHALL serve generated PDF artifacts exclusively through a download
endpoint that requires a valid caller session and authorizes the caller against
the bound export job, with no unauthenticated static file mount remaining on any
port. The caller is authorized when the caller is the export job's original
requester OR the caller has role-and-scope read access to the report the job is
bound to.

#### Scenario: Original requester downloads their own export

- **GIVEN** a completed export job whose `requestedBy` is the caller
- **WHEN** the caller requests that artifact with a valid session cookie
- **THEN** the endpoint streams the PDF with `Content-Type: application/pdf`

#### Scenario: In-scope reader downloads an artifact requested by someone else

- **GIVEN** a completed export job bound to a report the caller may read by role and group scope
- **AND** the job's `requestedBy` is a different user
- **WHEN** the caller requests that artifact with a valid session cookie
- **THEN** the endpoint authorizes by report read access and streams the PDF

#### Scenario: Unauthenticated request is rejected

- **GIVEN** a request for an artifact with no valid session cookie
- **WHEN** the endpoint resolves the caller
- **THEN** the endpoint responds 401 and serves no file bytes

#### Scenario: Out-of-scope caller is rejected

- **GIVEN** an authenticated caller who is neither the requester nor an in-scope reader of the bound report
- **WHEN** the caller requests that artifact
- **THEN** the endpoint responds 403 and serves no file bytes

#### Scenario: No unauthenticated static mount remains on any port

- **GIVEN** the API reached directly on its host-published port, bypassing the edge
- **WHEN** the artifact path is requested without a valid session
- **THEN** the request is still rejected, because the unauthenticated `express.static` mount has been removed

### Requirement: Artifact download reuses the session revocation and active-account checks

The system SHALL apply the same session-verification pipeline used by the tRPC
context — token verification, the revocation fast path, and the `isActive`
account check — before streaming any artifact, so a stale, revoked, or
deactivated session cannot pull files.

#### Scenario: Revoked session cannot download

- **GIVEN** a session token whose user is in the revocation set
- **WHEN** the caller requests an artifact
- **THEN** the endpoint treats the token as invalid and responds 401

#### Scenario: Deactivated account cannot download

- **GIVEN** a session token whose user row has `isActive = false`
- **WHEN** the caller requests an artifact
- **THEN** the endpoint denies access and serves no file bytes
