# @customreport/web

Next.js 16 frontend with App Router, React 19, shadcn/ui, and Tailwind CSS v4.

## Route inventory

| Route group                                          | Roles                     | Purpose                                                        |
| ---------------------------------------------------- | ------------------------- | -------------------------------------------------------------- |
| `/admin`                                             | admin                     | Users, catalogues, periods, jobs, and settings                 |
| `/head/dashboard`, `/head/report/[reportId]`         | head, admin               | Submission completeness, unified review, publication, export   |
| `/head/report`                                       | head, admin               | Current head report entrypoint                                 |
| `/lead/report/[reportId]`                            | lead, head, admin         | Structured section editing                                     |
| `/lead/report`                                       | lead, head, admin         | Current lead report entrypoint                                 |
| `/lead/report/[reportId]/preview`                    | lead                      | Read-only lead preview                                         |
| `/reports`, `/reports/[reportId]`, `/reports/trends` | lead, head, admin, viewer | Published archive, detail, and trend analysis                  |
| `/reports/latest`                                    | viewer                    | Viewer landing status                                          |
| `/print/[reportId]`                                  | export token              | Print source; human sessions are redirected to their role view |
| `/`, `/auth/error`                                   | public/session-aware      | Sign-in dispatch and authentication failure UI                 |

## API Proxy

Next.js owns the local `/api/client-logs` admission proxy and
`/api/revalidate-org` cache-invalidation handler. After those route handlers,
the rewrites in `next.config.ts` proxy `/trpc/*`, `/auth/*`, `/health/*`, the
remaining `/api/*`, and `/pdfs/*` to the API server. This keeps cookies and
browser telemetry same-origin. In production Caddy sends the API-owned client
log path directly to the API and leaves cache invalidation on Web.

## Main UI surfaces

- `shared/ui/navigation` — session-aware, role-filtered navigation
- `features/report-pages` — lead, head, and weekly report page composition
- `features/report-sections` — lead editing, autosave, submit, and record cards
- `features/admin/ui/admin-panel.tsx` — administration workspace
- `shared/ui/report-shell` — shared report controls and section chrome

## Development

From the repository root, copy `.env.example` to `.env`, then run:

```bash
pnpm dev
```

The Web package scripts load the root `.env`, so native API and Web share one
environment contract. The canonical native ports are Web `3000` and API
`3002`.

The bare `/head/report` and `/lead/report` paths are current landing
entrypoints. The page resolves the current editable report through the
`weeklyReport.get` API query with no explicit `reportId`, then redirects to its
canonical report URL; it does not use the session's `activeReportId` as the
source of truth.

## Testing

```bash
pnpm --filter @customreport/web test
```
