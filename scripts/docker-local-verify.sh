#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
EVIDENCE_DIR="${ROOT_DIR}/.planning/regression/evidence/docker-compose-local"
COMPOSE=(docker compose -f docker-compose.yml -f docker-compose.dev.yml)

mkdir -p "${EVIDENCE_DIR}"
cd "${ROOT_DIR}"

log() {
  printf '[docker-local-verify] %s\n' "$*"
}

wait_for_url() {
  local name="$1"
  local url="$2"
  local attempts="${3:-90}"

  for ((i = 1; i <= attempts; i += 1)); do
    if curl -fsS "${url}" >/dev/null 2>&1; then
      log "${name}: ready"
      return 0
    fi
    sleep 1
  done

  log "${name}: not ready after ${attempts}s"
  return 1
}

dump_diagnostics() {
  {
    printf '## docker compose ps\n'
    "${COMPOSE[@]}" ps || true
    printf '\n## api logs\n'
    "${COMPOSE[@]}" logs --tail=200 api || true
    printf '\n## web logs\n'
    "${COMPOSE[@]}" logs --tail=200 web || true
  } >"${EVIDENCE_DIR}/failure-diagnostics.log"
}

trap 'dump_diagnostics' ERR

log 'build and start full local compose stack'
"${COMPOSE[@]}" up -d --build

wait_for_url 'api ready' 'http://localhost:3002/health/ready'
wait_for_url 'web root' 'http://localhost:3000/'
wait_for_url 'mailpit ui' 'http://localhost:8025/'

log 'wipe and reseed database inside api container'
"${COMPOSE[@]}" exec -T api sh -lc \
  'cd /app && PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION=да pnpm exec prisma migrate reset --force'
"${COMPOSE[@]}" exec -T api sh -lc 'cd /app && pnpm exec prisma db seed'

wait_for_url 'api ready after reseed' 'http://localhost:3002/health/ready'

TMP_DIR="$(mktemp -d)"
trap 'rm -rf "${TMP_DIR}"; dump_diagnostics' ERR
trap 'rm -rf "${TMP_DIR}"' EXIT

COOKIE_JAR="${TMP_DIR}/cookies.txt"
HEAD_HTML="${TMP_DIR}/head-dashboard.html"
DEV_FALLBACK_HEAD_HTML="${TMP_DIR}/dev-fallback-head-dashboard.html"
DEV_FALLBACK_ADMIN_HTML="${TMP_DIR}/dev-fallback-admin.html"
AUTH_JSON="${TMP_DIR}/auth-me.json"

log 'verify dev login through web container rewrite'
curl -fsSL \
  -c "${COOKIE_JAR}" \
  'http://localhost:3000/auth/dev-login?role=head&redirect=%2Fhead%2Fdashboard' \
  -o "${HEAD_HTML}"

grep -Eq 'Dashboard|Weekly Report|Lead Reports' "${HEAD_HTML}"

log 'verify dev fallback SSR role gate without cookie'
curl -fsS 'http://localhost:3000/head/dashboard' -o "${DEV_FALLBACK_HEAD_HTML}"
grep -q 'Dashboard' "${DEV_FALLBACK_HEAD_HTML}"
if grep -q 'Page unavailable for your role' "${DEV_FALLBACK_HEAD_HTML}"; then
  log 'head dashboard rendered forbidden page under dev fallback'
  exit 1
fi

curl -fsS 'http://localhost:3000/admin' -o "${DEV_FALLBACK_ADMIN_HTML}"
grep -q 'Admin Panel' "${DEV_FALLBACK_ADMIN_HTML}"
if grep -q 'Page unavailable for your role' "${DEV_FALLBACK_ADMIN_HTML}"; then
  log 'admin page rendered forbidden page under dev fallback'
  exit 1
fi

log 'verify authenticated tRPC through web container rewrite'
curl -fsS \
  -b "${COOKIE_JAR}" \
  'http://localhost:3000/trpc/auth.me?batch=1&input=%7B%220%22%3A%7B%7D%7D' \
  -o "${AUTH_JSON}"
grep -q '"role"' "${AUTH_JSON}"

{
  printf '## docker compose ps\n'
  "${COMPOSE[@]}" ps
  printf '\n## health\n'
  printf 'web=http://localhost:3000 -> '
  curl -s -o /dev/null -w '%{http_code}\n' 'http://localhost:3000/'
  printf 'api=http://localhost:3002/health/ready -> '
  curl -s -o /dev/null -w '%{http_code}\n' 'http://localhost:3002/health/ready'
  printf 'mailpit=http://localhost:8025 -> '
  curl -s -o /dev/null -w '%{http_code}\n' 'http://localhost:8025/'
  printf '\n## dev fallback SSR role gate\n'
  printf 'head_dashboard=pass\n'
  printf 'admin=pass\n'
  printf '\n## auth.me\n'
  cat "${AUTH_JSON}"
  printf '\n'
} >"${EVIDENCE_DIR}/verify.log"

log "PASS; evidence: ${EVIDENCE_DIR}"
