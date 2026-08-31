# @customreport/api

NestJS 11 backend with tRPC API, Prisma ORM, and JWT/SAML authentication.

## Modules

| Module             | Purpose                                                   |
| ------------------ | --------------------------------------------------------- |
| `activity`         | Live per-report activity status feed                      |
| `admin`            | Users, groups, products, periods, reminders, and settings |
| `analytics`        | Scoped report analytics                                   |
| `archive`          | Published report history                                  |
| `auth`             | SAML, dev login, JWT sessions, and role context           |
| `carry-over`       | Carry unfinished records into the current period          |
| `email`            | Reminder and notification delivery                        |
| `observability`    | Web Vitals ingestion                                      |
| `organization`     | Organization singleton and public identity                |
| `pdf-export`       | Published-snapshot PDF generation                         |
| `period`           | Period lifecycle, scheduling, and automation              |
| `project-activity` | Admin activity provisioning and catalogue CRUD            |
| `publication`      | Atomic publication and immutable snapshots                |
| `reminders`        | Reminder policy evaluation and execution                  |
| `report-sections`  | Lead drafts, submission, and report assembly              |
| `review`           | Verdicts, comments, acknowledgements, and reopen requests |
| `search`           | Scoped published-content search                           |
| `telemetry`        | Scoped operational telemetry reads                        |
| `weekly-report`    | Current and published weekly read models                  |

## tRPC Routers

All product RPC procedures are served at `/trpc`. Every router procedure uses
one of the six canonical builders exported by
`src/infrastructure/trpc/trpc.middleware.ts`; each builder owns its exact role
and scope middleware chain. Conventional HTTP surfaces own authentication,
health, metrics, browser telemetry/log admission, the Bull Board, and PDF
artifact delivery.

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
