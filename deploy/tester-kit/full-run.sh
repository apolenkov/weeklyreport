#!/usr/bin/env bash
# One-command full test run of the tester stand with evidence for performance review.
#   full-run.sh [--states returned|all|<list>] [--widths-full 1280] [--out <dir>] [--no-e2e] [--walk-args "<crawler args>"]
# Steps: enable pg_stat_statements/auto_explain/statement log in Postgres and V8 coverage in the api pod
# (kubectl patches, no product change), reset, walk --quick (all roles, 1280+375), walk --full for the
# chosen states (default: returned at 1280; "all" is the 6-7 hour night mode), collect api/web/postgres
# logs, coverage and statistics, build report.md, reset the stand again.
# Evidence: ~/.local/state/wr-tester/full-run-<time>/ (override with --out).
set -euo pipefail
. "$(dirname "$0")/env.sh"

PG() { kubectl -n "$NS" exec -i postgres-0 -- psql -U customreport -d customreport_e2e -v ON_ERROR_STOP=1 -Atq "$@"; }

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
    kubectl -n "$NS" exec deploy/api -c api -- tar cf - -C /cov . 2>/dev/null | tar xf - -C "$dir/cov-$seg" 2>/dev/null && break
    sleep 2
  done
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

tester_guard
SELF="$HERE/full-run.sh"
export WR_PRE_RESET_HOOK="bash '$SELF' hook-pre"
export WR_POST_RESET_HOOK="bash '$SELF' hook-post"

phase "enable observability"
# Postgres: preload libraries, statement log and auto_explain through ALTER SYSTEM, then restart the pod.
if ! PG -c 'SHOW shared_preload_libraries' | grep -q 'pg_stat_statements.*auto_explain' \
  || [ "$(PG -c 'SHOW logging_collector')" != on ]; then
  PG -c "ALTER SYSTEM SET shared_preload_libraries = pg_stat_statements, auto_explain" -c "ALTER SYSTEM SET logging_collector = on"
  kubectl -n "$NS" delete pod postgres-0 --wait=true >/dev/null
  kubectl -n "$NS" rollout status statefulset/postgres --timeout=300s
  until PG -c 'SELECT 1' >/dev/null 2>&1; do sleep 2; done
fi
# The settings of the preloaded libraries exist only after the restart.
PG <<'SQL'
ALTER SYSTEM SET pg_stat_statements.track = 'all';
ALTER SYSTEM SET auto_explain.log_min_duration = '50ms';
ALTER SYSTEM SET auto_explain.log_analyze = off;
ALTER SYSTEM SET auto_explain.log_format = 'json';
ALTER SYSTEM SET auto_explain.log_nested_statements = on;
ALTER SYSTEM SET log_directory = 'log';
ALTER SYSTEM SET log_filename = 'wr-run.log';
ALTER SYSTEM SET log_truncate_on_rotation = on;
ALTER SYSTEM SET log_rotation_age = 0;
ALTER SYSTEM SET log_rotation_size = 0;
ALTER SYSTEM SET log_line_prefix = '%m [%p] ';
ALTER SYSTEM SET log_statement = 'all';
SELECT pg_reload_conf();
SQL
# Api: V8 coverage into an emptyDir (the chart has no extension point; the patch is idempotent).
if ! kubectl -n "$NS" get deploy api -o json | grep -q NODE_V8_COVERAGE; then
  kubectl -n "$NS" patch deploy api --type=json -p '[
   {"op":"add","path":"/spec/template/spec/volumes/-","value":{"name":"cov","emptyDir":{}}},
   {"op":"add","path":"/spec/template/spec/containers/0/volumeMounts/-","value":{"name":"cov","mountPath":"/cov"}},
   {"op":"add","path":"/spec/template/spec/containers/0/env/-","value":{"name":"NODE_V8_COVERAGE","value":"/cov"}}]' >/dev/null
  kubectl -n "$NS" rollout status deploy/api --timeout=300s
fi

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

phase "e2e"
if [ "$E2E" = 1 ]; then
  # e2e/setup hard-codes http://localhost:3000, dev.runtimeTarget and its own database reset; it cannot target this stand.
  echo "skipped: e2e/setup has no base-URL parameter and needs dev auth (the stand uses SAML)" | tee "$WR_RUN_DIR/e2e.txt"
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
