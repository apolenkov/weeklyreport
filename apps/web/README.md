# @customreport/web

Next.js 16 frontend with App Router, React 19, shadcn/ui, and Tailwind CSS v4.

## Route inventory

| Route group                                                              | Roles                     | Purpose                                                        |
| ------------------------------------------------------------------------ | ------------------------- | -------------------------------------------------------------- |
| `/admin`, `/admin/{products,activities,settings}`                        | admin                     | Users, catalogues, periods, jobs, and settings                 |
| `/head/dashboard`, `/head/report/[reportId]`                             | head, admin               | Submission completeness, unified review, publication, export   |
| `/lead/report/[reportId]`                                                | lead, head, admin         | Structured section editing                                     |
| `/lead/report/[reportId]/preview`                                        | lead                      | Read-only lead preview                                         |
| `/reports`, `/reports/history`, `/reports/[reportId]`, `/reports/trends` | lead, head, admin, viewer | Published archive, detail, and trend analysis                  |
| `/reports/latest`                                                        | viewer                    | Viewer landing status                                          |
| `/head/report/[reportId]/present`                                        | head, admin               | Full-screen review presentation                                |
| `/reports/[reportId]/present`                                            | lead, head, admin, viewer | Full-screen published presentation                             |
| `/head/history`, `/head/slides`                                          | head, admin               | Head-scoped compatibility entrypoints                          |
| `/lead/history`                                                          | lead, head, admin         | Lead-history compatibility entrypoint                          |
| `/head/report`                                                           | head, admin               | Back-compatible alias resolving to a canonical report URL      |
| `/lead/report`                                                           | lead, head, admin         | Back-compatible alias resolving to a canonical report URL      |
| `/print/[reportId]`                                                      | export token              | Print source; human sessions are redirected to their role view |
| `/`, `/auth/error`                                                       | public/session-aware      | Sign-in dispatch and authentication failure UI                 |

## API Proxy

Next.js rewrites in `next.config.ts` proxy `/trpc/*`, `/auth/*`, `/health/*`,
`/api/*`, and `/pdfs/*` to the API server. This keeps cookies and browser
telemetry same-origin.

## Key Components

- `NavBar` — session-aware, role-filtered navigation and account controls
- `ReportSectionForm` — Full report editing form with autosave
- `AdminPanel` — Tabbed CRUD interface for admin entities
- `DataTable` — Sortable, accessible table with keyboard navigation

## Development

From the repository root, copy `.env.example` to `.env`, then run:

```bash
pnpm dev
```

The Web package scripts load the root `.env`, so native API and Web share one
environment contract. The canonical native ports are Web `3000` and API
`3002`. Docker-backed development uses `pnpm dev:watch` and supplies
container-internal origins.

## Testing

```bash
pnpm --filter @customreport/web test
```
