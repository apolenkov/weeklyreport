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

```bash
cp .env.example .env
docker compose up -d postgres redis mailhog
pnpm dev
```

The API runs on `http://localhost:3002`. `.env.example` is the complete
development configuration; it includes the required AI, PDF, Redis, telemetry,
and health-check settings, so do not replace it with a partial inline command.

## Testing

```bash
pnpm test
```
