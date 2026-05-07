# Docker Compose Ready Report — 2026-05-07

## Verdict

PASS for local full-container operation.

The local stack now runs web, API, PostgreSQL, Redis, and Mailpit through Docker
Compose. The verification path performs a destructive database reset, applies
all migrations, reseeds the advanced fixture, and checks authenticated access
through the containerized web app.

## Evidence

| Gate                                        | Result                                      |
| ------------------------------------------- | ------------------------------------------- |
| `pnpm docker:local:verify`                  | PASS                                        |
| Compose dev config                          | PASS                                        |
| Compose prod config                         | PASS                                        |
| API readiness                               | `http://localhost:3002/health/ready` -> 200 |
| Web root                                    | `http://localhost:3000/` -> 200             |
| Mailpit UI                                  | `http://localhost:8025/` -> 200             |
| Dev login through web rewrite               | PASS                                        |
| Authenticated `auth.me` through web rewrite | PASS                                        |
| Container regression                        | 179/179 PASS                                |
| `pnpm typecheck`                            | PASS                                        |
| `pnpm lint`                                 | PASS                                        |
| `pnpm test`                                 | PASS                                        |
| `pnpm build`                                | PASS                                        |

Primary evidence path:

```text
.planning/regression/evidence/docker-compose-local/verify.log
```

## Fixes Made

- Added `scripts/docker-local-verify.sh` and `pnpm docker:local:verify`.
- Fixed API Docker install order so Prisma schema exists before API postinstall.
- Added a dedicated `migrator` Docker target for Compose and future Kubernetes
  init jobs.
- Set container-native API URLs for Next.js SSR (`API_URL`) and browser rewrites
  (`NEXT_PUBLIC_API_URL`).
- Mounted PDF output consistently at `/app/data/pdfs`.
- Made local SMTP deterministic with Mailpit (`SMTP_HOST=mailhog`).
- Enabled local dev auth stub and role switcher in dev Compose.
- Made `dev.wipeAndReseed` a real reset + seed operation inside containers.
- Added advanced seed coverage for reminder rules and a complete 3-row priority
  fixture for the active Olga lead section.
- Reduced Docker build context back to ~155 KB by excluding Playwright result
  artifacts.

## Kubernetes Portability Notes

- API and web images are self-contained and service-addressable.
- Migrations are separated into the `migrator` target and can map to a
  Kubernetes Job or init container.
- Runtime state is isolated to explicit mounts:
  - Postgres data
  - Redis data
  - API logs
  - PDF artifacts at `/app/data/pdfs`
- Readiness and liveness endpoints are already available:
  - `/health/live`
  - `/health/ready`
- Internal service URLs are used for server-side calls and PDF rendering:
  - `API_URL=http://api:3001`
  - `PDF_BASE_URL=http://web:3000`

## Remaining External Production Dependencies

Local product readiness is confirmed with dev-login and Mailpit. Production
still depends on environment-specific SAML/Keycloak and real SMTP credentials.
Those are configuration dependencies, not local Docker blockers.
