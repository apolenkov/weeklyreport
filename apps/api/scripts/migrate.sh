#!/usr/bin/env sh
# Production-migration entrypoint: runs `prisma migrate deploy` then exits.
# Used as a one-shot init-container in docker-compose.prod.yml; reusable as a
# Helm chart init-container later. Keeping the migration concern out of the API
# process means rolling restarts never re-run migrations, failed migrations
# don't crash-loop the API container, and one Dockerfile.api image serves both
# the API and migrate roles.
#
# Required env: DATABASE_URL (the migrate command pulls it from process.env).

set -eu

echo "[migrate] running prisma migrate deploy..."
exec pnpm exec prisma migrate deploy
