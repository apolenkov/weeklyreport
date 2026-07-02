## 1. Edge and dev routing

- [ ] 1.1 Add `/pdfs /pdfs/*` to the `@api` path matcher in `deploy/caddy/Caddyfile`
- [ ] 1.2 Add `/pdfs /pdfs/*` to the `@api` path matcher in `deploy/caddy/Caddyfile.staging`
- [ ] 1.3 Update the route comment block in both Caddyfiles to list the `/pdfs` route
- [ ] 1.4 Add a `{ source: "/pdfs/:path*", destination: "${API_URL}/pdfs/:path*" }` rewrite in `apps/web/next.config.ts`

## 2. Authorization helper

- [ ] 2.1 Extract the session-verify + revocation + `isActive` steps from `trpc.context.ts` into a reusable user-session resolver and call THAT from the download handler — do NOT call the full `createContext` chain, which falls back to the PDF-export worker token and the dev-mode synthetic session; the resolver must reject both and return 401
- [ ] 2.2 Implement the report read-access check reused from the report read path (caller role + group scope vs `job.reportId`)
- [ ] 2.3 Implement the authorize predicate: the caller currently passes the report read-access check; the job's `requestedBy` is NOT a standalone bypass once that read access is revoked (D3)

## 3. Authenticated download handler

- [ ] 3.1 Add a download handler mounted at the `/pdfs/:file` base in `apps/api/src/main.ts`
- [ ] 3.2 In the handler: resolve+verify the `customreport_session` cookie; respond 401 when absent/invalid/revoked/inactive
- [ ] 3.3 Parse `jobId` from the path, load the export job, read `status`, persisted `filePath`/`artifactUrl`, and bound `reportId`; respond 404 when the job is missing, the file is missing, the job `status !== 'completed'`, or the persisted artifact path does not match the requested `/pdfs/{jobId}.pdf` (the job row, not the filesystem, decides whether bytes may be served)
- [ ] 3.4 Apply the authorize predicate; respond 403 when the caller does not currently have role+scope read access to `job.reportId` (being the original `requestedBy` is not a standalone grant — D3)
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
- [ ] 4.7 Handler test: original requester whose report read access was revoked (e.g. viewer with `ViewerGroupAccess` removed) → 403, no bytes
- [ ] 4.8 Handler test: non-completed (pending/failed) job, or a row whose persisted artifact path mismatches the requested path, with a same-named file present on disk → 404, no bytes
- [ ] 4.9 Handler test: a PDF-export worker token in the `customreport_session` cookie → 401; dev-mode fallback does not authorize a `/pdfs` download

## 5. Verification

- [ ] 5.1 Confirm the only download consumer is `export-pdf-button.tsx` (`artifactUrl` stays `/pdfs/{jobId}.pdf`); no other reference relies on the static mount
- [ ] 5.2 Validate both Caddyfiles parse (`caddy validate` / `caddy fmt`)
- [ ] 5.3 Manually verify a direct host-port request to the artifact path is rejected without a session (P0-11 bypass closed)
- [ ] 5.4 Run `pnpm typecheck && pnpm lint && pnpm test` green
