#!/usr/bin/env bash
# One-command full test run of the tester stand with evidence for performance review.
#   full-run.sh [--states returned|all|<list>] [--widths-full 1280] [--out <dir>] [--no-e2e] [--walk-args "<crawler args>"]
# Steps: start the stand when it is not running (start.sh, with the image already deployed) or when the
# collection of pg_stat_statements/auto_explain/statement log (Postgres) and V8 coverage (api) is off in
# values-tester.yaml, reset, walk --quick (all roles, 1280+375), walk --full for the chosen states
# (default: returned at 1280; "all" is the night mode, about 2 hours (7 x 16 min estimate)), the synthetic API scenario (handlers the
# crawler skips as dangerous), the human-like pass, collect api/web/postgres logs, coverage and
# statistics, build report.md, reset the stand again.
# Evidence: ~/.local/state/wr-tester/full-run-<time>/ (override with --out).
# e2e (pnpm test:e2e) is not run: it needs dev-login and dev.runtimeTarget on a source run (weeklyreport_e2e), the stand uses SAML;
# the e2e step only writes e2e.txt with this reason, and --no-e2e skips that note. Browser checks on the stand are walk.sh and this script.
set -euo pipefail
. "$(dirname "$0")/env.sh"

PG() { kubectl -n "$NS" exec -i postgres-0 -- psql -U weeklyreport -d weeklyreport_e2e -v ON_ERROR_STOP=1 -Atq "$@"; }

# Statistics snapshot as one JSON document (statements, tables, indexes).
SNAPSHOT_SQL="SELECT json_build_object(
 'statements', (SELECT coalesce(json_agg(s), '[]') FROM (SELECT query, calls, total_exec_time, mean_exec_time, max_exec_time, rows,
    shared_blks_hit, shared_blks_read FROM pg_stat_statements WHERE dbid = (SELECT oid FROM pg_database WHERE datname = current_database())) s),
 'tables', (SELECT coalesce(json_agg(t), '[]') FROM (SELECT relname, seq_scan, seq_tup_read, idx_scan,
    (xpath('/row/c/text()', query_to_xml(format('SELECT count(*) AS c FROM %I', relname), false, true, '')))[1]::text::int AS n_live_tup FROM pg_stat_user_tables) t),
 'indexes', (SELECT coalesce(json_agg(i), '[]') FROM (SELECT relname, indexrelname, idx_scan FROM pg_stat_user_indexes) i))"

next_seg() {
  local n=0
  [ -f "$WR_RUN_DIR/.seg" ] && n=$(cat "$WR_RUN_DIR/.seg")
  echo $((n + 1)) >"$WR_RUN_DIR/.seg"
  printf '%02d' "$n"
}

# hook-pre: runs inside reset.sh before the api is stopped and the database is wiped.
hook_pre() {
  local seg dir
  seg=$(next_seg)
  dir="$WR_RUN_DIR/segments"
  mkdir -p "$dir/cov-$seg"
  PG -c "CREATE EXTENSION IF NOT EXISTS pg_stat_statements" >/dev/null
  PG -c "$SNAPSHOT_SQL" >"$dir/stats-$seg.json"
  kubectl -n "$NS" logs deploy/api -c api >"$dir/api-$seg.log" 2>&1 || true
  # Plans of the heaviest statements on this segment's data, before the wipe.
  (cd "$REPO" && node --experimental-strip-types scripts/full-run/explain.ts "$dir/explain-$seg.json") || echo "explain failed for segment $seg" >&2
  # Prometheus counters: the only record of HTTP routes the access log hides (2xx/3xx are not logged).
  kubectl -n "$NS" exec deploy/api -c api -- node -e "fetch('http://localhost:3001/metrics').then(async r=>process.stdout.write(await r.text()))" >"$dir/metrics-$seg.txt" 2>/dev/null || true
  # Coverage is written when node exits: stop pid 1 gracefully, the container restarts in the same pod
  # and keeps the emptyDir.
  local before after
  before=$(kubectl -n "$NS" get pod -l app.kubernetes.io/component=api -o jsonpath='{.items[0].status.containerStatuses[?(@.name=="api")].restartCount}')
  kubectl -n "$NS" exec deploy/api -c api -- sh -c 'kill -TERM 1' || true
  for _ in $(seq 1 60); do
    after=$(kubectl -n "$NS" get pod -l app.kubernetes.io/component=api -o jsonpath='{.items[0].status.containerStatuses[?(@.name=="api")].restartCount}')
    [ "$after" != "$before" ] && break
    sleep 1
  done
  for _ in $(seq 1 60); do
    kubectl -n "$NS" exec deploy/api -c api -- tar cf - -C /app/data/pdfs/cov . 2>/dev/null | tar xf - -C "$dir/cov-$seg" 2>/dev/null && break
    sleep 2
  done
  kubectl -n "$NS" exec deploy/api -c api -- sh -c 'rm -rf /app/data/pdfs/cov/*' || true
  echo "Segment $seg collected: $(ls "$dir/cov-$seg" | wc -l | tr -d ' ') coverage files"
}

