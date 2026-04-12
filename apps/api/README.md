# @customreport/api

NestJS 11 backend with tRPC API, Prisma ORM, and JWT/SAML authentication.

## Modules

| Module | Purpose |
|--------|---------|
| `auth` | SAML login/callback/logout, dev-login, JWT cookie sessions |
| `report-sections` | Lead report CRUD: getActive, saveDraft, submit |
| `review` | Head dashboard and assembled report views |
| `publication` | Report publishing workflow |
| `pdf-export` | Async PDF generation via Playwright |
| `admin` | User, project, period, reminder CRUD |
| `reminders` | Email reminder rules and execution |
| `carry-over` | Carry previous report data to next period |
| `archive` | Published report history |

## tRPC Routers

All API endpoints are tRPC procedures served at `/trpc`. Authentication uses `protectedProcedure` (any role) or `headProcedure` (head-only).

## Development

```bash
DATABASE_URL="postgresql://customreport:localdev@localhost:5432/customreport" \
AUTH_DEV_MODE=true AUTH_JWT_SECRET="local-dev-secret-minimum-32-characters-long!!" \
REDIS_HOST=localhost REDIS_PORT=6379 FRONTEND_URL=http://localhost:3000 PORT=3001 \
pnpm dev
```

## Testing

```bash
pnpm test    # 68 Vitest tests across 9 service modules
```
