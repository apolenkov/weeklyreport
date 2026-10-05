#!/usr/bin/env bash
# UI crawl of the tester stand: every role (lead, head, viewer, admin) at 1280 and 375 px.
# Presses each visible safe control, records screenshots, console, network errors, axe,
# geometry and a video per run. Dangerous actions (delete/publish/submit/archive/reopen...)
# are skipped and listed with the reason. The crawl changes data: run reset.sh afterwards.
#   walk.sh [--reset] [--url <base-url>] [--out <dir>] [--roles lead,head] [--widths 1280,375]
#           [--max-controls <n>] [--max-pages <n>]
# Default output: ~/.local/state/wr-tester/crawl-<time>/ (report.md, report.json, shots/, video/).
set -euo pipefail
. "$(dirname "$0")/env.sh"

RESET=0
ARGS=()
for a in "$@"; do
  if [ "$a" = --reset ]; then RESET=1; else ARGS+=("$a"); fi
done

for tool in node agent-browser ffmpeg; do
  command -v "$tool" >/dev/null || { echo "Missing tool: $tool (see README.md)" >&2; exit 1; }
done
[ -f "$STATE_DIR/secrets.env" ] || { echo "No $STATE_DIR/secrets.env. Run start.sh first." >&2; exit 1; }
[ -d "$REPO/node_modules" ] || (cd "$REPO" && pnpm install --frozen-lockfile)
pf_start app edge "$APP_PORT" 8080
pf_start keycloak keycloak "$KC_PORT" 8080

OUT="$STATE_DIR/crawl-$(date +%Y%m%d-%H%M%S)"
case " ${ARGS[*]:-} " in *" --out "*) OUT="" ;; esac
cd "$REPO"
node --experimental-strip-types scripts/ui-crawl/crawl.ts \
  --url "http://localhost:$APP_PORT" --secrets "$STATE_DIR/secrets.env" \
  ${OUT:+--out "$OUT"} "${ARGS[@]+"${ARGS[@]}"}"

if [ "$RESET" = 1 ]; then bash "$HERE/reset.sh" --yes; fi
