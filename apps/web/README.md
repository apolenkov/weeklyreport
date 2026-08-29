# @customreport/web

Next.js 16 frontend with App Router, React 19, shadcn/ui, and Tailwind CSS v4.

## Pages

| Route                             | Roles                       | Purpose                                    |
| --------------------------------- | --------------------------- | ------------------------------------------ |
| `/lead/report/[reportId]`         | lead, head, admin           | Owned structured section editing           |
| `/lead/report/[reportId]/preview` | lead                        | Read-only lead preview                     |
| `/head/dashboard`                 | head, admin                 | Submission completeness and review queue   |
| `/head/report/[reportId]`         | head, admin                 | Unified review, publication, and export    |
| `/admin`                          | admin                       | Users, products, activities, periods, jobs |
| `/reports`, `/reports/[reportId]` | lead, head, admin, viewer   | Published report archive and detail        |
| `/reports/latest`                 | viewer                      | Viewer landing status                      |
| `/reports/trends`                 | lead, head, admin, viewer   | Published trend analysis                   |
| `/print/[reportId]`               | authenticated export worker | Print-optimized PDF source                 |

## API Proxy

Next.js rewrites in `next.config.ts` proxy `/trpc/*` and `/auth/*` to the API server. This keeps all cookies same-origin — no CORS issues.

## Key Components

- `NavBar` — session-aware, role-filtered navigation and account controls
- `ReportSectionForm` — Full report editing form with autosave
- `AdminPanel` — Tabbed CRUD interface for admin entities
- `DataTable` — Sortable, accessible table with keyboard navigation

## Development

From the repository root, copy `.env.example` to `.env` and set
`NEXT_PUBLIC_API_URL=http://localhost:3002` in `apps/web/.env.local`, then run:

```bash
pnpm dev
```

The canonical native ports are web `3000` and API `3002`. Docker-backed
development uses `pnpm dev:watch` and supplies container-internal origins.

## Testing

```bash
pnpm --filter @customreport/web test
```
