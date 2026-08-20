# @customreport/web

Next.js 16 frontend with App Router, React 19, shadcn/ui, and Tailwind CSS v4.

## Pages

| Route                 | Role | Component                                                               |
| --------------------- | ---- | ----------------------------------------------------------------------- |
| `/lead/report`        | lead | ReportSectionForm — traffic lights, items, risks, decisions, priorities |
| `/head/dashboard`     | head | Review dashboard with lead submission status                            |
| `/head/report`        | head | Assembled report with publish action                                    |
| `/admin`              | head | AdminPanel — users, projects, periods, reminders (tabbed CRUD)          |
| `/reports/history`    | any  | Published report archive with DataTable                                 |
| `/reports/[id]`       | any  | Single report detail                                                    |
| `/reports/[id]/print` | any  | Print-optimized layout for PDF export                                   |

## API Proxy

Next.js rewrites in `next.config.ts` proxy `/trpc/*`, `/auth/*`, `/health/*`,
`/api/*`, and `/pdfs/*` to the API server. This keeps all cookies same-origin.

## Key Components

- `AppShell` — SidebarProvider + role-based navigation + header
- `ReportSectionForm` — Full report editing form with autosave
- `AdminPanel` — Tabbed CRUD interface for admin entities
- `DataTable` — Sortable, accessible table with keyboard navigation

## Development

```bash
NEXT_PUBLIC_API_URL=http://localhost:3002 pnpm dev
```

## E2E Testing

```bash
# Requires E2E_DATABASE_URL distinct from DATABASE_URL.
pnpm test:e2e:integration
```
