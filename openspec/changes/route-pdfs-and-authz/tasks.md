## 1. Edge and dev routing

- [ ] 1.1 Add `/pdfs /pdfs/*` to the `@api` path matcher in `deploy/caddy/Caddyfile`
- [ ] 1.2 Add `/pdfs /pdfs/*` to the `@api` path matcher in `deploy/caddy/Caddyfile.staging`
- [ ] 1.3 Update the route comment block in both Caddyfiles to list the `/pdfs` route
- [ ] 1.4 Add a `{ source: "/pdfs/:path*", destination: "${API_URL}/pdfs/:path*" }` rewrite in `apps/web/next.config.ts`

## 2. Authorization helper

- [ ] 2.1 Extract the session-verify + revocation + `isActive` steps from `trpc.context.ts` into a reusable helper (or call the existing path) so the download handler runs the identical pipeline
- [ ] 2.2 Implement the report read-access check reused from the report read path (caller role + group scope vs `job.reportId`)
- [ ] 2.3 Implement the authorize predicate: `caller === job.requestedBy` OR caller passes the report read-access check

## 3. Authenticated download handler

- [ ] 3.1 Add a download handler mounted at the `/pdfs/:file` base in `apps/api/src/main.ts`
- [ ] 3.2 In the handler: resolve+verify the `customreport_session` cookie; respond 401 when absent/invalid/revoked/inactive
- [ ] 3.3 Parse `jobId` from the path, load the export job, read `requestedBy` and bound `reportId`; respond 404 when the job or file is missing
- [ ] 3.4 Apply the authorize predicate; respond 403 when the caller is neither requester nor in-scope reader
- [ ] 3.5 Stream the file from `PDF_OUTPUT_DIR` with `Content-Type: application/pdf` and `Content-Disposition: attachment`
- [ ] 3.6 Remove the unauthenticated `express.static('/pdfs')` mount so no unauthenticated path remains on any port
- [ ] 3.7 (Pending D-Open) Decide whether an in-scope download writes a `scope-accessed-audit` entry; wire it if yes

## 4. Tests

- [ ] 4.1 Handler test: original requester downloads own export → 200 + PDF bytes
- [ ] 4.2 Handler test: in-scope viewer/head downloads an artifact requested by another user → 200
- [ ] 4.3 Handler test: unauthenticated request → 401, no bytes
- [ ] 4.4 Handler test: out-of-scope caller → 403, no bytes
- [ ] 4.5 Handler test: revoked-set user and `isActive=false` user → denied
- [ ] 4.6 Handler test: missing job/file → 404

## 5. Verification

- [ ] 5.1 Confirm the only download consumer is `export-pdf-button.tsx` (`artifactUrl` stays `/pdfs/{jobId}.pdf`); no other reference relies on the static mount
- [ ] 5.2 Validate both Caddyfiles parse (`caddy validate` / `caddy fmt`)
- [ ] 5.3 Manually verify a direct host-port request to the artifact path is rejected without a session (P0-11 bypass closed)
- [ ] 5.4 Run `pnpm typecheck && pnpm lint && pnpm test` green