# hook-post: runs inside reset.sh right after migrate and seed: the extension is dropped with the schema.
hook_post() {
  PG -c "CREATE EXTENSION IF NOT EXISTS pg_stat_statements" -c "SELECT pg_stat_statements_reset()" -c "SELECT pg_stat_reset()" >/dev/null
}

case "${1:-}" in
  hook-pre) hook_pre; exit 0 ;;
  hook-post) hook_post; exit 0 ;;
esac

STATES=returned
WIDTHS_FULL=1280
OUT=""
E2E=1
WALK_ARGS=()
while [ $# -gt 0 ]; do
  case "$1" in
    --states) STATES=${2:?--states needs a value}; shift 2 ;;
    --widths-full) WIDTHS_FULL=${2:?--widths-full needs a value}; shift 2 ;;
    --out) OUT=${2:?--out needs a value}; shift 2 ;;
    --no-e2e) E2E=0; shift ;;
    --walk-args) read -r -a WALK_ARGS <<<"${2:?--walk-args needs a value}"; shift 2 ;; # pilot: e.g. "--roles lead --max-pages 3"
    *) echo "Usage: $0 [--states returned|all|<list>] [--widths-full 1280] [--out <dir>] [--no-e2e] [--walk-args \"...\"]" >&2; exit 2 ;;
  esac
done
[ "$STATES" = all ] && STATES=draft,submitted,returned,published,archived,closed,reopened

. "$HERE/guard.sh"
export WR_RUN_DIR=${OUT:-$STATE_DIR/full-run-$(date +%Y%m%d-%H%M%S)}
mkdir -p "$WR_RUN_DIR"
TIMINGS="$WR_RUN_DIR/timings.txt"
START=$(date +%s)
phase() { echo "$(date +%H:%M:%S) $*" | tee -a "$TIMINGS"; }
memory_wait() { # wait until at least 15 percent of memory is free
  local free
  for _ in $(seq 1 60); do
    free=$(memory_pressure | awk '/free percentage/ {gsub("%","",$5); print $5}')
    [ "${free:-100}" -ge 15 ] && return
    echo "Memory free ${free}%, waiting"; sleep 30
  done
}

# The stand runs and collects: otherwise start.sh brings it up with the image that is deployed now
# (a registry image of this commit may not exist yet), or with its default image when nothing is deployed.
collection_on() {
  PG -c 'SHOW shared_preload_libraries' 2>/dev/null | grep -q 'pg_stat_statements.*auto_explain' \
    && kubectl -n "$NS" exec deploy/api -c api -- printenv NODE_V8_COVERAGE >/dev/null 2>&1
}
ensure_stand() {
  collection_on && return
  local image start_args=()
  image=$(kubectl -n "$NS" get deploy/api -o jsonpath='{.spec.template.spec.containers[?(@.name=="api")].image}' 2>/dev/null || true)
  [ -z "$image" ] || start_args=(--registry "${image%/api:*}" --tag "${image##*:}")
  phase "start the stand (start.sh ${start_args[*]:-})"
  bash "$HERE/start.sh" "${start_args[@]+"${start_args[@]}"}"
  collection_on || { echo "Collection is still off after start.sh: check values-tester.yaml" >&2; exit 1; }
}
ensure_stand

