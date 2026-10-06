#!/usr/bin/env bash
# Build the four stand images on this machine (no registry needed), then start the stand.
#   build-images.sh [--tag <git-sha>]      default tag = HEAD of this checkout
# Needs Docker. The first build takes 10-15 minutes and downloads packages, so it needs network.
set -euo pipefail
. "$(dirname "$0")/env.sh"

TAG=""
while [ $# -gt 0 ]; do
  case "$1" in
    --tag) TAG=${2:?--tag needs a value}; shift 2 ;;
    *) echo "Usage: $0 [--tag <git-sha>]" >&2; exit 2 ;;
  esac
done
command -v docker >/dev/null || { echo "Missing tool: docker" >&2; exit 1; }
[ -n "$TAG" ] || TAG=$(git -C "$REPO" rev-parse HEAD)
cd "$REPO"

build() { docker build -q --build-arg BUILD_VERSION="$TAG" "$@" >/dev/null; }

echo "Building wr/{api,migrate,web,backup}:$TAG ..."
build -f Dockerfile.api -t "wr/api:$TAG" .
build -f Dockerfile.api --target migrator -t "wr/migrate:$TAG" .
build -f Dockerfile.web -t "wr/web:$TAG" \
  --build-arg API_URL=http://api:3001 \
  --build-arg NEXT_PUBLIC_AUTH_STUB=false \
  --build-arg NEXT_PUBLIC_DEV_ROLE_SWITCHER=false \
  --build-arg NEXT_PUBLIC_APP_VERSION="$TAG" \
  --build-arg NEXT_PUBLIC_CLIENT_LOG_FORWARDING=false \
  --build-arg NEXT_PUBLIC_WEB_VITALS=false \
  --build-arg NEXT_PUBLIC_PRODUCT_FEEDBACK_ENABLED=false \
  --build-arg NEXT_PUBLIC_PRODUCT_FEEDBACK_INBOX_ROLES=admin .
build -f deploy/postgres/Dockerfile.backup -t "wr/backup:$TAG" deploy/postgres

# A failed network at build time can leave the Prisma schema engine out of the migrate image;
# the stand then fails on migration. Rebuild its dependency layer once if it is missing.
engine_present() {
  docker run --rm --entrypoint sh "wr/migrate:$TAG" \
    -c 'ls /app/node_modules/.pnpm/@prisma+engines@*/node_modules/@prisma/engines | grep -q schema-engine'
}
if ! engine_present; then
  echo "Prisma schema engine missing in wr/migrate; rebuilding its dependency layer ..."
  build -f Dockerfile.api --target migrator --no-cache-filter migrator-deps -t "wr/migrate:$TAG" .
  engine_present || { echo "Prisma schema engine is still missing: check the network and re-run." >&2; exit 1; }
fi
echo "Done. Start the stand: deploy/tester-kit/start.sh --tag $TAG"
