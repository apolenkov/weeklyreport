## Why

In production every PDF download is broken AND the artifacts are exposed
unauthenticated. The browser opens the relative `artifactUrl`
(`/pdfs/{jobId}.pdf`) same-origin, but the Caddy `@api` matcher omits `/pdfs`,
so the request falls through to `web:3000` and 404s (P0-3). Separately, the API
serves those files via `express.static('/pdfs')` with no authz, and the API
container port is published directly to the host, so anyone who can reach the
port can read any report PDF by guessing a job id (P0-11). PDF export is a fully
wired feature, not a stub, so both gaps bite real users.

## What Changes

- Route the PDF download path to the API at the edge: add `/pdfs` and `/pdfs/*`
  to the `@api` path matcher in `deploy/caddy/Caddyfile` and
  `deploy/caddy/Caddyfile.staging`, and add the matching dev rewrite in
  `apps/web/next.config.ts` so local dev behaves the same.
- **BREAKING (artifact serving):** replace the unauthenticated
  `express.static('/pdfs')` mount with an authenticated, authorized download
  handler. The handler resolves the caller's ambient session cookie
  (`customreport_session`) through a dedicated user-session resolver and serves
  the file only when the caller currently has role+scope read access to the
  bound report. Being the job's original `requestedBy` is not a standalone grant:
  once that read access is revoked the artifact is no longer served, so a viewer
  who exported while in-scope cannot keep pulling the bytes after losing access.
- Reuse the existing session-verification pipeline (revocation + `isActive`
  checks) for the download handler so a stale or deactivated session cannot
  pull artifacts. The resolver accepts only a human user session — it does NOT
  fall back to the PDF-export worker token or the dev-mode synthetic session
  that the full `trpc.context` chain otherwise accepts.
- Serve only a job whose `status` is `completed` and whose persisted artifact
  path matches the requested path, so a pending/failed row or an orphan
  same-named file on disk is never streamed.

Non-goals:

- Removing the direct host-port publication of the API in
  `docker-compose.prod.yml` (broader deploy-seam / `/metrics` exposure tracked
  by `BL-DEPLOY-SEAM-MISC` and P1-11). Replacing the static mount with an authz
  handler already closes the unauthenticated-artifact path on every port.
- Persisting the PDF checksum or any change to job generation
  (`BL-PDF-CHECKSUM-DEAD`).
- The PDF-export worker token flow (`signPdfExportToken`) used by the headless
  Playwright render — it is a separate inbound path and stays as is.

## Capabilities

### New Capabilities

- `pdf-artifact-delivery`: how generated PDF artifacts are routed from the
  browser through the edge to the API, and the authorization the API enforces
  before streaming a file.

### Modified Capabilities

<!-- none: no existing capability governs artifact serving or edge routing -->

## Impact

- Deploy: `deploy/caddy/Caddyfile`, `deploy/caddy/Caddyfile.staging`.
- Web: `apps/web/src/components/weekly-report/export-pdf-button.tsx`
  (download target), `apps/web/next.config.ts` (dev rewrite).
- API: `apps/api/src/main.ts` (drop the static mount; mount the authz handler),
  plus a new download handler and its authorization check; reuses
  `verifySessionToken` + `SessionRevocation` + the requester/scope logic.
- No schema change; `PDF_OUTPUT_DIR` and the worker token flow are unchanged.
