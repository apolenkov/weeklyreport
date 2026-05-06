#!/usr/bin/env bash
# Phase 39-06 — pre-baseline DB primer for the visual project.
#
# Wipes the dev DB, re-runs migrations, and seeds with the deterministic
# `seed-simple` fixture. seed-simple uses hard-coded UUIDs and a current-
# week-anchored period so every screenshot run starts from the same DB
# state. Run this BEFORE `playwright test --project=visual` whenever a
# spec captures DB-derived data.
#
# Why not seed.ts? Advanced seed creates dozens of items + activity rows
# that vary on `randomUUID()` for some attachments. seed-simple is
# 100% deterministic.
#
# Usage:
#   pnpm --filter @customreport/web visual:setup
#
# Requires DATABASE_URL pointing at a database you DON'T mind wiping.

set -euo pipefail

# Resolve repo root (apps/web/scripts/ → ../../..).
REPO_ROOT="$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )/../../.." &> /dev/null && pwd )"

cd "${REPO_ROOT}"

echo "[visual-setup] resetting DB at ${DATABASE_URL:-<unset>}"
pnpm exec prisma migrate reset --force --skip-seed

echo "[visual-setup] running seed-simple (deterministic fixture)"
pnpm db:seed:simple

echo "[visual-setup] done — DB ready for visual baselines"
