# Shared local target admission; stop must also work without a live API pod.
tester_target_guard() {
  local context
  context=$(kubectl config current-context) || return
  case "$context" in orbstack|docker-desktop) ;; *) echo "Refusing non-local context: $context" >&2; return 1 ;; esac
  case "$NS" in wr-tester | wr-tester-*) ;; *) echo "Synthetic writes require a wr-tester* namespace" >&2; return 1 ;; esac
  TESTER_CONTEXT=$context
}

tester_kubectl() {
  command kubectl --context="${TESTER_CONTEXT:?Run tester_target_guard first}" "$@"
}

# Additional runtime preflight for synthetic writes; source after env.sh.
tester_guard() {
  tester_target_guard || return
  tester_kubectl -n "$NS" exec deploy/api -- node -e '
    const u = new URL(process.env.DATABASE_URL);
    if (u.pathname !== "/weeklyreport_e2e" || !["pgbouncer", "postgres"].includes(u.hostname)) throw Error("Unknown tester database");
    if (process.env.REDIS_DB !== "15") throw Error("Tester stand must use Redis DB 15; redeploy current values-tester.yaml");
    if (process.env.SMTP_HOST !== "mailpit") throw Error("Tester SMTP must use Mailpit");
    if (process.env.REPORT_ASSISTANT_OUTBOUND_DATA_APPROVED !== "false") throw Error("Outbound assistant must be disabled");
    console.log("Verified tester runtime: weeklyreport_e2e, Redis DB 15, Mailpit, outbound assistant disabled");
  '
}

tester_lock() {
  local lock="$STATE_DIR/mutation.lock"
  if [ -n "${WR_TESTER_LOCK_OWNER:-}" ]; then
    [ -f "$lock/owner" ] && [ "$(cat "$lock/owner")" = "$WR_TESTER_LOCK_OWNER" ] && kill -0 "$WR_TESTER_LOCK_OWNER" 2>/dev/null \
      || { echo "Invalid inherited tester lock" >&2; return 1; }
    return
  fi
  mkdir "$lock" 2>/dev/null || { echo "Tester stand is busy: $lock" >&2; return 1; }
  printf '%s\n' "$$" >"$lock/owner"
  export WR_TESTER_LOCK_OWNER=$$
  TESTER_OWNS_LOCK=1
}

tester_unlock() {
  if [ "${TESTER_OWNS_LOCK:-0}" = 1 ]; then
    rm -f "$STATE_DIR/mutation.lock/owner"
    rmdir "$STATE_DIR/mutation.lock"
  fi
}
