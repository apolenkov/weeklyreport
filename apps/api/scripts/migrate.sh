#!/usr/bin/env sh
# 38-01 production-migration entrypoint.
#
# Runs `prisma migrate deploy` then exits. Used as a one-shot init-container
# in docker-compose.prod.yml; reusable as a Helm chart init-container later.
# Keeping the migration concern out of the API process means:
#   - rolling restarts of the API never re-run migrations (idempotent but slow)
#   - failed migrations don't crash-loop the API container
#   - the same Dockerfile.api image serves both API + migrate roles
#
# Required env: DATABASE_URL (the migrate command pulls it from process.env).

set -eu

echo "[migrate] running prisma migrate deploy..."
exec npx prisma migrate deploy
