# @customreport/api

NestJS 11 backend with tRPC API, Prisma ORM, and JWT/SAML authentication.

## Modules

| Module            | Purpose                                                    |
| ----------------- | ---------------------------------------------------------- |
| `auth`            | SAML login/callback/logout, dev-login, JWT cookie sessions |
| `report-sections` | Lead report CRUD: getActive, saveDraft, submit             |
| `review`          | Head dashboard and assembled report views                  |
| `publication`     | Report publishing workflow                                 |
| `pdf-export`      | Async PDF generation via Playwright                        |
| `admin`           | User, project, period, reminder CRUD                       |
| `reminders`       | Email reminder rules and execution                         |
| `carry-over`      | Carry previous report data to next period                  |
| `archive`         | Published report history                                   |

## tRPC Routers

All API endpoints are tRPC procedures served at `/trpc`. Authentication uses `protectedProcedure` (any role) or `headProcedure` (head-only).

## Development

From the repository root, copy `.env.example` to `.env`, then run:

```bash
pnpm dev
```

The canonical native ports are API `3002` and web `3000`. The API environment
is validated at boot; missing required values fail closed. For Docker-backed
development use `pnpm dev:watch`.

## Testing

```bash
pnpm --filter @customreport/api test
pnpm --filter @customreport/api test:integration  # requires .env.test and DB/Redis15
```
