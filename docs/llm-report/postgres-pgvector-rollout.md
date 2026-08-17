# PostgreSQL and pgvector image inventory

The repository uses the official `pgvector/pgvector` PostgreSQL 15 image at
the explicit `0.8.2-pg15-bookworm` release tag. Production additionally pins
the verified multi-platform manifest digest in `docker-compose.prod.yml`. The
Debian Bookworm variant is intentional: the PostgreSQL major version stays 15
while the image supplies the `vector` extension required by the semantic cache.
The same init migration also owns the feature-scoped AI prompt control,
immutable prompt revision, and exact evaluation tables. Disposable reset/seed
paths must create the Report Assistant baseline idempotently; prompt state is
not supplied by environment values at runtime.

| Environment             | Tracked image/configuration                                                          | Database name                                                            | Data lifecycle                                        |
| ----------------------- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------ | ----------------------------------------------------- |
| Local development       | `docker-compose.yml` and `docker-compose.dev.yml` overlay                            | `customreport_dev`                                                       | Disposable named `pgdata` volume                      |
| CI integration/E2E      | `.github/workflows/ci.yml` E2E service                                               | `customreport_test`                                                      | Disposable service container                          |
| CI migration-reset gate | `.github/workflows/ci.yml` reset service                                             | `customreport_reset_check`                                               | Disposable service container                          |
| CI visual regression    | `.github/workflows/ci.yml` visual service                                            | `customreport_visual`                                                    | Disposable service container                          |
| UAT                     | No separate tracked Compose image; the Playwright runner supplies `E2E_DATABASE_URL` | Must be a dedicated non-production database, normally `customreport_e2e` | Operator-managed; never point it at dev or production |
| Production              | `docker-compose.prod.yml` `postgres` service                                         | `customreport`                                                           | Non-disposable named `pgdata` volume                  |

The local, CI, and production database names are unchanged by the image
upgrade. The non-local destructive-operation guard continues to require an
explicit non-production suffix; production remains unsuffixed and is never a
reset target.

## Volume and backup verification

Before changing a non-disposable environment, the operator MUST:

1. Record the current image digest, PostgreSQL server version, extension list,
   volume name, and volume mount source.
2. Take a restorable logical backup and verify that the backup can be listed or
   restored in a disposable PostgreSQL 15 clone before changing the production
   image.
3. Confirm the storage snapshot/PITR recovery point and the rollback image are
   available to the on-call operator.
4. Start the replacement image against a cloned volume first. Verify
   `SELECT current_setting('server_version_num')`, `SELECT extversion FROM
pg_extension WHERE extname = 'vector'`, and the existing application health
   checks before touching the real volume.
5. Apply the extension/table migration through the direct PostgreSQL connection
   after the image is healthy. PgBouncer is not a DDL path.
6. Keep the backup and rollback evidence with the deployment record; do not
   delete or reinitialize the production volume to make the image start.

The UAT target is not provisioned by this repository, so its deployment
manifest must pin the same PostgreSQL 15 pgvector-compatible image and provide
the backup/restore evidence before task 4.6 or a production-like rollout is
considered complete.

## Disposable reset verification

On 2026-08-04, an isolated `customreport_reset_test` database was reset with
the edited init migration using the pinned image. The check confirmed
pgvector 0.8.2, a three-dimensional vector round-trip, and the
`SemanticEmbedding_vector_dimensions_check` constraint. The repository's
production-looking target tests also passed. The temporary container and
database were removed afterward.

Production reset remains forbidden. If production already recorded the edited
init migration, stop before deployment and use the reviewed additive migration
path described in task 4.6; never reset production or rewrite its migration
history.

Run the read-only ledger check before a rollout, with both values explicit:

```bash
MIGRATION_TARGET_ENV=production \
DATABASE_URL="$PRODUCTION_DIRECT_DATABASE_URL" \
pnpm db:check-init-target
```

An uninitialized disposable target reports `apply_edited_init`. An already
initialized production target exits non-zero with `stop_for_additive_migration`;
the operator must then create and review a forward migration containing the
same extension/table/check DDL before deploying application code.
