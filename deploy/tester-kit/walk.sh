#!/usr/bin/env bash
# UI crawl of the tester stand: every role (lead, head, viewer, admin) at 1280 and 375 px.
# Presses each visible safe control, records screenshots, console, network errors, axe,
# geometry and a video per run. Dangerous actions (delete/publish/submit/archive/reopen...)
# are skipped and listed with the reason. The crawl changes data: run reset.sh afterwards.
#   walk.sh [--quick] [--reset] [--url <base-url>] [--out <dir>] [--roles lead,head] [--widths 1280,375]
#           [--max-controls <n>] [--max-pages <n>]
#   walk.sh --full [--states draft,submitted,...] [--roles ...] [--widths ...] [--max-depth <n>] [--out <dir>]
# --quick (default) presses the first level of every page in minutes. --full recurses into every
# surface it opens (dialogs, menus, tabs, disclosures) up to --max-depth (default 3), visits each
# admin tab as a page, walks every page of every role in each prepared demo state
# (draft, submitted, returned, published, archived, closed, reopened), covers filters pairwise and
# writes coverage per page and an element x state matrix. Each state is prepared by reset.sh on the
# guarded synthetic database; a final synthetic pass runs the lifecycle actions on that state's
# prepared report; the stand is reset to the demo seed at the end, also after a failure. The admin
# tabs follow the report lifecycle only in Periods and Reopen: admin walks every tab in the first state
# and just those two in the others.
# Default output: ~/.local/state/wr-tester/crawl-<time>/ (report.md, report.json, shots/, video/).
set -euo pipefail
. "$(dirname "$0")/env.sh"

RESET=0
FULL=0
STATES=draft,submitted,returned,published,archived,closed,reopened
ARGS=()
ROLES=lead,head,viewer,admin
OUT=""
while [ $# -gt 0 ]; do
  case "$1" in
    --reset) RESET=1; shift ;;
    --full) FULL=1; shift ;;
    --quick) shift ;;
    --states) STATES=${2:?--states needs a value}; shift 2 ;;
    --out) OUT=${2:?--out needs a value}; shift 2 ;;
    --out=*) OUT=${1#--out=}; : "${OUT:?--out needs a value}"; shift ;;
    --roles) ROLES=${2:?--roles needs a value}; shift 2 ;;
    *) ARGS+=("$1"); shift ;;
  esac
done

for tool in node agent-browser ffmpeg; do
  command -v "$tool" >/dev/null || { echo "Missing tool: $tool (see README.md)" >&2; exit 1; }
done
[ -f "$STATE_DIR/secrets.env" ] || { echo "No $STATE_DIR/secrets.env. Run start.sh first." >&2; exit 1; }
[ -d "$REPO/node_modules" ] || (cd "$REPO" && pnpm install --frozen-lockfile)
pf_start app edge "$APP_PORT" 8080
pf_start keycloak keycloak "$KC_PORT" 8080

cd "$REPO"
if [ "$FULL" = 0 ]; then
  OUT=${OUT:-$STATE_DIR/crawl-$(date +%Y%m%d-%H%M%S)}
  crawl_result=0
  node --experimental-strip-types scripts/ui-crawl/crawl.ts --quick --roles "$ROLES" \
    --url "http://localhost:$APP_PORT" --secrets "$STATE_DIR/secrets.env" \
    --out "$OUT" "${ARGS[@]+"${ARGS[@]}"}" || crawl_result=$?
  if [ "$RESET" = 1 ]; then
    reset_result=0
    bash "$HERE/reset.sh" --yes || reset_result=$?
    if [ "$reset_result" != 0 ]; then
      echo "Requested reset failed with exit $reset_result (crawl exit $crawl_result)" >&2
      [ "$crawl_result" != 0 ] || crawl_result=$reset_result
    fi
  fi
  exit "$crawl_result"
fi

. "$HERE/guard.sh"
OUT=${OUT:-$STATE_DIR/crawl-full-$(date +%Y%m%d-%H%M%S)}
mkdir -p "$OUT"
tester_guard
tester_lock
FAILED=0
cleanup() {
  local result=$?
  trap - EXIT
  echo "Final reset to the demo seed"
  bash "$HERE/reset.sh" --yes || result=1
  tester_unlock || result=1
  exit "$result"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

export CRAWL_SYNTHETIC_ORIGIN="http://localhost:$APP_PORT"
crawl() { # crawl <state> <pass> <manifest> <extra args...>
  local state=$1 pass=$2 manifest=$3
  shift 3
  # The pass directory exists before the crawler can fail, so the merge reports it as missing.
  mkdir -p "$OUT/state-$state/$pass"
  node --experimental-strip-types scripts/ui-crawl/crawl.ts --full \
    --url "$CRAWL_SYNTHETIC_ORIGIN" --secrets "$STATE_DIR/secrets.env" \
    --fixture-manifest "$manifest" --out "$OUT/state-$state/$pass" \
    "${ARGS[@]+"${ARGS[@]}"}" "$@" || FAILED=1
}

# Admin tabs do not depend on the report lifecycle (except Periods and Reopen): every role walks every
# state, admin walks all tabs in the first state only and just those two tabs in the others.
without_admin() { echo ",$1," | sed 's/,admin,/,/; s/^,//; s/,$//'; }
IFS=, read -r -a STATE_LIST <<<"$STATES"
FIRST=1
for state in "${STATE_LIST[@]}"; do
  manifest="$OUT/fixtures/$state.json"
  echo "== state: $state"
  bash "$HERE/reset.sh" --yes --crawl-state "$state" --manifest "$manifest"
  # read pass: nothing is written; every role at every width
  READ_ROLES=$ROLES
  [ "$FIRST" = 1 ] || READ_ROLES=$(without_admin "$ROLES")
  FIRST=0
  [ -z "$READ_ROLES" ] || crawl "$state" read "$manifest" --roles "$READ_ROLES"
  case ",$ROLES," in
    *,admin,*) [ "$READ_ROLES" = "$ROLES" ] || crawl "$state" read-admin "$manifest" --roles admin --admin-state-tabs --max-pages 2 ;;
  esac
  # synthetic pass: Lead and Head run the lifecycle actions on the prepared report, last in this state
  SYNTH_ROLES=$(echo ",$ROLES," | tr ',' '\n' | { grep -xE 'lead|head' || true; } | paste -sd, -)
  [ -z "$SYNTH_ROLES" ] || crawl "$state" synthetic "$manifest" --synthetic --roles "$SYNTH_ROLES" --widths 1280
done
node --experimental-strip-types scripts/ui-crawl/merge.ts "$OUT" || FAILED=1
echo "Full walk report: $OUT/report.md"
exit "$FAILED"
