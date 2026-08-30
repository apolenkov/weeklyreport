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
`3002`.

The bare `/head/report` and `/lead/report` paths are current landing
entrypoints. The application resolves the
active report from the current session.

## Testing

```bash
pnpm --filter @customreport/web test
```