tester_guard
SELF="$HERE/full-run.sh"
export WR_PRE_RESET_HOOK="bash '$SELF' hook-pre"
export WR_POST_RESET_HOOK="bash '$SELF' hook-post"

phase "observability settings are on (values-tester.yaml)"

phase "reset to the demo seed"
memory_wait
bash "$HERE/reset.sh" --yes
hook_post
PG -c "SELECT pg_rotate_logfile()" >/dev/null
sleep 2
for _ in $(seq 1 60); do
  [ "$(curl -s -o /dev/null -w '%{http_code}' "http://localhost:$APP_PORT/health/ready")" = 200 ] && break
  sleep 2
done

phase "walk --quick (all roles, 1280 + 375)"
memory_wait
bash "$HERE/walk.sh" --quick --out "$WR_RUN_DIR/quick" "${WALK_ARGS[@]+"${WALK_ARGS[@]}"}" || phase "quick walk exited non-zero"
phase "quick walk done; waiting for the rate-limit window"
sleep 70

phase "walk --full (states $STATES, widths $WIDTHS_FULL)"
memory_wait
bash "$HERE/walk.sh" --full --states "$STATES" --widths "$WIDTHS_FULL" --out "$WR_RUN_DIR/full" "${WALK_ARGS[@]+"${WALK_ARGS[@]}"}" || phase "full walk exited non-zero"

phase "synthetic API scenario (handlers the crawler skips as dangerous, run on the freshly reset stand)"
memory_wait
mkdir -p "$WR_RUN_DIR/scenarios"
(
  tester_lock
  trap tester_unlock EXIT
  cd "$REPO"
  node --experimental-strip-types scripts/ui-crawl/scenario.ts --url "http://localhost:$APP_PORT" \
    --secrets "$STATE_DIR/secrets.env" --out "$WR_RUN_DIR/scenarios" | tee "$WR_RUN_DIR/scenarios/scenario.log"
) || phase "scenario exited non-zero"
bash "$HERE/reset.sh" --yes # the scenario wrote: collect its api segment and return to the demo seed

phase "human-like pass (dogfood.sh, 4 roles, Jev as second judge)"
memory_wait
if [ -n "${TYPESAFE_API_KEY:-}" ]; then JEV_ARG=(); else JEV_ARG=(--no-jev); echo "TYPESAFE_API_KEY not set: Jev skipped" | tee -a "$TIMINGS"; fi
bash "$HERE/dogfood.sh" --out "$WR_RUN_DIR/dogfood" "${JEV_ARG[@]+"${JEV_ARG[@]}"}" || phase "dogfood exited non-zero"

phase "e2e"
if [ "$E2E" = 1 ]; then
  # e2e takes E2E_BASE_URL, but it still signs in through dev-login, calls dev.runtimeTarget and resets its own database; the SAML stand has none of these.
  echo "skipped: e2e needs dev auth and dev.runtimeTarget (the stand uses SAML); E2E_BASE_URL only retargets a dev-mode app" | tee "$WR_RUN_DIR/e2e.txt"
fi

phase "collect logs"
mkdir -p "$WR_RUN_DIR/logs"
kubectl -n "$NS" logs deploy/web >"$WR_RUN_DIR/logs/web.log" 2>&1 || true
kubectl -n "$NS" logs statefulset/postgres >"$WR_RUN_DIR/logs/postgres-stderr.log" 2>&1 || true
kubectl -n "$NS" exec postgres-0 -- cat /var/lib/postgresql/data/pgdata/log/wr-run.log >"$WR_RUN_DIR/logs/postgres-wr-run.log" 2>/dev/null || true
kubectl -n "$NS" logs deploy/edge >"$WR_RUN_DIR/logs/edge.log" 2>&1 || true

phase "final reset (collects the last api segment)"
bash "$HERE/reset.sh" --yes
unset WR_PRE_RESET_HOOK WR_POST_RESET_HOOK

phase "analysis"
(cd "$REPO/apps/api" && pnpm exec tsx scripts/list-procedures.ts >"$WR_RUN_DIR/procedures.json")
cd "$REPO"
node --experimental-strip-types scripts/full-run/analyze.ts "$WR_RUN_DIR"
END=$(date +%s)
phase "total $(((END - START) / 60)) min"
echo "Full run report: $WR_RUN_DIR/report.md"
